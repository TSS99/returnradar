import asyncio
import logging
import os
from contextlib import asynccontextmanager, suppress
from pathlib import Path

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.trustedhost import TrustedHostMiddleware
from fastapi.responses import JSONResponse
from sqlalchemy.orm import sessionmaker

from backend.app.api.routes import router
from backend.app.core.config import ALLOWED_ORIGINS, DATA_DIR
from backend.app.core.security import LocalSecurityMiddleware
from backend.app.db.session import make_engine, migrate
from backend.app.services.purchases import ServiceError
from backend.app.services.reminders import process_reminders

logger = logging.getLogger("returnradar")


def create_app(data_dir: Path = DATA_DIR, worker_enabled: bool | None = None) -> FastAPI:
    engine = make_engine(data_dir)
    factory = sessionmaker(engine, expire_on_commit=False)
    enabled = (
        worker_enabled
        if worker_enabled is not None
        else os.getenv("RETURNRADAR_WORKER_ENABLED", "true") == "true"
    )

    def tick():
        with factory() as session:
            process_reminders(session)

    async def worker():
        while True:
            try:
                await asyncio.to_thread(tick)
            except Exception:
                logger.error("Reminder processing failed; next run will retry. No invoice contents logged.")
            await asyncio.sleep(60)

    @asynccontextmanager
    async def lifespan(app):
        migrate(engine)
        task = asyncio.create_task(worker()) if enabled else None
        yield
        if task:
            task.cancel()
            with suppress(asyncio.CancelledError):
                await task
        engine.dispose()

    app = FastAPI(
        title="ReturnRadar",
        version="0.1.0",
        lifespan=lifespan,
        description="Local single-user purchase tracking. Not a public authenticated service.",
    )
    app.state.session_factory = factory
    app.state.data_dir = data_dir
    app.add_middleware(
        CORSMiddleware,
        allow_origins=sorted(ALLOWED_ORIGINS),
        allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE"],
        allow_headers=["Content-Type"],
        allow_credentials=False,
    )
    app.add_middleware(LocalSecurityMiddleware)
    app.add_middleware(TrustedHostMiddleware, allowed_hosts=["127.0.0.1", "localhost", "testserver", "[::1]"])

    @app.exception_handler(ServiceError)
    async def service_error(request: Request, exc: ServiceError):
        return JSONResponse({"detail": exc.message}, status_code=exc.status_code)

    @app.exception_handler(RequestValidationError)
    async def validation_error(request: Request, exc: RequestValidationError):
        return JSONResponse(
            {
                "detail": "Please check the supplied values",
                "errors": [
                    {"field": ".".join(str(p) for p in e["loc"]), "message": e["msg"]} for e in exc.errors()
                ],
            },
            status_code=422,
        )

    app.include_router(router)
    return app


app = create_app()
