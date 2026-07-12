from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from api.routes import (
    allocations,
    assets,
    audits,
    auth,
    bookings,
    categories,
    departments,
    employees,
    notifications,
    reports,
    maintenance,
    transfers,
)
from core.config import get_settings
from jobs.overdue_scanner import start_overdue_scanner, stop_overdue_scanner

settings = get_settings()

app = FastAPI(title="AssetFlow API", version="0.1.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(departments.router)
app.include_router(categories.router)
app.include_router(employees.router)
app.include_router(assets.router)
app.include_router(allocations.router)
app.include_router(transfers.router)
app.include_router(bookings.router)
app.include_router(maintenance.router)
app.include_router(audits.router)
app.include_router(reports.router)
app.include_router(notifications.router)


@app.on_event("startup")
async def _startup_jobs():
    start_overdue_scanner()


@app.on_event("shutdown")
async def _shutdown_jobs():
    stop_overdue_scanner()


@app.get("/health")
async def health():
    return {"status": "ok"}

