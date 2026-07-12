from typing import Annotated

from fastapi import APIRouter, Depends, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from core.database import get_db
from core.security import require_role
from models.allocation import Allocation
from schemas.allocation import AllocationCreate, AllocationResponse, AllocationReturn
from services.allocation_service import create_allocation, return_allocation

router = APIRouter(prefix="/allocations", tags=["allocations"], dependencies=[Depends(require_role("admin", "asset_manager", "dept_head"))])


@router.get("", response_model=list[AllocationResponse])
async def list_allocations(db: Annotated[AsyncSession, Depends(get_db)], status: str | None = Query(default=None)):
    stmt = select(Allocation).order_by(Allocation.allocated_at.desc())
    if status:
        stmt = stmt.where(Allocation.status == status)
    return (await db.scalars(stmt)).all()


@router.post("", response_model=AllocationResponse)
async def allocate(payload: AllocationCreate, db: Annotated[AsyncSession, Depends(get_db)]):
    return await create_allocation(db, payload)


@router.post("/{allocation_id}/return", response_model=AllocationResponse)
async def return_asset(allocation_id: int, payload: AllocationReturn, db: Annotated[AsyncSession, Depends(get_db)]):
    return await return_allocation(db, allocation_id, payload)

