from datetime import UTC, date, datetime, timedelta

from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncSession

from core.database import AsyncSessionLocal
from models.allocation import Allocation
from models.asset import Asset
from models.booking import Booking
from services.notify import create_notification, log_activity, notify_roles
from services.transitions import assert_transition


async def scan_overdue() -> dict[str, int]:
    flagged_allocations = 0
    completed_bookings = 0
    reminders = 0
    marked_ongoing = 0

    async with AsyncSessionLocal() as db:
        flagged_allocations = await _flag_overdue_allocations(db)
        marked_ongoing = await _mark_ongoing_bookings(db)
        reminders = await _send_booking_reminders(db)
        completed_bookings = await _complete_stale_bookings(db)
        await db.commit()

    return {
        "overdue_allocations": flagged_allocations,
        "completed_bookings": completed_bookings,
        "booking_reminders": reminders,
        "ongoing_bookings": marked_ongoing,
    }


async def _flag_overdue_allocations(db: AsyncSession) -> int:
    today = date.today()
    rows = (
        await db.scalars(
            select(Allocation).where(
                Allocation.status == "active",
                Allocation.expected_return_date.is_not(None),
                Allocation.expected_return_date < today,
            )
        )
    ).all()
    count = 0
    for allocation in rows:
        assert_transition(allocation.status, "overdue", "allocation")
        allocation.status = "overdue"
        asset = await db.get(Asset, allocation.asset_id)
        label = f"{asset.tag} ({asset.name})" if asset else f"asset #{allocation.asset_id}"
        message = f"Return overdue for {label}"
        await log_activity(db, None, "overdue", "allocation", allocation.id, {"asset_id": allocation.asset_id})
        if allocation.holder_user_id:
            await create_notification(
                db,
                allocation.holder_user_id,
                type="overdue_return",
                message=message,
                entity_type="allocation",
                entity_id=allocation.id,
            )
        await notify_roles(db, ("admin", "asset_manager"), "overdue_return", message, "allocation", allocation.id)
        count += 1
    return count


async def _mark_ongoing_bookings(db: AsyncSession) -> int:
    now = datetime.now(UTC)
    rows = (
        await db.execute(
            text(
                """
                SELECT id FROM bookings
                WHERE status = 'upcoming'
                  AND lower(slot) <= :now
                  AND upper(slot) > :now
                """
            ),
            {"now": now},
        )
    ).all()
    count = 0
    for (booking_id,) in rows:
        booking = await db.get(Booking, booking_id)
        if not booking or booking.status != "upcoming":
            continue
        assert_transition(booking.status, "ongoing", "booking")
        booking.status = "ongoing"
        count += 1
    return count


async def _send_booking_reminders(db: AsyncSession) -> int:
    """Notify bookers for slots starting within the next hour (once per booking)."""
    now = datetime.now(UTC)
    soon = now + timedelta(hours=1)
    rows = (
        await db.execute(
            text(
                """
                SELECT id FROM bookings
                WHERE status = 'upcoming'
                  AND lower(slot) > :now
                  AND lower(slot) <= :soon
                """
            ),
            {"now": now, "soon": soon},
        )
    ).all()
    count = 0
    for (booking_id,) in rows:
        booking = await db.get(Booking, booking_id)
        if not booking:
            continue
        # Skip if a reminder already exists for this booking
        existing = await db.execute(
            text(
                """
                SELECT 1 FROM notifications
                WHERE user_id = :user_id
                  AND type = 'booking_reminder'
                  AND related_entity_type = 'booking'
                  AND related_entity_id = :booking_id
                LIMIT 1
                """
            ),
            {"user_id": booking.booked_by, "booking_id": booking.id},
        )
        if existing.first():
            continue
        asset = await db.get(Asset, booking.resource_id)
        label = f"{asset.tag} / {asset.name}" if asset else f"resource #{booking.resource_id}"
        start = booking.slot.lower.isoformat() if booking.slot and booking.slot.lower else "soon"
        await create_notification(
            db,
            booking.booked_by,
            type="booking_reminder",
            message=f"Reminder: {label} starts at {start}",
            entity_type="booking",
            entity_id=booking.id,
        )
        count += 1
    return count


async def _complete_stale_bookings(db: AsyncSession) -> int:
    now = datetime.now(UTC)
    rows = (
        await db.execute(
            text(
                """
                SELECT id FROM bookings
                WHERE status IN ('upcoming', 'ongoing') AND upper(slot) < :now
                """
            ),
            {"now": now},
        )
    ).all()
    count = 0
    for (booking_id,) in rows:
        booking = await db.get(Booking, booking_id)
        if not booking or booking.status not in {"upcoming", "ongoing"}:
            continue
        assert_transition(booking.status, "completed", "booking")
        booking.status = "completed"
        asset = await db.get(Asset, booking.resource_id)
        label = asset.tag if asset else f"resource #{booking.resource_id}"
        message = f"Booking ended for {label}"
        await log_activity(db, None, "booking_ended", "booking", booking.id)
        await create_notification(
            db,
            booking.booked_by,
            type="booking_ended",
            message=message,
            entity_type="booking",
            entity_id=booking.id,
        )
        count += 1
    return count
