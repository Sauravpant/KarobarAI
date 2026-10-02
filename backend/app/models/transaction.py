import uuid
from datetime import datetime
from sqlalchemy import Text, DateTime, Numeric, ForeignKey, Enum as SAEnum, Index, func as sql_func
from sqlalchemy.sql import func
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.db.database import Base
from app.models.enums import PaymentType, TransactionType

class Transaction(Base):
    __tablename__ = "transactions"
    __table_args__ = (
        Index("ix_transactions_shop_type",    "shop_id", "transaction_type"),
        Index("ix_transactions_shop_created", "shop_id", "created_at"),
        Index("ix_transactions_shop_payment", "shop_id", "payment_type"),
        Index("ix_transactions_customer_id",  "customer_id"),
    )

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    shop_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("shops.id"))
    customer_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("customers.id"), nullable=True)

    transaction_type: Mapped[TransactionType] = mapped_column(
        SAEnum(TransactionType),
        default=TransactionType.SALE,
    )
    payment_type: Mapped[PaymentType] = mapped_column(SAEnum(PaymentType))
    subtotal: Mapped[float] = mapped_column(Numeric(10, 2))
    discount: Mapped[float] = mapped_column(Numeric(10, 2), default=0.00)
    total_amount: Mapped[float] = mapped_column(Numeric(10, 2))
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    customer: Mapped["Customer"] = relationship(back_populates="transactions")
    items: Mapped[list["TransactionItem"]] = relationship(back_populates="transaction")
    credit_sale: Mapped["CreditSale"] = relationship(back_populates="transaction", uselist=False)
