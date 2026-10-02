"""Initial local schema. Future migrations must describe changes explicitly."""

from alembic import op
from sqlalchemy import (
    JSON,
    Boolean,
    Column,
    Date,
    DateTime,
    ForeignKey,
    Integer,
    String,
    Text,
    UniqueConstraint,
)

revision = "0001"
down_revision = None
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "purchases",
        Column("id", String(36), primary_key=True),
        Column("merchant_name", String(200)),
        Column("product_name", String(300), nullable=False),
        Column("product_category", String(80)),
        Column("order_number", String(120)),
        Column("invoice_number", String(120)),
        Column("purchase_date", Date),
        Column("delivery_date", Date),
        Column("purchase_amount", String(40)),
        Column("currency", String(3)),
        Column("purchase_status", String(30)),
        Column("timezone", String(80)),
        Column("field_status", JSON),
        Column("evidence", JSON),
        Column("notes", Text),
        Column("is_demo", Boolean, nullable=False),
        Column("created_at", DateTime(timezone=True)),
        Column("updated_at", DateTime(timezone=True)),
    )
    op.create_table(
        "documents",
        Column("id", String(36), primary_key=True),
        Column("purchase_id", String(36), ForeignKey("purchases.id", ondelete="CASCADE")),
        Column("original_filename", String(200), nullable=False),
        Column("storage_reference", String(80), nullable=False, unique=True),
        Column("document_type", String(50)),
        Column("content_hash", String(64), nullable=False),
        Column("upload_timestamp", DateTime(timezone=True)),
    )
    op.create_index("ix_documents_purchase_id", "documents", ["purchase_id"])
    op.create_table(
        "policies",
        Column("id", String(36), primary_key=True),
        Column("purchase_id", String(36), ForeignKey("purchases.id", ondelete="CASCADE"), nullable=False),
        Column("policy_type", String(20), nullable=False),
        Column("policy_source", String(200)),
        Column("source_reference", String(500)),
        Column("policy_text", Text),
        Column("duration", Integer),
        Column("duration_unit", String(10)),
        Column("start_date_basis", String(30)),
        Column("start_date", Date),
        Column("start_date_verified", Boolean),
        Column("cutoff_date", Date),
        Column("provider", String(200)),
        Column("verification_status", String(20)),
        Column("last_verified_at", DateTime(timezone=True)),
        UniqueConstraint("purchase_id", "policy_type"),
    )
    op.create_table(
        "deadlines",
        Column("id", String(36), primary_key=True),
        Column("purchase_id", String(36), ForeignKey("purchases.id", ondelete="CASCADE"), nullable=False),
        Column("deadline_type", String(20), nullable=False),
        Column("deadline_date", Date),
        Column("timezone", String(80), nullable=False),
        Column("verification_status", String(20), nullable=False),
        Column("calculation_basis", JSON, nullable=False),
        UniqueConstraint("purchase_id", "deadline_type"),
    )
    op.create_index("ix_deadlines_purchase_id", "deadlines", ["purchase_id"])
    op.create_table(
        "reminders",
        Column("id", String(36), primary_key=True),
        Column("deadline_id", String(36), ForeignKey("deadlines.id", ondelete="CASCADE"), nullable=False),
        Column("reminder_type", String(30)),
        Column("scheduled_at", DateTime(timezone=True), nullable=False),
        Column("delivered_at", DateTime(timezone=True)),
        Column("delivery_status", String(20)),
        Column("idempotency_key", String(200), nullable=False, unique=True),
    )
    op.create_index("ix_reminders_deadline_id", "reminders", ["deadline_id"])
    op.create_table(
        "notifications",
        Column("id", String(36), primary_key=True),
        Column("purchase_id", String(36), ForeignKey("purchases.id", ondelete="CASCADE"), nullable=False),
        Column("message", String(500), nullable=False),
        Column("created_at", DateTime(timezone=True)),
        Column("read", Boolean),
        Column("idempotency_key", String(200), nullable=False, unique=True),
    )
    op.create_table(
        "settings",
        Column("id", Integer, primary_key=True),
        Column("timezone", String(80)),
        Column("reminders_enabled", Boolean),
        Column("reminder_offsets", JSON),
    )


def downgrade():
    for table in (
        "settings",
        "notifications",
        "reminders",
        "deadlines",
        "policies",
        "documents",
        "purchases",
    ):
        op.drop_table(table)
