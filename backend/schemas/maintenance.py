from datetime import datetime

from pydantic import BaseModel, Field

from schemas.common import OrmModel


class MaintenanceCreate(BaseModel):
    asset_id: int
    issue_description: str
    priority: str = "medium"
    photo_url: str | None = None


class MaintenanceStatusUpdate(BaseModel):
    status: str
    technician_name: str | None = None


class MaintenanceResponse(OrmModel):
    id: int
    asset_id: int
    raised_by: int
    issue_description: str
    priority: str
    photo_url: str | None = None
    status: str
    approved_by: int | None = None
    technician_name: str | None = None
    resolved_at: datetime | None = None
    created_at: datetime
    asset_tag: str | None = None
    asset_name: str | None = None


class KanbanColumn(BaseModel):
    status: str
    count: int
    items: list[MaintenanceResponse] = Field(default_factory=list)


class KanbanBoard(BaseModel):
    columns: list[KanbanColumn]
