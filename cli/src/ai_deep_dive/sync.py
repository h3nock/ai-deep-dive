"""Sync module for sharing progress with the website via URL."""

import webbrowser
from urllib.parse import quote

from ai_deep_dive.config import (
    get_website_url,
    get_course_status,
)


def generate_sync_url(course_id: str) -> str | None:
    """
    Generate a sync URL for the given course.
    
    Format: aideep.dev/sync#course_id:challenge1,challenge2,challenge3
    
    Returns None if no progress to sync.
    """
    status = get_course_status(course_id)
    completed = status.get("completed", [])
    
    if not completed:
        return None
    
    # Format: course_id:comma-separated-challenge-ids
    # e.g., build-chatgpt:01-01,01-02,02-01,02-02
    challenges_str = ",".join(completed)
    data = f"{course_id}:{challenges_str}"
    
    # URL encode (though our format is already URL-safe)
    encoded = quote(data, safe=":,-")
    
    website_url = get_website_url()
    return f"{website_url}/sync#{encoded}"


def open_sync_url(course_id: str) -> tuple[bool, str]:
    """
    Open the sync URL in the browser.
    
    Returns (success, message).
    """
    url = generate_sync_url(course_id)
    
    if not url:
        return False, "No completed challenges to sync."
    
    try:
        webbrowser.open(url)
        return True, url
    except Exception as e:
        return False, f"Failed to open browser: {e}"
