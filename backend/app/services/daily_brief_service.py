import asyncio
import logging
import uuid
from datetime import date

from fastapi import HTTPException
from sqlalchemy import func as sa_func
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.models.customer import Customer
from app.models.daily_brief import DailyBrief
from app.models.enums import PaymentType, TransactionType
from app.models.product import Product
from app.models.transaction import Transaction
from app.models.transaction_item import TransactionItem
from app.models.user import User
from app.schemas.dashboard import DailyBriefContext, DailyBriefResponse, RestockSuggestion
from app.schemas.demand_forecast import DemandForecastByProductRequest
from app.services import demand_forecast_service, llm_service, product_service, voice_service
from app.services.dashboard_service import NEPAL_TIMESTAMP
from app.services.shop_service import get_shop_by_id

logger = logging.getLogger(__name__)

FORECAST_TOP_N = 3


def build_context(db: Session, user: User, shop_id: uuid.UUID, brief_date: date) -> DailyBriefContext:
    on_day = sa_func.date(NEPAL_TIMESTAMP) == brief_date
    sales = db.query(Transaction).filter(
        Transaction.shop_id == shop_id,
        Transaction.transaction_type == TransactionType.SALE,
        on_day,
    )
    total_sales = sales.with_entities(sa_func.sum(Transaction.total_amount)).scalar() or 0
    total_credit = sales.filter(Transaction.payment_type == PaymentType.CREDIT).with_entities(
        sa_func.sum(Transaction.total_amount)
    ).scalar() or 0

    top_customer = (
        db.query(Customer)
        .filter(Customer.shop_id == shop_id, Customer.is_active == True, Customer.current_outstanding_balance > 0)
        .order_by(Customer.current_outstanding_balance.desc())
        .first()
    )

    sold = (
        db.query(Product, sa_func.sum(TransactionItem.quantity).label("qty"))
        .join(TransactionItem, TransactionItem.product_id == Product.id)
        .join(Transaction, TransactionItem.transaction_id == Transaction.id)
        .filter(Transaction.shop_id == shop_id, Transaction.transaction_type == TransactionType.SALE, on_day)
        .group_by(Product.id)
        .order_by(sa_func.sum(TransactionItem.quantity).desc())
        .all()
    )

    low_stock = product_service.get_low_stock_products(db, user, shop_id)

    restock = []
    for product, qty in sold[:FORECAST_TOP_N]:
        try:
            forecast = demand_forecast_service.forecast_next_day_for_product(
                db, shop_id,
                DemandForecastByProductRequest(product_id=product.id, last_date=brief_date.isoformat()),
            )
        except Exception as exc:
            logger.warning("Brief forecast failed for %s: %r", product.product_name, exc)
            continue
        predicted = float(forecast["predicted_units"])
        restock.append(RestockSuggestion(
            product_name=product.product_name,
            sold_today=int(qty),
            current_stock=product.stock_quantity,
            predicted_tomorrow=round(predicted, 1),
            needs_restock=predicted >= product.stock_quantity,
        ))

    return DailyBriefContext(
        brief_date=brief_date,
        total_sales=float(total_sales),
        total_credit_today=float(total_credit),
        highest_credit_customer=(
            {"name": top_customer.full_name, "outstanding_balance": float(top_customer.current_outstanding_balance)}
            if top_customer else None
        ),
        top_selling_product=sold[0][0].product_name if sold else None,
        min_selling_product=sold[-1][0].product_name if len(sold) > 1 else None,
        low_stock_alerts=[p.product_name for p in low_stock],
        restock_suggestions=restock,
    )


def _prompt(ctx: DailyBriefContext) -> str:
    return f"""तपाईं नेपाली किराना पसलको सहायक हुनुहुन्छ। दिनको अन्त्यमा पसलेलाई बोलेर सुनाइने छोटो सारांश लेख्नुहोस्।

Data for {ctx.brief_date} (JSON, amounts in rupees):
{ctx.model_dump_json(exclude={"brief_date"})}

Write in this order:
1. One paragraph: today's total sales, credit given today, the customer with the highest outstanding credit, best-selling and least-selling product, low-stock items. Skip any item that is null or empty.
2. Restock guidance from restock_suggestions: say in plain words which products to restock before tomorrow (needs_restock true). Do not read out raw forecast numbers.
3. A final separate paragraph of 1-2 sentences: one practical insight that connects these data points (not a repeat of the numbers).

Rules: Nepali only, Devanagari script, warm spoken conversational style, as if talking to the shopkeeper. Write amounts as "रुपैयाँ" with numbers. Plain text only: no English words, no markdown, no bullets, no numbering, no emojis, no JSON. Separate paragraphs with one blank line. Keep it under 900 characters."""


def _insight(transcript: str) -> str:
    paragraphs = [p.strip() for p in transcript.split("\n\n") if p.strip()]
    return paragraphs[-1] if len(paragraphs) > 1 else transcript


def _to_response(brief: DailyBrief, audio_url: str) -> DailyBriefResponse:
    return DailyBriefResponse(
        **brief.context,
        transcript=brief.transcript,
        audio_url=audio_url,
        ai_insight=_insight(brief.transcript),
    )


def _get(db: Session, shop_id: uuid.UUID, brief_date: date) -> DailyBrief | None:
    return db.query(DailyBrief).filter(DailyBrief.shop_id == shop_id, DailyBrief.brief_date == brief_date).first()


async def get_or_create_brief(
    db: Session, user: User, shop_id: uuid.UUID, brief_date: date, audio_url: str
) -> DailyBriefResponse:
    """LLM transcript is generated once per shop+date and saved. Audio is synthesized on each play."""
    get_shop_by_id(db, user, shop_id)
    existing = _get(db, shop_id, brief_date)
    if existing:
        return _to_response(existing, audio_url)

    ctx = await asyncio.to_thread(build_context, db, user, shop_id, brief_date)
    db.commit()  # release connection; idle pooled connections get dropped during the slow LLM call
    transcript = await llm_service.generate(_prompt(ctx), temperature=0.6)

    brief = DailyBrief(
        shop_id=shop_id,
        brief_date=brief_date,
        transcript=transcript,
        context=ctx.model_dump(mode="json"),
    )
    response = _to_response(brief, audio_url)
    db.add(brief)
    try:
        db.commit()
    except IntegrityError:  # concurrent request for same shop+date already saved one
        db.rollback()
        return _to_response(_get(db, shop_id, brief_date), audio_url)
    return response


async def get_brief_audio(db: Session, user: User, shop_id: uuid.UUID, brief_date: date) -> bytes:
    get_shop_by_id(db, user, shop_id)
    brief = _get(db, shop_id, brief_date)
    if not brief:
        raise HTTPException(status_code=404, detail="Brief not found, fetch the brief first")
    transcript = brief.transcript
    db.commit()  # release connection during TTS
    return await voice_service.synthesize_speech(transcript)
