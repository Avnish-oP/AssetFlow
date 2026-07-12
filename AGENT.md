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
- [x] Hand-written `frontend/src/lib/api.ts` (OpenAPI codegen deferred — fine for demo)
- [x] Next.js sidebar shell matches `DESIGN.md`

**Phase 1 — Core CRUD + conflict rules**
- [x] Auth: signup (employee only), login, JWT, forgot-password stub
- [x] Departments / Categories / Employees CRUD (head, parent dept, category custom fields)
- [x] Admin promote → dept head / asset manager (self-elevation blocked)
- [x] Assets: register + auto tag, search/filter, directory + detail/history
- [x] Allocation conflict (unique partial index + 409 + UI)
- [x] Booking overlap (GIST exclude + 409 + UI) + cancel

**Phase 2 — Workflows**
- [x] Transfer: requested → approved → complete (re-allocates on **complete**)
- [x] Return flow: condition notes → asset Available
- [x] Maintenance kanban + reject + asset status auto-flip (approve → maintenance, resolve → available)
- [x] Audit cycle: assign auditors, verify / missing → discrepancy; **Lost on close**; report

**Phase 3 — Reports, notifications, dashboard**
- [x] Dashboard /reports/summary KPIs + overdue banner + quick actions
- [x] Overdue scanner (APScheduler) — ongoing bookings + reminders
- [x] Notifications feed + polling (allocate/transfer/maintenance/audit/booking)
- [x] Reports: utilization, usage, maintenance frequency, retirement, **booking heatmap**, **dept allocations**, CSV export

**Phase 4 — Integration & demo**
- [x] App pages on live API (no mock datasets; assets mock fallback removed)
- [x] `backend/seed.py` demo dataset (`*@assetflow.dev` / `password`) + `seeds/smoke_snapshot.json`
- [x] Role-based UI gating for all 4 roles (`lib/roles.ts` + Sidebar/page actions)
- [x] Demo script (README §9) rehearsed end-to-end — **Phase 5**

**Phase 5 — PS fidelity + §9 E2E**
- [x] Maintenance flips to under maintenance on **approve** (not raise)
- [x] Audit `Lost` applied on cycle **close** (not mark-missing)
- [x] README §9 step 5: Approve then **Complete** to reallocate
- [x] UI polish: dashboard quick actions, org parent/head + category fields, asset register fields, booking cancel, maintenance reject
- [x] Full §9 API E2E + employee Reports/Audits 403 spot-check

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

---

## Remaining work (priority)

1. Optional: MinIO photo upload (photo_url text fields work today)
2. Optional: OpenAPI-generated TS client (hand-written `api.ts` is sufficient)
3. Optional: Redis cache; booking reminders / reschedule UI

---

## Decision log

*(append-only, newest on top)*

- 2026-07-12 — closed PS gaps: forgot/reset password, booking reschedule, MinIO uploads, dept_head transfer approve, employee returns, audit dept scope.
- 2026-07-12 — merge origin/main: kept approve→maintenance flip + reject/notify; kept local heatmap/dept reports, smoke seed snapshot, asset detail links; combined org-setup head/parent + category fields.
- 2026-07-12 — seed split: `seed.py` loads `seeds/smoke_snapshot.json`; `seed.py --clean` for live §9 walkthrough; `seed_export.py` re-captures local DB.
- 2026-07-12 — Phase 5: maintenance asset flip on approve; audit Lost on close; README §9 step 5 Complete wording; §9 E2E rehearsed.
- 2026-07-12 — Phase 4: frontend role matrix in `lib/roles.ts` + Sidebar/page gating; assets mock removed; transfer Complete CTA clarified.
- 2026-07-12 — Phase 3: in-process 10s TTL for `/reports` aggregates; APScheduler overdue scanner; notifications poll; recharts + CSV.
- 2026-07-12 — `backend/seed.py` is demo data source; `init.sql` is schema-only.
- 2026-07-12 — repo layout is `backend/` + `frontend/` (not README's `apps/*` paths).
- 2026-07-12 — docker-compose = postgres/redis/minio only; FastAPI runs locally via uvicorn.

---

## Blockers

- —
