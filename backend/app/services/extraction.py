import re
from datetime import date, datetime
from decimal import Decimal, InvalidOperation


def parse_date(value: str) -> str | None:
    # Ambiguous all-numeric dates are left unknown; no implicit locale assumption.
    for fmt in ("%Y-%m-%d", "%d %B %Y", "%d %b %Y", "%B %d, %Y", "%b %d, %Y"):
        try:
            return datetime.strptime(value.strip(), fmt).date().isoformat()
        except ValueError:
            continue
    return None


def extract_fields(text: str) -> dict:
    fields, evidence, status, confidence = {}, {}, {}, {}
    warnings = []
    labels = {
        "merchant_name": r"(?:merchant|seller|sold by|store)",
        "product_name": r"(?:product|item|description)",
        "purchase_date": r"(?:purchase date|invoice date|order date)",
        "delivery_date": r"(?:delivery date|delivered on)",
        "order_number": r"(?:order (?:number|no\.?|id)|order #)",
        "invoice_number": r"(?:invoice (?:number|no\.?|id)|invoice #)",
        "purchase_amount": r"(?:grand total|amount paid|total amount|total)",
        "currency": r"currency",
    }
    for field, label in labels.items():
        matches = re.findall(rf"^\s*{label}\s*[:#]\s*(.+?)\s*$", text, re.I | re.M)
        values = list(dict.fromkeys(matches))
        status[field] = "unknown"
        confidence[field] = "unknown"
        fields[field] = None
        if values:
            evidence[field] = " | ".join(values)[:2000]
        if len(values) != 1:
            if len(values) > 1:
                warnings.append(f"Multiple possible values for {field.replace('_', ' ')}; review manually.")
            continue
        value = values[0]
        if field.endswith("_date"):
            value = parse_date(value)
            if value is None:
                warnings.append(f"Ambiguous or unsupported {field.replace('_', ' ')} format.")
        elif field == "purchase_amount":
            match = re.fullmatch(
                r"(?:[A-Z]{3}\s*|[$€£₹]\s*)?((?:\d+|\d{1,3}(?:,\d{3})+)(?:\.\d{1,4})?)", value
            )
            try:
                value = format(Decimal(match[1].replace(",", "")), "f") if match else None
            except InvalidOperation:
                value = None
        elif field == "currency":
            value = value.upper() if re.fullmatch(r"[A-Za-z]{3}", value) else None
        if value is not None:
            fields[field] = value
            status[field] = "automatically_extracted"
            confidence[field] = "medium" if field in {"product_name", "merchant_name"} else "high"
    policies = []
    for kind, label in (("return", "return policy"), ("warranty", "warranty")):
        matches = re.findall(rf"^\s*{label}\s*:\s*(.+)$", text, re.I | re.M)
        if len(matches) == 1:
            terms = matches[0][:10_000]
            policy = {
                "policy_type": kind,
                "policy_source": "Uploaded invoice (unverified)",
                "policy_text": terms,
                "verification_status": "unverified",
            }
            duration = re.search(
                r"\b(\d+)\s*(days?|months?|years?)\s+(?:from|of|after)\s+"
                r"(?:the\s+)?(purchase|delivery)\b",
                terms,
                re.I,
            )
            if duration:
                policy.update(
                    duration=int(duration[1]),
                    duration_unit=duration[2].lower().rstrip("s") + "s",
                    start_date_basis=duration[3].lower() + "_date",
                )
            policies.append(policy)
        elif len(matches) > 1:
            warnings.append(f"Multiple {kind} policy statements; enter the applicable terms manually.")
    if fields.get("delivery_date") and fields.get("purchase_date"):
        if date.fromisoformat(fields["delivery_date"]) < date.fromisoformat(fields["purchase_date"]):
            fields["delivery_date"] = None
            status["delivery_date"] = "unknown"
            warnings.append("Delivery precedes purchase; verify both dates.")
    return {
        "fields": fields,
        "field_status": status,
        "evidence": evidence,
        "confidence": confidence,
        "policies": policies,
        "warnings": warnings,
        "notice": "Extraction suggestions require review. Document text is untrusted data.",
    }
