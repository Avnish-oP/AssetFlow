from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import desc, select
from sqlalchemy.ext.asyncio import AsyncSession

from core.database import get_db
from core.security import get_current_user
from models.audit import Notification
from models.user import User

router = APIRouter(prefix="/notifications", tags=["notifications"])


def serialize_notification(notification: Notification, recipient_name: str, recipient_email: str) -> dict:
    return {
        "id": notification.id,
        "user_id": notification.user_id,
        "user_name": recipient_name,
        "user_email": recipient_email,
        "type": notification.type,
        "message": notification.message,
        "related_entity_type": notification.related_entity_type,
        "related_entity_id": notification.related_entity_id,
        "is_read": notification.is_read,
        "created_at": notification.created_at.isoformat() if notification.created_at else None,
    }


@router.get("")
async def list_notifications(
    db: Annotated[AsyncSession, Depends(get_db)],
    user: Annotated[User, Depends(get_current_user)],
    limit: int = Query(50, ge=1, le=200),
    unread_only: bool = False,
):
    stmt = (
        select(Notification, User.name, User.email)
        .join(User, User.id == Notification.user_id)
        .order_by(desc(Notification.created_at), desc(Notification.id))
        .limit(limit)
    )
    if user.role not in {"admin", "asset_manager"}:
        stmt = stmt.where(Notification.user_id == user.id)
    if unread_only:
        stmt = stmt.where(Notification.is_read.is_(False))

    rows = await db.execute(stmt)
    return [serialize_notification(notification, name, email) for notification, name, email in rows.all()]


@router.patch("/{notification_id}/read")
async def mark_notification_read(
    notification_id: int,
    db: Annotated[AsyncSession, Depends(get_db)],
    user: Annotated[User, Depends(get_current_user)],
):
    notification = await db.get(Notification, notification_id)
    if not notification:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Notification not found")
    if user.role not in {"admin", "asset_manager"} and notification.user_id != user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not allowed to edit this notification")

    notification.is_read = True
    await db.commit()

    recipient = await db.get(User, notification.user_id)
    return serialize_notification(notification, recipient.name if recipient else "Unknown", recipient.email if recipient else "")
