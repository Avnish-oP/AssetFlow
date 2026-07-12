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
    stubs,
    transfers,
)
from core.config import get_settings

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
app.include_router(stubs.stub_router("/reports", "reports"))
app.include_router(stubs.stub_router("/notifications", "notifications"))


@app.get("/health")
async def health():
    return {"status": "ok"}

