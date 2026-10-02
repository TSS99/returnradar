from datetime import UTC, date, datetime, timedelta
from zoneinfo import ZoneInfo

from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session

from backend.app.models.entities import Policy, Purchase, PurchaseDocument, Settings
from backend.app.schemas.purchase import PurchaseInput, SettingsInput
from backend.app.services.deadlines import actionable, sync_deadlines, warranty_state


class ServiceError(Exception):
    def __init__(self, message: str, status_code: int = 400):
        self.message = message
        self.status_code = status_code
        super().__init__(message)


def serialize_row(row, exclude=()) -> dict:
    result = {}
    for column in row.__table__.columns:
        if column.name in exclude:
            continue
        value = getattr(row, column.name)
        if isinstance(value, datetime) and value.tzinfo is None:
            value = value.replace(tzinfo=UTC)  # SQLite drops timezone metadata from UTC timestamps.
        result[column.name] = value.isoformat() if isinstance(value, (date, datetime)) else value
    return result


def purchase_dict(purchase: Purchase) -> dict:
    result = serialize_row(purchase)
    result["policies"] = [serialize_row(p) for p in purchase.policies]
    result["deadlines"] = [serialize_row(d) for d in purchase.deadlines]
    result["documents"] = [serialize_row(d, ("storage_reference",)) for d in purchase.documents]
    warranty = next(d for d in purchase.deadlines if d.deadline_type == "warranty")
    result["warranty_status"] = warranty_state(warranty, datetime.now(ZoneInfo(purchase.timezone)).date())
    return result


def get_purchase(session: Session, purchase_id: str) -> Purchase:
    purchase = session.get(Purchase, purchase_id)
    if purchase is None:
        raise ServiceError("Purchase not found", 404)
    return purchase


def save_purchase(session: Session, data: PurchaseInput, purchase_id: str | None = None) -> dict:
    purchase = get_purchase(session, purchase_id) if purchase_id else Purchase()
    fields = data.model_dump(exclude={"policies", "document_ids"})
    if not purchase_id and "timezone" not in data.model_fields_set:
        fields["timezone"] = get_settings(session).timezone
    if data.purchase_amount is not None:
        fields["purchase_amount"] = format(data.purchase_amount, "f")
    if purchase_id:
        # Corrections invalidate automatic provenance unless the caller explicitly re-confirms.
        for key, value in fields.items():
            if key not in {"field_status", "evidence"} and getattr(purchase, key) != value:
                if fields["field_status"].get(key) == "automatically_extracted":
                    fields["field_status"][key] = "manually_entered" if value is not None else "unknown"
    for key, value in fields.items():
        setattr(purchase, key, value)
    session.add(purchase)
    existing = {p.policy_type: p for p in purchase.policies}
    incoming = {p.policy_type for p in data.policies}
    for policy in list(purchase.policies):
        if policy.policy_type not in incoming:
            purchase.policies.remove(policy)
    for item in data.policies:
        policy = existing.get(item.policy_type)
        values = item.model_dump()
        terms_changed = policy is None or any(getattr(policy, key) != value for key, value in values.items())
        if policy is None:
            policy = Policy(**values)
            purchase.policies.append(policy)
        else:
            for key, value in values.items():
                setattr(policy, key, value)
        # This timestamp records a human verification assertion, not a merchant confirmation.
        if policy.verification_status == "verified" and (terms_changed or policy.last_verified_at is None):
            policy.last_verified_at = datetime.now(UTC)
        elif policy.verification_status != "verified":
            policy.last_verified_at = None
    for document_id in set(data.document_ids):
        document = session.get(PurchaseDocument, document_id)
        if document is None or (document.purchase_id and document.purchase_id != purchase.id):
            raise ServiceError("Document is missing or attached to another purchase")
        if document not in purchase.documents:
            purchase.documents.append(document)
    sync_deadlines(purchase)
    session.commit()
    return purchase_dict(purchase)


def list_purchases(
    session: Session,
    *,
    search: str = "",
    merchant: str = "",
    category: str = "",
    status: str = "",
    date_from: date | None = None,
    date_to: date | None = None,
    page: int = 1,
    page_size: int = 20,
) -> dict:
    if page < 1 or page_size < 1 or page_size > 100:
        raise ServiceError("Page must be positive and page size must be between 1 and 100")
    if date_from and date_to and date_from > date_to:
        raise ServiceError("Start date must not be after end date")
    query = select(Purchase)
    if search:
        # LIKE wildcards are escaped so user searches are literal.
        query = query.where(
            or_(
                Purchase.product_name.contains(search, autoescape=True),
                Purchase.merchant_name.contains(search, autoescape=True),
                Purchase.order_number.contains(search, autoescape=True),
            )
        )
    if merchant:
        query = query.where(Purchase.merchant_name == merchant)
    if category:
        query = query.where(Purchase.product_category == category)
    if status:
        query = query.where(Purchase.purchase_status == status)
    if date_from:
        query = query.where(Purchase.purchase_date >= date_from)
    if date_to:
        query = query.where(Purchase.purchase_date <= date_to)
    total = session.scalar(select(func.count()).select_from(query.subquery()))
    items = session.scalars(
        query.order_by(Purchase.created_at.desc()).offset((page - 1) * page_size).limit(page_size)
    ).all()
    return {"items": [purchase_dict(p) for p in items], "total": total, "page": page, "page_size": page_size}


def upcoming_deadlines(session: Session, days: int = 30, confirmed_only: bool = True) -> list[dict]:
    if days < 0 or days > 3650:
        raise ServiceError("Days must be between 0 and 3650")
    items = []
    for purchase in session.scalars(select(Purchase)):
        today = datetime.now(ZoneInfo(purchase.timezone)).date()
        for deadline in purchase.deadlines:
            if not actionable(purchase, deadline.deadline_type):
                continue
            if confirmed_only and deadline.verification_status != "confirmed":
                continue
            if deadline.deadline_date and today <= deadline.deadline_date <= today + timedelta(days=days):
                items.append(
                    {
                        **serialize_row(deadline),
                        "product_name": purchase.product_name,
                        "merchant_name": purchase.merchant_name,
                        "is_demo": purchase.is_demo,
                        "days_remaining": (deadline.deadline_date - today).days,
                    }
                )
    return sorted(items, key=lambda d: (d["deadline_date"], d["product_name"]))


def get_settings(session: Session) -> Settings:
    settings = session.get(Settings, 1)
    if settings is None:
        settings = Settings(id=1, timezone="UTC", reminders_enabled=True, reminder_offsets=[7, 3, 1, 0])
        session.add(settings)
        session.commit()
    return settings


def update_settings(session: Session, data: SettingsInput) -> dict:
    settings = get_settings(session)
    for key, value in data.model_dump().items():
        setattr(settings, key, value)
    session.commit()
    return serialize_row(settings)
