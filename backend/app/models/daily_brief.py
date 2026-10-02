import uuid
from datetime import date, datetime
from sqlalchemy import Text, Date, DateTime, ForeignKey, UniqueConstraint
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.sql import func
from sqlalchemy.orm import Mapped, mapped_column
from app.db.database import Base


class DailyBrief(Base):
    __tablename__ = "daily_briefs"
    __table_args__ = (UniqueConstraint("shop_id", "brief_date", name="uq_daily_briefs_shop_date"),)

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    shop_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("shops.id"))
    brief_date: Mapped[date] = mapped_column(Date)

    transcript: Mapped[str] = mapped_column(Text)
    context: Mapped[dict] = mapped_column(JSONB)

    generated_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
