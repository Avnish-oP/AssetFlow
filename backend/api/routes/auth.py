from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from core.database import get_db
from core.security import create_token, get_current_user, hash_password, verify_password
from models.user import User
from schemas.auth import LoginRequest, SignupRequest, TokenResponse, UserResponse
from schemas.common import Message

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/signup", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
async def signup(payload: SignupRequest, db: Annotated[AsyncSession, Depends(get_db)]):
    existing = await db.scalar(select(User).where(User.email == payload.email.lower()))
    if existing:
        raise HTTPException(status_code=409, detail="Email already registered")
    user = User(
        name=payload.name,
        email=payload.email.lower(),
        password_hash=hash_password(payload.password),
        role="employee",
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)
    return user


@router.post("/login", response_model=TokenResponse)
async def login(payload: LoginRequest, db: Annotated[AsyncSession, Depends(get_db)]):
    user = await db.scalar(select(User).where(User.email == payload.email.lower()))
    if not user or not verify_password(payload.password, user.password_hash):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")
    return TokenResponse(access_token=create_token(str(user.id)), refresh_token=create_token(str(user.id), "refresh"))


@router.post("/refresh", response_model=TokenResponse)
async def refresh(user: Annotated[User, Depends(get_current_user)]):
    return TokenResponse(access_token=create_token(str(user.id)), refresh_token=create_token(str(user.id), "refresh"))


@router.get("/me", response_model=UserResponse)
async def me(user: Annotated[User, Depends(get_current_user)]):
    return user


@router.post("/forgot-password", response_model=Message)
async def forgot_password():
    return Message(message="Password reset email stub accepted")

