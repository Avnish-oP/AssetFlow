#!/usr/bin/env python3
"""Reset the database and load the AssetFlow demo dataset.

Usage (from repo root or backend/):
    cd backend
    python seed.py

All seeded users share password: password

Demo accounts:
    admin@assetflow.dev          admin
    meera@assetflow.dev          asset_manager
    ravi@assetflow.dev           dept_head (Engineering)
    priya@assetflow.dev          employee  (Engineering) — AF-0114 holder in demo step 3
    amit@assetflow.dev           employee  (Engineering) — transfer target
    neha@assetflow.dev           employee  (Facilities)
"""

from __future__ import annotations

import asyncio
import sys
from datetime import date
from decimal import Decimal
from pathlib import Path

# Allow `python seed.py` from backend/ or repo root
BACKEND_ROOT = Path(__file__).resolve().parent
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from core.database import AsyncSessionLocal, engine
from core.security import hash_password
from models.asset import Asset, AssetCategory
from models.audit import Notification
from models.department import Department
from models.user import User

# Shared demo password — documented in README §9 / this file's docstring
DEMO_PASSWORD = "password"

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
    # Break departments.head_id → users cycle before truncate
    await session.execute(text("UPDATE departments SET head_id = NULL"))
    await session.execute(
        text(f"TRUNCATE TABLE {', '.join(TABLES)} RESTART IDENTITY CASCADE")
    )
    await session.execute(text("ALTER SEQUENCE asset_tag_seq RESTART WITH 200"))
    await session.commit()
    print("Cleared all application tables and reset sequences.")


async def seed(session: AsyncSession) -> None:
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

    # Welcome notifications so the feed isn't empty on first login
    for user in (admin, meera, ravi):
        session.add(
            Notification(
                user_id=user.id,
                type="welcome",
                message="Welcome to AssetFlow — KPIs and notifications are live.",
                related_entity_type=None,
                related_entity_id=None,
                is_read=False,
            )
        )
    await session.commit()

    print("Seeded demo dataset.")
    print()
    print("Login (password for all accounts: password)")
    print("  admin@assetflow.dev       admin")
    print("  meera@assetflow.dev       asset_manager")
    print("  ravi@assetflow.dev        dept_head")
    print("  priya@assetflow.dev       employee   ← allocate AF-0114 to her in demo")
    print("  amit@assetflow.dev        employee   ← transfer target")
    print("  neha@assetflow.dev        employee")
    print()
    print("Assets ready: AF-0114, AF-0062, AF-0108, AF-ROOM-B2 (all available)")
    print("Operational tables left empty so README §9 demo steps run clean.")


async def main() -> None:
    print("AssetFlow seed — wiping and reloading demo data…")
    async with AsyncSessionLocal() as session:
        await clear_all(session)
        await seed(session)
    await engine.dispose()
    print("Done.")


if __name__ == "__main__":
    asyncio.run(main())
