from typing import Annotated

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from core.database import get_db
from core.security import get_current_user, require_role
from models.asset import Asset
from models.user import User
from schemas.maintenance import (
    KanbanBoard,
    KanbanColumn,
    MaintenanceCreate,
    MaintenanceResponse,
    MaintenanceStatusUpdate,
)
from services import maintenance_service as svc

router = APIRouter(prefix="/maintenance", tags=["maintenance"])


@router.get("", response_model=list[MaintenanceResponse])
async def list_maintenance(
    db: Annotated[AsyncSession, Depends(get_db)],
    _: Annotated[User, Depends(get_current_user)],
    status_filter: str | None = Query(default=None, alias="status"),
    priority: str | None = None,
):
    return await svc.list_requests(db, status=status_filter, priority=priority)


@router.get("/kanban", response_model=KanbanBoard)
async def maintenance_kanban(
    db: Annotated[AsyncSession, Depends(get_db)],
    _: Annotated[User, Depends(get_current_user)],
):
    grouped = await svc.get_kanban_grouped(db)
    columns = [
        KanbanColumn(status=status_name, count=len(items), items=items)
        for status_name, items in grouped.items()
        if status_name in svc.KANBAN_COLUMNS
    ]
    order = {name: index for index, name in enumerate(svc.KANBAN_COLUMNS)}
    columns.sort(key=lambda column: order.get(column.status, 99))
    return KanbanBoard(columns=columns)


@router.post("", response_model=MaintenanceResponse, status_code=status.HTTP_201_CREATED)
async def create_maintenance(
    payload: MaintenanceCreate,
    db: Annotated[AsyncSession, Depends(get_db)],
    user: Annotated[User, Depends(get_current_user)],
):
    request = await svc.create_request(db, payload, raised_by=user.id)
    asset = await db.get(Asset, request.asset_id)
    return svc._to_response(request, asset)


@router.get("/{request_id}", response_model=MaintenanceResponse)
async def get_maintenance(
    request_id: int,
    db: Annotated[AsyncSession, Depends(get_db)],
    _: Annotated[User, Depends(get_current_user)],
):
    request = await svc.get_request(db, request_id)
    asset = await db.get(Asset, request.asset_id)
    return svc._to_response(request, asset)


@router.patch(
    "/{request_id}/status",
    response_model=MaintenanceResponse,
    dependencies=[Depends(require_role("admin", "asset_manager"))],
)
async def update_maintenance_status(
    request_id: int,
    payload: MaintenanceStatusUpdate,
    db: Annotated[AsyncSession, Depends(get_db)],
    user: Annotated[User, Depends(get_current_user)],
):
    request = await svc.advance_status(db, request_id, payload, actor_id=user.id)
    asset = await db.get(Asset, request.asset_id)
    return svc._to_response(request, asset)
