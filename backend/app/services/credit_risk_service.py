from __future__ import annotations

import logging
import uuid
from datetime import date, datetime, timezone, timedelta
from typing import Any, Dict, Optional

from fastapi import HTTPException, status
from sqlalchemy import case, func
from sqlalchemy.orm import Session

from app.core.ml_manager import get_credit_risk_predictor
from app.models.customer import Customer
from app.models.credit_sale import CreditSale
from app.models.transaction import Transaction
from app.models.enums import CreditStatus, PaymentType, RiskLevel, TransactionType
from app.models.credit_prediction import CreditPrediction
from app.schemas.credit_risk import CreditRiskPredictRequest

logger = logging.getLogger(__name__)

DAYS_WINDOW = 30

def _get_predictor():
    predictor = get_credit_risk_predictor()
    if predictor is None:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Credit risk model is not loaded. Contact the system administrator.",
        )
    return predictor

def _get_customer_or_404(db: Session, shop_id: uuid.UUID, customer_id: uuid.UUID) -> Customer:
    customer = db.query(Customer).filter(
        Customer.id == customer_id,
        Customer.shop_id == shop_id,
        Customer.is_active == True,
    ).first()
    if not customer:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Customer {customer_id} not found in shop {shop_id}",
        )
    return customer

def _compute_features_from_db(db: Session, customer: Customer) -> Dict[str, Any]:
    now = datetime.now(timezone.utc).replace(tzinfo=None)
    cutoff_30d = now - timedelta(days=DAYS_WINDOW)
    customer_id = customer.id

    relationship_days = max(0, (now - customer.created_at).days)

    is_credit = Transaction.payment_type == PaymentType.CREDIT
    recent_agg = db.query(
        func.count(Transaction.id).label("count"),
        func.coalesce(func.sum(case((is_credit, 0), else_=Transaction.total_amount)), 0.0).label("cash_value"),
        func.coalesce(func.sum(case((is_credit, Transaction.total_amount), else_=0)), 0.0).label("credit_value"),
        # count() skips NULLs, and case() without else_ is NULL for non-credit rows
        func.count(case((is_credit, 1))).label("credit_count"),
    ).filter(
        Transaction.customer_id == customer_id,
        Transaction.transaction_type == TransactionType.SALE,
        Transaction.created_at >= cutoff_30d,
    ).first()

    transaction_count_last_30d = int(recent_agg.count or 0)
    cash_purchase_value_last_30d = float(recent_agg.cash_value or 0.0)
    credit_purchase_value_last_30d = float(recent_agg.credit_value or 0.0)
    credit_transaction_count_last_30d = int(recent_agg.credit_count or 0)

    all_agg = db.query(
        func.count(Transaction.id).label("total_count"),
        func.coalesce(func.avg(Transaction.total_amount), 0.0).label("avg_amount"),
        func.max(Transaction.created_at).label("last_purchase_at"),
    ).filter(
        Transaction.customer_id == customer_id,
        Transaction.transaction_type == TransactionType.SALE,
    ).first()

    avg_purchase_amount = float(all_agg.avg_amount or 0.0)

    credit_avg_agg = db.query(
        func.coalesce(func.avg(Transaction.total_amount), 0.0).label("avg")
    ).filter(
        Transaction.customer_id == customer_id,
        Transaction.transaction_type == TransactionType.SALE,
        Transaction.payment_type == PaymentType.CREDIT,
    ).scalar()
    avg_credit_transaction_amount = float(credit_avg_agg or 0.0)

    total_value_30d = cash_purchase_value_last_30d + credit_purchase_value_last_30d
    credit_to_purchase_ratio = (
        credit_purchase_value_last_30d / total_value_30d if total_value_30d > 0 else 0.0
    )

    current_outstanding_balance = float(customer.current_outstanding_balance)
    max_outstanding_ever = float(customer.max_outstanding_ever)

    outstanding_to_avg_transaction_ratio = (
        current_outstanding_balance / avg_purchase_amount if avg_purchase_amount > 0 else 0.0
    )

    if all_agg.last_purchase_at:
        # transactions.created_at is timestamptz; compare in naive UTC like `now`
        last = all_agg.last_purchase_at
        if last.tzinfo is not None:
            last = last.astimezone(timezone.utc).replace(tzinfo=None)
        days_since_last_purchase = max(0, (now - last).days)
    else:
        days_since_last_purchase = relationship_days

    total_credit_ever = db.query(
        func.coalesce(func.sum(CreditSale.credit_amount), 0.0)
    ).filter(CreditSale.customer_id == customer_id).scalar() or 0.0

    completed = db.query(CreditSale).filter(
        CreditSale.customer_id == customer_id,
        CreditSale.status == CreditStatus.PAID,
    ).all()

    num_completed_credit_cycles = len(completed)

    on_time = [
        cs for cs in completed
        if cs.paid_at is not None and cs.paid_at.date() <= cs.due_date
    ]
    pct_repaid_on_time = len(on_time) / num_completed_credit_cycles if num_completed_credit_cycles > 0 else 0.0

    days_to_repay_list = []
    for cs in completed:
        if cs.paid_at is not None:
            created = cs.created_at
            paid = cs.paid_at
            days_to_repay_list.append(max(0, (paid - created).days))
    avg_days_to_repay = (sum(days_to_repay_list) / len(days_to_repay_list)) if days_to_repay_list else 0.0

    if len(days_to_repay_list) >= 2:
        mean_d = avg_days_to_repay
        variance = sum((d - mean_d) ** 2 for d in days_to_repay_list) / len(days_to_repay_list)
        repayment_consistency = variance ** 0.5
    else:
        repayment_consistency = 0.0

    total_repaid = sum(float(cs.credit_amount) for cs in completed)
    historical_repayment_ratio = (total_repaid / float(total_credit_ever)) if float(total_credit_ever) > 0 else 0.0

    severely_late = [
        cs for cs in completed
        if cs.paid_at is not None and cs.paid_at.date() > cs.due_date + timedelta(days=30)
    ]
    num_severely_late_repayments = len(severely_late)

    return {
        "relationship_days": relationship_days,
        "cash_purchase_value_last_30d": cash_purchase_value_last_30d,
        "credit_purchase_value_last_30d": credit_purchase_value_last_30d,
        "transaction_count_last_30d": transaction_count_last_30d,
        "credit_transaction_count_last_30d": credit_transaction_count_last_30d,
        "avg_purchase_amount": avg_purchase_amount,
        "avg_credit_transaction_amount": avg_credit_transaction_amount,
        "credit_to_purchase_ratio": credit_to_purchase_ratio,
        "current_outstanding_balance": current_outstanding_balance,
        "outstanding_to_avg_transaction_ratio": outstanding_to_avg_transaction_ratio,
        "pct_repaid_on_time": pct_repaid_on_time,
        "avg_days_to_repay": avg_days_to_repay,
        "repayment_consistency": repayment_consistency,
        "historical_repayment_ratio": historical_repayment_ratio,
        "num_completed_credit_cycles": num_completed_credit_cycles,
        "num_severely_late_repayments": num_severely_late_repayments,
        "max_outstanding_ever": max_outstanding_ever,
        "days_since_last_purchase": days_since_last_purchase,
    }

# Suggested limit = recent monthly spend scaled by risk. It is computed from the
# customer's behaviour, never from their current limit, so re-applying it gives
# the same number instead of compounding.
LIMIT_FACTOR = {RiskLevel.LOW: 1.0, RiskLevel.MEDIUM: 0.6, RiskLevel.HIGH: 0.3}
MAX_CREDIT_LIMIT = 50_000.0  # ponytail: global ceiling in NPR; make it per-shop if owners need different caps
LIMIT_ROUNDING = 100


def _has_overdue(db: Session, customer_id: uuid.UUID) -> bool:
    today = date.today()
    return db.query(CreditSale.id).filter(
        CreditSale.customer_id == customer_id,
        CreditSale.status != CreditStatus.PAID,
        (CreditSale.status == CreditStatus.OVERDUE) | (CreditSale.due_date < today),
    ).first() is not None


def suggest_credit_limit(
    db: Session, customer: Customer, features: Dict[str, Any], risk_probability: float, is_risk: bool
) -> Dict[str, Any]:
    current = float(customer.credit_limit)
    level = RiskLevel.HIGH if is_risk else _risk_level(risk_probability)
    monthly_spend = features["cash_purchase_value_last_30d"] + features["credit_purchase_value_last_30d"]

    if monthly_spend <= 0:
        suggested, reason = current, "Not enough purchases in the last 30 days to suggest a change."
    else:
        target = monthly_spend * LIMIT_FACTOR[level]
        suggested = min(MAX_CREDIT_LIMIT, round(target / LIMIT_ROUNDING) * LIMIT_ROUNDING)
        reason = (
            f"{int(LIMIT_FACTOR[level] * 100)}% of the last 30 days' spending "
            f"(Rs. {monthly_spend:,.0f}) for a {level.value}-risk customer"
        )
        if suggested >= MAX_CREDIT_LIMIT:
            reason += f", capped at Rs. {MAX_CREDIT_LIMIT:,.0f}"
        if suggested > current and _has_overdue(db, customer.id):
            suggested, reason = current, "Has overdue credit; the limit can't go up until it's paid."

    return {
        "current_credit_limit": current,
        "recommended_credit_limit": float(suggested),
        "limit_reason": reason,
        "risk_level": level.value,
    }


def _risk_level(probability: float) -> RiskLevel:
    if probability >= 0.65:
        return RiskLevel.HIGH
    elif probability >= 0.35:
        return RiskLevel.MEDIUM
    return RiskLevel.LOW

def predict_direct(payload: CreditRiskPredictRequest) -> Dict[str, Any]:
    predictor = _get_predictor()
    try:
        result = predictor.predict(**payload.model_dump())
    except Exception as exc:
        logger.exception("Credit risk prediction failed: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Prediction error: {exc}",
        )
    return result

def predict_probability_direct(payload: CreditRiskPredictRequest) -> Dict[str, Any]:
    predictor = _get_predictor()
    try:
        result = predictor.predict_probability(**payload.model_dump())
    except Exception as exc:
        logger.exception("Credit risk probability prediction failed: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Prediction error: {exc}",
        )
    return result

def explain_direct(payload: CreditRiskPredictRequest, top_k: int = 5) -> Dict[str, Any]:
    predictor = _get_predictor()
    try:
        result = predictor.explain_prediction(top_k=top_k, **payload.model_dump())
    except Exception as exc:
        logger.exception("Credit risk explanation failed: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Explanation error: {exc}",
        )
    return result

def predict_for_customer(
    db: Session,
    shop_id: uuid.UUID,
    customer_id: uuid.UUID,
    save_result: bool = True,
) -> Dict[str, Any]:
    predictor = _get_predictor()
    customer = _get_customer_or_404(db, shop_id, customer_id)
    features = _compute_features_from_db(db, customer)

    try:
        result = predictor.predict(**features)
    except Exception as exc:
        logger.exception("Credit risk prediction for customer %s failed: %s", customer_id, exc)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Prediction error: {exc}",
        )

    limit = suggest_credit_limit(db, customer, features, result["risk_probability"], result["is_risk"])
    if save_result:
        _record_prediction(db, customer_id, result, limit)
        db.commit()

    result.update(limit)
    result["computed_features"] = features
    result["customer_id"] = str(customer_id)
    return result

def explain_for_customer(
    db: Session,
    shop_id: uuid.UUID,
    customer_id: uuid.UUID,
    top_k: int = 5,
) -> Dict[str, Any]:
    predictor = _get_predictor()
    customer = _get_customer_or_404(db, shop_id, customer_id)
    features = _compute_features_from_db(db, customer)

    try:
        result = predictor.explain_prediction(top_k=top_k, **features)
    except Exception as exc:
        logger.exception("Credit risk explanation for customer %s failed: %s", customer_id, exc)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Explanation error: {exc}",
        )

    result.update(suggest_credit_limit(db, customer, features, result["risk_probability"], result["is_risk"]))
    result["computed_features"] = features
    result["customer_id"] = str(customer_id)
    return result


def _record_prediction(db: Session, customer_id: uuid.UUID, result: Dict[str, Any], limit: Dict[str, Any]) -> None:
    db.add(CreditPrediction(
        customer_id=customer_id,
        risk_probability=result["risk_probability"],
        risk_level=RiskLevel(limit["risk_level"]),
        recommended_credit_limit=limit["recommended_credit_limit"],
        model_version=str(result.get("model", "unknown")),
    ))


def apply_suggested_limit(db: Session, shop_id: uuid.UUID, customer_id: uuid.UUID) -> Dict[str, Any]:
    """Recompute the suggestion server-side and write it to customers.credit_limit."""
    predictor = _get_predictor()
    customer = _get_customer_or_404(db, shop_id, customer_id)
    features = _compute_features_from_db(db, customer)
    try:
        result = predictor.predict(**features)
    except Exception as exc:
        logger.exception("Credit risk prediction for customer %s failed: %s", customer_id, exc)
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Prediction error: {exc}")

    limit = suggest_credit_limit(db, customer, features, result["risk_probability"], result["is_risk"])
    previous = float(customer.credit_limit)
    customer.credit_limit = limit["recommended_credit_limit"]
    _record_prediction(db, customer_id, result, limit)
    db.commit()
    return {**limit, "previous_credit_limit": previous, "customer_id": str(customer_id)}

def get_global_feature_importance() -> Dict[str, Any]:
    predictor = _get_predictor()
    return predictor.get_global_feature_importance()

def get_model_metadata() -> Dict[str, Any]:
    predictor = _get_predictor()
    return predictor.get_model_metadata()

