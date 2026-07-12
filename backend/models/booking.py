from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, String, func
from sqlalchemy.dialects.postgresql import TSTZRANGE
from sqlalchemy.orm import Mapped, mapped_column

from core.database import Base


class Booking(Base):
    __tablename__ = "bookings"

    id: Mapped[int] = mapped_column(primary_key=True)
    resource_id: Mapped[int] = mapped_column(ForeignKey("assets.id"), index=True)
    booked_by: Mapped[int] = mapped_column(ForeignKey("users.id"))
    slot: Mapped[object] = mapped_column(TSTZRANGE)
    status: Mapped[str] = mapped_column(String(24), default="upcoming")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

