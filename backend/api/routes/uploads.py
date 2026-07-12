from typing import Annotated

from fastapi import APIRouter, Depends, File, UploadFile

from core.security import get_current_user
from core.storage import upload_file
from models.user import User

router = APIRouter(prefix="/uploads", tags=["uploads"])


@router.post("")
async def upload(
    user: Annotated[User, Depends(get_current_user)],
    file: UploadFile = File(...),
    folder: str = "uploads",
):
    safe_folder = "".join(ch for ch in folder if ch.isalnum() or ch in "-_")[:40] or "uploads"
    url = await upload_file(file, folder=safe_folder)
    return {"url": url, "filename": file.filename, "uploaded_by": user.id}
