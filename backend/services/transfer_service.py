from datetime import UTC, datetime

from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from models.allocation import Allocation, TransferRequest
from models.asset import Asset
from services.notify import log_activity, notify_roles, notify_user_ids
from services.transitions import assert_transition


async def create_transfer_request(
    db: AsyncSession,
    *,
    asset_id: int,
    to_holder_id: int,
    reason: str,
    requested_by: int,
    from_holder_id: int | None,
) -> TransferRequest:
    transfer = TransferRequest(
        asset_id=asset_id,
        from_holder_id=from_holder_id,
        to_holder_id=to_holder_id,
        reason=reason,
        requested_by=requested_by,
    )
    db.add(transfer)
    await db.flush()

    asset = await db.get(Asset, asset_id)
    label = f"{asset.tag} ({asset.name})" if asset else f"asset #{asset_id}"
    await log_activity(db, requested_by, "transfer_requested", "transfer", transfer.id, {"asset_id": asset_id})
    await notify_roles(
        db,
        ("admin", "asset_manager"),
        "transfer_requested",
        f"Transfer requested for {label}",
        "transfer",
        transfer.id,
    )
    await notify_user_ids(
        db,
        [to_holder_id, from_holder_id],
        type="transfer_requested",
        message=f"Transfer requested for {label}",
        entity_type="transfer",
        entity_id=transfer.id,
    )
    await db.commit()
    await db.refresh(transfer)
    return transfer


async def act_on_transfer(db: AsyncSession, transfer: TransferRequest, action: str, actor_id: int) -> TransferRequest:
    target = {"approve": "approved", "reject": "rejected", "complete": "completed"}.get(action)
    if not target:
        raise HTTPException(status_code=400, detail="Invalid action")

    assert_transition(transfer.status, target, "transfer")

    if action == "approve":
        transfer.status = "approved"
        transfer.approved_by = actor_id
        await log_activity(db, actor_id, "transfer_approved", "transfer", transfer.id)
        await notify_user_ids(
            db,
            [transfer.requested_by, transfer.to_holder_id, transfer.from_holder_id],
            type="transfer_approved",
            message=f"Transfer #{transfer.id} approved",
            entity_type="transfer",
            entity_id=transfer.id,
        )
        await notify_roles(db, ("admin", "asset_manager"), "transfer_approved", f"Transfer #{transfer.id} approved", "transfer", transfer.id)
    elif action == "reject":
        transfer.status = "rejected"
        await log_activity(db, actor_id, "transfer_rejected", "transfer", transfer.id)
        await notify_user_ids(
            db,
            [transfer.requested_by],
            type="transfer_rejected",
            message=f"Transfer #{transfer.id} rejected",
            entity_type="transfer",
            entity_id=transfer.id,
        )
    elif action == "complete":
        await _complete_transfer(db, transfer, actor_id)
        await log_activity(db, actor_id, "transfer_completed", "transfer", transfer.id)
        await notify_user_ids(
            db,
            [transfer.requested_by, transfer.to_holder_id, transfer.from_holder_id],
            type="transfer_completed",
            message=f"Transfer #{transfer.id} completed — asset reallocated",
            entity_type="transfer",
            entity_id=transfer.id,
        )
        await notify_roles(
            db,
            ("admin", "asset_manager"),
            "transfer_completed",
            f"Transfer #{transfer.id} completed",
            "transfer",
            transfer.id,
        )

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
