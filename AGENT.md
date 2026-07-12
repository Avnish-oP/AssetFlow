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
- [x] Admin promote → dept head / asset manager (self-elevation blocked)
- [x] Assets: register + auto tag, search/filter, directory
- [x] Allocation conflict (unique partial index + 409 + UI)
- [x] Booking overlap (GIST exclude + 409 + UI)

**Phase 2 — Workflows**
- [x] Transfer: requested → approved → complete (re-allocates on **complete**)
- [x] Return flow: condition notes → asset Available
- [x] Maintenance kanban + asset status auto-flip (approve → maintenance, resolve → available)
- [x] Audit cycle: assign auditors, missing→Lost, discrepancy report, close

**Phase 3 — Reports, notifications, dashboard**
- [x] Dashboard /reports/summary KPIs live
- [x] Overdue scanner (APScheduler)
- [x] Notifications feed + polling (also created on allocate/transfer/maintenance/audit)
- [x] Reports endpoints live (utilization, usage, maintenance frequency, retirement)

**Phase 4 — Integration & demo**
- [x] App pages on live API
- [x] `backend/seed.py` demo dataset (`*@assetflow.dev` / `password`)
- [ ] Role-based UI gating for all 4 roles (API enforced; sidebar still shows all nav)
- [ ] Demo script (README §9) rehearsed end-to-end in the UI

---

## README §9 demo workflow (API smoke 2026-07-12)

| # | Step | API | Notes |
|---|---|---|---|
| 1 | Admin promote + no self-elevation | PASS | Use `admin@assetflow.dev` |
| 2 | Register asset → Available + auto tag | PASS | |
| 3 | Allocate AF-0114 → Priya | PASS | |
| 4 | Re-allocate blocked + holder | PASS | 409 + Priya Shah (Engineering) |
| 5 | Transfer approve → complete | PASS | Re-alloc happens on **Complete** |
| 6 | Booking 9–10 then 9:30–10:30 reject | PASS | GIST-enforced |
| 7 | Maintenance → resolve → Available | PASS | On an **available** asset |
| 8 | Audit Missing→Lost + close + report | PASS | Needed `audit_cycle_auditors` table (added to live DB) |
| 9 | Reports + Notifications APIs | PASS | |
- [x] App pages on live API (no mock datasets; assets mock fallback removed)
- [x] `backend/seed.py` demo dataset (Priya Shah / AF-0114 / Room B2)
- [x] Role-based UI gating for all 4 roles (`lib/roles.ts` + Sidebar/page actions)
- [ ] Demo script (README §9) rehearsed end-to-end — **Phase 5** (Phase 4 smoke done)

---

## Remaining work (priority)

1. **Role-based UI gating** — hide admin-only nav/actions for employee / dept_head
2. Prefill login with `admin@assetflow.dev` (or a demo-account hint) so cold demos don't fail
3. Ensure fresh DBs get `audit_cycle_auditors` (already in `init.sql`; existing volumes need one-time `CREATE TABLE` or volume wipe + re-seed)
4. Optional: drop OpenAPI TS-client checklist item (hand-written `api.ts` is fine)
5. Full UI demo rehearsal
1. Full README §9 E2E rehearsal (Phase 5)
2. Optional: generate OpenAPI TS client (or drop the checklist item and keep `api.ts`)
3. Optional: MinIO photo upload / Redis cache

---

## Decision log

*(append-only, newest on top)*

- 2026-07-12 — re-audit vs README §9: API smoke mostly PASS after restart; live DB was missing `audit_cycle_auditors` (init.sql has it, volume was older). Role UI gating still open.
- 2026-07-12 — merged origin/main: Phase 3 reports/notifications stack; toast + org-setup conflict toasts.
- 2026-07-12 — merged origin/main: kept local Phase 3 reports/notifications stack (`report_service`, schemas, recharts, activity log); took remote toast + org-setup conflict toasts; cleaned AGENT ownership table.
- 2026-07-12 — Phase 4: frontend role matrix in `lib/roles.ts` + Sidebar/page gating; assets mock removed; `maintenance→allocated` transition allowed; transfer Complete CTA clarified. Full §9 E2E deferred to Phase 5. MinIO/OpenAPI still deferred.
- 2026-07-12 — Phase 3: in-process 10s TTL for `/reports` aggregates (skipped Redis client); APScheduler overdue scanner every 60s; notifications poll every 25s; recharts on Reports; CSV export client-side.
- 2026-07-12 — cleaned AGENT.md: dropped stale `apps/api`/`apps/web` ownership table; Phase 2–3 marked done.
- 2026-07-12 — `backend/seed.py` is demo data source; `init.sql` is schema-only.
- 2026-07-12 — repo layout is `backend/` + `frontend/` (not README's `apps/*` paths).
- 2026-07-12 — docker-compose = postgres/redis/minio only; FastAPI runs locally via uvicorn.

---

## Blockers

- —
