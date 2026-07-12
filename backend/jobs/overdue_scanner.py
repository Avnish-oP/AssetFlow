from datetime import UTC, date, datetime

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

    async with AsyncSessionLocal() as db:
        flagged_allocations = await _flag_overdue_allocations(db)
        completed_bookings = await _complete_stale_bookings(db)
        await db.commit()

    return {"overdue_allocations": flagged_allocations, "completed_bookings": completed_bookings}


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


async def _complete_stale_bookings(db: AsyncSession) -> int:
    now = datetime.now(UTC)
    rows = (
        await db.execute(
            text(
                """
                SELECT id FROM bookings
                WHERE status = 'upcoming' AND upper(slot) < :now
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
