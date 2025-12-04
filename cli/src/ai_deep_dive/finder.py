"""Smart file search utilities for finding challenge files."""

import re
from pathlib import Path
from typing import Optional

# Directories to skip when searching for solution files
SKIP_DIRS = {
    # Version control
    ".git",
    ".svn",
    ".hg",
    # Project config
    ".ai-deep-dive",
    # Python
    "__pycache__",
    ".venv",
    "venv",
    "env",
    ".env",
    "site-packages",
    ".eggs",
    # Build artifacts
    "dist",
    "build",
    # Testing
    ".pytest_cache",
    ".mypy_cache",
    ".ruff_cache",
    ".tox",
    ".nox",
    ".coverage",
    "htmlcov",
    # Node
    "node_modules",
    # IDE
    ".idea",
    ".vscode",
}


def _should_skip_path(path: Path) -> bool:
    """Check if a path should be skipped based on directory names."""
    for part in path.parts:
        # Exact match
        if part in SKIP_DIRS:
            return True
        # Pattern match for .egg-info directories
        if part.endswith(".egg-info"):
            return True
    return False


def find_challenge_file(
    workspace_root: Path,
    filename: str,
    function_name: Optional[str] = None,
) -> Optional[Path]:
    """
    Find a challenge file in the workspace.
    
    Recursively searches for a file matching the filename.
    If function_name is provided, also checks that the file contains
    a function with that name.
    
    Args:
        workspace_root: The root directory to search from
        filename: The filename to look for (e.g., "01_pair_counter.py")
        function_name: Optional function name that must exist in the file
    
    Returns:
        Path to the file if found, None otherwise
    """
    candidates = []
    
    for path in workspace_root.rglob(filename):
        if _should_skip_path(path):
            continue
        
        if path.is_file():
            candidates.append(path)
    
    if not candidates:
        return None
    
    # If only one candidate, return it
    if len(candidates) == 1:
        return candidates[0]
    
    # If multiple candidates, try to filter by function name
    if function_name:
        for candidate in candidates:
            if _file_contains_function(candidate, function_name):
                return candidate
    
    # Return the first match (prefer shallower paths)
    candidates.sort(key=lambda p: len(p.parts))
    return candidates[0]


def _file_contains_function(path: Path, function_name: str) -> bool:
    """Check if a Python file contains a function definition."""
    try:
        content = path.read_text()
        pattern = rf"def\s+{re.escape(function_name)}\s*\("
        return bool(re.search(pattern, content))
    except Exception:
        return False
