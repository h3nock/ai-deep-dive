"""The 'sync' command - sync progress with the website."""

import click
from rich.console import Console
from rich.panel import Panel

from ai_deep_dive.config import (
    get_workspace_root,
    get_workspace_config,
    get_course_status,
    get_status,
)
from ai_deep_dive.course_loader import initialize_courses
from ai_deep_dive.manifest import get_course_manifest
from ai_deep_dive.sync import open_sync_url, generate_sync_url

console = Console()


@click.command()
@click.option(
    "--course", "-c",
    "course_id",
    default=None,
    help="Specific course to sync (overrides workspace context)",
)
@click.option(
    "--all", "-a",
    "sync_all",
    is_flag=True,
    help="Sync all courses with progress",
)
@click.option(
    "--dry-run", "-n",
    is_flag=True,
    help="Show the sync URL without opening browser",
)
def sync_command(course_id: str | None, sync_all: bool, dry_run: bool) -> None:
    """Sync your progress with the website.
    
    Opens a browser link that automatically imports your progress
    into the website's localStorage.
    
    By default, syncs the current course (based on workspace).
    Use --course to specify a different course, or --all for everything.
    
    Examples:
        ai-deep-dive sync              # Sync current course
        ai-deep-dive sync --course build-chatgpt
        ai-deep-dive sync --all        # Sync all courses
        ai-deep-dive sync --dry-run    # Show URL without opening
    """
    # Initialize course data
    initialize_courses()
    
    if sync_all:
        _sync_all_courses(dry_run)
        return
    
    # Determine which course to sync
    target_course_id = course_id
    
    if not target_course_id:
        # Try to get from workspace context
        workspace_root = get_workspace_root()
        
        if workspace_root:
            config = get_workspace_config(workspace_root)
            target_course_id = config.get("course")
    
    if not target_course_id:
        console.print("[red]Error:[/red] Not in a course workspace.")
        console.print()
        console.print("Either:")
        console.print("  • [cyan]cd[/cyan] into a course folder, or")
        console.print("  • Run: [cyan]ai-deep-dive sync --course <course-id>[/cyan]")
        console.print("  • Run: [cyan]ai-deep-dive sync --all[/cyan]")
        raise SystemExit(1)
    
    # Validate course exists
    manifest = get_course_manifest(target_course_id)
    if not manifest:
        console.print(f"[red]Error:[/red] Course '{target_course_id}' not found.")
        raise SystemExit(1)
    
    # Get progress
    status = get_course_status(target_course_id)
    completed = status.get("completed", [])
    
    if not completed:
        console.print(f"[yellow]No progress to sync for {manifest.title}.[/yellow]")
        console.print()
        console.print("Complete some challenges first!")
        console.print(f"  [cyan]ai-deep-dive test 01-01[/cyan]")
        raise SystemExit(0)
    
    # Generate and show URL
    url = generate_sync_url(target_course_id)
    
    console.print()
    console.print(f"[bold]Syncing:[/bold] {manifest.title}")
    console.print(f"[dim]Progress: {len(completed)} challenges completed[/dim]")
    console.print()
    
    if dry_run:
        console.print("[bold]Sync URL:[/bold]")
        console.print(f"  [cyan]{url}[/cyan]")
        console.print()
        console.print("[dim]Use without --dry-run to open in browser[/dim]")
    else:
        success, result = open_sync_url(target_course_id)
        
        if success:
            console.print(Panel(
                f"[green]✓ Opening browser to sync progress[/green]\n\n"
                f"[dim]URL: {url}[/dim]",
                title="Sync",
                border_style="green",
            ))
        else:
            console.print(f"[red]Error:[/red] {result}")
            console.print()
            console.print("[bold]Manual sync URL:[/bold]")
            console.print(f"  [cyan]{url}[/cyan]")
            raise SystemExit(1)


def _sync_all_courses(dry_run: bool) -> None:
    """Sync all courses that have progress."""
    global_status = get_status()
    courses_with_progress = []
    
    for course_id, course_status in global_status.get("courses", {}).items():
        completed = course_status.get("completed", [])
        if completed:
            courses_with_progress.append((course_id, len(completed)))
    
    if not courses_with_progress:
        console.print("[yellow]No progress to sync across any courses.[/yellow]")
        raise SystemExit(0)
    
    console.print()
    console.print(f"[bold]Syncing {len(courses_with_progress)} course(s):[/bold]")
    
    for course_id, count in courses_with_progress:
        manifest = get_course_manifest(course_id)
        title = manifest.title if manifest else course_id
        console.print(f"  • {title}: {count} challenges")
    
    console.print()
    
    # For --all, we sync one at a time (user can run multiple times)
    # Or we could combine into one URL, but that gets complex
    # For simplicity, just sync the first one and tell them to run again
    
    first_course_id = courses_with_progress[0][0]
    url = generate_sync_url(first_course_id)
    
    if dry_run:
        console.print("[bold]Sync URLs:[/bold]")
        for course_id, _ in courses_with_progress:
            url = generate_sync_url(course_id)
            console.print(f"  [cyan]{url}[/cyan]")
    else:
        # Open first one
        success, _ = open_sync_url(first_course_id)
        
        if success:
            manifest = get_course_manifest(first_course_id)
            console.print(f"[green]✓ Opened sync for {manifest.title if manifest else first_course_id}[/green]")
            
            if len(courses_with_progress) > 1:
                console.print()
                console.print(f"[dim]Run again to sync the remaining {len(courses_with_progress) - 1} course(s)[/dim]")
        else:
            console.print("[red]Failed to open browser[/red]")
            raise SystemExit(1)
