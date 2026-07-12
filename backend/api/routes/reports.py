from typing import Annotated

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from core.database import get_db
from core.security import get_current_user, require_role
from models.user import User
from schemas.report import (
    AssetUsageReport,
    BookingHeatmapReport,
    DashboardSummary,
    DepartmentAllocationReport,
    MaintenanceFrequencyReport,
    RetirementReport,
    UtilizationReport,
)
from services import report_service as svc

router = APIRouter(
    prefix="/reports",
    tags=["reports"],
    dependencies=[Depends(require_role("admin", "asset_manager", "dept_head"))],
)


@router.get("/summary", response_model=DashboardSummary)
async def reports_summary(
    db: Annotated[AsyncSession, Depends(get_db)],
    user: Annotated[User, Depends(get_current_user)],
):
    return await svc.dashboard_summary(db, user_id=user.id)


@router.get("/utilization", response_model=UtilizationReport)
async def reports_utilization(db: Annotated[AsyncSession, Depends(get_db)]):
    return await svc.utilization(db)


@router.get("/assets/usage", response_model=AssetUsageReport)
async def reports_asset_usage(db: Annotated[AsyncSession, Depends(get_db)]):
    return await svc.asset_usage(db)


@router.get("/maintenance/frequency", response_model=MaintenanceFrequencyReport)
async def reports_maintenance_frequency(db: Annotated[AsyncSession, Depends(get_db)]):
    return await svc.maintenance_frequency(db)


@router.get("/retirement", response_model=RetirementReport)
async def reports_retirement(db: Annotated[AsyncSession, Depends(get_db)]):
    return await svc.retirement_candidates(db)


@router.get("/bookings/heatmap", response_model=BookingHeatmapReport)
async def reports_booking_heatmap(db: Annotated[AsyncSession, Depends(get_db)]):
    return await svc.booking_heatmap(db)


@router.get("/departments/allocations", response_model=DepartmentAllocationReport)
async def reports_department_allocations(db: Annotated[AsyncSession, Depends(get_db)]):
    return await svc.department_allocation_summary(db)
