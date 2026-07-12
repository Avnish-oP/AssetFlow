from contextlib import asynccontextmanager

from apscheduler.schedulers.asyncio import AsyncIOScheduler
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
    maintenance,
    notifications,
    reports,
    resource_requests,
    stubs,
    transfers,
    uploads,
)
from core.config import get_settings
from jobs.overdue_scanner import scan_overdue

settings = get_settings()
scheduler = AsyncIOScheduler()


@asynccontextmanager
async def lifespan(_: FastAPI):
    scheduler.add_job(scan_overdue, "interval", seconds=60, id="overdue_scanner", replace_existing=True)
    scheduler.start()
    # Run once at startup so demos don't wait a full minute
    await scan_overdue()
    yield
    scheduler.shutdown(wait=False)


app = FastAPI(title="AssetFlow API", version="0.1.0", lifespan=lifespan)
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
app.include_router(uploads.router)
app.include_router(resource_requests.router)


@app.get("/health")
async def health():
    return {"status": "ok"}
