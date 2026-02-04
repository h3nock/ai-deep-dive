"""Shared helpers for resolving challenge context in CLI commands."""

from dataclasses import dataclass
from pathlib import Path

from rich.console import Console

from ai_deep_dive.config import get_workspace_root, get_workspace_config
from ai_deep_dive.course_loader import initialize_courses
from ai_deep_dive.finder import find_challenge_file
from ai_deep_dive.manifest import Challenge, CourseManifest, get_course_manifest


@dataclass
class ChallengeContext:
    workspace_root: Path
    course_id: str
    manifest: CourseManifest
    challenge: Challenge
    solution_path: Path


def load_challenge_context(challenge_id: str, console: Console) -> ChallengeContext:
    """Resolve workspace, course, challenge, and solution path for a command."""
    initialize_courses()

    workspace_root = get_workspace_root()
    if not workspace_root:
        console.print("[red]Error:[/red] Not in an AI Deep Dive workspace.")
        console.print()
        console.print("Run this command from within a course directory,")
        console.print("or initialize a new workspace with:")
        console.print("  [cyan]ai-deep-dive init <course-slug>[/cyan]")
        raise SystemExit(1)

    config = get_workspace_config(workspace_root)
    course_id = config.get("course")
    if not course_id:
        console.print("[red]Error:[/red] Invalid workspace configuration.")
        console.print("Missing 'course' in .ai-deep-dive/config.json")
        raise SystemExit(1)

    manifest = get_course_manifest(course_id)
    if not manifest:
        console.print(f"[red]Error:[/red] Course '{course_id}' not found.")
        raise SystemExit(1)

    challenge = manifest.get_challenge(challenge_id)
    if not challenge:
        console.print(f"[red]Error:[/red] Challenge '{challenge_id}' not found in {course_id}.")
        console.print()
        console.print("[yellow]Available challenges:[/yellow]")
        for ch in manifest.get_all_challenges()[:10]:
            console.print(f"  • {ch.id} - {ch.title}")
        if len(manifest.get_all_challenges()) > 10:
            console.print(f"  ... and {len(manifest.get_all_challenges()) - 10} more")
        raise SystemExit(1)

    console.print(f"[dim]Looking for {challenge.filename}...[/dim]")

    solution_path = find_challenge_file(
        workspace_root,
        challenge.filename,
        challenge.function_name,
    )

    if not solution_path:
        console.print(f"[red]Error:[/red] Could not find solution file '{challenge.filename}'")
        console.print()
        console.print("Make sure you have created the file in your workspace.")
        console.print(f"Expected location: [cyan]{workspace_root / challenge.chapter / challenge.filename}[/cyan]")
        raise SystemExit(1)

    console.print(f"[dim]Found: {solution_path.relative_to(workspace_root)}[/dim]")
    console.print()

    return ChallengeContext(
        workspace_root=workspace_root,
        course_id=course_id,
        manifest=manifest,
        challenge=challenge,
        solution_path=solution_path,
    )
