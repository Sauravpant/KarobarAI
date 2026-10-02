import uuid
from sqlalchemy import Integer, Numeric, ForeignKey, Index
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.db.database import Base

class TransactionItem(Base):
    __tablename__ = "transaction_items"
    __table_args__ = (
        Index("ix_txn_items_transaction_id", "transaction_id"),
        Index("ix_txn_items_product_id",     "product_id"),
    )

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    transaction_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("transactions.id"))
    product_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("products.id"))

    quantity: Mapped[int] = mapped_column(Integer)
    unit_price: Mapped[float] = mapped_column(Numeric(10, 2))
    subtotal: Mapped[float] = mapped_column(Numeric(10, 2))

    transaction: Mapped["Transaction"] = relationship(back_populates="items")
    product: Mapped["Product"] = relationship()
