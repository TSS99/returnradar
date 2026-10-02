"""One-shot catch-up worker. Suitable for a free local OS scheduler."""

from backend.app.db.session import SessionLocal, engine, migrate
from backend.app.services.reminders import process_reminders

migrate(engine)
with SessionLocal() as session:
    result = process_reminders(session)
print(f"Generated {result['generated']} in-app reminders")
