"""Main CLI entry point for ai-deep-dive."""

import click

from ai_deep_dive import __version__


@click.command()
@click.version_option(version=__version__, prog_name="ai-deep-dive")
def cli() -> None:
    """AI Deep Dive CLI."""
    click.echo("CLI is temporarily frozen. A project-focused CLI is coming soon.")


def main() -> None:
    """Entry point for the CLI."""
    cli()


if __name__ == "__main__":
    main()
