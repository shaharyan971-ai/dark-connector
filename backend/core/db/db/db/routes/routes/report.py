from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session
from core.db.database import get_db
from core.db.db.models import Report, SiteScore
from core.db.db.db.schemas import ReportCreate
from slowapi import Limiter
from slowapi.util import get_remote_address

limiter = Limiter(key_func=get_remote_address)
router = APIRouter()


@router.get("/report")
async def list_reports(db: Session = Depends(get_db)):
    sites = (
        db.query(
            SiteScore.domain,
            SiteScore.score,
            SiteScore.total_flags,
            SiteScore.confirmed_flags,
        )
        .order_by(SiteScore.score.desc(), SiteScore.domain.asc())
        .all()
    )
    return {
        "sites": [
            {
                "domain": site.domain,
                "score": site.score or 0,
                "total_flags": site.total_flags or 0,
                "confirmed_flags": site.confirmed_flags or 0,
            }
            for site in sites
        ]
    }


@router.post("/report")
@limiter.limit("20/minute")
async def create_report(request: Request, payload: ReportCreate, db: Session = Depends(get_db)):
    try:
        for pattern in payload.patterns:
            report = Report(
                site_url=payload.site_url,
                pattern_type=pattern.pattern_type,
                confidence=pattern.confidence,
                confirmed=payload.confirmed
            )
            db.add(report)

        domain = payload.site_url.replace("https://", "").replace("http://", "").split("/")[0]
        site = db.query(SiteScore).filter(SiteScore.domain == domain).first()
        if not site:
            site = SiteScore(domain=domain, total_flags=0, confirmed_flags=0, score=0)
            db.add(site)
        site.total_flags += len(payload.patterns)
        if payload.confirmed:
            site.confirmed_flags += len(payload.patterns)
        site.score = min(100, site.confirmed_flags * 5 + site.total_flags)
        db.commit()
    except SQLAlchemyError as error:
        db.rollback()
        raise HTTPException(status_code=500, detail="Could not save report") from error
    return {"status": "saved", "patterns_count": len(payload.patterns)}