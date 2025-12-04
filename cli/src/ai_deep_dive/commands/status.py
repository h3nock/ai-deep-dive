"""The 'status' command - show progress in the current course."""

import click
from rich.console import Console
from rich.table import Table

from ai_deep_dive.config import (
    get_workspace_root,
    get_workspace_config,
    get_course_status,
)
from ai_deep_dive.course_loader import initialize_courses
from ai_deep_dive.manifest import get_course_manifest

console = Console()


@click.command()
@click.option(
    "--all", "-a",
    "show_all",
    is_flag=True,
    help="Show status for all courses",
)
def status_command(show_all: bool) -> None:
    """Show your progress in the current course.
    
    Run this from within a course workspace to see your progress,
    or use --all to see progress across all courses.
    
    Examples:
        ai-deep-dive status
        ai-deep-dive status --all
    """
    # Initialize course data
    initialize_courses()
    
    if show_all:
        _show_all_courses_status()
        return
    
    # Find workspace root
    workspace_root = get_workspace_root()
    
    if not workspace_root:
        console.print("[yellow]Not in a course workspace.[/yellow]")
        console.print()
        console.print("Run from within a course directory, or use:")
        console.print("  [cyan]ai-deep-dive status --all[/cyan]")
        console.print()
        console.print("To start a new course:")
        console.print("  [cyan]ai-deep-dive init <course-slug>[/cyan]")
        raise SystemExit(1)
    
    # Get workspace config
    config = get_workspace_config(workspace_root)
    course_id = config.get("course")
    
    if not course_id:
        console.print("[red]Error:[/red] Invalid workspace configuration.")
        raise SystemExit(1)
    
    # Get course manifest and status
    manifest = get_course_manifest(course_id)
    
    if not manifest:
        console.print(f"[red]Error:[/red] Course '{course_id}' not found.")
        raise SystemExit(1)
    
    status = get_course_status(course_id)
    completed = set(status.get("completed", []))
    
    # Count totals
    all_challenges = manifest.get_all_challenges()
    total = len(all_challenges)
    completed_count = len(completed)
    
    # Header
    console.print()
    console.print(f"[bold]{manifest.title}[/bold]")
    console.print(f"[dim]Workspace: {workspace_root}[/dim]")
    console.print()
    
    # Progress bar
    if total > 0:
        pct = (completed_count / total) * 100
        console.print(f"[bold]Progress:[/bold] {completed_count}/{total} challenges ({pct:.0f}%)")
        
        # Visual progress bar
        bar_width = 40
        filled = int(bar_width * completed_count / total)
        bar = "█" * filled + "░" * (bar_width - filled)
        console.print(f"[green]{bar}[/green]")
    
    console.print()
    
    # Chapter breakdown
    table = Table(show_header=True, header_style="bold")
    table.add_column("Chapter", overflow="fold")
    table.add_column("Progress", width=12)
    table.add_column("Status", width=20)
    
    for chapter in manifest.chapters:
        if not chapter.challenges:
            continue
        
        chapter_completed = sum(
            1 for ch in chapter.challenges if ch.id in completed
        )
        chapter_total = len(chapter.challenges)
        
        # Progress indicator
        if chapter_completed == chapter_total:
            progress = f"[green]{chapter_completed}/{chapter_total}[/green]"
            status_str = "[green]✓ Complete[/green]"
        elif chapter_completed > 0:
            progress = f"[yellow]{chapter_completed}/{chapter_total}[/yellow]"
            status_str = "[yellow]In Progress[/yellow]"
        else:
            progress = f"[dim]{chapter_completed}/{chapter_total}[/dim]"
            status_str = "[dim]Not Started[/dim]"
        
        table.add_row(
            f"{chapter.num}. {chapter.title}",
            progress,
            status_str,
        )
    
    console.print(table)
    
    # Next challenge suggestion
    console.print()
    next_challenge = None
    for challenge in all_challenges:
        if challenge.id not in completed:
            next_challenge = challenge
            break
    
    if next_challenge:
        console.print(f"[bold]Next up:[/bold] {next_challenge.title}")
        console.print(f"[dim]Run: ai-deep-dive test {next_challenge.id}[/dim]")
    else:
        console.print("[green bold]🎉 Congratulations! You've completed all challenges![/green bold]")


def _show_all_courses_status() -> None:
    """Show status for all courses."""
    from ai_deep_dive.manifest import get_available_courses
    from ai_deep_dive.config import get_status
    
    courses = get_available_courses()
    global_status = get_status()
    
    console.print()
    console.print("[bold]All Courses Progress[/bold]")
    console.print()
    
    table = Table(show_header=True, header_style="bold")
    table.add_column("Course", overflow="fold")
    table.add_column("Progress", width=12)
    table.add_column("Last Updated", width=20)
    
    for course in courses:
        course_status = global_status.get("courses", {}).get(course.id, {})
        completed = len(course_status.get("completed", []))
        total = len(course.get_all_challenges())
        last_updated = course_status.get("last_updated", "Never")
        
        if total > 0:
            pct = (completed / total) * 100
            if completed == total:
                progress = f"[green]{completed}/{total} (100%)[/green]"
            elif completed > 0:
                progress = f"[yellow]{completed}/{total} ({pct:.0f}%)[/yellow]"
            else:
                progress = f"[dim]{completed}/{total} (0%)[/dim]"
        else:
            progress = "[dim]N/A[/dim]"
        
        table.add_row(course.title, progress, last_updated or "Never")
    
    console.print(table)
