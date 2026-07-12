from datetime import UTC, datetime

from fastapi import HTTPException
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from models.asset import Asset
from models.audit import AuditCycle, AuditCycleAuditor, AuditItem
from models.user import User
from schemas.audit import (
    AuditCycleCreate,
    AuditCycleDetail,
    AuditCycleResponse,
    AuditItemResponse,
    AuditItemVerify,
    DiscrepancyItem,
    DiscrepancyReport,
)
from services.transitions import assert_transition


async def _summary_counts(db: AsyncSession, cycle_id: int) -> dict[str, int]:
    rows = (
        await db.execute(
            select(AuditItem.verification_status, func.count())
            .where(AuditItem.cycle_id == cycle_id)
            .group_by(AuditItem.verification_status)
        )
    ).all()
    counts = {status: count for status, count in rows}
    return {
        "total_items": sum(counts.values()),
        "verified_count": counts.get("verified", 0),
        "missing_count": counts.get("missing", 0),
        "damaged_count": counts.get("damaged", 0),
        "pending_count": counts.get("pending", 0),
    }


async def _auditor_ids(db: AsyncSession, cycle_id: int) -> list[int]:
    return list(
        (await db.scalars(select(AuditCycleAuditor.user_id).where(AuditCycleAuditor.cycle_id == cycle_id))).all()
    )


async def _cycle_response(db: AsyncSession, cycle: AuditCycle) -> AuditCycleResponse:
    counts = await _summary_counts(db, cycle.id)
    return AuditCycleResponse(
        id=cycle.id,
        name=cycle.name,
        scope_department_id=cycle.scope_department_id,
        scope_location=cycle.scope_location,
        start_date=cycle.start_date,
        end_date=cycle.end_date,
        status=cycle.status,
        created_by=cycle.created_by,
        auditor_ids=await _auditor_ids(db, cycle.id),
        **counts,
    )


def _item_response(item: AuditItem, asset: Asset | None = None) -> AuditItemResponse:
    return AuditItemResponse(
        id=item.id,
        cycle_id=item.cycle_id,
        asset_id=item.asset_id,
        expected_location=item.expected_location,
        verification_status=item.verification_status,
        notes=item.notes,
        verified_by=item.verified_by,
        verified_at=item.verified_at,
        asset_tag=asset.tag if asset else None,
        asset_name=asset.name if asset else None,
        asset_condition=asset.condition if asset else None,
    )


async def create_cycle(db: AsyncSession, payload: AuditCycleCreate, created_by: int) -> AuditCycle:
    if payload.end_date < payload.start_date:
        raise HTTPException(status_code=400, detail="end_date must be on or after start_date")

    for auditor_id in payload.auditor_ids:
        user = await db.get(User, auditor_id)
        if not user:
            raise HTTPException(status_code=400, detail=f"Auditor {auditor_id} not found")

    cycle = AuditCycle(
        name=payload.name,
        scope_department_id=payload.scope_department_id,
        scope_location=payload.scope_location,
        start_date=payload.start_date,
        end_date=payload.end_date,
        status="open",
        created_by=created_by,
    )
    db.add(cycle)
    await db.flush()

    for auditor_id in payload.auditor_ids:
        db.add(AuditCycleAuditor(cycle_id=cycle.id, user_id=auditor_id))

    await populate_items(db, cycle, commit=False)
    await db.commit()
    await db.refresh(cycle)
    return cycle


async def list_cycles(db: AsyncSession) -> list[AuditCycleResponse]:
    cycles = (await db.scalars(select(AuditCycle).order_by(AuditCycle.id.desc()))).all()
    return [await _cycle_response(db, cycle) for cycle in cycles]


async def get_cycle_detail(db: AsyncSession, cycle_id: int) -> AuditCycleDetail:
    cycle = await db.get(AuditCycle, cycle_id)
    if not cycle:
        raise HTTPException(status_code=404, detail="Audit cycle not found")
    base = await _cycle_response(db, cycle)
    rows = (
        await db.execute(
            select(AuditItem, Asset)
            .join(Asset, AuditItem.asset_id == Asset.id, isouter=True)
            .where(AuditItem.cycle_id == cycle_id)
            .order_by(AuditItem.id)
        )
    ).all()
    return AuditCycleDetail(**base.model_dump(), items=[_item_response(item, asset) for item, asset in rows])


async def populate_items(db: AsyncSession, cycle: AuditCycle, commit: bool = True) -> list[AuditItem]:
    if cycle.status != "open":
        raise HTTPException(status_code=400, detail="Cannot add items to a closed cycle")

    stmt = select(Asset)
    if cycle.scope_location:
        stmt = stmt.where(Asset.location == cycle.scope_location)
    assets = (await db.scalars(stmt)).all()

    existing_ids = set(
        (await db.scalars(select(AuditItem.asset_id).where(AuditItem.cycle_id == cycle.id))).all()
    )
    created: list[AuditItem] = []
    for asset in assets:
        if asset.id in existing_ids:
            continue
        item = AuditItem(
            cycle_id=cycle.id,
            asset_id=asset.id,
            expected_location=asset.location,
            verification_status="pending",
        )
        db.add(item)
        created.append(item)

    if commit:
        await db.commit()
        for item in created:
            await db.refresh(item)
    return created


async def verify_item(
    db: AsyncSession,
    cycle_id: int,
    item_id: int,
    payload: AuditItemVerify,
    actor_id: int,
) -> AuditItem:
    cycle = await db.get(AuditCycle, cycle_id)
    if not cycle:
        raise HTTPException(status_code=404, detail="Audit cycle not found")
    if cycle.status != "open":
        raise HTTPException(status_code=400, detail="Cycle is closed")

    item = await db.get(AuditItem, item_id)
    if not item or item.cycle_id != cycle_id:
        raise HTTPException(status_code=404, detail="Audit item not found")

    assert_transition(item.verification_status, payload.verification_status, "audit")
    item.verification_status = payload.verification_status
    item.notes = payload.notes
    item.verified_by = actor_id
    item.verified_at = datetime.now(UTC)

    asset = await db.get(Asset, item.asset_id)
    if asset:
        if payload.verification_status == "missing":
            assert_transition(asset.status, "lost", "asset")
            asset.status = "lost"
        elif payload.verification_status == "damaged":
            asset.condition = "damaged"

    await db.commit()
    await db.refresh(item)
    return item


async def close_cycle(db: AsyncSession, cycle_id: int) -> AuditCycle:
    cycle = await db.get(AuditCycle, cycle_id)
    if not cycle:
        raise HTTPException(status_code=404, detail="Audit cycle not found")
    if cycle.status != "open":
        raise HTTPException(status_code=400, detail="Cycle already closed")

    counts = await _summary_counts(db, cycle_id)
    if counts["pending_count"] > 0:
        raise HTTPException(
            status_code=400,
            detail=f"Cannot close cycle with {counts['pending_count']} pending items",
        )

    cycle.status = "closed"
    await db.commit()
    await db.refresh(cycle)
    return cycle


async def discrepancy_report(db: AsyncSession, cycle_id: int) -> DiscrepancyReport:
    cycle = await db.get(AuditCycle, cycle_id)
    if not cycle:
        raise HTTPException(status_code=404, detail="Audit cycle not found")

    counts = await _summary_counts(db, cycle_id)
    rows = (
        await db.execute(
            select(AuditItem, Asset)
            .join(Asset, AuditItem.asset_id == Asset.id, isouter=True)
            .where(
                AuditItem.cycle_id == cycle_id,
                AuditItem.verification_status.in_(["missing", "damaged"]),
            )
            .order_by(AuditItem.id)
        )
    ).all()

    return DiscrepancyReport(
        cycle_id=cycle.id,
        cycle_name=cycle.name,
        missing_count=counts["missing_count"],
        damaged_count=counts["damaged_count"],
        verified_count=counts["verified_count"],
        pending_count=counts["pending_count"],
        items=[
            DiscrepancyItem(
                item_id=item.id,
                asset_id=item.asset_id,
                asset_tag=asset.tag if asset else None,
                asset_name=asset.name if asset else None,
                verification_status=item.verification_status,
                notes=item.notes,
                expected_location=item.expected_location,
            )
            for item, asset in rows
        ],
    )
