from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from core.database import get_db
from core.security import require_role
from models.department import Department
from schemas.org import DepartmentCreate, DepartmentResponse, DepartmentUpdate

router = APIRouter(prefix="/departments", tags=["departments"], dependencies=[Depends(require_role("admin", "asset_manager"))])


@router.get("", response_model=list[DepartmentResponse])
async def list_departments(db: Annotated[AsyncSession, Depends(get_db)]):
    return (await db.scalars(select(Department).order_by(Department.name))).all()


from sqlalchemy.exc import IntegrityError

@router.post("", response_model=DepartmentResponse, status_code=status.HTTP_201_CREATED)
async def create_department(payload: DepartmentCreate, db: Annotated[AsyncSession, Depends(get_db)]):
    department = Department(**payload.model_dump())
    db.add(department)
    try:
        await db.commit()
    except IntegrityError:
        await db.rollback()
        raise HTTPException(status_code=409, detail=f"Department '{payload.name}' already exists")
    await db.refresh(department)
    return department


@router.get("/{department_id}", response_model=DepartmentResponse)
async def get_department(department_id: int, db: Annotated[AsyncSession, Depends(get_db)]):
    department = await db.get(Department, department_id)
    if not department:
        raise HTTPException(status_code=404, detail="Department not found")
    return department


@router.patch("/{department_id}", response_model=DepartmentResponse)
async def update_department(department_id: int, payload: DepartmentUpdate, db: Annotated[AsyncSession, Depends(get_db)]):
    department = await db.get(Department, department_id)
    if not department:
        raise HTTPException(status_code=404, detail="Department not found")
    for key, value in payload.model_dump(exclude_unset=True).items():
        setattr(department, key, value)
    await db.commit()
    await db.refresh(department)
    return department


@router.delete("/{department_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_department(department_id: int, db: Annotated[AsyncSession, Depends(get_db)]):
    department = await db.get(Department, department_id)
    if not department:
        raise HTTPException(status_code=404, detail="Department not found")
    await db.delete(department)
    await db.commit()

