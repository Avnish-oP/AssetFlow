from datetime import UTC, datetime

from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from models.allocation import Allocation
from models.asset import Asset
from models.maintenance import MaintenanceRequest
from schemas.maintenance import MaintenanceCreate, MaintenanceResponse, MaintenanceStatusUpdate
from services.transitions import assert_transition

KANBAN_COLUMNS = ["pending", "approved", "technician_assigned", "in_progress", "resolved"]


def _to_response(row: MaintenanceRequest, asset: Asset | None = None) -> MaintenanceResponse:
    return MaintenanceResponse(
        id=row.id,
        asset_id=row.asset_id,
        raised_by=row.raised_by,
        issue_description=row.issue_description,
        priority=row.priority,
        photo_url=row.photo_url,
        status=row.status,
        approved_by=row.approved_by,
        technician_name=row.technician_name,
        resolved_at=row.resolved_at,
        created_at=row.created_at,
        asset_tag=asset.tag if asset else None,
        asset_name=asset.name if asset else None,
    )


async def create_request(db: AsyncSession, payload: MaintenanceCreate, raised_by: int) -> MaintenanceRequest:
    asset = await db.get(Asset, payload.asset_id)
    if not asset:
        raise HTTPException(status_code=404, detail="Asset not found")
    if asset.status in {"lost", "retired", "disposed"}:
        raise HTTPException(status_code=400, detail=f"Cannot raise maintenance for asset in status {asset.status}")

    assert_transition(asset.status, "maintenance", "asset")
    asset.status = "maintenance"

    request = MaintenanceRequest(
        asset_id=payload.asset_id,
        raised_by=raised_by,
        issue_description=payload.issue_description,
        priority=payload.priority,
        photo_url=payload.photo_url,
        status="pending",
    )
    db.add(request)
    await db.commit()
    await db.refresh(request)
    return request


async def get_request(db: AsyncSession, request_id: int) -> MaintenanceRequest:
    request = await db.get(MaintenanceRequest, request_id)
    if not request:
        raise HTTPException(status_code=404, detail="Maintenance request not found")
    return request


async def list_requests(
    db: AsyncSession,
    status: str | None = None,
    priority: str | None = None,
) -> list[MaintenanceResponse]:
    stmt = (
        select(MaintenanceRequest, Asset)
        .join(Asset, MaintenanceRequest.asset_id == Asset.id, isouter=True)
        .order_by(MaintenanceRequest.created_at.desc())
    )
    if status:
        stmt = stmt.where(MaintenanceRequest.status == status)
    if priority:
        stmt = stmt.where(MaintenanceRequest.priority == priority)
    rows = (await db.execute(stmt)).all()
    return [_to_response(request, asset) for request, asset in rows]


async def advance_status(
    db: AsyncSession,
    request_id: int,
    payload: MaintenanceStatusUpdate,
    actor_id: int,
) -> MaintenanceRequest:
    request = await get_request(db, request_id)
    target = payload.status
    assert_transition(request.status, target, "maintenance")

    if target == "approved":
        request.approved_by = actor_id
    if target == "technician_assigned":
        if not payload.technician_name and not request.technician_name:
            raise HTTPException(status_code=400, detail="technician_name is required")
        if payload.technician_name:
            request.technician_name = payload.technician_name
    if target == "resolved":
        request.resolved_at = datetime.now(UTC)
        asset = await db.get(Asset, request.asset_id)
        if asset and asset.status == "maintenance":
            active = await db.scalar(
                select(Allocation).where(Allocation.asset_id == asset.id, Allocation.status == "active")
            )
            restore = "allocated" if active else "available"
            assert_transition(asset.status, restore, "asset")
            asset.status = restore

    request.status = target
    await db.commit()
    await db.refresh(request)
    return request


async def get_kanban_grouped(db: AsyncSession) -> dict[str, list[MaintenanceResponse]]:
    items = await list_requests(db)
    grouped: dict[str, list[MaintenanceResponse]] = {column: [] for column in KANBAN_COLUMNS}
    for item in items:
        if item.status in grouped:
            grouped[item.status].append(item)
        elif item.status == "rejected":
            continue
        else:
            grouped.setdefault(item.status, []).append(item)
    return grouped
