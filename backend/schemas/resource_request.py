from datetime import date, datetime

from pydantic import BaseModel, Field

from schemas.common import OrmModel


class ResourceRequestCreate(BaseModel):
    asset_id: int
    reason: str = Field(min_length=3, max_length=1000)
    priority: str = "medium"
    expected_return_date: date | None = None


class ResourceRequestReview(BaseModel):
    status: str = Field(pattern="^(approved|rejected)$")
    review_notes: str | None = None


class ResourceRequestResponse(OrmModel):
    id: int
    asset_id: int
    requested_by: int
    reason: str
    priority: str
    status: str
    reviewed_by: int | None = None
    review_notes: str | None = None
    expected_return_date: datetime | None = None
    created_at: datetime
    reviewed_at: datetime | None = None
    # Enriched fields joined at query time
    asset_tag: str | None = None
    asset_name: str | None = None
    asset_status: str | None = None
    requester_name: str | None = None
    requester_email: str | None = None
