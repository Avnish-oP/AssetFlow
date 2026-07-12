# AGENT.md — AssetFlow build tracker

Read `README.md` first — it has the architecture and the *why*. This file only tracks *current state*: who owns what right now, what's done, what's blocked, and decisions made mid-build that aren't in README yet.

**Rules for anyone (human or agent) working from this file:**
1. Check a box only when the thing actually works end-to-end (backend endpoint returns real data AND frontend renders it), not when code is written.
2. One file, one owner, at a time — see ownership table. Need to touch someone else's file? Ping them first, don't just edit it.
3. Stuck on the same error for 2+ attempts → stop, write it in **Blockers** below, ask for help. Don't keep grinding silently.
4. Log every decision that changes or adds to what README says — append to **Decision Log**, never edit README mid-build.
5. Update this file immediately after finishing a checklist item, not in a batch at the end.

---

## Module ownership (right now)

| Module / files | Owner | Status |
|---|---|---|
| `apps/api/app/models/*`, `alembic/*` | — | not started |
| `apps/api/app/routers/auth.py` | — | not started |
| `apps/api/app/routers/{departments,categories,employees}.py` | — | not started |
| `apps/api/app/routers/assets.py` | — | not started |
| `apps/api/app/routers/allocations.py`, `transfers.py` + `services/transitions.py` | — | not started |
| `apps/api/app/routers/bookings.py` | — | not started |
| `apps/api/app/routers/maintenance.py` | — | not started |
| `apps/api/app/routers/audits.py` | — | not started |
| `apps/api/app/routers/reports.py`, `notifications.py`, `jobs/overdue_scanner.py` | — | not started |
| `apps/web` — Screens 1–4 | — | not started |
| `apps/web` — Screens 5–6 | — | not started |
| `apps/web` — Screen 7 | — | not started |
| `apps/web` — Screens 8–10 | — | not started |

Fill in names at kickoff (0:00–0:30 sync). Reassign here, not in chat, so it stays the source of truth.

---

## Phase checklist

**Phase 0 — Setup (target 0:30)**
- [ ] `docs/schema.sql` agreed and committed
- [ ] OpenAPI contract stubbed (`/openapi.json` reachable, all 12 routers return `501`)
- [ ] `docker compose up` works for everyone (postgres, redis, minio reachable)
- [ ] TS client generated from OpenAPI stub
- [ ] Next.js sidebar shell matches `DESIGN.md` on all routes

**Phase 1 — Core CRUD + the two conflict rules (target 2:30)**
- [ ] Auth: signup (role=employee only), login, JWT, forgot password stub
- [ ] Departments / Categories / Employees CRUD (Screen 3)
- [ ] Admin can promote employee → dept head / asset manager
- [ ] Assets: register w/ auto tag, search/filter, directory (Screen 4)
- [ ] Allocation conflict block works (unique partial index + 409 + "currently held by" UI)
- [ ] Booking overlap block works (GIST exclude constraint + 409 + conflict UI)

**Phase 2 — Workflows (target 4:00)**
- [ ] Transfer request: requested → approved → re-allocated, history updates
- [ ] Return flow: condition notes, asset reverts to Available
- [ ] Maintenance: pending → approved → technician assigned → in progress → resolved, kanban UI, asset status auto-flips
- [ ] Audit cycle: create, assign auditors, verify items, close cycle, discrepancy report, missing → asset status = Lost

**Phase 3 — Reports, notifications, dashboard (target 5:30)**
- [ ] Dashboard KPI cards live (available/allocated/maintenance/bookings/transfers/returns)
- [ ] Overdue returns/bookings auto-flagged (APScheduler job running)
- [ ] Notifications feed + polling
- [ ] Reports: utilization, most-used/idle, maintenance frequency, due-for-retirement, export

**Phase 4 — Integration & demo (target 7:00)**
- [ ] All mocks removed, everything on live data
- [ ] `seed.py` demo dataset loaded (Priya Shah / AF-0114 / Room B2 scenario)
- [ ] Role-based UI gating verified for all 4 roles
- [ ] Demo script (README §9) rehearsed once, end to end, no blockers

---

## Decision log

*(append-only, newest on top, one line each: `HH:MM — decision — why`)*

- `docker-compose.yml` covers postgres/redis/minio only — FastAPI stays un-dockerized until the API is stable, to keep `uvicorn --reload` fast during the build. Add an `api` service + `apps/api/Dockerfile` later, not now.
- Backend isn't strictly one-owner: any full-stack dev comfortable in FastAPI can pick up a second router (maintenance/reports preferred — see README §7) after their own screens are wired, instead of staying frontend-only for the full 2.5–7h block.
- —

---

## Blockers / open questions

*(remove when resolved; if stuck 2+ attempts, it belongs here, not in your head)*

- —

---

## API contract changes since README was written

*(anyone changing a shape in `schemas/` that another module depends on — log it here so nobody's frontend silently breaks)*

- —
