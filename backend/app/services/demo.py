from datetime import datetime, timedelta
from zoneinfo import ZoneInfo

from sqlalchemy import select

from backend.app.models.entities import Purchase
from backend.app.schemas.purchase import PurchaseInput
from backend.app.services.purchases import ServiceError, get_purchase, get_settings, save_purchase


def seed_demo(session) -> dict:
    if session.scalar(select(Purchase.id).limit(1)):
        raise ServiceError("Demo data can only be loaded into an empty purchase library")
    timezone = get_settings(session).timezone
    today = datetime.now(ZoneInfo(timezone)).date()
    records = [
        ("Northline Audio (fictional)", "Studio wireless headphones", "Electronics", "149.00", 5, 365),
        ("Field & Form (fictional)", "Everyday canvas backpack", "Accessories", "68.00", 12, None),
        ("Clay House (fictional)", "Stoneware coffee set", "Home", "42.00", 2, None),
        ("Good Measure (fictional)", "Precision coffee scale", "Home", "55.00", 20, 30),
        ("Paper Society (fictional)", "Weekly desk planner", "Other", "24.00", None, None),
    ]
    for index, (merchant, product, category, amount, remaining, warranty) in enumerate(records):
        purchase_date = today - timedelta(days=25)
        policies = []
        for kind, days in (("return", remaining), ("warranty", warranty)):
            if days is not None:
                policies.append(
                    {
                        "policy_type": kind,
                        "policy_source": "Fictional demo terms",
                        "policy_text": "Synthetic demonstration cutoff. Not a real merchant policy.",
                        "cutoff_date": today + timedelta(days=days),
                        "start_date_basis": "explicit",
                        "verification_status": "verified",
                        "provider": merchant if kind == "warranty" else None,
                        "start_date": purchase_date if kind == "warranty" else None,
                        "start_date_verified": kind == "warranty",
                    }
                )
        saved = save_purchase(
            session,
            PurchaseInput(
                product_name=product,
                merchant_name=merchant,
                purchase_date=purchase_date,
                purchase_amount=amount,
                currency="USD",
                timezone=timezone,
                product_category=category,
                policies=policies,
                order_number=f"DEMO-{index + 1:04d}",
                notes="Fictional demonstration record",
            ),
        )
        get_purchase(session, saved["id"]).is_demo = True
    session.commit()
    return {"created": len(records), "notice": "Fictional demonstration records only"}
