from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncSession

from core.database import get_db
from core.security import get_current_user
from models.booking import Booking
from models.user import User
from schemas.booking import BookingCreate
from services.booking_service import create_booking

router = APIRouter(prefix="/bookings", tags=["bookings"])


def serialize_booking(booking: Booking) -> dict:
    return {
        "id": booking.id,
        "resource_id": booking.resource_id,
        "booked_by": booking.booked_by,
        "status": booking.status,
        "start": booking.slot.lower if booking.slot else None,
        "end": booking.slot.upper if booking.slot else None,
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
    rows = await db.execute(
        text(
            """
            SELECT id, resource_id, booked_by, status, lower(slot) AS start, upper(slot) AS "end"
            FROM bookings
            WHERE resource_id = :resource_id
              AND date(lower(slot)) = (:date)::date
            ORDER BY lower(slot)
            """
        ),
        {"resource_id": resource_id, "date": date},
    )
    return [dict(row) for row in rows.mappings().all()]


@router.post("/{booking_id}/cancel")
async def cancel_booking(booking_id: int, db: Annotated[AsyncSession, Depends(get_db)]):
    booking = await db.get(Booking, booking_id)
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")
    booking.status = "cancelled"
    await db.commit()
    return serialize_booking(booking)
