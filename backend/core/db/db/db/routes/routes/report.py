from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from core.db.database import get_db
from core.db.db.models import Report, SiteScore
from core.db.db.db.schemas import ReportCreate

router = APIRouter()

@router.post("/report")
async def create_report(payload: ReportCreate, db: Session = Depends(get_db)):
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
        site = SiteScore(domain=domain)
        db.add(site)
    site.total_flags += len(payload.patterns)
    if payload.confirmed:
        site.confirmed_flags += len(payload.patterns)
    site.score = min(100, site.confirmed_flags * 5 + site.total_flags)
    
    db.commit()
    return {"status": "saved", "patterns_count": len(payload.patterns)} 