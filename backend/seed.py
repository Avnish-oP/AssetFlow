#!/usr/bin/env python3
"""Reset the database and load AssetFlow demo/smoke data for collaborators.

Usage (from backend/):
    python seed.py                  # load seeds/smoke_snapshot.json (shared smoke world)
    python seed.py --clean          # org master data only — empty for live README §9 walkthrough
    python seed.py --snapshot PATH  # load a custom snapshot JSON

Re-capture local DB for the team:
    python seed_export.py           # writes/updates seeds/smoke_snapshot.json

All seeded users share password: password

    admin@assetflow.dev          admin
    meera@assetflow.dev          asset_manager
    ravi@assetflow.dev           dept_head (Engineering)
    priya@assetflow.dev          employee  (Engineering)
    amit@assetflow.dev           employee  (Engineering)
    neha@assetflow.dev           employee  (Facilities)
"""

from __future__ import annotations

import argparse
import asyncio
import json
import sys
from datetime import date, datetime
from decimal import Decimal
from pathlib import Path

BACKEND_ROOT = Path(__file__).resolve().parent
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))

from sqlalchemy import text
from sqlalchemy.dialects.postgresql import Range
from sqlalchemy.ext.asyncio import AsyncSession

from core.database import AsyncSessionLocal, engine
from core.security import hash_password
from models.allocation import Allocation, TransferRequest
from models.asset import Asset, AssetCategory
from models.audit import ActivityLog, AuditCycle, AuditCycleAuditor, AuditItem, Notification
from models.booking import Booking
from models.department import Department
from models.maintenance import MaintenanceRequest
from models.user import User

DEMO_PASSWORD = "password"
DEFAULT_SNAPSHOT = BACKEND_ROOT / "seeds" / "smoke_snapshot.json"

TABLES = [
    "activity_logs",
    "notifications",
    "audit_cycle_auditors",
    "audit_items",
    "audit_cycles",
    "maintenance_requests",
    "bookings",
    "transfer_requests",
    "allocations",
    "assets",
    "asset_categories",
    "users",
    "departments",
]


async def clear_all(session: AsyncSession) -> None:
    await session.execute(text("UPDATE departments SET head_id = NULL"))
    result = await session.execute(
        text(
            """
            SELECT tablename
            FROM pg_tables
            WHERE schemaname = 'public'
              AND tablename = ANY(:table_names)
            """
        ),
        {"table_names": TABLES},
    )
    existing_tables = [row[0] for row in result.fetchall()]
    if existing_tables:
        await session.execute(text(f"TRUNCATE TABLE {', '.join(existing_tables)} RESTART IDENTITY CASCADE"))
    else:
        print("No application tables found to truncate.")
    await session.execute(text("ALTER SEQUENCE asset_tag_seq RESTART WITH 200"))
    await session.commit()
    print("Cleared all application tables and reset sequences.")


def _parse_dt(value: str | None) -> datetime | None:
    if not value:
        return None
    return datetime.fromisoformat(value.replace("Z", "+00:00"))


def _parse_date(value: str | None) -> date | None:
    if not value:
        return None
    return date.fromisoformat(value[:10])


async def seed_clean(session: AsyncSession) -> None:
    """Master data only — for walking README §9 live."""
    password_hash = hash_password(DEMO_PASSWORD)

    engineering = Department(name="Engineering", status="active")
    facilities = Department(name="Facilities", status="active")
    finance = Department(name="Finance", status="active")
    session.add_all([engineering, facilities, finance])
    await session.flush()

    admin = User(
        name="Admin User",
        email="admin@assetflow.dev",
        password_hash=password_hash,
        role="admin",
        department_id=engineering.id,
        status="active",
    )
    meera = User(
        name="Meera Kapoor",
        email="meera@assetflow.dev",
        password_hash=password_hash,
        role="asset_manager",
        department_id=facilities.id,
        status="active",
    )
    ravi = User(
        name="Ravi Menon",
        email="ravi@assetflow.dev",
        password_hash=password_hash,
        role="dept_head",
        department_id=engineering.id,
        status="active",
    )
    priya = User(
        name="Priya Shah",
        email="priya@assetflow.dev",
        password_hash=password_hash,
        role="employee",
        department_id=engineering.id,
        status="active",
    )
    amit = User(
        name="Amit Rao",
        email="amit@assetflow.dev",
        password_hash=password_hash,
        role="employee",
        department_id=engineering.id,
        status="active",
    )
    neha = User(
        name="Neha Iyer",
        email="neha@assetflow.dev",
        password_hash=password_hash,
        role="employee",
        department_id=facilities.id,
        status="active",
    )
    session.add_all([admin, meera, ravi, priya, amit, neha])
    await session.flush()

    engineering.head_id = ravi.id
    facilities.head_id = meera.id

    laptop = AssetCategory(name="Laptop", custom_fields={"warranty_months": 36})
    room = AssetCategory(name="Room", custom_fields={})
    projector = AssetCategory(name="Projector", custom_fields={})
    session.add_all([laptop, room, projector])
    await session.flush()

    session.add_all(
        [
            Asset(
                tag="AF-0114",
                name="MacBook Pro 14",
                category_id=laptop.id,
                serial_number="MBP-0114",
                acquisition_date=date(2024, 3, 15),
                acquisition_cost=Decimal("1899.00"),
                condition="good",
                location="Engineering",
                is_bookable=False,
                status="available",
            ),
            Asset(
                tag="AF-0062",
                name="Dell Latitude 5440",
                category_id=laptop.id,
                serial_number="DLL-0062",
                acquisition_date=date(2023, 8, 1),
                acquisition_cost=Decimal("1199.00"),
                condition="good",
                location="Engineering",
                is_bookable=False,
                status="available",
            ),
            Asset(
                tag="AF-0108",
                name="Epson Projector",
                category_id=projector.id,
                serial_number="EPS-0108",
                acquisition_date=date(2022, 11, 20),
                acquisition_cost=Decimal("650.00"),
                condition="fair",
                location="Facilities",
                is_bookable=True,
                status="available",
            ),
            Asset(
                tag="AF-ROOM-B2",
                name="Room B2",
                category_id=room.id,
                condition="good",
                location="Floor 2",
                is_bookable=True,
                status="available",
            ),
        ]
    )
    await session.commit()

    for user in (admin, meera, ravi):
        session.add(
            Notification(
                user_id=user.id,
                type="welcome",
                message="Welcome to AssetFlow — KPIs and notifications are live.",
                is_read=False,
            )
        )
    await session.commit()

    print("Seeded CLEAN demo dataset (master data only).")
    print("Operational tables empty — walk README §9 live.")


async def _reset_identity(session: AsyncSession, table: str, pk: str = "id") -> None:
    # Table/pk are from our fixed allow-list, not user input.
    await session.execute(
        text(
            f"""
            SELECT setval(
              pg_get_serial_sequence('{table}', '{pk}'),
              COALESCE((SELECT MAX({pk}) FROM {table}), 1),
              true
            )
            """
        )
    )


async def seed_from_snapshot(session: AsyncSession, snapshot_path: Path) -> None:
    if not snapshot_path.exists():
        raise FileNotFoundError(
            f"Snapshot not found: {snapshot_path}\n"
            "Run `python seed_export.py` on a machine that has the smoke data, "
            "or use `python seed.py --clean` for a blank walkthrough."
        )

    payload = json.loads(snapshot_path.read_text(encoding="utf-8"))
    tables = payload.get("tables") or {}
    password_hash = hash_password(DEMO_PASSWORD)

    # --- departments (head_id applied after users) ---
    dept_heads: dict[int, int | None] = {}
    for row in tables.get("departments", []):
        dept_heads[row["id"]] = row.get("head_id")
        session.add(
            Department(
                id=row["id"],
                name=row["name"],
                head_id=None,
                parent_department_id=row.get("parent_department_id"),
                status=row.get("status") or "active",
            )
        )
    await session.flush()

    # --- users (always re-hash demo password so snapshots stay portable) ---
    for row in tables.get("users", []):
        session.add(
            User(
                id=row["id"],
                name=row["name"],
                email=row["email"],
                password_hash=password_hash,
                role=row["role"],
                department_id=row.get("department_id"),
                status=row.get("status") or "active",
                created_at=_parse_dt(row.get("created_at")),
            )
        )
    await session.flush()

    for dept_id, head_id in dept_heads.items():
        dept = await session.get(Department, dept_id)
        if dept:
            dept.head_id = head_id
    await session.flush()

    for row in tables.get("asset_categories", []):
        session.add(
            AssetCategory(
                id=row["id"],
                name=row["name"],
                custom_fields=row.get("custom_fields") or {},
            )
        )
    await session.flush()

    for row in tables.get("assets", []):
        cost = row.get("acquisition_cost")
        session.add(
            Asset(
                id=row["id"],
                tag=row["tag"],
                name=row["name"],
                category_id=row.get("category_id"),
                serial_number=row.get("serial_number"),
                acquisition_date=_parse_date(row.get("acquisition_date")),
                acquisition_cost=Decimal(cost) if cost is not None else None,
                condition=row.get("condition") or "good",
                location=row.get("location"),
                is_bookable=bool(row.get("is_bookable")),
                photo_url=row.get("photo_url"),
                status=row.get("status") or "available",
            )
        )
    await session.flush()

    for row in tables.get("allocations", []):
        session.add(
            Allocation(
                id=row["id"],
                asset_id=row["asset_id"],
                holder_user_id=row.get("holder_user_id"),
                holder_department_id=row.get("holder_department_id"),
                allocated_at=_parse_dt(row.get("allocated_at")),
                expected_return_date=_parse_date(row.get("expected_return_date")),
                returned_at=_parse_dt(row.get("returned_at")),
                return_condition_notes=row.get("return_condition_notes"),
                status=row.get("status") or "active",
            )
        )

    for row in tables.get("transfer_requests", []):
        session.add(
            TransferRequest(
                id=row["id"],
                asset_id=row["asset_id"],
                from_holder_id=row.get("from_holder_id"),
                to_holder_id=row["to_holder_id"],
                reason=row.get("reason") or "",
                status=row.get("status") or "requested",
                requested_by=row["requested_by"],
                approved_by=row.get("approved_by"),
                created_at=_parse_dt(row.get("created_at")),
            )
        )

    for row in tables.get("bookings", []):
        slot = row.get("slot") or {}
        start = _parse_dt(slot.get("start") if isinstance(slot, dict) else None)
        end = _parse_dt(slot.get("end") if isinstance(slot, dict) else None)
        bounds = slot.get("bounds", "[)") if isinstance(slot, dict) else "[)"
        if not start or not end:
            continue
        session.add(
            Booking(
                id=row["id"],
                resource_id=row["resource_id"],
                booked_by=row["booked_by"],
                slot=Range(start, end, bounds=bounds),
                status=row.get("status") or "upcoming",
                created_at=_parse_dt(row.get("created_at")),
            )
        )

    for row in tables.get("maintenance_requests", []):
        session.add(
            MaintenanceRequest(
                id=row["id"],
                asset_id=row["asset_id"],
                raised_by=row["raised_by"],
                issue_description=row["issue_description"],
                priority=row.get("priority") or "medium",
                photo_url=row.get("photo_url"),
                status=row.get("status") or "pending",
                approved_by=row.get("approved_by"),
                technician_name=row.get("technician_name"),
                resolved_at=_parse_dt(row.get("resolved_at")),
                created_at=_parse_dt(row.get("created_at")),
            )
        )

    for row in tables.get("audit_cycles", []):
        session.add(
            AuditCycle(
                id=row["id"],
                name=row["name"],
                scope_department_id=row.get("scope_department_id"),
                scope_location=row.get("scope_location"),
                start_date=_parse_date(row["start_date"]) or date.today(),
                end_date=_parse_date(row["end_date"]) or date.today(),
                status=row.get("status") or "open",
                created_by=row["created_by"],
            )
        )
    await session.flush()

    for row in tables.get("audit_cycle_auditors", []):
        session.add(AuditCycleAuditor(cycle_id=row["cycle_id"], user_id=row["user_id"]))

    for row in tables.get("audit_items", []):
        session.add(
            AuditItem(
                id=row["id"],
                cycle_id=row["cycle_id"],
                asset_id=row["asset_id"],
                expected_location=row.get("expected_location"),
                verification_status=row.get("verification_status") or "pending",
                notes=row.get("notes"),
                verified_by=row.get("verified_by"),
                verified_at=_parse_dt(row.get("verified_at")),
            )
        )

    for row in tables.get("notifications", []):
        session.add(
            Notification(
                id=row["id"],
                user_id=row["user_id"],
                type=row["type"],
                message=row["message"],
                related_entity_type=row.get("related_entity_type"),
                related_entity_id=row.get("related_entity_id"),
                is_read=bool(row.get("is_read")),
                created_at=_parse_dt(row.get("created_at")),
            )
        )

    for row in tables.get("activity_logs", []):
        session.add(
            ActivityLog(
                id=row["id"],
                actor_id=row.get("actor_id"),
                action=row["action"],
                entity_type=row["entity_type"],
                entity_id=row.get("entity_id"),
                log_metadata=row.get("metadata") or {},
                created_at=_parse_dt(row.get("created_at")),
            )
        )

    await session.commit()

    # Fix sequences so new inserts don't collide with restored IDs
    for table in (
        "departments",
        "users",
        "asset_categories",
        "assets",
        "allocations",
        "transfer_requests",
        "bookings",
        "maintenance_requests",
        "audit_cycles",
        "audit_items",
        "notifications",
        "activity_logs",
    ):
        await _reset_identity(session, table)

    seq_value = int((payload.get("sequences") or {}).get("asset_tag_seq") or 200)
    await session.execute(text("SELECT setval('asset_tag_seq', :v, true)"), {"v": seq_value})
    await session.commit()

    print(f"Seeded SMOKE snapshot from {snapshot_path.name}")
    for name in (
        "users",
        "assets",
        "allocations",
        "transfer_requests",
        "bookings",
        "maintenance_requests",
        "audit_cycles",
        "notifications",
        "activity_logs",
    ):
        print(f"  {name}: {len(tables.get(name, []))} rows")


async def main() -> None:
    parser = argparse.ArgumentParser(description="Wipe and reload AssetFlow seed data")
    parser.add_argument(
        "--clean",
        action="store_true",
        help="Load master data only (empty operational tables for live demo walkthrough)",
    )
    parser.add_argument(
        "--snapshot",
        type=Path,
        default=DEFAULT_SNAPSHOT,
        help=f"Smoke snapshot JSON (default: {DEFAULT_SNAPSHOT.name})",
    )
    args = parser.parse_args()

    mode = "CLEAN" if args.clean else "SMOKE"
    print(f"AssetFlow seed [{mode}] — wiping and reloading…")
    async with AsyncSessionLocal() as session:
        await clear_all(session)
        if args.clean:
            await seed_clean(session)
        else:
            await seed_from_snapshot(session, args.snapshot.resolve())
    await engine.dispose()

    print()
    print("Login (password for all accounts: password)")
    print("  admin@assetflow.dev       admin")
    print("  meera@assetflow.dev       asset_manager")
    print("  ravi@assetflow.dev        dept_head")
    print("  priya@assetflow.dev       employee")
    print("  amit@assetflow.dev        employee")
    print("  neha@assetflow.dev        employee")
    if not args.clean:
        print()
        print("Smoke world includes allocations, transfers, bookings, maintenance,")
        print("closed audit (AF-0062 lost), notifications, and activity logs.")
        print("Refresh snapshot anytime with: python seed_export.py")
    print("Done.")


if __name__ == "__main__":
    asyncio.run(main())
