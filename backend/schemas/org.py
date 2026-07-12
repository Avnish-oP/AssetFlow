from pydantic import BaseModel, EmailStr, Field

from schemas.common import OrmModel


class DepartmentCreate(BaseModel):
    name: str
    head_id: int | None = None
    parent_department_id: int | None = None


class DepartmentUpdate(BaseModel):
    name: str | None = None
    head_id: int | None = None
    parent_department_id: int | None = None
    status: str | None = None


class DepartmentResponse(OrmModel):
    id: int
    name: str
    head_id: int | None = None
    parent_department_id: int | None = None
    status: str


class CategoryCreate(BaseModel):
    name: str
    custom_fields: dict = {}


class CategoryUpdate(BaseModel):
    name: str | None = None
    custom_fields: dict | None = None


class CategoryResponse(OrmModel):
    id: int
    name: str
    custom_fields: dict


class EmployeeCreate(BaseModel):
    name: str = Field(min_length=2, max_length=120)
    email: EmailStr
    password: str = Field(min_length=6, max_length=128)
    department_id: int | None = None


class EmployeeUpdate(BaseModel):
    name: str | None = None
    department_id: int | None = None
    status: str | None = None


class RoleUpdate(BaseModel):
    role: str

