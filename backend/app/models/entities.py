from datetime import UTC, datetime
from uuid import uuid4

from sqlalchemy import JSON, Boolean, Date, DateTime, ForeignKey, Integer, String, Text, UniqueConstraint
from sqlalchemy.orm import DeclarativeBase, mapped_column, relationship


def identifier():
    return str(uuid4())


def utcnow():
    return datetime.now(UTC)


class Base(DeclarativeBase):
    pass


class Purchase(Base):
    __tablename__ = "purchases"
    id = mapped_column(String(36), primary_key=True, default=identifier)
    merchant_name = mapped_column(String(200))
    product_name = mapped_column(String(300), nullable=False)
    product_category = mapped_column(String(80), default="Other")
    order_number = mapped_column(String(120))
    invoice_number = mapped_column(String(120))
    purchase_date = mapped_column(Date)
    delivery_date = mapped_column(Date)
    purchase_amount = mapped_column(String(40))  # Exact decimal string; never a float.
    currency = mapped_column(String(3))
    purchase_status = mapped_column(String(30), default="tracking")
    timezone = mapped_column(String(80), default="UTC")
    field_status = mapped_column(JSON, default=dict)
    evidence = mapped_column(JSON, default=dict)
    notes = mapped_column(Text, default="")
    is_demo = mapped_column(Boolean, default=False, nullable=False)
    created_at = mapped_column(DateTime(timezone=True), default=utcnow)
    updated_at = mapped_column(DateTime(timezone=True), default=utcnow, onupdate=utcnow)
    policies = relationship("Policy", cascade="all, delete-orphan", back_populates="purchase")
    deadlines = relationship("Deadline", cascade="all, delete-orphan", back_populates="purchase")
    documents = relationship("PurchaseDocument", cascade="all, delete-orphan")


class PurchaseDocument(Base):
    __tablename__ = "documents"
    id = mapped_column(String(36), primary_key=True, default=identifier)
    purchase_id = mapped_column(ForeignKey("purchases.id", ondelete="CASCADE"), index=True)
    original_filename = mapped_column(String(200), nullable=False)
    storage_reference = mapped_column(String(80), unique=True, nullable=False)
    document_type = mapped_column(String(50), default="application/pdf")
    content_hash = mapped_column(String(64), nullable=False)
    upload_timestamp = mapped_column(DateTime(timezone=True), default=utcnow)


class Policy(Base):
    __tablename__ = "policies"
    __table_args__ = (UniqueConstraint("purchase_id", "policy_type"),)
    id = mapped_column(String(36), primary_key=True, default=identifier)
    purchase_id = mapped_column(ForeignKey("purchases.id", ondelete="CASCADE"), nullable=False)
    policy_type = mapped_column(String(20), nullable=False)
    policy_source = mapped_column(String(200))
    source_reference = mapped_column(String(500))
    policy_text = mapped_column(Text, default="")
    duration = mapped_column(Integer)
    duration_unit = mapped_column(String(10), default="days")
    start_date_basis = mapped_column(String(30), default="unknown")
    start_date = mapped_column(Date)
    start_date_verified = mapped_column(Boolean, default=False)
    cutoff_date = mapped_column(Date)
    provider = mapped_column(String(200))
    verification_status = mapped_column(String(20), default="unknown")
    last_verified_at = mapped_column(DateTime(timezone=True))
    purchase = relationship("Purchase", back_populates="policies")


class Deadline(Base):
    __tablename__ = "deadlines"
    __table_args__ = (UniqueConstraint("purchase_id", "deadline_type"),)
    id = mapped_column(String(36), primary_key=True, default=identifier)
    purchase_id = mapped_column(ForeignKey("purchases.id", ondelete="CASCADE"), nullable=False, index=True)
    deadline_type = mapped_column(String(20), nullable=False)
    deadline_date = mapped_column(Date)
    timezone = mapped_column(String(80), nullable=False)
    verification_status = mapped_column(String(20), nullable=False)
    calculation_basis = mapped_column(JSON, nullable=False)
    purchase = relationship("Purchase", back_populates="deadlines")
    reminders = relationship("Reminder", cascade="all, delete-orphan")


class Reminder(Base):
    __tablename__ = "reminders"
    id = mapped_column(String(36), primary_key=True, default=identifier)
    deadline_id = mapped_column(ForeignKey("deadlines.id", ondelete="CASCADE"), nullable=False, index=True)
    reminder_type = mapped_column(String(30), default="in_app")
    scheduled_at = mapped_column(DateTime(timezone=True), nullable=False)
    delivered_at = mapped_column(DateTime(timezone=True))
    delivery_status = mapped_column(String(20), default="pending")
    idempotency_key = mapped_column(String(200), unique=True, nullable=False)


class Notification(Base):
    __tablename__ = "notifications"
    id = mapped_column(String(36), primary_key=True, default=identifier)
    purchase_id = mapped_column(ForeignKey("purchases.id", ondelete="CASCADE"), nullable=False)
    message = mapped_column(String(500), nullable=False)
    created_at = mapped_column(DateTime(timezone=True), default=utcnow)
    read = mapped_column(Boolean, default=False)
    idempotency_key = mapped_column(String(200), unique=True, nullable=False)


class Settings(Base):
    __tablename__ = "settings"
    id = mapped_column(Integer, primary_key=True, default=1)
    timezone = mapped_column(String(80), default="UTC")
    reminders_enabled = mapped_column(Boolean, default=True)
    reminder_offsets = mapped_column(JSON, default=lambda: [7, 3, 1, 0])
