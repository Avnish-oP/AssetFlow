from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from core.database import get_db
from core.security import get_current_user, require_role
from models.audit import ActivityLog, Notification
from models.user import User
from schemas.notification import ActivityLogResponse, NotificationResponse

router = APIRouter(prefix="/notifications", tags=["notifications"])


@router.get("", response_model=list[NotificationResponse])
async def list_notifications(
    db: Annotated[AsyncSession, Depends(get_db)],
    user: Annotated[User, Depends(get_current_user)],
    unread_only: bool = Query(default=False),
    limit: int = Query(default=50, le=100),
):
    stmt = (
        select(Notification)
        .where(Notification.user_id == user.id)
        .order_by(Notification.created_at.desc())
        .limit(limit)
    )
    if unread_only:
        stmt = stmt.where(Notification.is_read.is_(False))
    return (await db.scalars(stmt)).all()


@router.get(
    "/activity",
    response_model=list[ActivityLogResponse],
    dependencies=[Depends(require_role("admin", "asset_manager", "dept_head"))],
)
async def list_activity(
    db: Annotated[AsyncSession, Depends(get_db)],
    limit: int = Query(default=50, le=100),
):
    rows = (
        await db.scalars(select(ActivityLog).order_by(ActivityLog.created_at.desc()).limit(limit))
    ).all()

    # Resolve actor IDs → names in one batch query
    actor_ids = {row.actor_id for row in rows if row.actor_id is not None}
    name_map: dict[int, str] = {}
    if actor_ids:
        users = (await db.scalars(select(User).where(User.id.in_(actor_ids)))).all()
        name_map = {u.id: u.name for u in users}

    return [ActivityLogResponse.from_row(row, actor_name=name_map.get(row.actor_id)) for row in rows]


@router.patch("/{notification_id}/read", response_model=NotificationResponse)
async def mark_read(
    notification_id: int,
    db: Annotated[AsyncSession, Depends(get_db)],
    user: Annotated[User, Depends(get_current_user)],
):
    row = await db.get(Notification, notification_id)
    if not row or row.user_id != user.id:
        raise HTTPException(status_code=404, detail="Notification not found")
    row.is_read = True
    await db.commit()
    await db.refresh(row)
    return row


@router.post("/read-all", response_model=dict)
async def mark_all_read(
    db: Annotated[AsyncSession, Depends(get_db)],
    user: Annotated[User, Depends(get_current_user)],
):
    rows = (
        await db.scalars(
            select(Notification).where(Notification.user_id == user.id, Notification.is_read.is_(False))
        )
    ).all()
    for row in rows:
        row.is_read = True
    await db.commit()
    return {"updated": len(rows)}
