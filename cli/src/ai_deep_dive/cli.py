"""Main CLI entry point for ai-deep-dive."""

import click

from ai_deep_dive import __version__
from ai_deep_dive.commands.init import init_command
from ai_deep_dive.commands.test import test_command
from ai_deep_dive.commands.status import status_command
from ai_deep_dive.commands.list import list_command
from ai_deep_dive.commands.sync import sync_command


@click.group()
@click.version_option(version=__version__, prog_name="ai-deep-dive")
@click.pass_context
def cli(ctx: click.Context) -> None:
    """AI Deep Dive - Learn ML by building from scratch.
    
    Work through interactive challenges locally with full editor support.
    """
    ctx.ensure_object(dict)


# Register commands
cli.add_command(init_command, name="init")
cli.add_command(test_command, name="test")
cli.add_command(status_command, name="status")
cli.add_command(list_command, name="list")
cli.add_command(sync_command, name="sync")


def main() -> None:
    """Entry point for the CLI."""
    cli()


if __name__ == "__main__":
    main()
