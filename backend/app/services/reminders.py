from datetime import UTC, datetime, time, timedelta
from typing import Protocol
from zoneinfo import ZoneInfo

from sqlalchemy import select
from sqlalchemy.dialects.sqlite import insert
from sqlalchemy.orm import Session

from backend.app.models.entities import Deadline, Notification, Reminder, identifier
from backend.app.services.deadlines import actionable
from backend.app.services.purchases import get_settings


class NotificationChannel(Protocol):
    def deliver(
        self, session: Session, *, purchase_id: str, message: str, key: str, now: datetime
    ) -> bool: ...


class InAppChannel:
    def deliver(self, session: Session, *, purchase_id: str, message: str, key: str, now: datetime) -> bool:
        statement = insert(Notification).values(
            id=identifier(),
            purchase_id=purchase_id,
            message=message,
            idempotency_key=key,
            created_at=now,
            read=False,
        )
        result = session.execute(statement.on_conflict_do_nothing(index_elements=["idempotency_key"]))
        return result.rowcount == 1


def process_reminders(
    session: Session, now: datetime | None = None, channel: NotificationChannel | None = None
) -> dict:
    now = now or datetime.now(UTC)
    if now.tzinfo is None:
        raise ValueError("Reminder processing requires an aware datetime")
    channel = channel or InAppChannel()
    settings = get_settings(session)
    if not settings.reminders_enabled:
        return {"generated": 0, "enabled": False}
    count = 0
    for deadline in session.scalars(select(Deadline)):
        if deadline.verification_status != "confirmed" or not deadline.deadline_date:
            continue
        purchase = deadline.purchase
        if not actionable(purchase, deadline.deadline_type):
            continue
        for offset in settings.reminder_offsets:
            scheduled = datetime.combine(
                deadline.deadline_date - timedelta(days=offset), time(9), tzinfo=ZoneInfo(deadline.timezone)
            ).astimezone(UTC)
            if scheduled > now:
                continue
            key = f"{deadline.id}:{deadline.deadline_date}:{deadline.timezone}:{offset}"
            reminder = session.scalar(select(Reminder).where(Reminder.idempotency_key == key))
            if reminder and reminder.delivery_status == "delivered":
                continue
            if reminder is None:
                statement = insert(Reminder).values(
                    id=identifier(),
                    deadline_id=deadline.id,
                    scheduled_at=scheduled,
                    delivery_status="pending",
                    reminder_type="in_app",
                    idempotency_key=key,
                )
                session.execute(statement.on_conflict_do_nothing(index_elements=["idempotency_key"]))
                reminder = session.scalar(select(Reminder).where(Reminder.idempotency_key == key))
            remaining = (deadline.deadline_date - now.astimezone(ZoneInfo(deadline.timezone)).date()).days
            wording = f"in {remaining} days" if remaining > 0 else "today" if remaining == 0 else "has passed"
            message = f"{purchase.product_name[:300]}: {deadline.deadline_type} deadline {wording} "
            message += f"({deadline.deadline_date}, {deadline.timezone})."
            if channel.deliver(session, purchase_id=purchase.id, message=message, key=key, now=now):
                count += 1
            reminder.delivery_status = "delivered"
            reminder.delivered_at = now
    session.commit()
    return {"generated": count, "enabled": True}
