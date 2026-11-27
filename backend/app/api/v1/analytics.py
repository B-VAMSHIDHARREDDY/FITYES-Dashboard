from typing import Annotated

from fastapi import APIRouter, Query
from sqlalchemy import text

from app.api.deps import DbSession
from app.schemas.analytics import (
    ActivityOut,
    AgentStats,
    DashboardSummary,
    NavCounts,
    NeighborhoodStat,
    PipelineStage,
    TrendPoint,
)
from app.services import analytics_service as svc

router = APIRouter()
public_router = APIRouter()  # no sign-in required (load balancer / uptime checks)


@public_router.get("/health", tags=["meta"])
def health(db: DbSession):
    db.execute(text("SELECT 1"))
    return {"status": "ok", "database": "up"}


@router.get("/meta/counts", response_model=NavCounts, tags=["meta"])
def nav_counts(db: DbSession):
    return svc.nav_counts(db)


@router.get("/dashboard/summary", response_model=DashboardSummary, tags=["dashboard"])
def dashboard_summary(db: DbSession):
    return svc.dashboard_summary(db)


@router.get("/dashboard/pipeline", response_model=list[PipelineStage], tags=["dashboard"])
def dashboard_pipeline(db: DbSession):
    return svc.pipeline(db)


@router.get("/market/trends", response_model=list[TrendPoint], tags=["market"])
def market_trends(
    db: DbSession,
    neighborhood: str | None = None,
    months: Annotated[int, Query(ge=3, le=60)] = 24,
):
    return svc.market_trends(db, neighborhood=neighborhood, months=months)


@router.get("/market/neighborhoods", response_model=list[NeighborhoodStat], tags=["market"])
def market_neighborhoods(db: DbSession):
    return svc.neighborhood_stats(db)


@router.get("/agents", response_model=list[AgentStats], tags=["agents"])
def agents(db: DbSession):
    return svc.agent_leaderboard(db)


@router.get("/activities", response_model=list[ActivityOut], tags=["activity"])
def activities(
    db: DbSession,
    limit: Annotated[int, Query(ge=1, le=100)] = 20,
    deal_id: int | None = None,
):
    return svc.recent_activity(db, limit=limit, deal_id=deal_id)
