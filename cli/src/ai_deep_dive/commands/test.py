"""The 'test' command - run tests for a challenge."""

import click
from rich.console import Console
from rich.panel import Panel
from rich.table import Table

from ai_deep_dive.config import (
    get_workspace_root,
    get_workspace_config,
    update_challenge_status,
)
from ai_deep_dive.course_loader import initialize_courses
from ai_deep_dive.manifest import get_course_manifest
from ai_deep_dive.finder import find_challenge_file
from ai_deep_dive.runner import run_tests, TestResult

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
    # Initialize course data
    initialize_courses()
    
    # Find workspace root
    workspace_root = get_workspace_root()
    
    if not workspace_root:
        console.print("[red]Error:[/red] Not in an AI Deep Dive workspace.")
        console.print()
        console.print("Run this command from within a course directory,")
        console.print("or initialize a new workspace with:")
        console.print("  [cyan]ai-deep-dive init <course-slug>[/cyan]")
        raise SystemExit(1)
    
    # Get workspace config
    config = get_workspace_config(workspace_root)
    course_id = config.get("course")
    
    if not course_id:
        console.print("[red]Error:[/red] Invalid workspace configuration.")
        console.print("Missing 'course' in .ai-deep-dive/config.json")
        raise SystemExit(1)
    
    # Get course manifest
    manifest = get_course_manifest(course_id)
    
    if not manifest:
        console.print(f"[red]Error:[/red] Course '{course_id}' not found.")
        raise SystemExit(1)
    
    # Get challenge
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
    
    # Find the solution file
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
    
    # Check if challenge has test cases
    if not challenge.test_cases:
        console.print("[yellow]Warning:[/yellow] No test cases defined for this challenge.")
        console.print("This challenge may require manual verification.")
        raise SystemExit(0)
    
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
    _display_results(result.results, verbose)
    
    console.print()
    
    # Summary
    if result.passed:
        console.print(Panel(
            f"[green bold]✓ All tests passed![/green bold]\n\n"
            f"[dim]{result.passed_count}/{result.total} test cases passed[/dim]",
            title="🎉 Accepted",
            border_style="green",
        ))
        
        # Update local status
        update_challenge_status(course_id, challenge_id, passed=True)
        
        # Show sync tip
        console.print()
        console.print("[dim]Tip: Run 'ai-deep-dive sync' to update your web profile[/dim]")
        
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


def _display_results(results: list[TestResult], verbose: bool) -> None:
    """Display test results."""
    # Create results table
    table = Table(show_header=True, header_style="bold")
    table.add_column("Case", style="dim", width=8)
    table.add_column("Status", width=12)
    table.add_column("Details", overflow="fold")
    
    for result in results:
        if result.hidden and result.status == "Accepted":
            # Don't show details for hidden passing tests
            continue
        
        # Status styling
        if result.status == "Accepted":
            status = "[green]✓ Passed[/green]"
        elif result.status == "Wrong Answer":
            status = "[red]✗ Wrong[/red]"
        else:
            status = "[yellow]! Error[/yellow]"
        
        # Details
        case_name = "Hidden" if result.hidden else result.id
        
        if result.status == "Accepted" and not verbose:
            details = ""
        elif result.status == "Wrong Answer":
            details = f"Expected: {result.expected}\nGot: {result.output}"
        elif result.status == "Runtime Error":
            details = result.stderr[:200] + ("..." if len(result.stderr) > 200 else "")
        else:
            details = ""
        
        table.add_row(case_name, status, details)
    
    # Show hidden tests summary
    hidden_results = [r for r in results if r.hidden]
    if hidden_results:
        hidden_passed = sum(1 for r in hidden_results if r.status == "Accepted")
        table.add_row(
            "[dim]Hidden[/dim]",
            f"[dim]{hidden_passed}/{len(hidden_results)}[/dim]",
            "[dim]Hidden test cases[/dim]",
        )
    
    console.print(table)
    
    # Show verbose output
    if verbose:
        for result in results:
            if result.hidden:
                continue
            
            console.print()
            console.print(f"[bold]Case {result.id}:[/bold]")
            console.print(f"  [dim]Input:[/dim]")
            for line in result.input_code.strip().split('\n'):
                console.print(f"    {line}")
            
            if result.stdout:
                console.print(f"  [dim]Stdout:[/dim]")
                console.print(f"    {result.stdout.strip()}")
            
            console.print(f"  [dim]Output:[/dim] {result.output}")
            console.print(f"  [dim]Expected:[/dim] {result.expected}")
