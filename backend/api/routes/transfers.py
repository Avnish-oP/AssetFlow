from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from core.database import get_db
from core.security import get_current_user, require_role
from models.allocation import Allocation, TransferRequest
from models.user import User
from schemas.allocation import TransferCreate, TransferResponse
from services.transfer_service import act_on_transfer, create_transfer_request

router = APIRouter(prefix="/transfers", tags=["transfers"])


@router.get("", response_model=list[TransferResponse], dependencies=[Depends(require_role("admin", "asset_manager", "dept_head"))])
async def list_transfers(
    db: Annotated[AsyncSession, Depends(get_db)],
    user: Annotated[User, Depends(get_current_user)],
):
    stmt = select(TransferRequest).order_by(TransferRequest.created_at.desc())
    if user.role == "dept_head" and user.department_id:
        dept_user_ids = (
            await db.scalars(select(User.id).where(User.department_id == user.department_id))
        ).all()
        stmt = stmt.where(
            or_(
                TransferRequest.from_holder_id.in_(dept_user_ids),
                TransferRequest.to_holder_id.in_(dept_user_ids),
                TransferRequest.requested_by.in_(dept_user_ids),
            )
        )
    return (await db.scalars(stmt)).all()


@router.post("", response_model=TransferResponse)
async def create_transfer(
    payload: TransferCreate,
    db: Annotated[AsyncSession, Depends(get_db)],
    user: Annotated[User, Depends(get_current_user)],
):
    active = await db.scalar(select(Allocation).where(Allocation.asset_id == payload.asset_id, Allocation.status == "active"))
    return await create_transfer_request(
        db,
        asset_id=payload.asset_id,
        to_holder_id=payload.to_holder_id,
        reason=payload.reason,
        requested_by=user.id,
        from_holder_id=active.holder_user_id if active else None,
    )


@router.post(
    "/{transfer_id}/{action}",
    response_model=TransferResponse,
    dependencies=[Depends(require_role("admin", "asset_manager", "dept_head"))],
)
async def transfer_action(
    transfer_id: int,
    action: str,
    db: Annotated[AsyncSession, Depends(get_db)],
    user: Annotated[User, Depends(get_current_user)],
):
    transfer = await db.get(TransferRequest, transfer_id)
    if not transfer:
        raise HTTPException(status_code=404, detail="Transfer not found")

    if user.role == "dept_head":
        if not user.department_id:
            raise HTTPException(status_code=403, detail="Department head has no department")
        parties = {transfer.from_holder_id, transfer.to_holder_id, transfer.requested_by}
        parties.discard(None)
        party_users = (await db.scalars(select(User).where(User.id.in_(parties)))).all() if parties else []
        if not any(u.department_id == user.department_id for u in party_users):
            raise HTTPException(status_code=403, detail="Transfer is outside your department")

    return await act_on_transfer(db, transfer, action, actor_id=user.id)
