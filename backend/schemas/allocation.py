from datetime import date, datetime

from pydantic import BaseModel

from schemas.common import OrmModel


class AllocationCreate(BaseModel):
    asset_id: int
    holder_user_id: int | None = None
    holder_department_id: int | None = None
    expected_return_date: date | None = None


class AllocationReturn(BaseModel):
    return_condition_notes: str | None = None
    condition: str | None = None


class AllocationResponse(OrmModel):
    id: int
    asset_id: int
    holder_user_id: int | None = None
    holder_department_id: int | None = None
    allocated_at: datetime
    expected_return_date: date | None = None
    returned_at: datetime | None = None
    return_condition_notes: str | None = None
    status: str


class TransferCreate(BaseModel):
    asset_id: int
    to_holder_id: int
    reason: str


class TransferResponse(OrmModel):
    id: int
    asset_id: int
    from_holder_id: int | None = None
    to_holder_id: int
    reason: str
    status: str
    requested_by: int
    approved_by: int | None = None

