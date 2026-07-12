from typing import Annotated

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from core.database import get_db
from core.security import get_current_user, require_role
from models.user import User
from schemas.resource_request import (
    ResourceRequestCreate,
    ResourceRequestResponse,
    ResourceRequestReview,
)
from services.resource_request_service import (
    create_resource_request,
    list_resource_requests,
    review_resource_request,
)

router = APIRouter(prefix="/resource-requests", tags=["resource-requests"])


@router.get("", response_model=list[ResourceRequestResponse])
async def list_requests(
    db: Annotated[AsyncSession, Depends(get_db)],
    user: Annotated[User, Depends(get_current_user)],
    status: str | None = Query(default=None),
    mine: bool = Query(default=False),
):
    """List resource requests. Employees see only their own; admins/managers see all."""
    user_id = None
    if mine or user.role == "employee":
        user_id = user.id
    return await list_resource_requests(db, status=status, user_id=user_id)


@router.post("", response_model=ResourceRequestResponse)
async def create_request(
    payload: ResourceRequestCreate,
    db: Annotated[AsyncSession, Depends(get_db)],
    user: Annotated[User, Depends(get_current_user)],
):
    """Any authenticated user can request an available resource."""
    rr = await create_resource_request(db, payload, user)
    # Re-fetch with joined fields
    rows = await list_resource_requests(db, user_id=None)
    return next((r for r in rows if r["id"] == rr.id), rr)


@router.post(
    "/{request_id}/review",
    response_model=ResourceRequestResponse,
    dependencies=[Depends(require_role("admin", "asset_manager"))],
)
async def review_request(
    request_id: int,
    payload: ResourceRequestReview,
    db: Annotated[AsyncSession, Depends(get_db)],
    user: Annotated[User, Depends(require_role("admin", "asset_manager"))],
):
    """Admin or asset manager approves/rejects a request."""
    rr = await review_resource_request(db, request_id, payload, user)
    rows = await list_resource_requests(db, user_id=None)
    return next((r for r in rows if r["id"] == rr.id), rr)
