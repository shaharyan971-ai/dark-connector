from sqlalchemy import Column, String, Float, Boolean, DateTime, Integer
from sqlalchemy.sql import func
from core.db.database import Base
import uuid

class Report(Base):
    __tablename__ = "reports"
    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    site_url = Column(String(500), nullable=False, index=True)
    pattern_type = Column(String(100), nullable=False)
    confidence = Column(Float)
    confirmed = Column(Boolean, default=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

class SiteScore(Base):
    __tablename__ = "site_scores"
    domain = Column(String(255), primary_key=True)
    total_flags = Column(Integer, default=0)
    confirmed_flags = Column(Integer, default=0)
    score = Column(Float, default=0.0)
    last_scanned = Column(DateTime(timezone=True), server_default=func.now())