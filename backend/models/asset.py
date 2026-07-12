from datetime import date
from decimal import Decimal
from typing import Optional

from sqlalchemy import Boolean, Date, ForeignKey, Numeric, String, Text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from core.database import Base


class AssetCategory(Base):
    __tablename__ = "asset_categories"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(120), unique=True)
    custom_fields: Mapped[dict] = mapped_column(JSONB, default=dict)


class Asset(Base):
    __tablename__ = "assets"

    id: Mapped[int] = mapped_column(primary_key=True)
    tag: Mapped[str] = mapped_column(String(32), unique=True, index=True)
    name: Mapped[str] = mapped_column(String(160))
    category_id: Mapped[Optional[int]] = mapped_column(ForeignKey("asset_categories.id"), nullable=True)
    serial_number: Mapped[Optional[str]] = mapped_column(String(120), nullable=True)
    acquisition_date: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    acquisition_cost: Mapped[Optional[Decimal]] = mapped_column(Numeric(12, 2), nullable=True)
    condition: Mapped[str] = mapped_column(String(32), default="good")
    location: Mapped[Optional[str]] = mapped_column(String(160), nullable=True)
    is_bookable: Mapped[bool] = mapped_column(Boolean, default=False)
    photo_url: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    status: Mapped[str] = mapped_column(String(32), default="available", index=True)

