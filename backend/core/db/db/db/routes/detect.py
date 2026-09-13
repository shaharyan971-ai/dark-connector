from fastapi import APIRouter
from core.db.db.db.schemas import DetectPayload
import re

router = APIRouter()

URGENCY_PATTERNS = [
    r'only \d+ (rooms?|left|seats?)',
    r'we have \d+ left',
    r'selling fast',
    r'in high demand',
    r'\d+ booked today'
]

SOCIAL_PATTERNS = [
    r'\d+ (people|guests?) (just )?(booked|viewed)',
    r'someone just booked',
    r'\d+ (are )?viewing this'
]

@router.post("/detect")
async def detect(payload: DetectPayload):
    results = []
    for text in payload.text_elements:
        for p in URGENCY_PATTERNS:
            if re.search(p, text, re.IGNORECASE):
                results.append({"pattern_type": "fake_urgency", "confidence": 0.82})
                break
        for p in SOCIAL_PATTERNS:
            if re.search(p, text, re.IGNORECASE):
                results.append({"pattern_type": "social_proof_manipulation", "confidence": 0.79})
                break
    return {"site_url": payload.site_url, "patterns_found": len(results), "results": results}