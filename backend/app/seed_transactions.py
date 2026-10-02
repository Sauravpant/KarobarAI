
#  python -m app.seed_transactions
# Optional: --email, --shop-name / --shop-id, --reset, --end-date YYYY-MM-DD, --days N

from __future__ import annotations

import argparse
import hashlib
import uuid
from datetime import date, datetime, timedelta, timezone

import numpy as np

from app.db.database import SessionLocal
from app.models.enums import PaymentType, TransactionType
from app.models.product import Product
from app.models.shop import Shop
from app.models.transaction import Transaction
from app.models.transaction_item import TransactionItem
from app.models.user import User

USER_EMAIL = "swastika@example.com"
NEPAL_TZ = timezone(timedelta(hours=5, minutes=45))
SEED_TAG = "demo_seed"

DASHAIN = [date(2025, 10, 6), date(2026, 10, 20)]
TIHAR = [date(2025, 10, 20), date(2026, 11, 8)]
BUILD_DAYS, PEAK_OFFSET, DECAY_DAYS = 15, -2, 4
MONTH_END_DAYS = {1, 2, 3, 28, 29, 30, 31}


def _profile(dow, dashain, tihar, month_end, months=None):
    mean = sum(dow) / 7
    return {"dow": [x / mean for x in dow], "dashain": dashain, "tihar": tihar,
            "month_end": month_end, "months": months or {}}


PROFILES = {
    "Groceries": _profile([0.93, 0.93, 0.95, 0.95, 1.03, 1.22, 0.98], 1.30, 1.15, 1.12),
    "Beverages": _profile([0.90, 0.90, 0.93, 0.95, 1.05, 1.30, 1.07], 1.50, 1.45, 1.05,
                          {1: .78, 2: .85, 3: 1.05, 4: 1.25, 5: 1.35, 6: 1.30, 7: 1.10, 11: .90, 12: .80}),
    "Snacks": _profile([0.93, 0.93, 0.94, 0.96, 1.03, 1.23, 0.98], 1.85, 1.65, 1.05),
    "Dairy & Eggs": _profile([0.97, 0.97, 0.98, 0.98, 1.02, 1.12, 0.97], 1.25, 1.40, 1.03),
    "Personal Care": _profile([0.94, 0.94, 0.96, 0.96, 1.02, 1.18, 0.99], 1.25, 1.15, 1.12),
    "Household": _profile([0.92, 0.92, 0.95, 0.95, 1.04, 1.22, 1.00], 1.30, 1.45, 1.10),
    "Cleaning Supplies": _profile([0.92, 0.92, 0.94, 0.95, 1.04, 1.25, 0.98], 1.40, 1.70, 1.08),
    "Stationery": _profile([1.05, 1.05, 1.05, 1.05, 1.00, 0.70, 1.10], 0.80, 0.85, 1.00,
                           {1: 1.1, 2: 1.1, 3: 1.3, 4: 1.9, 5: 1.5, 6: 1.1, 10: .95, 11: .9, 12: .9}),
}
DEFAULT_PROFILE = _profile([0.94, 0.94, 0.96, 0.96, 1.03, 1.20, 0.97], 1.20, 1.20, 1.05)


def festival_ramp(days_diff: int) -> float:
    if -BUILD_DAYS <= days_diff <= PEAK_OFFSET:
        return (days_diff + BUILD_DAYS) / (PEAK_OFFSET + BUILD_DAYS)
    if PEAK_OFFSET < days_diff <= DECAY_DAYS:
        return 1 - (days_diff - PEAK_OFFSET) / (DECAY_DAYS - PEAK_OFFSET)
    return 0.0


def day_multiplier(profile: dict, day: date, ramp_d: float, ramp_t: float) -> float:
    return (
        profile["dow"][day.weekday()]
        * profile["months"].get(day.month, 1.0)
        * (1 + (profile["dashain"] - 1) * ramp_d)
        * (1 + (profile["tihar"] - 1) * ramp_t)
        * (profile["month_end"] if day.day in MONTH_END_DAYS else 1.0)
    )


def base_rate(product: Product) -> float:
    h = int(hashlib.md5(product.product_name.encode()).hexdigest()[:8], 16)
    jitter = 0.7 + (h % 600) / 1000.0
    rate = 40.0 / (1.0 + float(product.selling_price) / 50.0)
    rate = min(max(rate, 8.0), 16.0)
    if product.is_staple:
        rate *= 1.15
    return rate * jitter


def chunk_quantities(units: int, rng: np.random.Generator) -> list[int]:
    out, left = [], units
    while left > 0:
        q = min(int(rng.choice([1, 2, 3], p=[0.70, 0.25, 0.05])), left)
        out.append(q)
        left -= q
    return out


def pick_shop(db, user: User, shop_id: str | None, shop_name: str | None) -> Shop:
    shops = db.query(Shop).filter(Shop.user_id == user.id).order_by(Shop.created_at).all()
    if not shops:
        raise SystemExit("Shop not found for this user.")
    if shop_id:
        match = [s for s in shops if str(s.id) == shop_id]
    elif shop_name:
        match = [s for s in shops if s.shop_name.lower() == shop_name.lower()]
    elif len(shops) == 1:
        return shops[0]
    else:
        match = None
    if match:
        return match[0]
    lines = "\n".join(f"  {s.id}  {s.shop_name}" for s in shops)
    if match is None:
        raise SystemExit(f"This user has {len(shops)} shops. Pass --shop-id or --shop-name:\n{lines}")
    raise SystemExit(f"No matching shop for this user. Available shops:\n{lines}")


def seed(email: str, days: int, end_date: date, reset: bool, rng_seed: int,
         shop_id: str | None = None, shop_name: str | None = None) -> None:
    db = SessionLocal()
    rng = np.random.default_rng(rng_seed)
    try:
        user = db.query(User).filter(User.email == email).first()
        if not user:
            raise SystemExit(f"User '{email}' not found.")
        shop = pick_shop(db, user, shop_id, shop_name)

        products = (
            db.query(Product)
            .filter(Product.shop_id == shop.id, Product.is_active == True)  # noqa: E712
            .all()
        )
        if not products:
            raise SystemExit("No products in this shop. Run app/seed.py first.")

        existing = db.query(Transaction.id).filter(
            Transaction.shop_id == shop.id, Transaction.notes == SEED_TAG
        )
        n_existing = existing.count()
        if n_existing and not reset:
            raise SystemExit(
                f"{n_existing} demo transactions already exist for this shop. "
                "Re-run with --reset to replace them."
            )
        if reset and n_existing:
            ids = [r[0] for r in existing.all()]
            for i in range(0, len(ids), 500):
                batch = ids[i:i + 500]
                db.query(TransactionItem).filter(
                    TransactionItem.transaction_id.in_(batch)
                ).delete(synchronize_session=False)
                db.query(Transaction).filter(Transaction.id.in_(batch)).delete(
                    synchronize_session=False
                )
            db.commit()
            print(f"Removed {n_existing} old demo transactions.")

        cat_names = {p.id: (p.category.name if p.category else "") for p in products}
        rates = {p.id: base_rate(p) for p in products}
        by_id = {p.id: p for p in products}
        print(f"Shop: {shop.shop_name} | products: {len(products)} | "
              f"{days} days ending {end_date}")

        start = end_date - timedelta(days=days - 1)
        total_txn = total_items = 0

        for n in range(days):
            day = start + timedelta(days=n)
            ramp_d = max(festival_ramp((day - f).days) for f in DASHAIN)
            ramp_t = max(festival_ramp((day - f).days) for f in TIHAR)
            trend = 1.0 + 0.10 * (n / max(days - 1, 1))

            per_product: dict[uuid.UUID, list[int]] = {}
            for p in products:
                profile = PROFILES.get(cat_names[p.id], DEFAULT_PROFILE)
                lam = rates[p.id] * trend * day_multiplier(profile, day, ramp_d, ramp_t)
                lam *= float(rng.lognormal(0, 0.12))
                units = int(rng.poisson(max(lam, 0.1)))
                if units:
                    per_product[p.id] = chunk_quantities(units, rng)

            if not per_product:
                continue

            total_chunks = sum(len(c) for c in per_product.values())
            max_chunks = max(len(c) for c in per_product.values())
            n_baskets = max(max_chunks, round(total_chunks / 3.0), 10)
            baskets: list[list[tuple[Product, int]]] = [[] for _ in range(n_baskets)]
            for pid, chunks in per_product.items():
                slots = rng.choice(n_baskets, size=len(chunks), replace=False)
                for slot, q in zip(slots, chunks):
                    baskets[int(slot)].append((by_id[pid], q))

            for basket in baskets:
                if not basket:
                    continue
                subtotal = sum(float(p.selling_price) * q for p, q in basket)
                ts = datetime(day.year, day.month, day.day,
                              int(rng.integers(4, 15)), int(rng.integers(0, 60)),
                              tzinfo=timezone.utc)
                tx = Transaction(
                    id=uuid.uuid4(),
                    shop_id=shop.id,
                    customer_id=None,
                    transaction_type=TransactionType.SALE,
                    payment_type=PaymentType.CASH if rng.random() < 0.6 else PaymentType.QR,
                    subtotal=round(subtotal, 2),
                    discount=0,
                    total_amount=round(subtotal, 2),
                    notes=SEED_TAG,
                    created_at=ts,
                )
                db.add(tx)
                for p, q in basket:
                    db.add(TransactionItem(
                        id=uuid.uuid4(),
                        transaction_id=tx.id,
                        product_id=p.id,
                        quantity=q,
                        unit_price=p.selling_price,
                        subtotal=round(float(p.selling_price) * q, 2),
                    ))
                    total_items += 1
                total_txn += 1
            db.commit()

        print("=" * 44)
        print("Transaction seed complete")
        print(f"Transactions : {total_txn}")
        print(f"Line items   : {total_items}")
        print(f"Date range   : {start} -> {end_date}")
        print("=" * 44)
        print("Use last_date =", end_date.isoformat(), "when calling the forecast API.")

    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


if __name__ == "__main__":
    ap = argparse.ArgumentParser(description="Seed demo sales transactions")
    ap.add_argument("--email", default=USER_EMAIL)
    ap.add_argument("--shop-id", default=None)
    ap.add_argument("--shop-name", default=None)
    ap.add_argument("--days", type=int, default=30)
    ap.add_argument("--end-date", default=None)
    ap.add_argument("--reset", action="store_true")
    ap.add_argument("--seed", type=int, default=42)
    a = ap.parse_args()
    if a.days < 21:
        raise SystemExit("--days must be >= 21 (the model needs 21 days of history).")
    end = date.fromisoformat(a.end_date) if a.end_date else datetime.now(NEPAL_TZ).date()
    seed(a.email, a.days, end, a.reset, a.seed, a.shop_id, a.shop_name)