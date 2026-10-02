# Local setup and data ownership

Follow README quick start. Python 3.11+ and Node 22.12+ are required. Use an
isolated virtual environment and `npm ci` with the committed lockfile. Runtime
dependencies are permissively licensed and free; nothing activates a paid service.

On macOS/Linux:

```bash
python3 -m venv .venv
source .venv/bin/activate
python -m pip install -r requirements-dev.lock
python -m pip install --no-deps -e .
cd frontend && npm ci
```

On Windows, create the same environment with `python -m venv .venv`, then
`.venv\Scripts\Activate.ps1`. Install commands are identical. Start the backend
from the repository root; start the frontend from its own directory.

## Data directory

Default: repository-root `private_data/`, containing `returnradar.sqlite3`,
SQLite WAL/SHM files while running, and `uploads/<generated UUID>.pdf`.
Choose a private existing account folder via the environment:

```bash
export RETURNRADAR_DATA_DIR=/absolute/path/to/private-returnradar
python -m uvicorn backend.app.main:app --host 127.0.0.1 --port 8000
```

Use this exact directory in your MCP config too. Do not share the directory with
untrusted users. Data files are not app-encrypted. `.env.example` documents
variables; it is not read automatically. `RETURNRADAR_WORKER_ENABLED=false`
turns off the backend worker for tests or maintenance.

## Backups and restore

Settings → Download backup creates a ZIP containing JSON records/preferences/
notifications and original PDFs. This is a readable archival export, not a
one-click restore image. There is no ZIP upload/automatic restore feature.

For a fully restorable snapshot, **stop backend, MCP and scheduled workers** and
privately copy the entire data directory, including uploads. Once stopped, SQLite
will finish its outstanding writes. Restore by stopping all processes, moving
aside the current data directory, and copying that saved directory into the
configured location. Restart with the same or newer compatible application
version; Alembic applies later migrations. Preserve the original backup.

Data copies/exports are private artifacts and must not be committed to Git.
The app's all-data deletion does not remove external backups.

## Reminders

The backend runs every minute. Alternatively schedule this one-shot command
using your operating system, with an absolute Python executable, working directory
and data environment:

```bash
python -m scripts.reminder_worker
```

No processing happens while the machine/process is off. It catches up due
offsets on its next run. In-app delivery does not imply an OS popup or email.
The worker logs generated counts only. Settings lets you disable reminders or
choose offsets from 0 to 365 days. Previously generated history remains.

## Production frontend on your own computer

`npm run build` checks TypeScript and creates `frontend/dist/`. For the MVP,
the documented two-terminal development server is the primary launch path.
Never use `--host 0.0.0.0` as a shortcut. See deployment documentation for the
separate work required for a hosted authenticated version.
