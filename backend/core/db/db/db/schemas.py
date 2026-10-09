import re
from typing import Literal

from pydantic import BaseModel, Field, field_validator

class PatternItem(BaseModel):
    pattern_type: str
    confidence: float

    @field_validator('pattern_type')
    @classmethod
    def pattern_type_length(cls, v):
        if len(v) > 100:
            raise ValueError('pattern_type too long')
        return v

    @field_validator('confidence')
    @classmethod
    def confidence_range(cls, v):
        if not 0.0 <= v <= 1.0:
            raise ValueError('confidence must be between 0 and 1')
        return v

class ReportCreate(BaseModel):
    site_url: str
    patterns: list[PatternItem]
    confirmed: bool = False

    @field_validator('patterns')
    @classmethod
    def patterns_not_empty(cls, v):
        if len(v) == 0:
            raise ValueError('patterns list cannot be empty')
        if len(v) > 50:
            raise ValueError('too many patterns')
        return v

class DetectPayload(BaseModel):
    site_url: str
    text_elements: list[str] = Field(default_factory=list)
    buttons: list[dict] = Field(default_factory=list)
    checkboxes: list[dict] = Field(default_factory=list)
    timers: list[dict] = Field(default_factory=list)


class ProfileUpdate(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    email: str = Field(min_length=3, max_length=255)

    @field_validator("name", "email")
    @classmethod
    def trim_text(cls, value: str) -> str:
        return value.strip()

    @field_validator("email")
    @classmethod
    def valid_email(cls, value: str) -> str:
        if not re.fullmatch(r"[^\s@]+@[^\s@]+\.[^\s@]+", value):
            raise ValueError("email must be a valid email address")
        return value


class SettingsUpdate(BaseModel):
    notify_high_risk: bool
    risk_threshold: int = Field(ge=0, le=100)
    default_range: Literal["24h", "7d", "30d"]
    analytics_consent: bool