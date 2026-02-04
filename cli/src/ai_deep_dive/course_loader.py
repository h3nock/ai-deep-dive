"""Load course manifests from the web content directory or embedded data."""

import ast
import json
import sys
import re
from pathlib import Path
from typing import Optional
from urllib.parse import quote
from urllib.request import urlopen
from urllib.error import URLError
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
from ai_deep_dive.config import get_tests_url


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


def _parse_expected(value: object) -> object:
    if isinstance(value, str):
        try:
            return json.loads(value)
        except json.JSONDecodeError:
            return value
    return value


def _case_from_raw(raw: dict, hidden_override: bool | None = None) -> TestCase:
    input_code = raw.get("input_code")
    if input_code is None and "inputs" in raw:
        input_code = ""
        for name, value in raw.get("inputs", {}).items():
            input_code += f"{name} = {value}\n"
    if input_code is None:
        input_code = ""

    expected_raw = raw.get("expected")
    expected_is_code = bool(raw.get("expected_is_code", False))
    if expected_is_code and isinstance(expected_raw, str):
        try:
            expected_value = ast.literal_eval(expected_raw)
        except (ValueError, SyntaxError):
            expected_value = expected_raw
    else:
        expected_value = _parse_expected(expected_raw)

    comparison = raw.get("comparison") if isinstance(raw, dict) else None

    hidden = bool(raw.get("hidden", False))
    if hidden_override is not None:
        hidden = hidden_override

    return TestCase(
        id=str(raw.get("id", "")),
        input_code=input_code,
        expected=expected_value,
        expected_is_code=False,
        hidden=hidden,
        comparison=comparison,
    )


def _load_hidden_tests_from_web(problem_id: str, allow_network: bool = True) -> Optional[list[TestCase]]:
    base_url = get_tests_url().rstrip("/")
    problem_path = "/".join(quote(seg) for seg in problem_id.split("/"))
    tests_url = f"{base_url}/judge-tests/{problem_path}/hidden_tests.json"
    cache_dir = _cache_dir_for_problem(problem_id)
    cached_tests_path = cache_dir / "hidden_tests.json"

    tests_raw = _read_cached_json(cached_tests_path)
    if tests_raw is None and allow_network:
        tests_raw = _fetch_json(tests_url)
        if tests_raw:
            _write_cached_json(cached_tests_path, tests_raw)
    if tests_raw is None:
        return None

    cases_raw = tests_raw.get("cases", tests_raw) if isinstance(tests_raw, dict) else tests_raw
    return [_case_from_raw(item, hidden_override=True) for item in cases_raw]


def _log_fetch_error(url: str, message: str) -> None:
    print(f"[ai-deep-dive] Failed to fetch {url}: {message}", file=sys.stderr)


def _fetch_json(url: str) -> Optional[dict]:
    try:
        with urlopen(url, timeout=10) as response:
            return json.loads(response.read().decode("utf-8"))
    except URLError as exc:
        _log_fetch_error(url, str(getattr(exc, "reason", exc)))
    except json.JSONDecodeError as exc:
        _log_fetch_error(url, f"invalid json ({exc})")
    except Exception as exc:
        _log_fetch_error(url, str(exc))
    return None


def _cache_root() -> Path:
    root = Path.home() / ".ai-deep-dive" / "cache" / "judge-tests"
    root.mkdir(parents=True, exist_ok=True)
    return root


def _cache_dir_for_problem(problem_id: str) -> Path:
    return _cache_root() / Path(*problem_id.split("/"))


def _read_cached_json(path: Path) -> Optional[dict]:
    if not path.exists():
        return None
    try:
        return json.loads(path.read_text())
    except json.JSONDecodeError:
        return None


def _write_cached_json(path: Path, data: dict) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data))


def _load_public_tests_from_web(problem_id: str, allow_network: bool = True) -> Optional[tuple[list[TestCase], str, dict]]:
    base_url = get_tests_url().rstrip("/")
    problem_path = "/".join(quote(seg) for seg in problem_id.split("/"))
    manifest_url = f"{base_url}/judge-tests/{problem_path}/public_manifest.json"
    cache_dir = _cache_dir_for_problem(problem_id)
    cached_manifest_path = cache_dir / "public_manifest.json"

    # Cache-first for speed.
    manifest = _read_cached_json(cached_manifest_path)
    if manifest is None and allow_network:
        manifest = _fetch_json(manifest_url)
        if manifest:
            _write_cached_json(cached_manifest_path, manifest)
    if manifest is None:
        return None

    bundle_name = manifest.get("bundle")
    if not bundle_name:
        return None
    bundle_url = f"{base_url}/judge-tests/{problem_path}/{bundle_name}"
    cached_bundle_path = cache_dir / bundle_name

    bundle = _read_cached_json(cached_bundle_path)
    if bundle is None and allow_network:
        bundle = _fetch_json(bundle_url)
        if bundle:
            _write_cached_json(cached_bundle_path, bundle)
    if bundle is None:
        return None

    tests_raw = bundle.get("tests", [])
    cases_raw = tests_raw.get("cases", tests_raw) if isinstance(tests_raw, dict) else tests_raw
    cases = [_case_from_raw(item, hidden_override=False) for item in cases_raw]

    runner = str(bundle.get("runner", "")).strip()
    comparison = bundle.get("comparison", {"type": "exact"})
    if not isinstance(comparison, dict):
        comparison = {"type": "exact"}

    return cases, runner, comparison


def load_public_tests(problem_id: str) -> Optional[tuple[list[TestCase], str, dict]]:
    return _load_public_tests_from_web(problem_id, allow_network=True)


def load_hidden_tests(problem_id: str) -> tuple[list[TestCase], bool]:
    cases = _load_hidden_tests_from_web(problem_id, allow_network=True)
    if cases is None:
        return [], False
    return cases, True


def load_challenge_from_dir(
    challenge_dir: Path,
    chapter_num: int,
    challenge_num: int,
    chapter_slug: str,
    course_slug: str,
) -> Optional[Challenge]:
    """Load a challenge from a challenge directory."""
    desc_file = challenge_dir / "description.md"
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
    
    problem_id = frontmatter.get("problemId") or f"{course_slug}/{chapter_slug}/{challenge_dir.name}"
    test_cases: list[TestCase] = []
    runner = ""
    comparison = None

    # Public tests are loaded on-demand by CLI commands (test/submit).
    
    return Challenge(
        id=challenge_id,
        slug=slug,
        problem_id=problem_id,
        title=title,
        filename=filename,
        function_name=function_name,
        chapter=chapter_slug,
        chapter_num=chapter_num,
        challenge_num=challenge_num,
        difficulty=frontmatter.get("difficulty", "Medium"),
        initial_code=initial_code,
        execution_snippet=execution_snippet,
        runner=runner,
        arguments=arguments,
        test_cases=test_cases,
        comparison=comparison,
        description=body,
    )


def load_chapter_from_dir(chapter_dir: Path, course_slug: str) -> Optional[Chapter]:
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
            course_slug,
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
        
        chapter = load_chapter_from_dir(item, course_id)
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
                        problem_id="build-chatgpt/01-from-text-to-bytes/01-encoder",
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
                            TestCase(id="case1", input_code='text = "Hello"\n', expected=[72, 101, 108, 108, 111]),
                            TestCase(id="case2", input_code='text = "A"\n', expected=[65]),
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
                        problem_id="build-chatgpt/02-tokenization/01-pair-counter",
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
                            TestCase(
                                id="case1",
                                input_code="ids = [1, 2, 3, 1, 2]\n",
                                expected={(1, 2): 2, (2, 3): 1, (3, 1): 1},
                            ),
                            TestCase(
                                id="case2",
                                input_code="ids = [97, 97, 97, 98]\n",
                                expected={(97, 97): 2, (97, 98): 1},
                            ),
                        ],
                    ),
                    Challenge(
                        id="02-02",
                        slug="token-merger",
                        problem_id="build-chatgpt/02-tokenization/02-token-merger",
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
