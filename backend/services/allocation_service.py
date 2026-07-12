from datetime import UTC, datetime

from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from models.allocation import Allocation
from models.asset import Asset
from models.department import Department
from models.user import User
from schemas.allocation import AllocationCreate, AllocationReturn
from services.transitions import assert_transition


async def _holder_payload(db: AsyncSession, asset_id: int) -> dict:
    row = await db.execute(
        select(Allocation, User, Department)
        .join(User, Allocation.holder_user_id == User.id, isouter=True)
        .join(Department, User.department_id == Department.id, isouter=True)
        .where(Allocation.asset_id == asset_id, Allocation.status == "active")
        .order_by(Allocation.allocated_at.desc())
    )
    record = row.first()
    if not record:
        return {}
    allocation, user, department = record
    return {
        "allocation_id": allocation.id,
        "holder_user_id": user.id if user else None,
        "holder_name": user.name if user else "Department holder",
        "department": department.name if department else None,
    }


async def create_allocation(db: AsyncSession, payload: AllocationCreate) -> Allocation:
    asset = await db.get(Asset, payload.asset_id)
    if not asset:
        raise HTTPException(status_code=404, detail="Asset not found")
    if asset.status != "available":
        raise HTTPException(
            status_code=409,
            detail={
                "error": "asset already allocated",
                "asset_id": asset.id,
                "asset_tag": asset.tag,
                "asset_name": asset.name,
                "current_holder": await _holder_payload(db, asset.id),
            },
        )
    allocation = Allocation(**payload.model_dump(), status="active")
    assert_transition(asset.status, "allocated", "asset")
    asset.status = "allocated"
    db.add(allocation)
    try:
        await db.commit()
    except IntegrityError as exc:
        await db.rollback()
        raise HTTPException(
            status_code=409,
            detail={
                "error": "asset already allocated",
                "asset_id": asset.id,
                "asset_tag": asset.tag,
                "asset_name": asset.name,
                "current_holder": await _holder_payload(db, asset.id),
            },
        ) from exc
    await db.refresh(allocation)
    return allocation


async def return_allocation(db: AsyncSession, allocation_id: int, payload: AllocationReturn) -> Allocation:
    allocation = await db.get(Allocation, allocation_id)
    if not allocation:
        raise HTTPException(status_code=404, detail="Allocation not found")
    if allocation.status not in {"active", "overdue"}:
        raise HTTPException(status_code=400, detail="Allocation is not returnable")
    asset = await db.get(Asset, allocation.asset_id)
    assert_transition(allocation.status, "returned", "allocation")
    allocation.status = "returned"
    allocation.returned_at = datetime.now(UTC)
    allocation.return_condition_notes = payload.return_condition_notes
    if asset:
        if payload.condition:
            asset.condition = payload.condition
        elif payload.return_condition_notes:
            notes = payload.return_condition_notes.lower()
            if "damage" in notes or "broken" in notes:
                asset.condition = "damaged"
            elif "fair" in notes or "wear" in notes:
                asset.condition = "fair"
            else:
                asset.condition = "good"
        if asset.status == "allocated":
            assert_transition(asset.status, "available", "asset")
            asset.status = "available"
    await db.commit()
    await db.refresh(allocation)
    return allocation


async def list_history_for_asset(db: AsyncSession, asset_id: int) -> list[Allocation]:
    return list(
        (
            await db.scalars(
                select(Allocation).where(Allocation.asset_id == asset_id).order_by(Allocation.allocated_at.desc())
            )
        ).all()
    )
