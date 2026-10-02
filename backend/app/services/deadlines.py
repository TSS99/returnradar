from datetime import UTC, date, timedelta

from dateutil.relativedelta import relativedelta

from backend.app.models.entities import Deadline, Policy, Purchase


def calculate(purchase: Purchase, policy: Policy | None, kind: str) -> dict:
    basis = {"policy_source": None, "reason": "No policy has been supplied", "start_date": None}
    result = {"deadline_date": None, "verification_status": "unknown", "calculation_basis": basis}
    if policy is None:
        return result
    basis.update(
        {
            "policy_source": policy.policy_source,
            "source_reference": policy.source_reference,
            "policy_verification": policy.verification_status,
            "start_date_basis": policy.start_date_basis,
            "duration": policy.duration,
            "duration_unit": policy.duration_unit,
            "last_verified_at": policy.last_verified_at.replace(tzinfo=UTC).isoformat()
            if policy.last_verified_at
            else None,
            "reason": "Required policy information is missing",
        }
    )
    if policy.cutoff_date:
        deadline = policy.cutoff_date
        inputs_verified = True
        if policy.start_date and policy.start_date_verified:
            basis["start_date"] = policy.start_date.isoformat()
        basis["reason"] = "Explicit cutoff supplied by the user"
    else:
        if policy.start_date_basis == "warranty_start":
            start = policy.start_date
            inputs_verified = policy.start_date_verified
        elif policy.start_date_basis in {"purchase_date", "delivery_date"}:
            start = getattr(purchase, policy.start_date_basis)
            inputs_verified = purchase.field_status.get(policy.start_date_basis) in {
                "user_confirmed",
                "manually_entered",
            }
        else:
            start = None
            inputs_verified = False
        if start is None:
            basis["reason"] = (
                "Window starting basis is unknown"
                if policy.start_date_basis == "unknown"
                else (f"Missing {policy.start_date_basis.replace('_', ' ')}")
            )
            return result
        basis["start_date"] = start.isoformat()
        if policy.duration is None:
            return result
        try:
            if policy.duration_unit == "days":
                deadline = start + timedelta(days=policy.duration)
            else:
                delta = {policy.duration_unit: policy.duration}
                deadline = start + relativedelta(**delta)
        except (ValueError, OverflowError):
            basis["reason"] = "The calculated date is outside the supported calendar"
            return result
        basis_label = (
            "specified start date"
            if policy.start_date_basis == "warranty_start"
            else (policy.start_date_basis.replace("_", " "))
        )
        basis["reason"] = f"{policy.duration} {policy.duration_unit} from {basis_label}"
    result["deadline_date"] = deadline
    confirmed = policy.verification_status == "verified" and inputs_verified
    result["verification_status"] = "confirmed" if confirmed else "tentative"
    if not confirmed:
        basis["reason"] += "; policy or starting date needs verification"
    # Date precision is deliberate: the MVP cannot determine merchant-specific time-of-day cutoffs.
    basis["cutoff_precision"] = "date_only"
    basis["deadline_type"] = kind
    return result


def sync_deadlines(purchase: Purchase) -> None:
    for kind in ("return", "warranty"):
        policy = next((p for p in purchase.policies if p.policy_type == kind), None)
        values = calculate(purchase, policy, kind)
        deadline = next((d for d in purchase.deadlines if d.deadline_type == kind), None)
        if deadline is None:
            deadline = Deadline(deadline_type=kind, timezone=purchase.timezone, **values)
            purchase.deadlines.append(deadline)
        else:
            changed = (
                deadline.deadline_date != values["deadline_date"]
                or deadline.verification_status != values["verification_status"]
                or deadline.timezone != purchase.timezone
            )
            if changed:
                deadline.reminders.clear()
            for name, value in values.items():
                setattr(deadline, name, value)
            deadline.timezone = purchase.timezone


def actionable(purchase: Purchase, kind: str) -> bool:
    if purchase.purchase_status in {"archived", "returned", "refunded"}:
        return False
    if kind == "return" and purchase.purchase_status == "kept":
        return False
    if kind == "warranty" and purchase.purchase_status == "warranty_claimed":
        return False
    return True


def warranty_state(deadline: Deadline, today: date) -> str:
    if deadline.verification_status != "confirmed" or not deadline.deadline_date:
        return "unknown"
    start = deadline.calculation_basis.get("start_date")
    if start and date.fromisoformat(start) > today:
        return "not_started"
    if deadline.deadline_date < today:
        return "expired"
    if not start:
        return "end_date_confirmed"
    return "expiring_soon" if (deadline.deadline_date - today).days <= 30 else "active"
