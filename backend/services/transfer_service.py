from datetime import UTC, datetime

from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from models.allocation import Allocation, TransferRequest
from models.asset import Asset
from services.transitions import assert_transition


async def act_on_transfer(db: AsyncSession, transfer: TransferRequest, action: str, actor_id: int) -> TransferRequest:
    target = {"approve": "approved", "reject": "rejected", "complete": "completed"}.get(action)
    if not target:
        raise HTTPException(status_code=400, detail="Invalid action")

    assert_transition(transfer.status, target, "transfer")

    if action == "approve":
        transfer.status = "approved"
        transfer.approved_by = actor_id
    elif action == "reject":
        transfer.status = "rejected"
    elif action == "complete":
        await _complete_transfer(db, transfer, actor_id)

    await db.commit()
    await db.refresh(transfer)
    return transfer


async def _complete_transfer(db: AsyncSession, transfer: TransferRequest, actor_id: int) -> None:
    active = await db.scalar(
        select(Allocation).where(Allocation.asset_id == transfer.asset_id, Allocation.status == "active")
    )
    if not active:
        raise HTTPException(status_code=400, detail="No active allocation to transfer")

    assert_transition(active.status, "returned", "allocation")
    active.status = "returned"
    active.returned_at = datetime.now(UTC)
    active.return_condition_notes = f"Transferred to user {transfer.to_holder_id}"

    new_allocation = Allocation(
        asset_id=transfer.asset_id,
        holder_user_id=transfer.to_holder_id,
        holder_department_id=None,
        expected_return_date=active.expected_return_date,
        status="active",
    )
    db.add(new_allocation)

    asset = await db.get(Asset, transfer.asset_id)
    if asset and asset.status != "allocated":
        assert_transition(asset.status, "allocated", "asset")
        asset.status = "allocated"

    transfer.status = "completed"
    transfer.approved_by = transfer.approved_by or actor_id
