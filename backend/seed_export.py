#!/usr/bin/env python3
"""Export the current Postgres dataset to seeds/smoke_snapshot.json.

Run this on the machine that has the "golden" local smoke data, then commit
the JSON so collaborators can recreate the same world with:

    python seed.py

Usage:
    cd backend
    python seed_export.py
    python seed_export.py --out seeds/my_snapshot.json
"""

from __future__ import annotations

import argparse
import asyncio
import json
import sys
from datetime import UTC, date, datetime
from decimal import Decimal
from pathlib import Path

BACKEND_ROOT = Path(__file__).resolve().parent
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))

from sqlalchemy import text

from core.database import AsyncSessionLocal, engine

TABLES = [
    "departments",
    "users",
    "asset_categories",
    "assets",
    "allocations",
    "transfer_requests",
    "bookings",
    "maintenance_requests",
    "audit_cycles",
    "audit_cycle_auditors",
    "audit_items",
    "notifications",
    "activity_logs",
]


def _jsonable(value):
    if value is None:
        return None
    if isinstance(value, Decimal):
        return str(value)
    if isinstance(value, (datetime, date)):
        return value.isoformat()
    # asyncpg / psycopg Range
    if hasattr(value, "lower") and hasattr(value, "upper") and type(value).__name__.endswith("Range"):
        lower = value.lower.isoformat() if value.lower else None
        upper = value.upper.isoformat() if value.upper else None
        bounds = getattr(value, "bounds", "[)")
        return {"start": lower, "end": upper, "bounds": bounds}
    if isinstance(value, dict):
        return {k: _jsonable(v) for k, v in value.items()}
    if isinstance(value, (list, tuple)):
        return [_jsonable(v) for v in value]
    return value


async def export_snapshot(out_path: Path) -> dict:
    payload: dict = {
        "version": 1,
        "exported_at": datetime.now(UTC).replace(microsecond=0).isoformat().replace("+00:00", "Z"),
        "note": "Passwords are re-hashed to 'password' on seed load; password_hash in this file is ignored.",
        "tables": {},
    }
    async with AsyncSessionLocal() as session:
        for table in TABLES:
            rows = (await session.execute(text(f"SELECT * FROM {table} ORDER BY 1"))).mappings().all()
            serialized = []
            for row in rows:
                item = {k: _jsonable(v) for k, v in dict(row).items()}
                if "password_hash" in item:
                    item["password_hash"] = "<rehashed-on-seed>"
                serialized.append(item)
            payload["tables"][table] = serialized
            print(f"  {table}: {len(rows)} rows")

        seq = await session.scalar(text("SELECT last_value FROM asset_tag_seq"))
        payload["sequences"] = {"asset_tag_seq": int(seq or 200)}

    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_text(json.dumps(payload, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    return payload


async def main() -> None:
    parser = argparse.ArgumentParser(description="Export live AssetFlow DB to a seed snapshot JSON")
    parser.add_argument(
        "--out",
        type=Path,
        default=BACKEND_ROOT / "seeds" / "smoke_snapshot.json",
        help="Output JSON path (default: seeds/smoke_snapshot.json)",
    )
    args = parser.parse_args()

    print(f"Exporting live database → {args.out}")
    payload = await export_snapshot(args.out.resolve())
    await engine.dispose()

    counts = {name: len(rows) for name, rows in payload["tables"].items()}
    print()
    print(f"Wrote {args.out} ({sum(counts.values())} total rows)")
    print("Commit this file so collaborators can run: python seed.py")


if __name__ == "__main__":
    asyncio.run(main())
