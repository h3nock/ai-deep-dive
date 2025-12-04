"""Load course manifests from the web content directory or embedded data."""

import json
import re
from pathlib import Path
from typing import Optional
import yaml

from ai_deep_dive.manifest import (
    Challenge,
    ChallengeArgument,
    Chapter,
    CourseManifest,
    TestCase,
    register_course,
    COURSE_MANIFESTS,
)


def parse_mdx_frontmatter(content: str) -> tuple[dict, str]:
    """Parse MDX frontmatter (YAML between ---) and return (frontmatter, body)."""
    if not content.startswith("---"):
        return {}, content
    
    # Find the closing ---
    end_idx = content.find("---", 3)
    if end_idx == -1:
        return {}, content
    
    frontmatter_str = content[3:end_idx].strip()
    body = content[end_idx + 3:].strip()
    
    try:
        frontmatter = yaml.safe_load(frontmatter_str)
        return frontmatter or {}, body
    except yaml.YAMLError:
        return {}, content


def load_challenge_from_dir(
    challenge_dir: Path,
    chapter_num: int,
    challenge_num: int,
    chapter_slug: str,
) -> Optional[Challenge]:
    """Load a challenge from a challenge directory."""
    desc_file = challenge_dir / "description.md"
    tests_file = challenge_dir / "tests.json"
    
    if not desc_file.exists():
        return None
    
    # Parse description.md for metadata
    content = desc_file.read_text()
    frontmatter, body = parse_mdx_frontmatter(content)
    
    if not frontmatter:
        return None
    
    challenge_id = f"{chapter_num:02d}-{challenge_num:02d}"
    slug = frontmatter.get("id", challenge_dir.name)
    title = frontmatter.get("title", slug.replace("-", " ").title())
    
    # Generate filename from challenge
    filename = f"{challenge_num:02d}_{slug.replace('-', '_')}.py"
    
    # Parse arguments
    arguments = []
    for arg in frontmatter.get("arguments", []):
        arguments.append(ChallengeArgument(
            name=arg.get("name", ""),
            type=arg.get("type", "any"),
        ))
    
    # Extract function name from initial code or execution snippet
    initial_code = frontmatter.get("initialCode", "")
    execution_snippet = frontmatter.get("executionSnippet", "")
    
    # Try to extract function name from initial code
    function_name = ""
    if initial_code:
        match = re.search(r"def\s+(\w+)\s*\(", initial_code)
        if match:
            function_name = match.group(1)
    
    # Load test cases
    test_cases = []
    if tests_file.exists():
        try:
            tests_data = json.loads(tests_file.read_text())
            for tc in tests_data:
                test_cases.append(TestCase(
                    id=tc.get("id", ""),
                    inputs=tc.get("inputs", {}),
                    expected=tc.get("expected", ""),
                    hidden=tc.get("hidden", False),
                ))
        except json.JSONDecodeError:
            pass
    
    return Challenge(
        id=challenge_id,
        slug=slug,
        title=title,
        filename=filename,
        function_name=function_name,
        chapter=chapter_slug,
        chapter_num=chapter_num,
        challenge_num=challenge_num,
        difficulty=frontmatter.get("difficulty", "Medium"),
        initial_code=initial_code,
        execution_snippet=execution_snippet,
        arguments=arguments,
        test_cases=test_cases,
        description=body,
    )


def load_chapter_from_dir(chapter_dir: Path) -> Optional[Chapter]:
    """Load a chapter from a chapter directory."""
    # Parse chapter slug to get number
    # Format: "02-tokenization" or "p1-02-assembly"
    slug = chapter_dir.name
    
    # Skip project sub-chapters for now (p1-xx, p2-xx)
    if slug.startswith("p"):
        return None
    
    # Extract chapter number from slug
    match = re.match(r"(\d+)-(.+)", slug)
    if not match:
        return None
    
    chapter_num = int(match.group(1))
    chapter_name = match.group(2).replace("-", " ").title()
    
    # Check for challenges directory
    challenges_dir = chapter_dir / "challenges"
    if not challenges_dir.exists():
        return Chapter(
            num=chapter_num,
            slug=slug,
            title=chapter_name,
            challenges=[],
        )
    
    # Load challenges
    challenges = []
    challenge_dirs = sorted(challenges_dir.iterdir())
    
    for idx, challenge_dir in enumerate(challenge_dirs, 1):
        if not challenge_dir.is_dir():
            continue
        
        challenge = load_challenge_from_dir(
            challenge_dir,
            chapter_num,
            idx,
            slug,
        )
        if challenge:
            challenges.append(challenge)
    
    return Chapter(
        num=chapter_num,
        slug=slug,
        title=chapter_name,
        challenges=challenges,
    )


def load_course_from_dir(course_dir: Path) -> Optional[CourseManifest]:
    """Load a course manifest from a course directory."""
    meta_file = course_dir / "meta.json"
    
    if not meta_file.exists():
        return None
    
    # Load meta.json for basic info
    try:
        meta = json.loads(meta_file.read_text())
    except json.JSONDecodeError:
        return None
    
    course_id = course_dir.name
    
    # Load chapters
    chapters = []
    for item in sorted(course_dir.iterdir()):
        if not item.is_dir():
            continue
        
        chapter = load_chapter_from_dir(item)
        if chapter:
            chapters.append(chapter)
    
    # Sort chapters by number
    chapters.sort(key=lambda c: c.num)
    
    return CourseManifest(
        id=course_id,
        title=course_id.replace("-", " ").title(),
        description="",
        chapters=chapters,
    )


def load_courses_from_content_dir(content_dir: Path) -> list[CourseManifest]:
    """Load all courses from a content directory."""
    courses = []
    
    if not content_dir.exists():
        return courses
    
    for item in content_dir.iterdir():
        if not item.is_dir():
            continue
        
        course = load_course_from_dir(item)
        if course:
            courses.append(course)
            register_course(course)
    
    return courses


def discover_content_dir() -> Optional[Path]:
    """
    Try to discover the web content directory.
    
    Searches in common locations relative to the package or current directory.
    """
    # Check relative to this file (development mode)
    package_dir = Path(__file__).parent
    
    candidates = [
        # Development: cli is sibling to web
        package_dir.parent.parent.parent / "web" / "content",
        # Installed: might be in a data directory
        package_dir / "data" / "content",
        # Current directory
        Path.cwd() / "web" / "content",
        Path.cwd() / "content",
    ]
    
    for candidate in candidates:
        if candidate.exists() and candidate.is_dir():
            return candidate
    
    return None


def initialize_courses() -> None:
    """Initialize course manifests from available sources."""
    if COURSE_MANIFESTS:
        return  # Already initialized
    
    content_dir = discover_content_dir()
    if content_dir:
        load_courses_from_content_dir(content_dir)
    
    # Fallback: register embedded course data
    if not COURSE_MANIFESTS:
        _register_embedded_courses()


def _register_embedded_courses() -> None:
    """Register embedded/hardcoded course data as fallback."""
    # Build ChatGPT course - minimal embedded data
    # This is a fallback when content directory is not available
    
    build_chatgpt = CourseManifest(
        id="build-chatgpt",
        title="Build ChatGPT from Scratch",
        description="From raw text to a working chatbot.",
        chapters=[
            Chapter(
                num=1,
                slug="01-from-text-to-bytes",
                title="From Text to Bytes",
                challenges=[
                    Challenge(
                        id="01-01",
                        slug="encoder",
                        title="String to Bytes Encoder",
                        filename="01_encoder.py",
                        function_name="encode_string",
                        chapter="01-from-text-to-bytes",
                        chapter_num=1,
                        challenge_num=1,
                        difficulty="Easy",
                        initial_code='def encode_string(text: str) -> list[int]:\n    # TODO: Convert string to list of UTF-8 bytes\n    pass\n',
                        execution_snippet="encode_string(text)",
                        arguments=[ChallengeArgument(name="text", type="str")],
                        test_cases=[
                            TestCase(id="case1", inputs={"text": '"Hello"'}, expected="[72, 101, 108, 108, 111]"),
                            TestCase(id="case2", inputs={"text": '"A"'}, expected="[65]"),
                        ],
                    ),
                ],
            ),
            Chapter(
                num=2,
                slug="02-tokenization",
                title="Tokenization",
                challenges=[
                    Challenge(
                        id="02-01",
                        slug="pair-counter",
                        title="The Pair Counter",
                        filename="01_pair_counter.py",
                        function_name="get_stats",
                        chapter="02-tokenization",
                        chapter_num=2,
                        challenge_num=1,
                        difficulty="Easy",
                        initial_code='def get_stats(ids: list[int]) -> dict[tuple[int, int], int]:\n    # TODO: Count how often each consecutive pair appears\n    pass\n',
                        execution_snippet="get_stats(ids)",
                        arguments=[ChallengeArgument(name="ids", type="list[int]")],
                        test_cases=[
                            TestCase(id="case1", inputs={"ids": "[1, 2, 3, 1, 2]"}, expected="{(1, 2): 2, (2, 3): 1, (3, 1): 1}"),
                            TestCase(id="case2", inputs={"ids": "[97, 97, 97, 98]"}, expected="{(97, 97): 2, (97, 98): 1}"),
                        ],
                    ),
                    Challenge(
                        id="02-02",
                        slug="token-merger",
                        title="The Token Merger",
                        filename="02_token_merger.py",
                        function_name="merge",
                        chapter="02-tokenization",
                        chapter_num=2,
                        challenge_num=2,
                        difficulty="Easy",
                        initial_code='def merge(ids: list[int], pair: tuple[int, int], new_id: int) -> list[int]:\n    # TODO: Replace all occurrences of pair with new_id\n    pass\n',
                        execution_snippet="merge(ids, pair, new_id)",
                        arguments=[
                            ChallengeArgument(name="ids", type="list[int]"),
                            ChallengeArgument(name="pair", type="tuple[int, int]"),
                            ChallengeArgument(name="new_id", type="int"),
                        ],
                        test_cases=[],
                    ),
                ],
            ),
        ],
    )
    
    register_course(build_chatgpt)
