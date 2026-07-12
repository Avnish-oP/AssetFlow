# AssetFlow

Enterprise asset & resource management — track physical assets (laptops, furniture, equipment) and shared resources (rooms, gear) from registration through allocation, booking, maintenance, and audit.

## What it does

| Module | What you can do |
|---|---|
| **Dashboard** | KPIs, overdue flags, quick actions |
| **Organization setup** | Departments, asset categories, employees & roles |
| **Assets** | Register assets (auto tag), search/filter, request allocation |
| **Allocation & transfer** | Allocate assets, block double-allocation, request/approve transfers, return |
| **Resource booking** | Book shared resources; overlapping slots are rejected |
| **Maintenance** | Raise requests, approve, kanban through to resolved |
| **Audits** | Run audit cycles, mark verified/missing/damaged, close with discrepancy report |
| **Reports** | Utilization, usage, maintenance frequency, CSV export |
| **Notifications** | Activity feed for allocations, transfers, bookings, and more |

**Guarantees (enforced in Postgres):**
1. An asset cannot be allocated to two people at once — conflict shows the current holder and offers a transfer.
2. A shared resource cannot be double-booked for overlapping time slots.

## Roles

| Role | Typical access |
|---|---|
| **Admin** | Full access — org setup, promote users, all workflows |
| **Asset manager** | Assets, allocations, transfers, maintenance, audits |
| **Dept head** | Department-scoped view; can approve transfers |
| **Employee** | Browse assets, request resources/transfers, book, raise maintenance, return own assets |

Signup always creates an **employee**. Only an admin can promote roles from Organization setup.

## Stack

- **Frontend:** Next.js (App Router) + TypeScript + Tailwind
- **Backend:** FastAPI + SQLAlchemy (async)
- **Infra:** PostgreSQL 16, Redis, MinIO (via Docker Compose)

```
AssetFlow/
├── frontend/          # Next.js app → http://localhost:3000
├── backend/           # FastAPI app → http://localhost:8000
├── docker-compose.yaml
├── DESIGN.md          # UI tokens & patterns
└── AGENT.md           # Build tracker
```

## Setup

**Prerequisites:** Docker, Node.js 20+, Python 3.11+

```bash
# 1. Infra (Postgres on :5434, Redis, MinIO)
docker compose up -d

# 2. Backend
cd backend
python -m venv .venv
source .venv/bin/activate          # Windows: .venv\Scripts\activate
pip install -r requirements.txt
python seed.py                     # demo data
uvicorn main:app --reload          # http://localhost:8000/docs

# 3. Frontend (new terminal)
cd frontend
npm install
npm run dev                        # http://localhost:3000
```

Defaults match Docker Compose (no `.env` required for local demo). Optional overrides go in `backend/.env` — see `backend/core/config.py`.

### Seed modes

```bash
cd backend
python seed.py                 # full smoke dataset (recommended)
python seed.py --clean         # master data only — empty workflows for a live walkthrough
```

## Demo accounts

Password for all: `password`

| Email | Role |
|---|---|
| `admin@assetflow.dev` | Admin |
| `meera@assetflow.dev` | Asset manager |
| `ravi@assetflow.dev` | Dept head (Engineering) |
| `priya@assetflow.dev` | Employee (Engineering) |
| `amit@assetflow.dev` | Employee (Engineering) |
| `neha@assetflow.dev` | Employee (Facilities) |

## How to use

### Admin / asset manager walkthrough

1. **Login** as `admin@assetflow.dev`.
2. **Organization setup** — create departments/categories; promote an employee if needed.
3. **Assets** — register an asset (tag like `AF-0001` is auto-generated).
4. **Allocate** — Allocation & transfer → pick asset + holder → Allocate.
5. **Conflict** — try allocating the same asset again → blocked with current holder; submit a **transfer request**.
6. **Transfer** — approve as manager, then **Complete reallocation** to move the asset.
7. **Booking** — Resource booking → book a room/slot; overlapping times are rejected.
8. **Maintenance** — raise a request → approve → drag through kanban → resolve (asset returns to Available).
9. **Audit** — open a cycle, verify/mark missing, close → discrepancy report; missing assets become Lost.
10. **Reports / Notifications** — check KPIs and the activity feed.

### Employee walkthrough

1. **Login** as `priya@assetflow.dev` (or any employee).
2. **Assets** — browse available assets → **Request** allocation (manager reviews).
3. **Allocation & transfer** — request transfer of an asset held by someone else; return assets assigned to you.
4. **Bookings / Maintenance** — book shared resources; raise maintenance for issues.

## Useful URLs

| Service | URL |
|---|---|
| App | http://localhost:3000 |
| API docs | http://localhost:8000/docs |
| MinIO console | http://localhost:9001 (`assetflow` / `assetflow123`) |

## Design

Follow `DESIGN.md` for colors, typography, and layout. Brand is ink + rosewood — not green.
