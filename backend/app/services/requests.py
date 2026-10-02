from backend.app.models.entities import Purchase
from backend.app.schemas.purchase import RequestInput


def generate_request(purchase: Purchase, data: RequestInput) -> dict:
    labels = {
        "return": "Return request",
        "refund": "Refund follow-up",
        "warranty": "Warranty claim",
        "replacement": "Replacement request",
    }
    verified = {"manually_entered", "user_confirmed"}

    def confirmed(field):
        value = getattr(purchase, field)
        return str(value) if value is not None and purchase.field_status.get(field) in verified else None

    product = confirmed("product_name")
    merchant = confirmed("merchant_name")
    subject = f"{labels[data.kind]}{': ' + product if product else ''}"
    lines = [f"Hello {merchant + ' team' if merchant else 'Customer Support'},", ""]
    action = {
        "return": "I would like to request a return",
        "refund": "I would like an update on the status of my refund request",
        "warranty": "I would like to request an assessment under the applicable warranty",
        "replacement": "I would like to request a replacement",
    }[data.kind]
    lines.extend([f"{action}{' for ' + product if product else ' for my purchase'}.", ""])
    for field, label in [
        ("order_number", "Order reference"),
        ("invoice_number", "Invoice reference"),
        ("purchase_date", "Purchase date"),
    ]:
        value = confirmed(field)
        if value:
            lines.append(f"{label}: {value}")
    if data.reason:
        lines.extend(["", f"Reason / additional details: {data.reason}"])
    lines.extend(
        [
            "",
            "Please let me know the next steps and any documentation you need.",
            "",
            "Thank you,",
            "[Your name]",
        ]
    )
    return {
        "subject": subject,
        "body": "\n".join(lines),
        "sent": False,
        "notice": "Editable draft only. Eligibility and refund approval have not been confirmed.",
    }
