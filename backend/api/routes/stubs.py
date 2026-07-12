from fastapi import APIRouter, HTTPException


def stub_router(prefix: str, tag: str) -> APIRouter:
    router = APIRouter(prefix=prefix, tags=[tag])

    @router.get("")
    async def not_implemented():
        raise HTTPException(status_code=501, detail=f"{tag} module is coming in a later phase")

    return router

