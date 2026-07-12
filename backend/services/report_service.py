import time
from datetime import UTC, date, datetime, timedelta
from typing import Any

from sqlalchemy import Date, cast, func, select, text
from sqlalchemy.ext.asyncio import AsyncSession

from models.allocation import Allocation, TransferRequest
from models.asset import Asset
from models.audit import Notification
from models.booking import Booking
from models.maintenance import MaintenanceRequest
from schemas.report import (
    AssetUsageItem,
    AssetUsageReport,
    BookingHeatmapCell,
    BookingHeatmapReport,
    DashboardSummary,
    DepartmentAllocationReport,
    DepartmentAllocationRow,
    MaintenanceFrequencyItem,
    MaintenanceFrequencyReport,
    RetirementItem,
    RetirementReport,
    UtilizationPoint,
    UtilizationReport,
)
_CACHE: dict[str, tuple[float, Any]] = {}
_TTL_SECONDS = 10.0


def _cached(key: str):
    entry = _CACHE.get(key)
    if entry and (time.monotonic() - entry[0]) < _TTL_SECONDS:
        return entry[1]
    return None


def _store(key: str, value: Any):
    _CACHE[key] = (time.monotonic(), value)
    return value


async def dashboard_summary(db: AsyncSession, user_id: int | None = None) -> DashboardSummary:
    cache_key = f"summary:{user_id}"
    hit = _cached(cache_key)
    if hit is not None:
        return hit

    today = date.today()
    week_end = today + timedelta(days=7)
    week_start = today - timedelta(days=7)

    status_rows = (await db.execute(select(Asset.status, func.count()).group_by(Asset.status))).all()
    by_status = {status: count for status, count in status_rows}

    bookings_today = await db.scalar(
        text(
            """
            SELECT COUNT(*) FROM bookings
            WHERE status != 'cancelled'
              AND lower(slot)::date = :today
            """
        ),
        {"today": today},
    )

    pending_transfers = await db.scalar(
        select(func.count()).select_from(TransferRequest).where(TransferRequest.status.in_(["requested", "approved"]))
    )
    due_this_week = await db.scalar(
        select(func.count())
        .select_from(Allocation)
        .where(
            Allocation.status.in_(["active", "overdue"]),
            Allocation.expected_return_date.is_not(None),
            Allocation.expected_return_date >= today,
            Allocation.expected_return_date <= week_end,
        )
    )
    returned_this_week = await db.scalar(
        select(func.count())
        .select_from(Allocation)
        .where(
            Allocation.status == "returned",
            Allocation.returned_at.is_not(None),
            cast(Allocation.returned_at, Date) >= week_start,
        )
    )
    overdue_allocations = await db.scalar(
        select(func.count()).select_from(Allocation).where(Allocation.status == "overdue")
    )

    unread = 0
    if user_id is not None:
        unread = await db.scalar(
            select(func.count())
            .select_from(Notification)
            .where(Notification.user_id == user_id, Notification.is_read.is_(False))
        ) or 0

    summary = DashboardSummary(
        available=by_status.get("available", 0),
        allocated=by_status.get("allocated", 0),
        maintenance=by_status.get("maintenance", 0),
        bookings_today=int(bookings_today or 0),
        pending_transfers=int(pending_transfers or 0),
        due_this_week=int(due_this_week or 0),
        returned_this_week=int(returned_this_week or 0),
        overdue_allocations=int(overdue_allocations or 0),
        unread_notifications=int(unread),
    )
    return _store(cache_key, summary)


async def utilization(db: AsyncSession, days: int = 14) -> UtilizationReport:
    hit = _cached(f"utilization:{days}")
    if hit is not None:
        return hit

    start = date.today() - timedelta(days=days - 1)
    alloc_rows = (
        await db.execute(
            select(cast(Allocation.allocated_at, Date), func.count())
            .where(cast(Allocation.allocated_at, Date) >= start)
            .group_by(cast(Allocation.allocated_at, Date))
        )
    ).all()
    booking_rows = (
        await db.execute(
            text(
                """
                SELECT lower(slot)::date AS d, COUNT(*)
                FROM bookings
                WHERE status != 'cancelled' AND lower(slot)::date >= :start
                GROUP BY 1
                """
            ),
            {"start": start},
        )
    ).all()

    alloc_map = {row[0]: row[1] for row in alloc_rows}
    book_map = {row[0]: row[1] for row in booking_rows}
    series: list[UtilizationPoint] = []
    for offset in range(days):
        day = start + timedelta(days=offset)
        series.append(
            UtilizationPoint(
                date=day.isoformat(),
                allocations=int(alloc_map.get(day, 0)),
                bookings=int(book_map.get(day, 0)),
            )
        )
    return _store(f"utilization:{days}", UtilizationReport(series=series))


async def asset_usage(db: AsyncSession) -> AssetUsageReport:
    hit = _cached("asset_usage")
    if hit is not None:
        return hit

    assets = (await db.scalars(select(Asset).order_by(Asset.id))).all()
    alloc_counts = dict(
        (await db.execute(select(Allocation.asset_id, func.count()).group_by(Allocation.asset_id))).all()
    )
    booking_counts = dict(
        (await db.execute(select(Booking.resource_id, func.count()).group_by(Booking.resource_id))).all()
    )

    items = [
        AssetUsageItem(
            asset_id=asset.id,
            tag=asset.tag,
            name=asset.name,
            status=asset.status,
            allocation_count=int(alloc_counts.get(asset.id, 0)),
            booking_count=int(booking_counts.get(asset.id, 0)),
        )
        for asset in assets
    ]
    ranked = sorted(items, key=lambda item: item.allocation_count + item.booking_count, reverse=True)
    most_used = [item for item in ranked if (item.allocation_count + item.booking_count) > 0][:8]
    idle = [item for item in ranked if item.allocation_count == 0 and item.booking_count == 0 and item.status == "available"][
        :8
    ]
    return _store("asset_usage", AssetUsageReport(most_used=most_used, idle=idle))


async def maintenance_frequency(db: AsyncSession) -> MaintenanceFrequencyReport:
    hit = _cached("maintenance_frequency")
    if hit is not None:
        return hit

    rows = (
        await db.execute(
            select(MaintenanceRequest.asset_id, Asset.tag, Asset.name, func.count())
            .join(Asset, Asset.id == MaintenanceRequest.asset_id)
            .group_by(MaintenanceRequest.asset_id, Asset.tag, Asset.name)
            .order_by(func.count().desc())
        )
    ).all()
    items = [
        MaintenanceFrequencyItem(asset_id=asset_id, tag=tag, name=name, request_count=int(count))
        for asset_id, tag, name, count in rows
    ]
    return _store("maintenance_frequency", MaintenanceFrequencyReport(items=items))


async def retirement_candidates(db: AsyncSession, years: int = 4) -> RetirementReport:
    hit = _cached(f"retirement:{years}")
    if hit is not None:
        return hit

    cutoff = date.today() - timedelta(days=365 * years)
    assets = (await db.scalars(select(Asset).order_by(Asset.id))).all()
    items: list[RetirementItem] = []
    for asset in assets:
        reasons: list[str] = []
        if asset.condition in {"fair", "damaged"}:
            reasons.append(f"condition={asset.condition}")
        if asset.acquisition_date and asset.acquisition_date <= cutoff:
            reasons.append(f"acquired before {cutoff.isoformat()}")
        if asset.status in {"retired", "disposed"}:
            continue
        if not reasons:
            continue
        items.append(
            RetirementItem(
                asset_id=asset.id,
                tag=asset.tag,
                name=asset.name,
                condition=asset.condition,
                status=asset.status,
                acquisition_date=asset.acquisition_date.isoformat() if asset.acquisition_date else None,
                reason="; ".join(reasons),
            )
        )
    return _store(f"retirement:{years}", RetirementReport(items=items))


async def booking_heatmap(db: AsyncSession) -> BookingHeatmapReport:
    hit = _cached("booking_heatmap")
    if hit is not None:
        return hit

    rows = (
        await db.execute(
            text(
                """
                SELECT EXTRACT(ISODOW FROM lower(slot))::int AS dow,
                       EXTRACT(HOUR FROM lower(slot))::int AS hour,
                       COUNT(*)::int AS count
                FROM bookings
                WHERE status != 'cancelled'
                  AND lower(slot) >= NOW() - INTERVAL '30 days'
                GROUP BY 1, 2
                ORDER BY 1, 2
                """
            )
        )
    ).mappings().all()
    # Postgres ISODOW: 1=Mon .. 7=Sun → convert to 0..6
    cells = [
        BookingHeatmapCell(weekday=int(row["dow"]) - 1, hour=int(row["hour"]), count=int(row["count"]))
        for row in rows
    ]
    return _store("booking_heatmap", BookingHeatmapReport(cells=cells))


async def department_allocation_summary(db: AsyncSession) -> DepartmentAllocationReport:
    hit = _cached("dept_allocation")
    if hit is not None:
        return hit

    rows = (
        await db.execute(
            text(
                """
                SELECT d.id AS department_id,
                       COALESCE(d.name, 'Unassigned') AS department_name,
                       COUNT(*) FILTER (WHERE a.status = 'active')::int AS active_allocations,
                       COUNT(*) FILTER (WHERE a.status = 'overdue')::int AS overdue_allocations
                FROM allocations a
                LEFT JOIN departments d ON d.id = a.holder_department_id
                WHERE a.status IN ('active', 'overdue')
                GROUP BY d.id, d.name
                ORDER BY active_allocations DESC, department_name
                """
            )
        )
    ).mappings().all()
    items = [
        DepartmentAllocationRow(
            department_id=row["department_id"],
            department_name=row["department_name"],
            active_allocations=int(row["active_allocations"]),
            overdue_allocations=int(row["overdue_allocations"]),
        )
        for row in rows
    ]
    return _store("dept_allocation", DepartmentAllocationReport(items=items))
