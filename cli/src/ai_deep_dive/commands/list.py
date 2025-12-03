"""The 'list' command - list available courses."""

import click
from rich.console import Console
from rich.table import Table

from ai_deep_dive.course_loader import initialize_courses
from ai_deep_dive.manifest import get_available_courses

console = Console()


@click.command(name="list")
@click.option(
    "--verbose", "-v",
    is_flag=True,
    help="Show detailed information about each course",
)
def list_command(verbose: bool) -> None:
    """List all available courses.
    
    Shows courses that can be initialized with 'ai-deep-dive init'.
    
    Examples:
        ai-deep-dive list
        ai-deep-dive list --verbose
    """
    # Initialize course data
    initialize_courses()
    
    courses = get_available_courses()
    
    if not courses:
        console.print("[yellow]No courses available.[/yellow]")
        console.print()
        console.print("This might mean the course content couldn't be loaded.")
        console.print("Check that you're running from the correct directory.")
        raise SystemExit(1)
    
    console.print()
    console.print("[bold]Available Courses[/bold]")
    console.print()
    
    if verbose:
        for course in courses:
            all_challenges = course.get_all_challenges()
            
            console.print(f"[bold cyan]{course.id}[/bold cyan]")
            console.print(f"  [bold]{course.title}[/bold]")
            if course.description:
                console.print(f"  [dim]{course.description}[/dim]")
            console.print(f"  Chapters: {len(course.chapters)}")
            console.print(f"  Challenges: {len(all_challenges)}")
            console.print()
            
            # List chapters
            for chapter in course.chapters:
                ch_count = len(chapter.challenges)
                console.print(f"    {chapter.num}. {chapter.title} [dim]({ch_count} challenges)[/dim]")
            
            console.print()
    else:
        table = Table(show_header=True, header_style="bold")
        table.add_column("ID", style="cyan")
        table.add_column("Title")
        table.add_column("Chapters", justify="right")
        table.add_column("Challenges", justify="right")
        
        for course in courses:
            all_challenges = course.get_all_challenges()
            table.add_row(
                course.id,
                course.title,
                str(len(course.chapters)),
                str(len(all_challenges)),
            )
        
        console.print(table)
    
    console.print()
    console.print("[dim]To start a course:[/dim]")
    console.print("  [cyan]ai-deep-dive init <course-id>[/cyan]")
