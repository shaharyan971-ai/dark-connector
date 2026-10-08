from pydantic import BaseModel, HttpUrl, field_validator
from typing import Optional

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
    text_elements: list[str] = []
    buttons: list[dict] = []
    checkboxes: list[dict] = []
    timers: list[dict] = []