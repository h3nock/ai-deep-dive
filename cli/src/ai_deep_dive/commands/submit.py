"""The 'submit' command - run public + hidden tests for a challenge."""

from dataclasses import replace

import click
from rich.console import Console
from rich.panel import Panel

from ai_deep_dive.commands._results import display_results
from ai_deep_dive.config import (
    get_workspace_root,
    get_workspace_config,
    update_challenge_status,
)
from ai_deep_dive.course_loader import (
    initialize_courses,
    load_hidden_tests,
    load_public_tests,
)
from ai_deep_dive.manifest import get_course_manifest
from ai_deep_dive.finder import find_challenge_file
from ai_deep_dive.runner import run_tests

console = Console()


@click.command()
@click.argument("challenge_id")
@click.option(
    "--verbose", "-v",
    is_flag=True,
    help="Show detailed output for all public test cases",
)
def submit_command(challenge_id: str, verbose: bool) -> None:
    """Run public + hidden tests for a specific challenge.

    CHALLENGE_ID should be in format "CC-NN" where CC is chapter number
    and NN is challenge number. For example: "02-01" for chapter 2, challenge 1.

    Examples:
        ai-deep-dive submit 02-01
        ai-deep-dive submit 02-01 --verbose
    """
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

    loaded_public = load_public_tests(challenge.problem_id)
    if loaded_public:
        test_cases, runner, comparison = loaded_public
        challenge = replace(
            challenge,
            test_cases=test_cases,
            runner=runner,
            comparison=comparison,
        )

    if not challenge.test_cases:
        console.print("[red]Error:[/red] Unable to load public test cases.")
        console.print("This challenge cannot be submitted without public tests.")
        console.print("Check your network connection or set:")
        console.print("  [cyan]ai-deep-dive config set-tests-url <url>[/cyan]")
        raise SystemExit(1)

    if not challenge.problem_id:
        console.print("[red]Error:[/red] Missing problem id for this challenge.")
        raise SystemExit(1)

    hidden_cases, hidden_found = load_hidden_tests(challenge.problem_id)
    if not hidden_found:
        console.print("[red]Error:[/red] Hidden tests not available.")
        console.print()
        console.print("Unable to load hidden tests from the remote endpoint or cache.")
        console.print("Check your network connection or set:")
        console.print("  [cyan]ai-deep-dive config set-tests-url <url>[/cyan]")
        raise SystemExit(1)

    if not hidden_cases:
        console.print("[yellow]Warning:[/yellow] No hidden tests defined for this challenge.")
        console.print("[dim]Submit will run public tests only.[/dim]")

    combined = challenge.test_cases + hidden_cases
    challenge_for_submit = replace(challenge, test_cases=combined)

    console.print(f"[bold]Submitting:[/bold] {challenge.title}")
    console.print(f"[dim]Challenge {challenge.id} • {challenge.difficulty}[/dim]")
    console.print()

    with console.status("[bold blue]Running tests...[/bold blue]"):
        result = run_tests(challenge_for_submit, solution_path)

    if result.error:
        console.print(Panel(
            f"[red]{result.error}[/red]",
            title="❌ Error",
            border_style="red",
        ))
        raise SystemExit(1)

    display_results(console, result.results, verbose)

    console.print()

    if result.passed:
        console.print(Panel(
            f"[green bold]✓ All tests passed![/green bold]\n\n"
            f"[dim]{result.passed_count}/{result.total} test cases passed[/dim]",
            title="🎉 Accepted",
            border_style="green",
        ))

        update_challenge_status(course_id, challenge_id, passed=True)

        console.print()
        console.print("[dim]Tip: Run 'ai-deep-dive sync' to update your web profile[/dim]")
        raise SystemExit(0)

    failed_count = result.total - result.passed_count
    console.print(Panel(
        f"[red bold]✗ Some tests failed[/red bold]\n\n"
        f"[dim]{result.passed_count}/{result.total} test cases passed[/dim]\n"
        f"[dim]{failed_count} failed[/dim]",
        title="Wrong Answer",
        border_style="red",
    ))
    raise SystemExit(1)
