# Contributing

Install using the README and read `AGENTS.md`. Open an issue for a significant
behavior change. Explain the user problem and the smallest useful solution.

Use synthetic fixtures only. Never commit receipt files from real people,
databases, credentials, `.env`, or logs. Prefer deterministic local processing.
Business rules belong in services reused by API/MCP, not duplicated in clients.

Run pytest, Ruff (check and format), Bandit, Python/npm audits, `npm run build`,
and browser tests before submitting a PR. Include what changed, why, and the
actual checks run. Add meaningful regression tests for deadline/security changes.
Use a separate numbered Alembic migration for schema changes; never edit the
released initial migration or generate tables from changing live models.

Unknown fields must remain unknown. Do not increase extraction confidence by
guessing, quietly mark policies verified, send email, add a paid API dependency,
or weaken loopback/origin controls. Describe any remaining limits honestly.

Contributions are MIT licensed. Please follow `CODE_OF_CONDUCT.md`.
