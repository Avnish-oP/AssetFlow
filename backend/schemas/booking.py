from datetime import datetime

from pydantic import BaseModel, field_validator

from schemas.common import OrmModel


class BookingCreate(BaseModel):
    resource_id: int
    start: datetime
    end: datetime

    @field_validator("end")
    @classmethod
    def end_after_start(cls, value: datetime, info):
        start = info.data.get("start")
        if start and value <= start:
            raise ValueError("end must be after start")
        return value


class BookingResponse(OrmModel):
    id: int
    resource_id: int
    booked_by: int
    status: str
    start: datetime | None = None
    end: datetime | None = None

