from pydantic import BaseModel
from typing import Optional

class PatternItem(BaseModel):
    pattern_type: str
    confidence: float

class ReportCreate(BaseModel):
    site_url: str
    patterns: list[PatternItem]
    confirmed: bool = False

class DetectPayload(BaseModel):
    site_url: str
    text_elements: list[str] = []
    buttons: list[dict] = []
    checkboxes: list[dict] = []
    timers: list[dict] = []