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
- [x] Maintenance kanban + asset status auto-flip (on **approve**)
- [x] Audit cycle: verify / missing → discrepancy; **Lost on close**

**Phase 3 — Reports, notifications, dashboard**
- [x] Dashboard KPI cards live
- [x] Overdue scanner (APScheduler)
- [x] Notifications feed + polling
- [x] Reports: utilization, most-used/idle, maintenance frequency, due-for-retirement, export

**Phase 4 — Integration & demo**
- [x] App pages on live API (no mock datasets; assets mock fallback removed)
- [x] `backend/seed.py` demo dataset (Priya Shah / AF-0114 / Room B2)
- [x] Role-based UI gating for all 4 roles (`lib/roles.ts` + Sidebar/page actions)
- [x] Demo script (README §9) rehearsed end-to-end — **Phase 5**

**Phase 5 — PS fidelity + §9 E2E**
- [x] Maintenance flips to under maintenance on **approve** (not raise)
- [x] Audit `Lost` applied on cycle **close** (not mark-missing)
- [x] README §9 step 5: Approve then **Complete** to reallocate
- [x] UI polish: dashboard quick actions, org parent/head + category fields, asset register fields, booking cancel, maintenance reject
- [x] Full §9 API E2E + employee Reports/Audits 403 spot-check
- [x] PS compliance matrix below

---

## PS vs app (Screens 1–10)

| Screen / area | Status | Notes |
|---|---|---|
| 1 Login / Signup | Done | Forgot-password stub only (no email) |
| 2 Dashboard | Done | KPIs + overdue tint + quick actions; employees see feed without KPI grid |
| 3 Org Setup | Done | Parent dept, head, category custom fields; promote admin-only |
| 4 Assets | Partial | Register + filters live; photo URL only (no MinIO); no per-asset history panel |
| 5 Allocation / Transfer | Done | 409 + Transfer CTA; Complete reallocates; return for admin/AM/DH (not employee API) |
| 6 Bookings | Partial | Overlap 409 + cancel; no reschedule / reminders / `ongoing` |
| 7 Maintenance | Done | Pending→…→Resolved; reject; flip on approve; restore on resolve |
| 8 Audits | Done | Cycle, auditors, verify/missing/damaged, report, Lost on close |
| 9 Reports | Partial | Utilization / usage / maintenance / retirement + CSV; no heatmap / dept summary |
| 10 Notifications + activity | Done | Feed + activity log + overdue scanner |
| Roles (UI + API) | Partial | Frontend `roles.ts`; some GETs open; dept_head not dept-scoped server-side |

**Deferred / stretch:** MinIO upload, Redis cache, OpenAPI TS client, booking reminders, heatmap, forgot-password email, QR search.

---

## Remaining work (priority)

1. Optional: MinIO photo upload / Redis cache
2. Optional: generate OpenAPI TS client (or keep `api.ts`)
3. Optional: booking heatmap, dept allocation report, employee-initiated return API

---

## Decision log

*(append-only, newest on top)*

- 2026-07-12 — Phase 5: maintenance asset flip on approve; audit Lost on close; README §9 step 5 Complete wording; §9 E2E rehearsed. Employee return still manager-gated (allocations router roles). Stretch (MinIO/heatmap/OpenAPI) deferred.
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
