import uuid
from datetime import date, datetime, timezone
from sqlalchemy import func, text, cast, String, or_
from sqlalchemy.orm import Session, joinedload, selectinload
from fastapi import HTTPException, status

from app.models.transaction import Transaction
from app.models.transaction_item import TransactionItem
from app.models.credit_sale import CreditSale
from app.models.product import Product
from app.models.customer import Customer
from app.models.user import User
from app.models.enums import PaymentType, CreditStatus, TransactionType
from app.schemas.transaction import TransactionCreateRequest, CreditSaleUpdateRequest
from app.services.shop_service import get_shop_by_id

def create_transaction(
    db: Session, user: User, shop_id: uuid.UUID, payload: TransactionCreateRequest
) -> Transaction:
    get_shop_by_id(db, user, shop_id)

    if not payload.items:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Transaction must have at least one item",
        )

    if payload.transaction_type == TransactionType.SALE and payload.payment_type == PaymentType.CREDIT:
        if not payload.customer_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Credit sales require a customer",
            )
        if not payload.due_date:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Credit sales require a due date",
            )

    product_ids = [item.product_id for item in payload.items]
    products_by_id = {
        p.id: p
        for p in db.query(Product).filter(
            Product.id.in_(product_ids),
            Product.shop_id == shop_id,
        ).all()
    }

    subtotal = 0.0
    tx_items = []
    for item_req in payload.items:
        product = products_by_id.get(item_req.product_id)
        if not product:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Product {item_req.product_id} not found in this shop",
            )
        if payload.transaction_type == TransactionType.SALE and product.stock_quantity < item_req.quantity:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Insufficient stock for '{product.product_name}'. Available: {product.stock_quantity}",
            )
        unit_price = float(product.selling_price)
        if payload.transaction_type == TransactionType.PURCHASE:
            unit_price = float(product.cost_price)
        item_subtotal = unit_price * item_req.quantity
        tx_items.append(TransactionItem(
            product_id=product.id,
            quantity=item_req.quantity,
            unit_price=unit_price,
            subtotal=item_subtotal,
        ))
        if payload.transaction_type == TransactionType.SALE:
            product.stock_quantity -= item_req.quantity
        else:
            product.stock_quantity += item_req.quantity
        subtotal += item_subtotal

    total_amount = subtotal - payload.discount

    transaction = Transaction(
        shop_id=shop_id,
        customer_id=payload.customer_id,
        transaction_type=payload.transaction_type,
        payment_type=payload.payment_type,
        subtotal=subtotal,
        discount=payload.discount,
        total_amount=total_amount,
        notes=payload.notes,
        items=tx_items,
    )
    db.add(transaction)
    db.flush()

    if payload.transaction_type == TransactionType.SALE and payload.payment_type == PaymentType.CREDIT:
        credit_sale = CreditSale(
            transaction_id=transaction.id,
            customer_id=payload.customer_id,
            credit_amount=total_amount,
            due_date=payload.due_date,
            status=CreditStatus.UNPAID,
        )
        db.add(credit_sale)

        customer = db.query(Customer).filter(Customer.id == payload.customer_id).first()
        if customer:
            customer.current_outstanding_balance = float(customer.current_outstanding_balance) + total_amount
            if float(customer.current_outstanding_balance) > float(customer.max_outstanding_ever):
                customer.max_outstanding_ever = customer.current_outstanding_balance

    db.commit()
    db.refresh(transaction)
    return transaction

def get_transaction_stats(db: Session, shop_id: uuid.UUID) -> dict:
    today = datetime.now(timezone.utc).date()
    nepal_time = Transaction.created_at + text("interval '5 hours 45 minutes'")

    today_sales = (
        db.query(func.coalesce(func.sum(Transaction.total_amount), 0.0))
        .filter(
            Transaction.shop_id == shop_id,
            Transaction.transaction_type == TransactionType.SALE,
            func.date(nepal_time) == today,
        )
        .scalar()
    ) or 0.0

    total_sales = (
        db.query(func.coalesce(func.sum(Transaction.total_amount), 0.0))
        .filter(
            Transaction.shop_id == shop_id,
            Transaction.transaction_type == TransactionType.SALE,
        )
        .scalar()
    ) or 0.0

    credit_sales = (
        db.query(func.coalesce(func.sum(Transaction.total_amount), 0.0))
        .filter(
            Transaction.shop_id == shop_id,
            Transaction.payment_type == PaymentType.CREDIT,
        )
        .scalar()
    ) or 0.0

    pending_credit = (
        db.query(func.coalesce(func.sum(CreditSale.credit_amount), 0.0))
        .join(Transaction, CreditSale.transaction_id == Transaction.id)
        .filter(
            Transaction.shop_id == shop_id,
            CreditSale.status != CreditStatus.PAID,
        )
        .scalar()
    ) or 0.0

    total_count = (
        db.query(func.count(Transaction.id))
        .filter(Transaction.shop_id == shop_id)
        .scalar()
    ) or 0

    return {
        "today_sales": float(today_sales),
        "total_sales": float(total_sales),
        "credit_sales": float(credit_sales),
        "pending_credit": float(pending_credit),
        "total_count": int(total_count),
    }

def get_transactions(
    db: Session,
    user: User,
    shop_id: uuid.UUID,
    page: int = 1,
    limit: int = 20,
    payment_type: PaymentType | None = None,
    search: str | None = None,
    include_stats: bool = True,
) -> dict:
    get_shop_by_id(db, user, shop_id)

    query = db.query(Transaction).filter(Transaction.shop_id == shop_id)

    if payment_type:
        query = query.filter(Transaction.payment_type == payment_type)

    if search:
        search_term = f"%{search.strip()}%"
        query = query.outerjoin(Customer, Transaction.customer_id == Customer.id).filter(
            or_(
                cast(Transaction.id, String).ilike(search_term),
                Customer.full_name.ilike(search_term),
            )
        )

    total = query.count()

    items = (
        query.options(selectinload(Transaction.items), joinedload(Transaction.credit_sale))
        .order_by(Transaction.created_at.desc())
        .offset((page - 1) * limit)
        .limit(limit)
        .all()
    )

    stats = get_transaction_stats(db, shop_id) if include_stats else None

    return {
        "items": items,
        "total": total,
        "page": page,
        "limit": limit,
        "has_more": (page * limit) < total,
        "stats": stats,
    }

def get_transaction_by_id(
    db: Session, user: User, shop_id: uuid.UUID, transaction_id: uuid.UUID
) -> Transaction:
    get_shop_by_id(db, user, shop_id)
    transaction = (
        db.query(Transaction)
        .options(joinedload(Transaction.items), joinedload(Transaction.credit_sale))
        .filter(Transaction.id == transaction_id, Transaction.shop_id == shop_id)
        .first()
    )
    if not transaction:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Transaction not found",
        )
    return transaction

def get_credit_sales(db: Session, user: User, shop_id: uuid.UUID, status_filter: CreditStatus | None = None) -> list[CreditSale]:
    get_shop_by_id(db, user, shop_id)
    query = (
        db.query(CreditSale)
        .join(Transaction, CreditSale.transaction_id == Transaction.id)
        .filter(Transaction.shop_id == shop_id)
    )
    if status_filter:
        query = query.filter(CreditSale.status == status_filter)
    return query.order_by(CreditSale.created_at.desc()).all()

def update_credit_sale(
    db: Session, user: User, shop_id: uuid.UUID, credit_sale_id: uuid.UUID, payload: CreditSaleUpdateRequest
) -> CreditSale:
    get_shop_by_id(db, user, shop_id)
    credit_sale = (
        db.query(CreditSale)
        .join(Transaction, CreditSale.transaction_id == Transaction.id)
        .filter(CreditSale.id == credit_sale_id, Transaction.shop_id == shop_id)
        .first()
    )
    if not credit_sale:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Credit sale not found",
        )

    if payload.status and payload.status == CreditStatus.PAID and credit_sale.status != CreditStatus.PAID:
        credit_sale.status = CreditStatus.PAID
        credit_sale.paid_at = datetime.now(timezone.utc)
        customer = db.query(Customer).filter(Customer.id == credit_sale.customer_id).first()
        if customer:
            customer.current_outstanding_balance = (
                float(customer.current_outstanding_balance) - float(credit_sale.credit_amount)
            )
            if float(customer.current_outstanding_balance) < 0:
                customer.current_outstanding_balance = 0
    elif payload.status:
        credit_sale.status = payload.status

    if payload.remarks is not None:
        credit_sale.remarks = payload.remarks

    db.commit()
    db.refresh(credit_sale)
    return credit_sale

