from pydantic import BaseModel, Field


class DashboardSummary(BaseModel):
    available: int = 0
    allocated: int = 0
    maintenance: int = 0
    bookings_today: int = 0
    pending_transfers: int = 0
    due_this_week: int = 0
    returned_this_week: int = 0
    overdue_allocations: int = 0
    unread_notifications: int = 0


class UtilizationPoint(BaseModel):
    date: str
    allocations: int = 0
    bookings: int = 0


class UtilizationReport(BaseModel):
    series: list[UtilizationPoint] = Field(default_factory=list)


class AssetUsageItem(BaseModel):
    asset_id: int
    tag: str
    name: str
    status: str
    allocation_count: int = 0
    booking_count: int = 0


class AssetUsageReport(BaseModel):
    most_used: list[AssetUsageItem] = Field(default_factory=list)
    idle: list[AssetUsageItem] = Field(default_factory=list)


class MaintenanceFrequencyItem(BaseModel):
    asset_id: int
    tag: str
    name: str
    request_count: int


class MaintenanceFrequencyReport(BaseModel):
    items: list[MaintenanceFrequencyItem] = Field(default_factory=list)


class RetirementItem(BaseModel):
    asset_id: int
    tag: str
    name: str
    condition: str
    status: str
    acquisition_date: str | None = None
    reason: str


class RetirementReport(BaseModel):
    items: list[RetirementItem] = Field(default_factory=list)


class BookingHeatmapCell(BaseModel):
    weekday: int  # 0=Mon .. 6=Sun
    hour: int
    count: int = 0


class BookingHeatmapReport(BaseModel):
    cells: list[BookingHeatmapCell] = Field(default_factory=list)


class DepartmentAllocationRow(BaseModel):
    department_id: int | None = None
    department_name: str
    active_allocations: int = 0
    overdue_allocations: int = 0


class DepartmentAllocationReport(BaseModel):
    items: list[DepartmentAllocationRow] = Field(default_factory=list)
