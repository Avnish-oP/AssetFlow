from datetime import datetime

from schemas.common import OrmModel


class NotificationResponse(OrmModel):
    id: int
    user_id: int
    type: str
    message: str
    related_entity_type: str | None = None
    related_entity_id: int | None = None
    is_read: bool
    created_at: datetime


class ActivityLogResponse(OrmModel):
    id: int
    actor_id: int | None = None
    action: str
    entity_type: str
    entity_id: int | None = None
    metadata: dict = {}
    created_at: datetime

    @classmethod
    def from_row(cls, row) -> "ActivityLogResponse":
        return cls(
            id=row.id,
            actor_id=row.actor_id,
            action=row.action,
            entity_type=row.entity_type,
            entity_id=row.entity_id,
            metadata=row.log_metadata or {},
            created_at=row.created_at,
        )
