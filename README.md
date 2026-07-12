# AssetFlow — Enterprise Asset & Resource Management System

Hackathon build · 4 engineers (2 full-stack, 1 Python/backend, 1 swing) · 7-hour build window · 10 screens (Login/Signup + 9 core modules)

This file is the single source of truth for **what** we're building and **how it fits together**. Read this before touching code. Companion files:
- `AGENT.md` — live progress tracker, module ownership, decision log. Update after every milestone.
- `DESIGN.md` — visual language, tokens, component patterns. Follow it exactly so 4 people's screens look like one product.

---

## 1. What we're actually building

An ERP module for tracking physical assets (laptops, furniture, vehicles) and shared resources (rooms, equipment) through their full lifecycle — registration → allocation → booking → maintenance → audit — with two **non-negotiable, judge-visible correctness guarantees**:

1. **An asset can never be allocated to two people at once.** Attempting it must show *"currently held by X"* and offer a Transfer Request instead of a silent failure.
2. **A shared resource can never be double-booked for overlapping time slots.** 9:00–10:00 blocks 9:30–10:30 but allows 10:00–11:00.

Everything else (org setup, maintenance approval, audit cycles, reports, notifications) is standard CRUD + workflow. These two rules are what the problem statement gives worked examples for — they're what the judges will test first. We solve both **at the database layer**, not just in application code (details in §4). That's our biggest technical differentiator and it costs almost no extra time to implement.

---

## 2. Tech stack (and why)

| Layer | Choice | Why |
|---|---|---|
| Frontend | Next.js 14 (App Router) + TypeScript + Tailwind + shadcn/ui (Radix) | File-based routing maps 1:1 to our 10 screens; shadcn gives us accessible primitives (dialog, table, tabs, command palette) without a heavy design-system dependency; Tailwind lets 3 people style consistently if `DESIGN.md` tokens are followed. |
| Backend | **FastAPI** (not Express) | We have exactly one backend-focused dev — Pydantic schemas double as request validation *and* auto-generated OpenAPI docs, which the frontend team consumes directly to generate a typed client (`openapi-typescript`). That single artifact is what lets 3 frontend people build against a contract instead of waiting on a person. SQLAlchemy 2.0 (async) + Alembic for migrations. |
| DB | PostgreSQL 16 | Range types + `EXCLUDE USING GIST` give us database-enforced booking-overlap prevention for free (§4.2) — this is the actual reason Postgres was the right call over MySQL here, not just familiarity. |
| Object storage | MinIO (S3-compatible) | Asset photos, maintenance request photos, audit attachments. Presigned upload URLs, zero backend file-handling code. |
| Cache / jobs | Redis | Two jobs only, kept deliberately small for a 7-hour build: (1) cache Dashboard/Reports aggregate queries for ~10s so KPI cards don't hammer Postgres, (2) backing store for a lightweight in-process APScheduler job that flags overdue allocations/bookings every 60s. No message broker, no websockets — out of scope for the time we have. |
| Auth | JWT (access + refresh), bcrypt via passlib | Signup always creates role=`employee`. Roles are only ever elevated from Screen 3 (Employee Directory) by an admin — this is explicitly called out in the spec as the "no self-elevation" requirement; enforce it server-side, not just by hiding a UI field. |

**Rejected:** Express — would've meant the one Python dev either context-switches to TS or is idle while backend is the actual bottleneck resource. Keeping backend single-language lets that person move fastest. Websockets/real-time — cut for time; polling every 20–30s for notifications is indistinguishable from realtime in a live demo and costs zero infra.

---

## 3. Repo layout

```
assetflow/
├── README.md  AGENT.md  DESIGN.md
├── docker-compose.yml        # postgres, redis, minio ONLY — one command, everyone's unblocked.
│                              # FastAPI is deliberately not in here yet — run it locally via
│                              # uvicorn during the build so reload stays fast; dockerize it
│                              # later once the API is stable and you're prepping the final submission.
├── infra/postgres/init.sql   # enables btree_gist + pgcrypto before alembic ever connects
├── .env.example
├── apps/
│   ├── web/                  # Next.js
│   │   ├── app/
│   │   │   ├── (auth)/login/  (auth)/signup/
│   │   │   └── (app)/dashboard/  org-setup/  assets/  allocations/  bookings/  maintenance/  audits/  reports/  notifications/
│   │   ├── components/ui/        # shadcn primitives — DO NOT hand-roll duplicates
│   │   ├── components/shared/    # Sidebar, KpiCard, StatusPill, ConflictBanner, EmptyState
│   │   └── lib/api-client.ts     # generated from FastAPI's /openapi.json — regenerate, don't hand-edit
│   └── api/                  # FastAPI
│       ├── app/main.py
│       ├── app/core/          # config, security, deps (get_current_user, require_role)
│       ├── app/models/        # SQLAlchemy models — one file per domain
│       ├── app/schemas/       # Pydantic — request/response contracts
│       ├── app/routers/       # auth, departments, categories, employees, assets, allocations, bookings, maintenance, audits, reports, notifications
│       ├── app/services/      # transitions.py (state machines), conflict rules, discrepancy report gen
│       ├── app/jobs/          # overdue_scanner.py (APScheduler)
│       ├── alembic/
│       └── seed.py            # realistic demo data — see §8
└── docs/schema.sql
```

**File-ownership rule (from multi-agent coding practice — conflicting edits to the same file is the #1 way parallel work stalls):** each router file, each screen folder, and each model file has exactly one owner at a time, tracked in `AGENT.md`. If you need to touch a file you don't own, ping the owner in chat first — don't just edit it.

---

## 4. Domain model & the two conflict rules

### 4.1 Core schema (condensed — full DDL in `docs/schema.sql`)

```sql
-- master data
departments(id, name, head_id -> users, parent_department_id -> departments, status)
asset_categories(id, name, custom_fields jsonb)          -- e.g. {"warranty_months": 24}
users(id, name, email, password_hash, role, department_id, status)  -- role: admin|asset_manager|dept_head|employee

-- assets
assets(id, tag,              -- auto AF-0001 via sequence
       name, category_id, serial_number, acquisition_date, acquisition_cost,
       condition, location, is_bookable, photo_url,
       status)               -- available|allocated|reserved|maintenance|lost|retired|disposed

allocations(id, asset_id, holder_user_id, holder_department_id, allocated_at,
            expected_return_date, returned_at, return_condition_notes,
            status)          -- active|returned|overdue

transfer_requests(id, asset_id, from_holder_id, to_holder_id, reason,
                   status, requested_by, approved_by)   -- requested|approved|rejected|completed

-- shared resources
bookings(id, resource_id -> assets, booked_by, slot tstzrange, status)
         -- upcoming|ongoing|completed|cancelled

-- maintenance
maintenance_requests(id, asset_id, raised_by, issue_description, priority,
                      photo_url, status, approved_by, technician_name, resolved_at)
         -- pending|approved|rejected|technician_assigned|in_progress|resolved

-- audit
audit_cycles(id, name, scope_department_id, scope_location, start_date, end_date, status, created_by)  -- open|closed
audit_cycle_auditors(cycle_id, user_id)
audit_items(id, cycle_id, asset_id, expected_location, verification_status, notes, verified_by, verified_at)
            -- pending|verified|missing|damaged

-- system
notifications(id, user_id, type, message, related_entity_type, related_entity_id, is_read, created_at)
activity_logs(id, actor_id, action, entity_type, entity_id, metadata jsonb, created_at)
```

### 4.2 Rule 1 — No double allocation (DB-enforced, not just app-checked)

```sql
CREATE UNIQUE INDEX one_active_allocation_per_asset
ON allocations (asset_id)
WHERE status = 'active';
```

App flow: before `POST /allocations`, check `asset.status`. If not `available`, return `409` with the current holder's name and department — the frontend renders the exact "Already Allocated to Priya Shah (Engineering) — Direct re-allocation is blocked, submit a transfer request below" banner from the mockup, with the Transfer Request form underneath. The unique index is the backstop against race conditions two people hitting "Allocate" at the same instant — the app check alone can't guarantee that.

### 4.3 Rule 2 — No overlapping bookings (DB-enforced via exclusion constraint)

This is the one worth doing right: application-level overlap checks (`SELECT ... WHERE start < :end AND end > :start`) race under concurrent requests. Postgres has a purpose-built primitive for this — an `EXCLUDE` constraint over a range type, backed by a GiST index:

```sql
CREATE EXTENSION IF NOT EXISTS btree_gist;

ALTER TABLE bookings
  ADD CONSTRAINT no_overlapping_bookings
  EXCLUDE USING GIST (resource_id WITH =, slot WITH &&)
  WHERE (status != 'cancelled');
```

`slot` is a single `tstzrange` column (not separate start/end columns). The `&&` operator is "overlaps." This single line makes the exact example in the spec (9:00–10:00 blocks 9:30–10:30, allows 10:00–11:00) structurally impossible to violate, at any concurrency level, with zero application locking code. The API layer just catches Postgres error `23P01` and returns `409 { "error": "slot unavailable", "conflicting_booking": {...} }`, which drives the dotted-red-border "conflict — slot is unavailable" state in the mockup.

### 4.4 State machines (single source of truth)

Every entity with a `status` column (asset, allocation, booking, maintenance_request, audit_item) has its allowed transitions defined **once**, in `app/services/transitions.py`, as an explicit adjacency map, e.g.:

```python
ASSET_TRANSITIONS = {
    "available":  {"allocated", "reserved", "maintenance", "retired"},
    "allocated":  {"available"},
    "maintenance":{"available", "retired"},
    "lost":       {"available", "disposed"},   # e.g. found asset
    ...
}
```
Every service (allocation, booking, maintenance, audit) calls `assert_transition(current, target, TABLE)` before writing. This is the thing that breaks quietly in rushed hackathon code (an asset stuck "Under Maintenance" forever because two code paths both tried to flip it) — one file, one map, prevents that class of bug entirely.

### 4.5 RBAC

FastAPI dependency `require_role("admin", "asset_manager")` on routes; department-scoped routes additionally filter `WHERE department_id = current_user.department_id` for `dept_head`. Enforced server-side always — the frontend hiding a button is UX, not security.

---

## 5. API surface (routers = frontend module boundary)

`/auth` `/departments` `/categories` `/employees` `/assets` `/allocations` `/transfers` `/bookings` `/maintenance` `/audits` `/reports` `/notifications`

FastAPI serves `/openapi.json` from minute one (even with stub routes returning `501`) — **lock this contract in the first 30 minutes as a group**, then generate the TS client. Frontend builds against real types immediately; swaps stub responses for live data as each router lands. This is what makes 4 people productive in parallel instead of 3 people waiting on 1.

---

## 6. Screen ↔ module map

| # | Screen | Primary backend routers |
|---|---|---|
| 1 | Login / Signup | `/auth` |
| 2 | Dashboard | `/reports` (KPI aggregates), `/notifications` |
| 3 | Organization Setup (3 tabs) | `/departments` `/categories` `/employees` |
| 4 | Asset Registration & Directory | `/assets` |
| 5 | Allocation & Transfer | `/allocations` `/transfers` |
| 6 | Resource Booking | `/bookings` |
| 7 | Maintenance (kanban) | `/maintenance` |
| 8 | Asset Audit | `/audits` |
| 9 | Reports & Analytics | `/reports` |
| 10 | Activity Logs & Notifications | `/notifications` |

---

## 7. Team split — dependency-ordered, not evenly split

With one backend dev, the naive split (1 backend, 3 frontend) makes backend the bottleneck for the whole first half of the day. Fix: the 4th person co-builds the *boring* CRUD backend for the first ~2.5 hours (departments/categories/employees/assets — screens 3–4), freeing the Python dev to start immediately on the two signature conflict features. Then the 4th person swaps to frontend for the screens whose backend lands last anyway (audit/reports), so nobody sits idle waiting.

| Owner | Hours 0–2.5 | Hours 2.5–7 |
|---|---|---|
| **Backend (Python)** | Auth, allocation conflict logic, booking exclusion constraint | Maintenance workflow → audit cycle → reports aggregation → notifications → overdue job |
| **4th / swing** | Pairs on backend: departments, categories, employees, assets CRUD+search | Frontend: Screens 8–10 (audit, reports, notifications) + final integration/QA pass |
| **Full-stack A** | Frontend: Screens 1–4 (auth, dashboard, org setup, asset directory) — static first, wires to real data as auth/CRUD land (~hr 1–1.5) | Continues wiring, then Screen 10 shell, then integration pass |
| **Full-stack B** | Frontend: Screens 5–6 static, specifically building the two conflict UI states (red "already allocated" banner, red dotted "overlap" banner) against fixture data first | Wires 5–6 to real endpoints as they land (~hr 2–2.5), then Screen 7 kanban |

Adjust freely if the 4th person's actual skills differ — the point is *module ownership tracked in `AGENT.md`*, not these exact names.

**Update:** if a full-stack dev is also comfortable in FastAPI, don't leave them purely on frontend for the whole 2.5–7h block — have them pick up a second backend router (maintenance or reports are the best candidates, since those are what's still serial on the Python dev after hour 2.5) once their own screens are wired to live data. This is the direct fix for the single-backend-owner bottleneck flagged at the top of this section — two people who can both write FastAPI routes in parallel is worth more than a 4th frontend pair of hands once Phase 1 (§8) is done.

---

## 8. Hour-by-hour plan (7h = 420min)

| Time | Everyone |
|---|---|
| 0:00–0:30 | **Whole team, one room.** Lock the DB schema (§4.1) and API contract (§5). `docker-compose up`. Push empty Next.js + FastAPI skeletons. Skim `DESIGN.md` so nobody free-styles colors. |
| 0:30–2:30 | Parallel build per §7 table, column 1. Backend prioritizes the two conflict rules before anything else — they're the demo centerpiece. |
| 2:30–4:00 | Parallel build continues. Backend: maintenance workflow + audit cycle start. Frontend: screens 5–7 wiring; 8–9 skeletons on mocks. |
| 4:00–5:30 | Backend finishes audit, reports queries, notifications, overdue job. Frontend wires everything remaining to live data. |
| 5:30–6:15 | **Integration pass, whole team.** Kill every mock. Run `seed.py` for realistic demo data (§9). Role-based UI gating. Fix cross-screen bugs. |
| 6:15–6:45 | Polish: `DESIGN.md` consistency check, responsive pass, empty/loading/error states, MinIO upload wired on at least Screens 4 & 7. |
| 6:45–7:00 | **Demo rehearsal** — run the script in §9 start to finish once. Fix only blockers. |

---

## 9. Seed data & demo script

`seed.py` recreates the exact examples the problem statement itself uses — Priya Shah / Laptop AF-0114 / Engineering, Room B2 / 9:00–10:00 — so the demo *is* the spec, which reads as deliberate rather than improvised.

1. Login as Admin → Org Setup → promote an employee to Asset Manager (proves no self-elevation).
2. Register a new asset → appears `Available` with an auto-generated tag.
3. Allocate AF-0114 to Priya Shah.
4. Switch user, try to allocate AF-0114 again → **blocked**, "currently held by Priya Shah (Engineering)", Transfer Request CTA shown.
5. Submit transfer request → approve as Asset Manager → allocation history updates automatically.
6. Book Room B2 9:00–10:00 → attempt 9:30–10:30 → **rejected live**, note this is enforced at the database layer, not just client validation.
7. Raise a maintenance request → approve → asset auto-flips to `Under Maintenance` → drag kanban card to Resolved → asset auto-flips back to `Available`.
8. Create an audit cycle, assign an auditor, mark one asset Missing → close cycle → discrepancy report auto-generates → asset status flips to `Lost`.
9. Land on Dashboard: KPIs and Notifications feed reflect every action above, live.

---

## 10. Setup

```bash
git clone <repo> && cd assetflow
cp .env.example .env
docker compose up -d          # postgres, redis, minio
cd apps/api && alembic upgrade head && python seed.py
uvicorn app.main:app --reload # http://localhost:8000/docs
cd ../web && npm install && npm run dev  # http://localhost:3000
```

---

## 11. Stretch goals (only after §9's demo script works end to end)

- QR code per asset tag (the mockup's search bar already advertises "search by tag, serial, or QR code") — printable label view.
- `cmd+k` command palette (shadcn `cmdk`) for cross-entity search.
- Drag-and-drop maintenance kanban via `dnd-kit` (spec explicitly frames Screen 7 as a kanban board).
- CSV export on Reports (client-side, no backend work needed).

Do not start any of these until the core 10-screen flow in §9 is bulletproof. A working boring demo beats a broken impressive one.
