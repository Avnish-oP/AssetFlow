from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from core.database import get_db
from core.security import get_current_user, require_role
from models.user import User
from schemas.auth import UserResponse
from schemas.org import EmployeeUpdate, RoleUpdate

router = APIRouter(prefix="/employees", tags=["employees"])


@router.get("", response_model=list[UserResponse], dependencies=[Depends(require_role("admin", "asset_manager", "dept_head"))])
async def list_employees(db: Annotated[AsyncSession, Depends(get_db)], user: Annotated[User, Depends(get_current_user)]):
    stmt = select(User).order_by(User.name)
    if user.role == "dept_head":
        stmt = stmt.where(User.department_id == user.department_id)
    return (await db.scalars(stmt)).all()


@router.get("/{employee_id}", response_model=UserResponse, dependencies=[Depends(require_role("admin", "asset_manager", "dept_head"))])
async def get_employee(employee_id: int, db: Annotated[AsyncSession, Depends(get_db)]):
    user = await db.get(User, employee_id)
    if not user:
        raise HTTPException(status_code=404, detail="Employee not found")
    return user


@router.patch("/{employee_id}", response_model=UserResponse, dependencies=[Depends(require_role("admin", "asset_manager"))])
async def update_employee(employee_id: int, payload: EmployeeUpdate, db: Annotated[AsyncSession, Depends(get_db)]):
    user = await db.get(User, employee_id)
    if not user:
        raise HTTPException(status_code=404, detail="Employee not found")
    for key, value in payload.model_dump(exclude_unset=True).items():
        setattr(user, key, value)
    await db.commit()
    await db.refresh(user)
    return user


@router.patch("/{employee_id}/role", response_model=UserResponse, dependencies=[Depends(require_role("admin"))])
async def update_role(
    employee_id: int,
    payload: RoleUpdate,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
):
    if employee_id == current_user.id:
        raise HTTPException(status_code=400, detail="Self-elevation is not allowed")
    if payload.role not in {"admin", "asset_manager", "dept_head", "employee"}:
        raise HTTPException(status_code=400, detail="Invalid role")
    user = await db.get(User, employee_id)
    if not user:
        raise HTTPException(status_code=404, detail="Employee not found")
    user.role = payload.role
    await db.commit()
    await db.refresh(user)
    return user

