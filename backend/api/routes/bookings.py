from typing import Annotated
from datetime import date as date_type

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncSession

from core.database import get_db
from core.security import get_current_user
from models.booking import Booking
from models.user import User
from schemas.booking import BookingCreate, BookingReschedule
from services.booking_service import cancel_booking, create_booking, reschedule_booking

router = APIRouter(prefix="/bookings", tags=["bookings"])


def serialize_booking(booking: Booking) -> dict:
    return {
        "id": booking.id,
        "resource_id": booking.resource_id,
        "booked_by": booking.booked_by,
        "status": booking.status,
        "start": booking.slot.lower.isoformat() if booking.slot and booking.slot.lower else None,
        "end": booking.slot.upper.isoformat() if booking.slot and booking.slot.upper else None,
    }


@router.get("")
async def list_bookings(db: Annotated[AsyncSession, Depends(get_db)], resource_id: int | None = None):
    stmt = select(Booking).order_by(text("lower(slot) DESC"))
    if resource_id:
        stmt = stmt.where(Booking.resource_id == resource_id)
    return [serialize_booking(booking) for booking in (await db.scalars(stmt)).all()]


@router.post("")
async def book(payload: BookingCreate, db: Annotated[AsyncSession, Depends(get_db)], user: Annotated[User, Depends(get_current_user)]):
    return serialize_booking(await create_booking(db, payload, user.id))


@router.get("/slots")
async def slots(db: Annotated[AsyncSession, Depends(get_db)], resource_id: int, date: str = Query(...)):
    try:
        day = date_type.fromisoformat(date)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail="date must be YYYY-MM-DD") from exc

    rows = await db.execute(
        text(
            """
            SELECT b.id, b.resource_id, b.booked_by, u.name AS booked_by_name,
                   b.status, lower(b.slot) AS start, upper(b.slot) AS "end"
            FROM bookings b
            JOIN users u ON u.id = b.booked_by
            WHERE b.resource_id = :resource_id
              AND b.status != 'cancelled'
              AND lower(b.slot)::date = :day
            ORDER BY lower(b.slot)
            """
        ),
        {"resource_id": resource_id, "day": day},
    )
    return [
        {
            "id": row["id"],
            "resource_id": row["resource_id"],
            "booked_by": row["booked_by"],
            "booked_by_name": row["booked_by_name"],
            "status": row["status"],
            "start": row["start"].isoformat() if row["start"] else None,
            "end": row["end"].isoformat() if row["end"] else None,
        }
        for row in rows.mappings().all()
    ]


@router.post("/{booking_id}/cancel")
async def cancel_booking_route(
    booking_id: int,
    db: Annotated[AsyncSession, Depends(get_db)],
    user: Annotated[User, Depends(get_current_user)],
):
    return serialize_booking(await cancel_booking(db, booking_id, actor_id=user.id))


@router.post("/{booking_id}/reschedule")
async def reschedule_booking_route(
    booking_id: int,
    payload: BookingReschedule,
    db: Annotated[AsyncSession, Depends(get_db)],
    user: Annotated[User, Depends(get_current_user)],
):
    return serialize_booking(await reschedule_booking(db, booking_id, payload, actor_id=user.id))
