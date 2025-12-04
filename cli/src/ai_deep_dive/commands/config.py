"""The 'config' command - manage CLI configuration."""

import click
from rich.console import Console
from rich.table import Table

from ai_deep_dive.config import (
    get_global_config,
    get_website_url,
    set_website_url,
    DEFAULT_WEBSITE_URL,
)

console = Console()


@click.group()
def config_command() -> None:
    """Manage CLI configuration.
    
    View or update global settings like the website URL.
    
    Examples:
        ai-deep-dive config show
        ai-deep-dive config set-url https://my-site.com
        ai-deep-dive config reset-url
    """
    pass


@config_command.command("show")
def show_config() -> None:
    """Show current configuration."""
    config = get_global_config()
    
    table = Table(title="Configuration", show_header=True)
    table.add_column("Setting", style="cyan")
    table.add_column("Value", style="white")
    table.add_column("Source", style="dim")
    
    # Website URL
    current_url = get_website_url()
    is_custom = config.get("website_url") is not None
    table.add_row(
        "website_url",
        current_url,
        "custom" if is_custom else "default"
    )
    
    console.print(table)
    
    if not is_custom:
        console.print()
        console.print("[dim]Tip: Use 'ai-deep-dive config set-url <url>' to use a custom website[/dim]")


@config_command.command("set-url")
@click.argument("url")
def set_url(url: str) -> None:
    """Set a custom website URL.
    
    Use this if you're hosting your own version of the platform.
    
    Example:
        ai-deep-dive config set-url https://my-learning-site.com
    """
    # Basic validation
    if not url.startswith("http://") and not url.startswith("https://"):
        console.print("[red]Error:[/red] URL must start with http:// or https://")
        raise SystemExit(1)
    
    set_website_url(url)
    console.print(f"[green]✓[/green] Website URL set to: [cyan]{url}[/cyan]")


@config_command.command("reset-url")
def reset_url() -> None:
    """Reset website URL to the default.
    
    Removes any custom URL and uses the default platform URL.
    """
    config = get_global_config()
    
    if "website_url" in config:
        del config["website_url"]
        from ai_deep_dive.config import save_global_config
        save_global_config(config)
        console.print(f"[green]✓[/green] Website URL reset to default: [cyan]{DEFAULT_WEBSITE_URL}[/cyan]")
    else:
        console.print(f"[yellow]Already using default URL:[/yellow] [cyan]{DEFAULT_WEBSITE_URL}[/cyan]")
