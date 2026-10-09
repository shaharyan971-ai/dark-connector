from urllib.parse import urlsplit


def extract_domain(site_url: str) -> str:
    candidate = site_url.strip()
    parsed = urlsplit(candidate if "://" in candidate else f"//{candidate}")
    return (parsed.hostname or parsed.path.split("/")[0]).lower().rstrip(".")