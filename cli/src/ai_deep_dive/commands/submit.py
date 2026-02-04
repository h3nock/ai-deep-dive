"""The 'submit' command - run public + hidden tests for a challenge."""

from dataclasses import replace

import click
from rich.console import Console
from rich.panel import Panel

from ai_deep_dive.commands._context import load_challenge_context
from ai_deep_dive.commands._results import display_results
from ai_deep_dive.config import update_challenge_status
from ai_deep_dive.course_loader import load_hidden_tests, load_public_tests
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
    context = load_challenge_context(challenge_id, console)
    challenge = context.challenge
    solution_path = context.solution_path
    course_id = context.course_id

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

    display_results(
        console,
        result.results,
        verbose,
        first_failure_only=True,
        show_hidden_summary=False,
    )

    console.print()

    failed_count = result.total - result.passed_count
    console.print(Panel(
        f"[red bold]✗ Some tests failed[/red bold]\n\n"
        f"[dim]{result.passed_count}/{result.total} test cases passed[/dim]\n"
        f"[dim]{failed_count} failed[/dim]",
        title="Wrong Answer",
        border_style="red",
    ))
    raise SystemExit(1)
