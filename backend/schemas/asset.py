from datetime import date
from decimal import Decimal

from pydantic import BaseModel

from schemas.common import OrmModel


class AssetCreate(BaseModel):
    name: str
    category_id: int | None = None
    serial_number: str | None = None
    acquisition_date: date | None = None
    acquisition_cost: Decimal | None = None
    condition: str = "good"
    location: str | None = None
    is_bookable: bool = False
    photo_url: str | None = None


class AssetUpdate(BaseModel):
    name: str | None = None
    category_id: int | None = None
    serial_number: str | None = None
    condition: str | None = None
    location: str | None = None
    is_bookable: bool | None = None
    photo_url: str | None = None
    status: str | None = None


class AssetResponse(OrmModel):
    id: int
    tag: str
    name: str
    category_id: int | None = None
    serial_number: str | None = None
    acquisition_date: date | None = None
    acquisition_cost: Decimal | None = None
    condition: str
    location: str | None = None
    is_bookable: bool
    photo_url: str | None = None
    status: str

