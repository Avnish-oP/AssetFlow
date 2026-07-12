from datetime import date, datetime

from pydantic import BaseModel, Field

from schemas.common import OrmModel


class AuditCycleCreate(BaseModel):
    name: str
    scope_department_id: int | None = None
    scope_location: str | None = None
    start_date: date
    end_date: date
    auditor_ids: list[int] = Field(default_factory=list)


class AuditItemVerify(BaseModel):
    verification_status: str
    notes: str | None = None


class AuditItemResponse(OrmModel):
    id: int
    cycle_id: int
    asset_id: int
    expected_location: str | None = None
    verification_status: str
    notes: str | None = None
    verified_by: int | None = None
    verified_at: datetime | None = None
    asset_tag: str | None = None
    asset_name: str | None = None
    asset_condition: str | None = None


class AuditCycleResponse(OrmModel):
    id: int
    name: str
    scope_department_id: int | None = None
    scope_location: str | None = None
    start_date: date
    end_date: date
    status: str
    created_by: int
    auditor_ids: list[int] = Field(default_factory=list)
    total_items: int = 0
    verified_count: int = 0
    missing_count: int = 0
    damaged_count: int = 0
    pending_count: int = 0


class AuditCycleDetail(AuditCycleResponse):
    items: list[AuditItemResponse] = Field(default_factory=list)


class DiscrepancyItem(BaseModel):
    item_id: int
    asset_id: int
    asset_tag: str | None = None
    asset_name: str | None = None
    verification_status: str
    notes: str | None = None
    expected_location: str | None = None


class DiscrepancyReport(BaseModel):
    cycle_id: int
    cycle_name: str
    missing_count: int
    damaged_count: int
    verified_count: int
    pending_count: int
    items: list[DiscrepancyItem] = Field(default_factory=list)
