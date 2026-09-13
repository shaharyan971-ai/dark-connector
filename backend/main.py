from fastapi import FastAPI

from core.db.database import Base, engine
from core.db.db import models  # noqa: F401
from core.db.db.db.routes.detect import router as detect_router
from core.db.db.db.routes.routes.report import router as report_router

Base.metadata.create_all(bind=engine)

app = FastAPI(title="Dark Connector API")
app.include_router(detect_router, prefix="/api")
app.include_router(report_router, prefix="/api")


@app.get("/")
async def health_check():
    return {"status": "ok"}
