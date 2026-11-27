from fastapi import APIRouter

from app.api.v1 import analytics, clients, deals, properties

api_router = APIRouter()
api_router.include_router(analytics.router)
api_router.include_router(properties.router)
api_router.include_router(deals.router)
api_router.include_router(clients.router)
