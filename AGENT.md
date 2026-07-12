# AGENT.md — AssetFlow build tracker

Read `README.md` first — architecture and *why*. This file tracks *current state* only.

**Rules:**
1. Check a box only when it works end-to-end (live API + frontend), not when code is merely written.
2. Stuck 2+ attempts → log in **Blockers**, ask for help.
3. Decisions that change README → append to **Decision log** (don't edit README mid-build).

---

## Phase checklist

**Phase 0 — Setup**
- [x] Schema in `backend/infra/postgres/init.sql` (no `docs/schema.sql`)
- [x] OpenAPI reachable; all 12 routers mounted and live
- [x] `docker compose up` (postgres, redis, minio)
- [ ] Generated TS client from OpenAPI (still hand-written `frontend/src/lib/api.ts`)
- [x] Next.js sidebar shell matches `DESIGN.md`

**Phase 1 — Core CRUD + conflict rules**
- [x] Auth: signup (employee only), login, JWT, forgot-password stub
- [x] Departments / Categories / Employees CRUD
- [x] Admin promote → dept head / asset manager
- [x] Assets: register + auto tag, search/filter, directory
- [x] Allocation conflict (unique partial index + 409 + UI)
- [x] Booking overlap (GIST exclude + 409 + UI)

**Phase 2 — Workflows**
- [x] Transfer: requested → approved → complete (re-allocates on complete)
- [x] Return flow: condition notes → asset Available
- [x] Maintenance kanban + asset status auto-flip
- [x] Audit cycle: verify / missing→Lost, discrepancy report, close

**Phase 3 — Reports, notifications, dashboard**
- [x] Dashboard KPI cards live
- [x] Overdue scanner (APScheduler)
- [x] Notifications feed + polling
- [ ] Reports fully correct (UI + `/reports` live; allocation/booking/transfer totals still wrong — queried from assets)

**Phase 4 — Integration & demo**
- [x] App pages on live API (no mock datasets; `stubs.py` unused)
- [x] `backend/seed.py` demo dataset (Priya Shah / AF-0114 / Room B2)
- [ ] Role-based UI gating for all 4 roles (API `require_role` only today)
- [ ] Demo script (README §9) rehearsed end-to-end

---

## Remaining work (priority)

1. Fix reports summary counts (allocations / bookings / transfers)
2. Role-based UI gating in sidebar + admin actions
3. Optional: generate OpenAPI TS client (or drop the checklist item and keep `api.ts`)
4. Demo rehearsal

---

## Decision log

*(append-only, newest on top)*

- 2026-07-12 — cleaned AGENT.md: dropped stale `apps/api`/`apps/web` ownership table; Phase 2–3 marked done; reports totals flagged partial.
- 2026-07-12 — `backend/seed.py` is demo data source; `init.sql` is schema-only.
- 2026-07-12 — repo layout is `backend/` + `frontend/` (not README's `apps/*` paths).
- 2026-07-12 — docker-compose = postgres/redis/minio only; FastAPI runs locally via uvicorn.

---

## Blockers

- —
