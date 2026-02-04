"""Shared utilities for displaying test results."""

from rich.console import Console
from rich.table import Table

from ai_deep_dive.runner import TestResult


def display_results(console: Console, results: list[TestResult], verbose: bool) -> None:
    """Display test results."""
    table = Table(show_header=True, header_style="bold")
    table.add_column("Case", style="dim", width=8)
    table.add_column("Status", width=12)
    table.add_column("Details", overflow="fold")

    for result in results:
        if result.hidden and result.status == "Accepted":
            # Don't show details for hidden passing tests
            continue

        if result.status == "Accepted":
            status = "[green]✓ Passed[/green]"
        elif result.status == "Wrong Answer":
            status = "[red]✗ Wrong[/red]"
        else:
            status = "[yellow]! Error[/yellow]"

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

    hidden_results = [r for r in results if r.hidden]
    if hidden_results:
        hidden_passed = sum(1 for r in hidden_results if r.status == "Accepted")
        table.add_row(
            "[dim]Hidden[/dim]",
            f"[dim]{hidden_passed}/{len(hidden_results)}[/dim]",
            "[dim]Hidden test cases[/dim]",
        )

    console.print(table)

    if verbose:
        for result in results:
            if result.hidden:
                continue

            console.print()
            console.print(f"[bold]Case {result.id}:[/bold]")
            console.print("  [dim]Input:[/dim]")
            for line in result.input_code.strip().split("\n"):
                console.print(f"    {line}")

            if result.stdout:
                console.print("  [dim]Stdout:[/dim]")
                console.print(f"    {result.stdout.strip()}")

            console.print(f"  [dim]Output:[/dim] {result.output}")
