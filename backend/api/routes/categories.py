from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from core.database import get_db
from core.security import require_role
from models.asset import AssetCategory
from schemas.org import CategoryCreate, CategoryResponse, CategoryUpdate

router = APIRouter(prefix="/categories", tags=["categories"], dependencies=[Depends(require_role("admin", "asset_manager"))])


@router.get("", response_model=list[CategoryResponse])
async def list_categories(db: Annotated[AsyncSession, Depends(get_db)]):
    return (await db.scalars(select(AssetCategory).order_by(AssetCategory.name))).all()


@router.post("", response_model=CategoryResponse, status_code=status.HTTP_201_CREATED)
async def create_category(payload: CategoryCreate, db: Annotated[AsyncSession, Depends(get_db)]):
    category = AssetCategory(**payload.model_dump())
    db.add(category)
    await db.commit()
    await db.refresh(category)
    return category


@router.patch("/{category_id}", response_model=CategoryResponse)
async def update_category(category_id: int, payload: CategoryUpdate, db: Annotated[AsyncSession, Depends(get_db)]):
    category = await db.get(AssetCategory, category_id)
    if not category:
        raise HTTPException(status_code=404, detail="Category not found")
    for key, value in payload.model_dump(exclude_unset=True).items():
        setattr(category, key, value)
    await db.commit()
    await db.refresh(category)
    return category


@router.delete("/{category_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_category(category_id: int, db: Annotated[AsyncSession, Depends(get_db)]):
    category = await db.get(AssetCategory, category_id)
    if not category:
        raise HTTPException(status_code=404, detail="Category not found")
    await db.delete(category)
    await db.commit()

