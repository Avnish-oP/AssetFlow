from fastapi import HTTPException
from sqlalchemy import select, text
from sqlalchemy.exc import IntegrityError
from sqlalchemy.dialects.postgresql import Range
from sqlalchemy.ext.asyncio import AsyncSession

from models.asset import Asset
from models.booking import Booking
from schemas.booking import BookingCreate


async def _conflict_payload(db: AsyncSession, resource_id: int, start, end) -> dict:
    row = await db.execute(
        text(
            """
            SELECT b.id, b.resource_id, b.booked_by, u.name AS booked_by_name,
                   lower(b.slot) AS start, upper(b.slot) AS "end"
            FROM bookings b
            JOIN users u ON u.id = b.booked_by
            WHERE b.resource_id = :resource_id
              AND b.status != 'cancelled'
              AND b.slot && tstzrange(:start, :end, '[)')
            ORDER BY lower(b.slot)
            LIMIT 1
            """
        ),
        {"resource_id": resource_id, "start": start, "end": end},
    )
    conflict = row.mappings().first()
    return dict(conflict) if conflict else {}


async def create_booking(db: AsyncSession, payload: BookingCreate, user_id: int) -> Booking:
    asset = await db.scalar(select(Asset).where(Asset.id == payload.resource_id, Asset.is_bookable.is_(True)))
    if not asset:
        raise HTTPException(status_code=404, detail="Bookable resource not found")
    booking = Booking(
        resource_id=payload.resource_id,
        booked_by=user_id,
        slot=Range(payload.start, payload.end, lower_inc=True, upper_inc=False),
        status="upcoming",
    )
    db.add(booking)
    try:
        await db.commit()
    except IntegrityError as exc:
        await db.rollback()
        raise HTTPException(
            status_code=409,
            detail={
                "error": "slot unavailable",
                "resource_id": payload.resource_id,
                "conflicting_booking": await _conflict_payload(db, payload.resource_id, payload.start, payload.end),
            },
        ) from exc
    await db.refresh(booking)
    return booking
