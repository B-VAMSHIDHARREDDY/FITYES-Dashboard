import logging
import time
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from fastapi.responses import JSONResponse
from sqlalchemy import inspect
from sqlalchemy.exc import OperationalError, SQLAlchemyError

from app.api.v1.router import api_router
from app.core.config import settings
from app.core.errors import DomainError
from app.core.security import ensure_initial_admin
from app.db.session import engine

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")
log = logging.getLogger("fityes")


@asynccontextmanager
async def lifespan(_: FastAPI):
    # Make sure someone can sign in. Skipped (with a hint) until migrations have created the table.
    try:
        if inspect(engine).has_table("users", schema=settings.effective_schema):
            ensure_initial_admin()
        else:
            log.warning("users table missing - run `alembic upgrade head`, then restart to create the admin")
    except SQLAlchemyError as exc:
        log.error("Could not check for an initial admin user: %s", exc)
    yield


def create_app() -> FastAPI:
    app = FastAPI(
        lifespan=lifespan,
        title=settings.app_name,
        version="1.0.0",
        description="Real-estate market & deal pipeline API",
        docs_url="/docs",
        openapi_url=f"{settings.api_prefix}/openapi.json",
    )

    app.add_middleware(GZipMiddleware, minimum_size=1024)
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origin_list,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    @app.middleware("http")
    async def timing(request: Request, call_next):
        start = time.perf_counter()
        response = await call_next(request)
        response.headers["Server-Timing"] = f"app;dur={(time.perf_counter() - start) * 1000:.1f}"
        return response

    @app.exception_handler(DomainError)
    async def domain_error(_: Request, exc: DomainError):
        headers = {"WWW-Authenticate": "Bearer"} if exc.status_code == 401 else None
        return JSONResponse(status_code=exc.status_code, content={"code": exc.code, "message": exc.message, "params": exc.params},
                            headers=headers)

    @app.exception_handler(OperationalError)
    async def db_unavailable(_: Request, exc: OperationalError):
        log.error("Database unavailable: %s", exc.orig)
        return JSONResponse(status_code=503, content={"code": "db_unavailable",
                                                      "message": "Database is unreachable. Try again shortly."})

    app.include_router(api_router, prefix=settings.api_prefix)
    return app


app = create_app()
