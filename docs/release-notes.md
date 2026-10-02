# ReturnRadar v0.1.0

A local, single-user purchase, return and warranty tracker with official Python
MCP tools. Core operation needs no paid API, account or hosted infrastructure.

Includes text-PDF extraction/review, purchase CRUD and filters, verified/unknown
deadline calculation, configurable in-app reminders with catch-up/idempotency,
editable request drafts, light/dark responsive screens, CSV/JSON export,
receipt-inclusive archival backup, local deletion, Alembic migrations, and a
portable local plugin with Codex compatibility.

Only explicitly enabled fictional records appear in demo screenshots. All tests
use synthetic data. See the README for exact installation/start/MCP commands.

Limitations: no OCR, external notification delivery, merchant integrations,
automatic request sending, authenticated hosted service or public directory
registration. Deadlines are date-only and depend on user-verified applicable
terms. The local backend/computer must run to process reminders. Data is not
encrypted at rest. Read SECURITY.md and PRIVACY.md before use.

The plugin ZIP requires an installed local ReturnRadar runtime and a client
that supports stdio. It does not include private data or machine configuration.

Expenditure: INR 0.
