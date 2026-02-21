"""Configuration and path utilities for the CLI."""

import json
import os
from pathlib import Path
from typing import Optional

# Default Website URL (can be overridden in global config)
DEFAULT_WEBSITE_URL = "https://aideepdive.dev"
# Default tests endpoint (judge VM)
DEFAULT_TESTS_URL = "https://judge.aideepdive.dev"

# Directory names
CONFIG_DIR_NAME = ".ai-deep-dive"
CONFIG_FILE_NAME = "config.json"
GLOBAL_CONFIG_DIR = Path.home() / ".ai-deep-dive"
GLOBAL_CONFIG_FILE = GLOBAL_CONFIG_DIR / "config.json"
STATUS_FILE = GLOBAL_CONFIG_DIR / "status.json"


def get_global_config_dir() -> Path:
    """Get or create the global config directory (~/.ai-deep-dive/)."""
    GLOBAL_CONFIG_DIR.mkdir(parents=True, exist_ok=True)
    return GLOBAL_CONFIG_DIR


def get_global_config() -> dict:
    """Load global configuration from ~/.ai-deep-dive/config.json."""
    get_global_config_dir()  # Ensure dir exists
    
    if not GLOBAL_CONFIG_FILE.exists():
        return {}
    
    with open(GLOBAL_CONFIG_FILE, "r") as f:
        return json.load(f)


def save_global_config(config: dict) -> None:
    """Save global configuration to ~/.ai-deep-dive/config.json."""
    get_global_config_dir()  # Ensure dir exists
    
    with open(GLOBAL_CONFIG_FILE, "w") as f:
        json.dump(config, f, indent=2)


def get_website_url() -> str:
    """Get the website URL from global config, or use default."""
    config = get_global_config()
    return config.get("website_url", DEFAULT_WEBSITE_URL)


def get_tests_url() -> str:
    """Get the tests URL from global config, or use website URL."""
    config = get_global_config()
    if "tests_url" in config:
        return config["tests_url"]
    return config.get("website_url", DEFAULT_TESTS_URL)


def set_website_url(url: str) -> None:
    """Set a custom website URL in global config."""
    config = get_global_config()
    config["website_url"] = url.rstrip("/")  # Remove trailing slash
    save_global_config(config)


def set_tests_url(url: str) -> None:
    """Set a custom tests URL in global config."""
    config = get_global_config()
    config["tests_url"] = url.rstrip("/")  # Remove trailing slash
    save_global_config(config)


def get_workspace_root(start_path: Optional[Path] = None) -> Optional[Path]:
    """
    Find the workspace root by looking for .ai-deep-dive/config.json.
    
    Searches from start_path (or cwd) upward through parent directories.
    Returns None if no workspace is found.
    """
    current = Path(start_path or os.getcwd()).resolve()
    
    while current != current.parent:
        config_dir = current / CONFIG_DIR_NAME
        config_file = config_dir / CONFIG_FILE_NAME
        
        if config_file.exists():
            return current
        
        current = current.parent
    
    return None


def get_workspace_config(workspace_root: Path) -> dict:
    """Load the workspace configuration from .ai-deep-dive/config.json."""
    config_file = workspace_root / CONFIG_DIR_NAME / CONFIG_FILE_NAME
    
    if not config_file.exists():
        return {}
    
    with open(config_file, "r") as f:
        return json.load(f)


def save_workspace_config(workspace_root: Path, config: dict) -> None:
    """Save the workspace configuration to .ai-deep-dive/config.json."""
    config_dir = workspace_root / CONFIG_DIR_NAME
    config_dir.mkdir(parents=True, exist_ok=True)
    
    config_file = config_dir / CONFIG_FILE_NAME
    with open(config_file, "w") as f:
        json.dump(config, f, indent=2)


def get_status() -> dict:
    """Load global status from ~/.ai-deep-dive/status.json."""
    get_global_config_dir()  # Ensure dir exists
    
    if not STATUS_FILE.exists():
        return {"courses": {}}
    
    with open(STATUS_FILE, "r") as f:
        return json.load(f)


def save_status(status: dict) -> None:
    """Save global status to ~/.ai-deep-dive/status.json."""
    get_global_config_dir()  # Ensure dir exists
    
    with open(STATUS_FILE, "w") as f:
        json.dump(status, f, indent=2)


def get_course_status(course_id: str) -> dict:
    """Get the status for a specific course."""
    status = get_status()
    return status.get("courses", {}).get(course_id, {
        "completed": [],
        "current": None,
        "last_updated": None
    })


def update_challenge_status(
    course_id: str,
    challenge_id: str,
    passed: bool
) -> None:
    """Update the status of a challenge."""
    from datetime import datetime
    
    status = get_status()
    
    if "courses" not in status:
        status["courses"] = {}
    
    if course_id not in status["courses"]:
        status["courses"][course_id] = {
            "completed": [],
            "current": None,
            "last_updated": None
        }
    
    course_status = status["courses"][course_id]
    
    if passed and challenge_id not in course_status["completed"]:
        course_status["completed"].append(challenge_id)
        course_status["completed"].sort()
    
    course_status["current"] = challenge_id
    course_status["last_updated"] = datetime.now().isoformat()
    
    save_status(status)
