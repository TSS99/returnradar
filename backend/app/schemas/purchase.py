import re
from datetime import date
from decimal import Decimal
from typing import Literal
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

Status = Literal["tracking", "returned", "refunded", "kept", "warranty_claimed", "archived"]
FieldStatus = Literal["automatically_extracted", "user_confirmed", "manually_entered", "unknown"]
PolicyType = Literal["return", "warranty"]


def valid_timezone(value: str) -> str:
    try:
        ZoneInfo(value)
    except (ZoneInfoNotFoundError, ValueError) as exc:
        raise ValueError("Use a valid IANA timezone such as Asia/Kolkata or Europe/London") from exc
    return value


class StrictModel(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True, allow_inf_nan=False)


class PolicyInput(StrictModel):
    policy_type: PolicyType
    policy_source: str | None = Field(None, max_length=200)
    source_reference: str | None = Field(None, max_length=500)
    policy_text: str = Field("", max_length=10_000)
    duration: int | None = Field(None, ge=0, le=36_500)
    duration_unit: Literal["days", "months", "years"] = "days"
    start_date_basis: Literal["purchase_date", "delivery_date", "warranty_start", "explicit", "unknown"] = (
        "unknown"
    )
    start_date: date | None = None
    start_date_verified: bool = False
    cutoff_date: date | None = None
    provider: str | None = Field(None, max_length=200)
    verification_status: Literal["unknown", "unverified", "verified"] = "unknown"

    @model_validator(mode="after")
    def check_terms(self):
        if self.cutoff_date and self.duration is not None:
            raise ValueError("Use either an explicit cutoff or a duration, not both")
        if self.cutoff_date and self.start_date and self.start_date > self.cutoff_date:
            raise ValueError("Policy start date cannot be after its cutoff")
        if self.cutoff_date and self.start_date_basis != "explicit":
            raise ValueError("A cutoff date requires the explicit date basis")
        if self.start_date_basis == "explicit" and self.duration is not None:
            raise ValueError("An explicit date basis requires a cutoff, not a duration")
        if self.verification_status == "verified":
            if not self.policy_source or not (self.policy_text or self.source_reference):
                raise ValueError("Verified policies require a source and terms or source reference")
            if self.duration is None and not self.cutoff_date:
                raise ValueError("Verified policies require a duration or cutoff date")
            if self.duration is not None and self.start_date_basis == "unknown":
                raise ValueError("Verified durations require an explicitly supplied starting date basis")
        return self


class PurchaseInput(StrictModel):
    merchant_name: str | None = Field(None, max_length=200)
    product_name: str = Field(min_length=1, max_length=300)
    product_category: str = Field("Other", min_length=1, max_length=80)
    order_number: str | None = Field(None, max_length=120)
    invoice_number: str | None = Field(None, max_length=120)
    purchase_date: date | None = None
    delivery_date: date | None = None
    purchase_amount: Decimal | None = Field(None, ge=0, max_digits=18, decimal_places=4)
    currency: str | None = Field(None, pattern=r"^[A-Z]{3}$")
    purchase_status: Status = "tracking"
    timezone: str = "UTC"
    field_status: dict[str, FieldStatus] = Field(default_factory=dict, max_length=30)
    evidence: dict[str, str] = Field(default_factory=dict, max_length=30)
    policies: list[PolicyInput] = Field(default_factory=list, max_length=2)
    document_ids: list[str] = Field(default_factory=list, max_length=10)
    notes: str = Field("", max_length=5000)

    _timezone = field_validator("timezone")(valid_timezone)

    @field_validator("document_ids")
    @classmethod
    def safe_ids(cls, values):
        from uuid import UUID

        for value in values:
            UUID(value)
        return values

    @model_validator(mode="after")
    def consistent_fields(self):
        if len({p.policy_type for p in self.policies}) != len(self.policies):
            raise ValueError("Only one policy per type is supported")
        if self.delivery_date and self.purchase_date and self.delivery_date < self.purchase_date:
            raise ValueError("Delivery date cannot be before purchase date")
        allowed = set(type(self).model_fields) - {"policies", "document_ids", "field_status", "evidence"}
        if set(self.field_status) - allowed or set(self.evidence) - allowed:
            raise ValueError("Evidence and field status keys must name purchase fields")
        if any(len(v) > 2000 for v in self.evidence.values()):
            raise ValueError("Extraction evidence must be no more than 2000 characters per field")
        for key in allowed:
            value = getattr(self, key)
            if value is None or value == "":
                self.field_status[key] = "unknown"
            elif key not in self.field_status:
                self.field_status[key] = "manually_entered"
        return self


class SettingsInput(StrictModel):
    timezone: str = "UTC"
    reminders_enabled: bool = True
    reminder_offsets: list[int] = Field(default_factory=lambda: [7, 3, 1, 0], max_length=10)

    _timezone = field_validator("timezone")(valid_timezone)

    @field_validator("reminder_offsets")
    @classmethod
    def offsets(cls, values):
        if any(v < 0 or v > 365 for v in values):
            raise ValueError("Reminder days must be between 0 and 365")
        return sorted(set(values), reverse=True)


class RequestInput(StrictModel):
    kind: Literal["return", "refund", "warranty", "replacement"] = "return"
    reason: str = Field("", max_length=2000)


def safe_download_name(name: str) -> str:
    return re.sub(r"[^\w .-]", "_", name)[:180] or "receipt.pdf"
