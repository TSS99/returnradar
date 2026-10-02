# Architecture

The API and MCP adapters delegate to the same synchronous SQLAlchemy services.
Each request/tool owns one session. SQLite foreign keys and cascades are enabled,
with WAL and a 30-second lock timeout. Alembic upgrades the database on startup.
The initial migration freezes the schema; later changes need numbered revisions.

## Boundaries

- `schemas/`: Pydantic input validation and field provenance.
- `models/`: relational purchase, document, policy, deadline, reminder,
  notification and settings entities.
- `services/purchases.py`: CRUD, filtering, pagination and serialization.
- `services/deadlines.py`: calculation, verification and actionable-status rules.
- `services/documents.py` and `utils/pdf_worker.py`: validation/storage and isolated parsing.
- `services/extraction.py`: deterministic label-based suggestions/evidence.
- `services/reminders.py`: notification abstraction, schedule and catch-up.
- `services/requests.py`: deterministic editable drafts; never sends.
- `api/routes.py`, `mcp_server/server.py`: protocol adapters only.
- `frontend/`: React screens, typed API client, theme and hash navigation.

No external model, merchant scraper, queue, cache, microservice or cloud database
is needed. Future identity/tenant checks must be added to the service access
boundary and every query, not just hidden in the frontend.

## Deadline semantics

An unknown policy/start yields a null date. A known duration/start can produce
a tentative date. A confirmed date requires policy verification plus verified
start provenance (`manually_entered` or `user_confirmed`), or a verified explicit
cutoff. Warranty-specific starting dates have a separate verification flag.

The duration convention is `start + N days/months/years`. Calendar month/year
arithmetic clamps to the last valid day. No assumption is made about merchant
inclusive counting, weekends, holidays, exact hours or exceptions. Enter the
merchant's explicit cutoff when those differ. Cutoffs are date-only and retain
the purchase's IANA timezone. User verification timestamps record the user's
assertion, never a live merchant check.

Calculated rows remain stable across unchanged edits so reminders do not resend.
A changed date, verification status or timezone clears its schedule; notification
keys contain the deadline ID, cutoff, timezone and offset. SQLite uniqueness and
conflict-ignore prevent duplicate in-app messages across retried runs.

Closed purchase states suppress actionable reminders/calendar entries. Kept
items suppress returns but may retain warranty reminders. Warranty claimed
suppresses warranty reminders. Local status is not evidence of merchant action.

## Processing and extension points

PDF parsing receives bounded stdin bytes in a fixed local subprocess. Neither
receipt text nor user input becomes command text. Extraction output contains
only relevant suggestions, bounded evidence, confidence and warnings; full text
is not stored separately. Original PDFs remain private local attachments.

`NotificationChannel` separates delivery from scheduling. An optional future
email adapter must accept user credentials outside source control and require
clear setup; it must not imply successful delivery on failure. A merchant-policy
adapter should return source/terms/verification evidence to this same calculation
service, without auto-verifying a recognized merchant. No external adapters are
activated in 0.1.

The backend runs reminders every minute and the one-shot worker can be run by
an OS scheduler. Dates are scheduled at 9 am local time and stored in UTC.
The worker catches up every due configured offset; expired dates are explicitly
described as passed. Unique offsets are idempotent. Notifications remain visible
until read or associated data is deleted.
