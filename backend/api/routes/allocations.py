from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from core.database import get_db
from core.security import get_current_user, require_role
from models.allocation import Allocation
from models.user import User
from schemas.allocation import AllocationCreate, AllocationResponse, AllocationReturn
from services.allocation_service import create_allocation, list_history_for_asset, return_allocation

router = APIRouter(prefix="/allocations", tags=["allocations"])


@router.get("", response_model=list[AllocationResponse])
async def list_allocations(
    db: Annotated[AsyncSession, Depends(get_db)],
    user: Annotated[User, Depends(get_current_user)],
    status: str | None = Query(default=None),
    asset_id: int | None = Query(default=None),
):
    if asset_id is not None:
        return await list_history_for_asset(db, asset_id)
    stmt = select(Allocation).order_by(Allocation.allocated_at.desc())
    if status:
        stmt = stmt.where(Allocation.status == status)

    # Org-wide read for active/overdue so any role can request transfers of held assets.
    org_wide_statuses = {"active", "overdue"}
    if status in org_wide_statuses:
        return (await db.scalars(stmt)).all()

    if user.role == "employee":
        stmt = stmt.where(Allocation.holder_user_id == user.id)
    elif user.role == "dept_head" and user.department_id:
        dept_user_ids = (
            await db.scalars(select(User.id).where(User.department_id == user.department_id))
        ).all()
        stmt = stmt.where(
            (Allocation.holder_department_id == user.department_id)
            | (Allocation.holder_user_id.in_(dept_user_ids))
        )
    return (await db.scalars(stmt)).all()


@router.post(
    "",
    response_model=AllocationResponse,
    dependencies=[Depends(require_role("admin", "asset_manager", "dept_head"))],
)
async def allocate(payload: AllocationCreate, db: Annotated[AsyncSession, Depends(get_db)]):
    return await create_allocation(db, payload)


@router.post("/{allocation_id}/return", response_model=AllocationResponse)
async def return_asset(
    allocation_id: int,
    payload: AllocationReturn,
    db: Annotated[AsyncSession, Depends(get_db)],
    user: Annotated[User, Depends(get_current_user)],
):
    allocation = await db.get(Allocation, allocation_id)
    if not allocation:
        raise HTTPException(status_code=404, detail="Allocation not found")

    if user.role == "employee" and allocation.holder_user_id != user.id:
        raise HTTPException(status_code=403, detail="You can only return assets allocated to you")
    if user.role == "dept_head" and user.department_id:
        if allocation.holder_department_id == user.department_id:
            pass
        elif allocation.holder_user_id:
            holder = await db.get(User, allocation.holder_user_id)
            if not holder or holder.department_id != user.department_id:
                raise HTTPException(status_code=403, detail="Allocation is outside your department")
        else:
            raise HTTPException(status_code=403, detail="Allocation is outside your department")
    elif user.role not in {"admin", "asset_manager", "dept_head", "employee"}:
        raise HTTPException(status_code=403, detail="Insufficient permissions")

    return await return_allocation(db, allocation_id, payload)
