from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import or_, select, text
from sqlalchemy.ext.asyncio import AsyncSession

from core.database import get_db
from core.security import require_role
from models.asset import Asset
from schemas.asset import AssetCreate, AssetResponse, AssetUpdate

router = APIRouter(prefix="/assets", tags=["assets"])


@router.get("", response_model=list[AssetResponse])
async def list_assets(
    db: Annotated[AsyncSession, Depends(get_db)],
    search: str | None = None,
    status_filter: str | None = Query(default=None, alias="status"),
    is_bookable: bool | None = None,
    limit: int = Query(default=50, le=100),
    offset: int = 0,
):
    stmt = select(Asset).order_by(Asset.id.desc()).limit(limit).offset(offset)
    if search:
        pattern = f"%{search}%"
        stmt = stmt.where(or_(Asset.name.ilike(pattern), Asset.tag.ilike(pattern), Asset.serial_number.ilike(pattern)))
    if status_filter:
        stmt = stmt.where(Asset.status == status_filter)
    if is_bookable is not None:
        stmt = stmt.where(Asset.is_bookable.is_(is_bookable))
    return (await db.scalars(stmt)).all()


@router.post("", response_model=AssetResponse, status_code=status.HTTP_201_CREATED, dependencies=[Depends(require_role("admin", "asset_manager"))])
async def create_asset(payload: AssetCreate, db: Annotated[AsyncSession, Depends(get_db)]):
    next_value = await db.scalar(text("SELECT nextval('asset_tag_seq')"))
    asset = Asset(tag=f"AF-{int(next_value):04d}", **payload.model_dump())
    db.add(asset)
    await db.commit()
    await db.refresh(asset)
    return asset


@router.get("/{asset_id}", response_model=AssetResponse)
async def get_asset(asset_id: int, db: Annotated[AsyncSession, Depends(get_db)]):
    asset = await db.get(Asset, asset_id)
    if not asset:
        raise HTTPException(status_code=404, detail="Asset not found")
    return asset


@router.patch("/{asset_id}", response_model=AssetResponse, dependencies=[Depends(require_role("admin", "asset_manager"))])
async def update_asset(asset_id: int, payload: AssetUpdate, db: Annotated[AsyncSession, Depends(get_db)]):
    asset = await db.get(Asset, asset_id)
    if not asset:
        raise HTTPException(status_code=404, detail="Asset not found")
    for key, value in payload.model_dump(exclude_unset=True).items():
        setattr(asset, key, value)
    await db.commit()
    await db.refresh(asset)
    return asset


@router.delete("/{asset_id}", status_code=status.HTTP_204_NO_CONTENT, dependencies=[Depends(require_role("admin", "asset_manager"))])
async def delete_asset(asset_id: int, db: Annotated[AsyncSession, Depends(get_db)]):
    asset = await db.get(Asset, asset_id)
    if not asset:
        raise HTTPException(status_code=404, detail="Asset not found")
    await db.delete(asset)
    await db.commit()

