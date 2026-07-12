from fastapi import HTTPException


TRANSITIONS = {
    "asset": {
        "available": {"allocated", "reserved", "maintenance", "lost", "retired"},
        "allocated": {"available", "maintenance", "lost"},
        "reserved": {"available", "allocated"},
        "maintenance": {"available", "retired"},
        "lost": {"available", "disposed"},
        "retired": {"disposed"},
        "disposed": set(),
    },
    "allocation": {
        "active": {"returned", "overdue"},
        "overdue": {"returned"},
        "returned": set(),
    },
    "booking": {
        "upcoming": {"ongoing", "completed", "cancelled"},
        "ongoing": {"completed", "cancelled"},
        "completed": set(),
        "cancelled": set(),
    },
    "maintenance": {
        "pending": {"approved", "rejected"},
        "approved": {"technician_assigned"},
        "technician_assigned": {"in_progress"},
        "in_progress": {"resolved"},
        "resolved": set(),
        "rejected": set(),
    },
    "audit": {
        "pending": {"verified", "missing", "damaged"},
        "verified": set(),
        "missing": set(),
        "damaged": set(),
    },
}


def assert_transition(current: str, target: str, entity_type: str) -> None:
    allowed = TRANSITIONS.get(entity_type, {}).get(current)
    if allowed is None or target not in allowed:
        raise HTTPException(status_code=400, detail=f"Illegal {entity_type} transition: {current} -> {target}")

