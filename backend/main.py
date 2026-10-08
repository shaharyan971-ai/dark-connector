from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded

from core.db.database import Base, engine
from core.db.db import models  # noqa: F401
from core.db.db.db.routes.detect import router as detect_router
from core.db.db.db.routes.routes.report import router as report_router

Base.metadata.create_all(bind=engine)

limiter = Limiter(key_func=get_remote_address)

app = FastAPI(title="Dark Connector API")
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "https://dark-connector.vercel.app",
    ],
    allow_origin_regex=r"^chrome-extension://[a-p]{32}$",
    allow_credentials=True,
    allow_methods=["GET", "POST"],
    allow_headers=["*"],
)

app.include_router(detect_router, prefix="/api")
app.include_router(report_router, prefix="/api")


@app.get("/")
async def health_check():
    return {"status": "ok"}