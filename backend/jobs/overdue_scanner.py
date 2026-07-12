from __future__ import annotations

from datetime import datetime, timezone

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from sqlalchemy import select, text

from core.database import AsyncSessionLocal
from models.allocation import Allocation
from models.asset import Asset
from models.audit import ActivityLog, Notification
from models.booking import Booking
from models.user import User

scheduler = AsyncIOScheduler(timezone="UTC")


async def _create_notification(
    session,
    *,
    user_id: int,
    type_: str,
    message: str,
    related_entity_type: str,
    related_entity_id: int,
) -> None:
    existing = await session.scalar(
        select(Notification.id).where(
            Notification.user_id == user_id,
            Notification.type == type_,
            Notification.related_entity_type == related_entity_type,
            Notification.related_entity_id == related_entity_id,
        )
    )
    if existing:
        return

    session.add(
        Notification(
            user_id=user_id,
            type=type_,
            message=message,
            related_entity_type=related_entity_type,
            related_entity_id=related_entity_id,
            is_read=False,
        )
    )


async def scan_overdue_items() -> dict[str, int]:
    now = datetime.now(timezone.utc)
    today = now.date()

    async with AsyncSessionLocal() as session:
        privileged_user_ids = list(
            (
                await session.scalars(
                    select(User.id).where(User.role.in_(["admin", "asset_manager"]))
                )
            ).all()
        )

        allocations = (
            await session.scalars(
                select(Allocation).where(
                    Allocation.status == "active",
                    Allocation.expected_return_date.is_not(None),
                    Allocation.expected_return_date < today,
                )
            )
        ).all()
        allocation_updates = 0
        allocation_notifications = 0
        for allocation in allocations:
            allocation_updates += 1
            allocation.status = "overdue"
            asset = await session.get(Asset, allocation.asset_id)
            recipients = [allocation.holder_user_id] if allocation.holder_user_id else privileged_user_ids
            recipients = [user_id for user_id in recipients if user_id is not None]
            if not recipients:
                continue

            message = f"{asset.tag if asset else f'Asset #{allocation.asset_id}'} is overdue for return."
            for user_id in recipients:
                await _create_notification(
                    session,
                    user_id=user_id,
                    type_="allocation_overdue",
                    message=message,
                    related_entity_type="allocation",
                    related_entity_id=allocation.id,
                )
                allocation_notifications += 1

            session.add(
                ActivityLog(
                    actor_id=None,
                    action="allocation_marked_overdue",
                    entity_type="allocation",
                    entity_id=allocation.id,
                    log_metadata={"asset_id": allocation.asset_id, "expected_return_date": str(allocation.expected_return_date)},
                )
            )

        bookings = (
            await session.scalars(
                select(Booking).where(
                    Booking.status.in_(["upcoming", "ongoing"]),
                    text("upper(slot) < now()"),
                )
            )
        ).all()
        booking_updates = 0
        booking_notifications = 0
        for booking in bookings:
            booking_updates += 1
            booking.status = "completed"
            asset = await session.get(Asset, booking.resource_id)
            message = f"{asset.tag if asset else f'Resource #{booking.resource_id}'} booking has passed its scheduled slot."
            await _create_notification(
                session,
                user_id=booking.booked_by,
                type_="booking_overdue",
                message=message,
                related_entity_type="booking",
                related_entity_id=booking.id,
            )
            booking_notifications += 1

            session.add(
                ActivityLog(
                    actor_id=booking.booked_by,
                    action="booking_marked_overdue",
                    entity_type="booking",
                    entity_id=booking.id,
                    log_metadata={"resource_id": booking.resource_id},
                )
            )

        await session.commit()

    return {
        "allocation_updates": allocation_updates,
        "allocation_notifications": allocation_notifications,
        "booking_updates": booking_updates,
        "booking_notifications": booking_notifications,
    }


def start_overdue_scanner() -> None:
    if scheduler.running:
        return

    scheduler.add_job(
        scan_overdue_items,
        trigger="interval",
        minutes=1,
        id="overdue_scanner",
        replace_existing=True,
        coalesce=True,
        max_instances=1,
    )
    scheduler.start()


def stop_overdue_scanner() -> None:
    if scheduler.running:
        scheduler.shutdown(wait=False)
