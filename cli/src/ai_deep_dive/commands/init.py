"""The 'init' command - initialize a new course workspace."""

import click
from pathlib import Path
from rich.console import Console
from rich.panel import Panel
from rich.tree import Tree

from ai_deep_dive.config import save_workspace_config, CONFIG_DIR_NAME
from ai_deep_dive.course_loader import initialize_courses
from ai_deep_dive.manifest import get_course_manifest, get_available_courses

console = Console()


@click.command()
@click.argument("course_slug")
@click.option(
    "--dir", "-d",
    "directory",
    default=None,
    help="Directory name to create (defaults to course slug)",
)
@click.option(
    "--force", "-f",
    is_flag=True,
    help="Overwrite existing directory",
)
def init_command(course_slug: str, directory: str | None, force: bool) -> None:
    """Initialize a new course workspace.
    
    Creates a directory with all course challenges scaffolded and ready to edit.
    
    Example:
        ai-deep-dive init build-chatgpt
    """
    # Initialize course data
    initialize_courses()
    
    # Get course manifest
    manifest = get_course_manifest(course_slug)
    
    if not manifest:
        available = get_available_courses()
        console.print(f"[red]Error:[/red] Course '{course_slug}' not found.")
        console.print()
        console.print("[yellow]Available courses:[/yellow]")
        for course in available:
            console.print(f"  • {course.id} - {course.title}")
        raise SystemExit(1)
    
    # Determine target directory
    target_dir = Path(directory or course_slug)
    
    if target_dir.exists() and not force:
        console.print(f"[red]Error:[/red] Directory '{target_dir}' already exists.")
        console.print("Use --force to overwrite.")
        raise SystemExit(1)
    
    # Create directory structure
    console.print(f"[bold]Creating course workspace:[/bold] {manifest.title}")
    console.print()
    
    target_dir.mkdir(parents=True, exist_ok=True)
    
    # Create .ai-deep-dive config
    config = {
        "course": course_slug,
        "version": "1.0.0",
    }
    save_workspace_config(target_dir, config)
    
    # Scaffold challenges
    tree = Tree(f"[bold cyan]{target_dir}/[/bold cyan]")
    config_tree = tree.add(f"[dim]{CONFIG_DIR_NAME}/[/dim]")
    config_tree.add("[dim]config.json[/dim]")
    
    challenges_created = 0
    
    for chapter in manifest.chapters:
        if not chapter.challenges:
            continue
        
        # Create chapter directory
        chapter_dir = target_dir / chapter.slug
        chapter_dir.mkdir(parents=True, exist_ok=True)
        
        chapter_tree = tree.add(f"[cyan]{chapter.slug}/[/cyan]")
        
        for challenge in chapter.challenges:
            # Create challenge file with initial code
            challenge_path = chapter_dir / challenge.filename
            
            # Only write if file doesn't exist or force is set
            if not challenge_path.exists() or force:
                content = _generate_challenge_file(challenge)
                challenge_path.write_text(content)
                challenges_created += 1
            
            # Add to tree
            status_icon = "📝"
            chapter_tree.add(f"{status_icon} [white]{challenge.filename}[/white]")
    
    console.print(tree)
    console.print()
    
    # Summary panel
    summary = f"""
[green]✓[/green] Workspace created: [bold]{target_dir}[/bold]
[green]✓[/green] Course: [bold]{manifest.title}[/bold]
[green]✓[/green] Challenges scaffolded: [bold]{challenges_created}[/bold]

[bold]Next steps:[/bold]
  1. [cyan]cd {target_dir}[/cyan]
  2. Open in your editor
  3. Start with the first challenge!
  4. Run [cyan]ai-deep-dive test 01-01[/cyan] to check your solution
"""
    
    console.print(Panel(summary.strip(), title="🚀 Ready!", border_style="green"))


def _generate_challenge_file(challenge) -> str:
    """Generate the content for a challenge file."""
    lines = []
    
    # Header comment
    lines.append(f'"""')
    lines.append(f'{challenge.title}')
    lines.append(f'Challenge ID: {challenge.id}')
    lines.append(f'Difficulty: {challenge.difficulty}')
    lines.append(f'')
    if challenge.description:
        # Add first paragraph of description
        desc_lines = challenge.description.strip().split('\n\n')[0].split('\n')
        for line in desc_lines:
            lines.append(line)
    lines.append(f'"""')
    lines.append('')
    
    # Initial code
    if challenge.initial_code:
        lines.append(challenge.initial_code.rstrip())
    else:
        # Generate a stub
        args_str = ", ".join(
            f"{arg.name}: {arg.type}" for arg in challenge.arguments
        )
        lines.append(f"def {challenge.function_name}({args_str}):")
        lines.append("    # TODO: Implement this function")
        lines.append("    pass")
    
    lines.append('')
    
    return '\n'.join(lines)
