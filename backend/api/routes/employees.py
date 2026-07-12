from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from core.database import get_db
from core.security import get_current_user, hash_password, require_role
from models.department import Department
from models.user import User
from schemas.auth import UserResponse
from schemas.org import EmployeeCreate, EmployeeUpdate, RoleUpdate

router = APIRouter(prefix="/employees", tags=["employees"])


@router.get("", response_model=list[UserResponse], dependencies=[Depends(require_role("admin", "asset_manager", "dept_head"))])
async def list_employees(db: Annotated[AsyncSession, Depends(get_db)], user: Annotated[User, Depends(get_current_user)]):
    stmt = select(User).order_by(User.name)
    if user.role == "dept_head":
        stmt = stmt.where(User.department_id == user.department_id)
    return (await db.scalars(stmt)).all()


@router.post("", response_model=UserResponse, status_code=status.HTTP_201_CREATED, dependencies=[Depends(require_role("admin", "asset_manager"))])
async def create_employee(payload: EmployeeCreate, db: Annotated[AsyncSession, Depends(get_db)]):
    existing = await db.scalar(select(User).where(User.email == payload.email.lower()))
    if existing:
        raise HTTPException(status_code=409, detail="Email already registered")
    if payload.department_id is not None:
        department = await db.get(Department, payload.department_id)
        if not department:
            raise HTTPException(status_code=404, detail="Department not found")
    user = User(
        name=payload.name,
        email=payload.email.lower(),
        password_hash=hash_password(payload.password),
        role="employee",
        department_id=payload.department_id,
        status="active",
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)
    return user


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
    data = payload.model_dump(exclude_unset=True)
    if "status" in data and data["status"] not in {"active", "inactive"}:
        raise HTTPException(status_code=400, detail="Invalid status")
    if "department_id" in data and data["department_id"] is not None:
        department = await db.get(Department, data["department_id"])
        if not department:
            raise HTTPException(status_code=404, detail="Department not found")
    for key, value in data.items():
        setattr(user, key, value)
    await db.commit()
    await db.refresh(user)
    return user


@router.delete("/{employee_id}", status_code=status.HTTP_204_NO_CONTENT, dependencies=[Depends(require_role("admin"))])
async def delete_employee(
    employee_id: int,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
):
    if employee_id == current_user.id:
        raise HTTPException(status_code=400, detail="Cannot delete your own account")
    user = await db.get(User, employee_id)
    if not user:
        raise HTTPException(status_code=404, detail="Employee not found")
    await db.delete(user)
    await db.commit()


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
