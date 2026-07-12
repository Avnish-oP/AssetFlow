from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from core.database import get_db
from core.security import get_current_user, require_role
from models.asset import Asset
from models.audit import AuditCycle
from models.user import User
from schemas.audit import (
    AuditCycleCreate,
    AuditCycleDetail,
    AuditCycleResponse,
    AuditItemResponse,
    AuditItemVerify,
    DiscrepancyReport,
)
from services import audit_service as svc

router = APIRouter(
    prefix="/audits",
    tags=["audits"],
    dependencies=[Depends(require_role("admin", "asset_manager"))],
)


@router.get("", response_model=list[AuditCycleResponse])
async def list_audits(db: Annotated[AsyncSession, Depends(get_db)]):
    return await svc.list_cycles(db)


@router.post("", response_model=AuditCycleResponse, status_code=status.HTTP_201_CREATED)
async def create_audit(
    payload: AuditCycleCreate,
    db: Annotated[AsyncSession, Depends(get_db)],
    user: Annotated[User, Depends(get_current_user)],
):
    cycle = await svc.create_cycle(db, payload, created_by=user.id)
    return await svc._cycle_response(db, cycle)


@router.get("/{cycle_id}", response_model=AuditCycleDetail)
async def get_audit(cycle_id: int, db: Annotated[AsyncSession, Depends(get_db)]):
    return await svc.get_cycle_detail(db, cycle_id)


@router.post("/{cycle_id}/items", response_model=AuditCycleDetail)
async def populate_audit_items(cycle_id: int, db: Annotated[AsyncSession, Depends(get_db)]):
    cycle = await db.get(AuditCycle, cycle_id)
    if not cycle:
        raise HTTPException(status_code=404, detail="Audit cycle not found")
    await svc.populate_items(db, cycle)
    return await svc.get_cycle_detail(db, cycle_id)


@router.patch("/{cycle_id}/items/{item_id}", response_model=AuditItemResponse)
async def verify_audit_item(
    cycle_id: int,
    item_id: int,
    payload: AuditItemVerify,
    db: Annotated[AsyncSession, Depends(get_db)],
    user: Annotated[User, Depends(get_current_user)],
):
    item = await svc.verify_item(db, cycle_id, item_id, payload, actor_id=user.id)
    asset = await db.get(Asset, item.asset_id)
    return svc._item_response(item, asset)


@router.post("/{cycle_id}/close", response_model=AuditCycleResponse)
async def close_audit(cycle_id: int, db: Annotated[AsyncSession, Depends(get_db)]):
    cycle = await svc.close_cycle(db, cycle_id)
    return await svc._cycle_response(db, cycle)


@router.get("/{cycle_id}/report", response_model=DiscrepancyReport)
async def audit_report(cycle_id: int, db: Annotated[AsyncSession, Depends(get_db)]):
    return await svc.discrepancy_report(db, cycle_id)
