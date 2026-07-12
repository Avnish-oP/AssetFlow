from datetime import UTC, datetime

from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from models.allocation import Allocation
from models.asset import Asset
from models.resource_request import ResourceRequest
from models.user import User
from schemas.resource_request import ResourceRequestCreate, ResourceRequestReview


async def create_resource_request(
    db: AsyncSession,
    payload: ResourceRequestCreate,
    user: User,
) -> ResourceRequest:
    """Employee requests an available asset. Only available assets can be requested."""
    asset = await db.get(Asset, payload.asset_id)
    if not asset:
        raise HTTPException(status_code=404, detail="Asset not found")
    if asset.status != "available":
        raise HTTPException(
            status_code=409,
            detail={
                "error": "asset_not_available",
                "asset_id": asset.id,
                "asset_tag": asset.tag,
                "asset_name": asset.name,
                "current_status": asset.status,
                "message": f"Asset {asset.tag} is currently {asset.status} and cannot be requested.",
            },
        )

    # Prevent duplicate pending requests by the same user for the same asset
    existing = await db.scalar(
        select(ResourceRequest).where(
            ResourceRequest.asset_id == payload.asset_id,
            ResourceRequest.requested_by == user.id,
            ResourceRequest.status == "pending",
        )
    )
    if existing:
        raise HTTPException(
            status_code=409,
            detail="You already have a pending request for this asset.",
        )

    request = ResourceRequest(
        asset_id=payload.asset_id,
        requested_by=user.id,
        reason=payload.reason,
        priority=payload.priority,
        expected_return_date=payload.expected_return_date,
        status="pending",
    )
    db.add(request)
    await db.commit()
    await db.refresh(request)
    return request


async def review_resource_request(
    db: AsyncSession,
    request_id: int,
    payload: ResourceRequestReview,
    reviewer: User,
) -> ResourceRequest:
    """Admin/asset_manager approves or rejects. Approval auto-creates an allocation."""
    request = await db.get(ResourceRequest, request_id)
    if not request:
        raise HTTPException(status_code=404, detail="Resource request not found")
    if request.status != "pending":
        raise HTTPException(
            status_code=400,
            detail=f"Request is already {request.status} and cannot be reviewed.",
        )

    request.status = payload.status
    request.reviewed_by = reviewer.id
    request.review_notes = payload.review_notes
    request.reviewed_at = datetime.now(UTC)

    if payload.status == "approved":
        # Check asset is still available before allocating
        asset = await db.get(Asset, request.asset_id)
        if not asset or asset.status != "available":
            raise HTTPException(
                status_code=409,
                detail="Asset is no longer available. The request will be rejected.",
            )

        # Create allocation automatically
        allocation = Allocation(
            asset_id=request.asset_id,
            holder_user_id=request.requested_by,
            expected_return_date=request.expected_return_date,
            status="active",
        )
        asset.status = "allocated"
        db.add(allocation)

    await db.commit()
    await db.refresh(request)
    return request


async def list_resource_requests(
    db: AsyncSession,
    *,
    status: str | None = None,
    user_id: int | None = None,
) -> list[dict]:
    """List requests with asset and requester info joined."""
    stmt = (
        select(
            ResourceRequest,
            Asset.tag.label("asset_tag"),
            Asset.name.label("asset_name"),
            Asset.status.label("asset_status"),
            User.name.label("requester_name"),
            User.email.label("requester_email"),
        )
        .join(Asset, ResourceRequest.asset_id == Asset.id, isouter=True)
        .join(User, ResourceRequest.requested_by == User.id, isouter=True)
        .order_by(ResourceRequest.created_at.desc())
    )
    if status:
        stmt = stmt.where(ResourceRequest.status == status)
    if user_id:
        stmt = stmt.where(ResourceRequest.requested_by == user_id)

    rows = (await db.execute(stmt)).all()
    results = []
    for rr, tag, aname, astatus, rname, remail in rows:
        data = {
            "id": rr.id,
            "asset_id": rr.asset_id,
            "requested_by": rr.requested_by,
            "reason": rr.reason,
            "priority": rr.priority,
            "status": rr.status,
            "reviewed_by": rr.reviewed_by,
            "review_notes": rr.review_notes,
            "expected_return_date": rr.expected_return_date,
            "created_at": rr.created_at,
            "reviewed_at": rr.reviewed_at,
            "asset_tag": tag,
            "asset_name": aname,
            "asset_status": astatus,
            "requester_name": rname,
            "requester_email": remail,
        }
        results.append(data)
    return results
