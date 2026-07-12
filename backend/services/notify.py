from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from models.audit import ActivityLog, Notification
from models.user import User


async def create_notification(
    db: AsyncSession,
    user_id: int,
    type: str,
    message: str,
    entity_type: str | None = None,
    entity_id: int | None = None,
) -> Notification:
    row = Notification(
        user_id=user_id,
        type=type,
        message=message,
        related_entity_type=entity_type,
        related_entity_id=entity_id,
        is_read=False,
    )
    db.add(row)
    return row


async def log_activity(
    db: AsyncSession,
    actor_id: int | None,
    action: str,
    entity_type: str,
    entity_id: int | None = None,
    metadata: dict | None = None,
) -> ActivityLog:
    row = ActivityLog(
        actor_id=actor_id,
        action=action,
        entity_type=entity_type,
        entity_id=entity_id,
        log_metadata=metadata or {},
    )
    db.add(row)
    return row


async def notify_roles(
    db: AsyncSession,
    roles: list[str] | tuple[str, ...],
    type: str,
    message: str,
    entity_type: str | None = None,
    entity_id: int | None = None,
    exclude_user_id: int | None = None,
) -> list[Notification]:
    users = (
        await db.scalars(select(User).where(User.role.in_(list(roles)), User.status == "active"))
    ).all()
    created: list[Notification] = []
    for user in users:
        if exclude_user_id is not None and user.id == exclude_user_id:
            continue
        created.append(
            await create_notification(
                db,
                user.id,
                type=type,
                message=message,
                entity_type=entity_type,
                entity_id=entity_id,
            )
        )
    return created


async def notify_user_ids(
    db: AsyncSession,
    user_ids: list[int | None],
    type: str,
    message: str,
    entity_type: str | None = None,
    entity_id: int | None = None,
) -> None:
    seen: set[int] = set()
    for user_id in user_ids:
        if user_id is None or user_id in seen:
            continue
        seen.add(user_id)
        await create_notification(
            db,
            user_id,
            type=type,
            message=message,
            entity_type=entity_type,
            entity_id=entity_id,
        )
