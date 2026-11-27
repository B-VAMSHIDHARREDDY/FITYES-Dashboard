from fastapi import APIRouter, Depends

from app.api.v1 import analytics, auth, clients, deals, properties
from app.core.security import get_current_user

api_router = APIRouter()

# Public: sign-in and the health probe.
api_router.include_router(auth.router)
api_router.include_router(analytics.public_router)

# Everything else needs a signed-in user.
protected = APIRouter(dependencies=[Depends(get_current_user)])
protected.include_router(analytics.router)
protected.include_router(properties.router)
protected.include_router(deals.router)
protected.include_router(clients.router)
api_router.include_router(protected)
