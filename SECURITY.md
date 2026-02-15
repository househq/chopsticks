# Security Policy

## Reporting a Vulnerability

Do not open public issues for security vulnerabilities.

Send a report with:
- a clear description of the impact
- reproduction steps (PoC if possible)
- affected version/commit and environment

to the repository owner or maintainers through a private channel.

## What to Include
- Logs with secrets removed
- Whether agents/pools were involved
- Whether the issue affects controller, agents, dashboard, or FunHub

## Token/Key Safety
If you ever accidentally share:
- `DISCORD_TOKEN`
- agent bot tokens
- `AGENT_TOKEN_KEY`
- dashboard auth secrets

assume they are compromised and rotate immediately.

