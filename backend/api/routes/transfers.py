from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from core.database import get_db
from core.security import get_current_user, require_role
from models.allocation import Allocation, TransferRequest
from models.user import User
from schemas.allocation import TransferCreate, TransferResponse
from services.transfer_service import act_on_transfer

router = APIRouter(prefix="/transfers", tags=["transfers"])


@router.get("", response_model=list[TransferResponse], dependencies=[Depends(require_role("admin", "asset_manager"))])
async def list_transfers(db: Annotated[AsyncSession, Depends(get_db)]):
    return (await db.scalars(select(TransferRequest).order_by(TransferRequest.created_at.desc()))).all()


@router.post("", response_model=TransferResponse)
async def create_transfer(
    payload: TransferCreate,
    db: Annotated[AsyncSession, Depends(get_db)],
    user: Annotated[User, Depends(get_current_user)],
):
    active = await db.scalar(select(Allocation).where(Allocation.asset_id == payload.asset_id, Allocation.status == "active"))
    transfer = TransferRequest(
        asset_id=payload.asset_id,
        from_holder_id=active.holder_user_id if active else None,
        to_holder_id=payload.to_holder_id,
        reason=payload.reason,
        requested_by=user.id,
    )
    db.add(transfer)
    await db.commit()
    await db.refresh(transfer)
    return transfer


@router.post("/{transfer_id}/{action}", response_model=TransferResponse, dependencies=[Depends(require_role("admin", "asset_manager"))])
async def transfer_action(
    transfer_id: int,
    action: str,
    db: Annotated[AsyncSession, Depends(get_db)],
    user: Annotated[User, Depends(get_current_user)],
):
    transfer = await db.get(TransferRequest, transfer_id)
    if not transfer:
        raise HTTPException(status_code=404, detail="Transfer not found")
    return await act_on_transfer(db, transfer, action, actor_id=user.id)
