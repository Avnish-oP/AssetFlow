from __future__ import annotations

import csv
import io
from datetime import datetime, timezone
from typing import Annotated

from fastapi import APIRouter, Depends
from fastapi.responses import Response
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from core.database import get_db
from core.security import require_role

router = APIRouter(prefix="/reports", tags=["reports"], dependencies=[Depends(require_role("admin", "asset_manager", "dept_head"))])


def _serialize_stat(row: dict) -> dict:
    return {
        "asset_id": row["asset_id"],
        "tag": row["tag"],
        "name": row["name"],
        "status": row["status"],
        "condition": row["condition"],
        "location": row["location"],
        "usage_count": int(row["usage_count"]),
        "allocation_count": int(row["allocation_count"]),
        "booking_count": int(row["booking_count"]),
        "maintenance_count": int(row["maintenance_count"]),
        "age_days": int(row["age_days"]) if row["age_days"] is not None else None,
    }


async def _fetch_asset_stats(db: AsyncSession, order_by: str, limit: int = 5, where_clause: str = "") -> list[dict]:
    rows = await db.execute(
        text(
            f"""
            WITH allocation_counts AS (
              SELECT asset_id, COUNT(*)::int AS allocation_count
              FROM allocations
              GROUP BY asset_id
            ), booking_counts AS (
              SELECT resource_id AS asset_id, COUNT(*)::int AS booking_count
              FROM bookings
              WHERE status != 'cancelled'
              GROUP BY resource_id
            ), maintenance_counts AS (
              SELECT asset_id, COUNT(*)::int AS maintenance_count
              FROM maintenance_requests
              GROUP BY asset_id
            )
            SELECT a.id AS asset_id,
                   a.tag,
                   a.name,
                   a.status,
                   a.condition,
                   a.location,
                   COALESCE(ac.allocation_count, 0)::int AS allocation_count,
                   COALESCE(bc.booking_count, 0)::int AS booking_count,
                   COALESCE(mc.maintenance_count, 0)::int AS maintenance_count,
                   (COALESCE(ac.allocation_count, 0) + COALESCE(bc.booking_count, 0) + COALESCE(mc.maintenance_count, 0))::int AS usage_count,
                   CASE WHEN a.acquisition_date IS NULL THEN NULL ELSE (CURRENT_DATE - a.acquisition_date)::int END AS age_days
            FROM assets a
            LEFT JOIN allocation_counts ac ON ac.asset_id = a.id
            LEFT JOIN booking_counts bc ON bc.asset_id = a.id
            LEFT JOIN maintenance_counts mc ON mc.asset_id = a.id
            {where_clause}
            ORDER BY {order_by}, a.tag
            LIMIT :limit
            """
        ),
        {"limit": limit},
    )
    return [_serialize_stat(row) for row in rows.mappings().all()]


@router.get("/summary")
async def summary(db: Annotated[AsyncSession, Depends(get_db)]):
    totals_row = (
        await db.execute(
            text(
                """
                SELECT
                  COUNT(*)::int AS total_assets,
                  COUNT(*) FILTER (WHERE status = 'available')::int AS available_assets,
                  COUNT(*) FILTER (WHERE status = 'allocated')::int AS allocated_assets,
                  COUNT(*) FILTER (WHERE status = 'maintenance')::int AS maintenance_assets,
                  COUNT(*) FILTER (WHERE is_bookable)::int AS bookable_assets,
                  COUNT(*) FILTER (WHERE status IN ('active', 'overdue'))::int AS active_allocations,
                  COUNT(*) FILTER (WHERE status = 'overdue')::int AS overdue_allocations,
                  COUNT(*) FILTER (WHERE status IN ('upcoming', 'ongoing'))::int AS active_bookings,
                  COUNT(*) FILTER (WHERE status != 'cancelled' AND upper(slot) < now())::int AS overdue_bookings,
                  COUNT(*) FILTER (WHERE status IN ('requested', 'approved'))::int AS pending_transfers,
                  ROUND(
                    CASE WHEN COUNT(*) = 0 THEN 0 ELSE COUNT(*) FILTER (WHERE status = 'allocated') * 100.0 / COUNT(*) END,
                    1
                  )::numeric AS utilization_rate
                FROM assets
                """
            )
        )
    ).mappings().one()

    most_used = await _fetch_asset_stats(db, "usage_count DESC", 5)
    idle_assets = await _fetch_asset_stats(db, "usage_count ASC", 5, "WHERE a.status = 'available'")
    maintenance_frequency = await _fetch_asset_stats(db, "maintenance_count DESC, usage_count DESC", 5)
    retirement_candidates = await _fetch_asset_stats(
        db,
        "CASE WHEN a.condition IN ('fair', 'poor') THEN 0 ELSE 1 END, age_days DESC NULLS LAST",
        5,
        "WHERE a.acquisition_date IS NOT NULL",
    )

    return {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "totals": {key: int(value) if key != "utilization_rate" else float(value) for key, value in totals_row.items()},
        "most_used": most_used,
        "idle_assets": idle_assets,
        "maintenance_frequency": maintenance_frequency,
        "retirement_candidates": retirement_candidates,
    }


@router.get("/export")
async def export_report(db: Annotated[AsyncSession, Depends(get_db)]):
    payload = await summary(db)
    buffer = io.StringIO()
    writer = csv.writer(buffer)

    writer.writerow(["section", "label", "value"])
    for key, value in payload["totals"].items():
        writer.writerow(["totals", key, value])

    for section_name in ["most_used", "idle_assets", "maintenance_frequency", "retirement_candidates"]:
        for item in payload[section_name]:
            writer.writerow(
                [
                    section_name,
                    item["tag"],
                    f"{item['name']} | usage={item['usage_count']} | allocation={item['allocation_count']} | booking={item['booking_count']} | maintenance={item['maintenance_count']} | age_days={item['age_days']}",
                ]
            )

    csv_content = buffer.getvalue()
    return Response(
        content=csv_content,
        media_type="text/csv",
        headers={"Content-Disposition": 'attachment; filename="assetflow-reports.csv"'},
    )
