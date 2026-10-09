from sqlalchemy import Column, String, Float, Boolean, DateTime, Integer, ForeignKey, text
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


class User(Base):
    __tablename__ = "users"
    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    name = Column(String(120), nullable=False)
    email = Column(String(255), nullable=False, unique=True, index=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)


class UserSettings(Base):
    __tablename__ = "user_settings"
    user_id = Column(String, ForeignKey("users.id", ondelete="CASCADE"), primary_key=True)
    notify_high_risk = Column(Boolean, nullable=False, default=True, server_default=text("true"))
    risk_threshold = Column(Integer, nullable=False, default=75, server_default="75")
    default_range = Column(String(3), nullable=False, default="24h", server_default="24h")
    analytics_consent = Column(Boolean, nullable=False, default=False, server_default=text("false"))


class Alert(Base):
    __tablename__ = "alerts"
    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    site_url = Column(String(500), nullable=False, index=True)
    pattern_type = Column(String(100), nullable=False)
    severity = Column(String(20), nullable=False, default="high")
    message = Column(String(500), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    read = Column(Boolean, nullable=False, default=False, server_default=text("false"))