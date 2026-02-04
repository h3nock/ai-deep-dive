"""The 'test' command - run tests for a challenge."""

from dataclasses import replace

import click
from rich.console import Console
from rich.panel import Panel

from ai_deep_dive.course_loader import load_public_tests
from ai_deep_dive.commands._context import load_challenge_context
from ai_deep_dive.commands._results import display_results
from ai_deep_dive.runner import run_tests

console = Console()


@click.command()
@click.argument("challenge_id")
@click.option(
    "--verbose", "-v",
    is_flag=True,
    help="Show detailed output for all test cases",
)
def test_command(challenge_id: str, verbose: bool) -> None:
    """Run tests for a specific challenge.
    
    CHALLENGE_ID should be in format "CC-NN" where CC is chapter number
    and NN is challenge number. For example: "02-01" for chapter 2, challenge 1.
    
    Examples:
        ai-deep-dive test 02-01
        ai-deep-dive test 02-01 --verbose
    """
    context = load_challenge_context(challenge_id, console)
    challenge = context.challenge
    solution_path = context.solution_path
    
    # Refresh public tests using remote-first + cache strategy
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
        console.print("Check your network connection or set:")
        console.print("  [cyan]ai-deep-dive config set-tests-url <url>[/cyan]")
        raise SystemExit(1)
    
    # Run tests
    console.print(f"[bold]Running tests for:[/bold] {challenge.title}")
    console.print(f"[dim]Challenge {challenge.id} • {challenge.difficulty}[/dim]")
    console.print()
    
    with console.status("[bold blue]Running tests...[/bold blue]"):
        result = run_tests(challenge, solution_path)
    
    # Handle error
    if result.error:
        console.print(Panel(
            f"[red]{result.error}[/red]",
            title="❌ Error",
            border_style="red",
        ))
        raise SystemExit(1)
    
    # Display results
    display_results(console, result.results, verbose)
    
    console.print()
    
    # Summary
    if result.passed:
        console.print(Panel(
            f"[green bold]✓ All tests passed![/green bold]\n\n"
            f"[dim]{result.passed_count}/{result.total} test cases passed[/dim]",
            title="🎉 Accepted",
            border_style="green",
        ))
        
        console.print()
        console.print("[dim]Tip: Run 'ai-deep-dive submit' to run hidden tests and record completion[/dim]")
        
        raise SystemExit(0)
    else:
        failed_count = result.total - result.passed_count
        console.print(Panel(
            f"[red bold]✗ Some tests failed[/red bold]\n\n"
            f"[dim]{result.passed_count}/{result.total} test cases passed[/dim]\n"
            f"[dim]{failed_count} failed[/dim]",
            title="Wrong Answer",
            border_style="red",
        ))
        raise SystemExit(1)


            console.print(f"  [dim]Expected:[/dim] {result.expected}")
