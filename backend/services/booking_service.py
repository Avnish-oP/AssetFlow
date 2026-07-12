from fastapi import HTTPException
from fastapi.encoders import jsonable_encoder
from sqlalchemy import select, text
from sqlalchemy.exc import DBAPIError, IntegrityError
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
    if not conflict:
        return {}
    return {
        "id": conflict["id"],
        "resource_id": conflict["resource_id"],
        "booked_by": conflict["booked_by"],
        "booked_by_name": conflict["booked_by_name"],
        "start": conflict["start"].isoformat() if conflict["start"] else None,
        "end": conflict["end"].isoformat() if conflict["end"] else None,
    }


async def create_booking(db: AsyncSession, payload: BookingCreate, user_id: int) -> Booking:
    asset = await db.scalar(select(Asset).where(Asset.id == payload.resource_id, Asset.is_bookable.is_(True)))
    if not asset:
        raise HTTPException(status_code=404, detail="Bookable resource not found")
    booking = Booking(
        resource_id=payload.resource_id,
        booked_by=user_id,
        slot=Range(payload.start, payload.end, bounds="[)"),
        status="upcoming",
    )
    db.add(booking)
    try:
        await db.commit()
    except (IntegrityError, DBAPIError) as exc:
        await db.rollback()
        detail = jsonable_encoder(
            {
                "error": "slot unavailable",
                "resource_id": payload.resource_id,
                "conflicting_booking": await _conflict_payload(db, payload.resource_id, payload.start, payload.end),
            }
        )
        raise HTTPException(status_code=409, detail=detail) from exc
    await db.refresh(booking)
    return booking
