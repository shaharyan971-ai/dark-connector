from datetime import datetime, timedelta, timezone
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError, SQLAlchemyError
from sqlalchemy.orm import Session

from core.db.database import get_db
from core.db.db.domain import extract_domain
from core.db.db.local_user import DEFAULT_USER_ID, ensure_default_user
from core.db.db.models import Alert, Report, SiteScore, User, UserSettings
from core.db.db.db.schemas import ProfileUpdate, SettingsUpdate

router = APIRouter()


def _range_start(value: str) -> datetime:
    hours = {"24h": 24, "7d": 24 * 7, "30d": 24 * 30}[value]
    return datetime.now(timezone.utc) - timedelta(hours=hours)


def _local_user(db: Session) -> User:
    user = db.get(User, DEFAULT_USER_ID)
    if user is None:
        try:
            user = ensure_default_user(db)
        except SQLAlchemyError as error:
            db.rollback()
            raise HTTPException(status_code=500, detail="Could not load local profile") from error
    return user


def _report_domain_counts(db: Session, since: datetime | None = None):
    statement = select(Report.site_url, Report.confirmed)
    if since is not None:
        statement = statement.where(Report.created_at >= since)
    counts: dict[str, dict[str, int]] = {}
    for site_url, confirmed in db.execute(statement):
        domain = extract_domain(site_url)
        domain_counts = counts.setdefault(domain, {"total": 0, "confirmed": 0})
        domain_counts["total"] += 1
        domain_counts["confirmed"] += int(bool(confirmed))
    return counts


@router.get("/overview")
def get_overview(db: Session = Depends(get_db)):
    total_patterns = db.query(func.count(Report.id)).scalar() or 0
    sites_scanned = db.query(func.count(SiteScore.domain)).scalar() or 0
    average_risk = db.query(func.avg(SiteScore.score)).scalar() or 0
    pattern_counts = (
        db.query(Report.pattern_type, func.count(Report.id).label("count"))
        .group_by(Report.pattern_type)
        .order_by(func.count(Report.id).desc(), Report.pattern_type.asc())
        .all()
    )
    recent_reports = (
        db.query(Report.site_url, Report.pattern_type, Report.confidence, Report.created_at)
        .order_by(Report.created_at.desc())
        .limit(10)
        .all()
    )
    breakdown_total = sum(count for _name, count in pattern_counts) or 1

    return {
        "total_patterns": total_patterns,
        "sites_scanned": sites_scanned,
        "average_risk": round(float(average_risk), 1),
        "pattern_breakdown": [
            {
                "pattern_type": name,
                "count": count,
                "percentage": round(count * 100 / breakdown_total, 1),
            }
            for name, count in pattern_counts
        ],
        "recent_activity": [
            {
                "site_url": site_url,
                "domain": extract_domain(site_url),
                "pattern_type": pattern_type,
                "confidence": confidence,
                "created_at": created_at,
            }
            for site_url, pattern_type, confidence, created_at in recent_reports
        ],
    }


@router.get("/sites")
def get_sites(
    search: str = "",
    sort: Literal["domain", "score", "total_flags", "confirmed_flags"] = "score",
    range: Literal["24h", "7d", "30d"] = Query("24h"),
    db: Session = Depends(get_db),
):
    site_rows = db.query(SiteScore).all()
    range_counts = _report_domain_counts(db, _range_start(range))
    sites = []
    for site in site_rows:
        if search and search.casefold() not in site.domain.casefold():
            continue
        counts = range_counts.get(site.domain, {"total": 0, "confirmed": 0})
        if not counts["total"]:
            continue
        total_flags = counts["total"]
        confirmed_flags = counts["confirmed"]
        sites.append({
            "domain": site.domain,
            "score": min(100, confirmed_flags * 5 + total_flags),
            "total_flags": total_flags,
            "confirmed_flags": confirmed_flags,
            "last_scanned": site.last_scanned,
        })
    sites.sort(key=lambda site: site[sort] if sort == "domain" else site[sort], reverse=sort != "domain")
    return {"sites": sites, "range": range}


@router.get("/sites/{domain}")
def get_site(domain: str, db: Session = Depends(get_db)):
    normalized_domain = extract_domain(domain)
    site = db.get(SiteScore, normalized_domain)
    if site is None:
        raise HTTPException(status_code=404, detail="Site not found")

    reports = (
        db.query(Report.pattern_type, Report.created_at, Report.confidence, Report.confirmed)
        .order_by(Report.created_at.asc())
        .all()
    )
    matching = [
        report for report in reports if extract_domain(report.site_url) == normalized_domain
    ]
    if not matching:
        raise HTTPException(status_code=404, detail="Site reports not found")
    return {
        "domain": normalized_domain,
        "score": site.score or 0,
        "total_flags": site.total_flags or 0,
        "confirmed_flags": site.confirmed_flags or 0,
        "first_seen": matching[0].created_at,
        "last_scan": matching[-1].created_at,
        "patterns_found": [
            {
                "pattern_type": report.pattern_type,
                "confidence": report.confidence,
                "confirmed": report.confirmed,
                "created_at": report.created_at,
            }
            for report in matching
        ],
    }


@router.get("/patterns")
def get_patterns(db: Session = Depends(get_db)):
    rows = (
        db.query(
            Report.pattern_type,
            func.count(Report.id).label("count"),
            func.avg(Report.confidence).label("average_confidence"),
        )
        .group_by(Report.pattern_type)
        .order_by(func.count(Report.id).desc(), Report.pattern_type.asc())
        .all()
    )
    return {
        "patterns": [
            {
                "pattern_type": pattern_type,
                "count": count,
                "average_confidence": round(float(average_confidence or 0), 3),
            }
            for pattern_type, count, average_confidence in rows
        ]
    }


@router.get("/alerts")
def get_alerts(db: Session = Depends(get_db)):
    alerts = db.query(Alert).order_by(Alert.created_at.desc(), Alert.id.asc()).all()
    return {
        "alerts": [
            {
                "id": alert.id,
                "site_url": alert.site_url,
                "pattern_type": alert.pattern_type,
                "severity": alert.severity,
                "message": alert.message,
                "created_at": alert.created_at,
                "read": alert.read,
            }
            for alert in alerts
        ]
    }


@router.patch("/alerts/{alert_id}/read")
def mark_alert_read(alert_id: str, db: Session = Depends(get_db)):
    alert = db.get(Alert, alert_id)
    if alert is None:
        raise HTTPException(status_code=404, detail="Alert not found")
    try:
        alert.read = True
        db.commit()
    except SQLAlchemyError as error:
        db.rollback()
        raise HTTPException(status_code=500, detail="Could not update alert") from error
    return {"id": alert.id, "read": alert.read}


@router.get("/profile")
def get_profile(db: Session = Depends(get_db)):
    user = _local_user(db)
    return {"id": user.id, "name": user.name, "email": user.email, "created_at": user.created_at}


@router.put("/profile")
def update_profile(payload: ProfileUpdate, db: Session = Depends(get_db)):
    user = _local_user(db)
    try:
        user.name = payload.name
        user.email = payload.email
        db.commit()
    except IntegrityError as error:
        db.rollback()
        raise HTTPException(status_code=409, detail="That email is already in use") from error
    except SQLAlchemyError as error:
        db.rollback()
        raise HTTPException(status_code=500, detail="Could not update profile") from error
    return {"id": user.id, "name": user.name, "email": user.email, "created_at": user.created_at}


@router.get("/settings")
def get_settings(db: Session = Depends(get_db)):
    _local_user(db)
    settings = db.get(UserSettings, DEFAULT_USER_ID)
    return {
        "notify_high_risk": settings.notify_high_risk,
        "risk_threshold": settings.risk_threshold,
        "default_range": settings.default_range,
        "analytics_consent": settings.analytics_consent,
    }


@router.put("/settings")
def update_settings(payload: SettingsUpdate, db: Session = Depends(get_db)):
    _local_user(db)
    settings = db.get(UserSettings, DEFAULT_USER_ID)
    try:
        settings.notify_high_risk = payload.notify_high_risk
        settings.risk_threshold = payload.risk_threshold
        settings.default_range = payload.default_range
        settings.analytics_consent = payload.analytics_consent
        db.commit()
    except SQLAlchemyError as error:
        db.rollback()
        raise HTTPException(status_code=500, detail="Could not update settings") from error
    return {
        "notify_high_risk": settings.notify_high_risk,
        "risk_threshold": settings.risk_threshold,
        "default_range": settings.default_range,
        "analytics_consent": settings.analytics_consent,
    }