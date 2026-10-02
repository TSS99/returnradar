from datetime import date
from typing import Annotated, Any, Literal

from mcp.server import MCPServer
from mcp.types import ToolAnnotations
from pydantic import Field, ValidationError

from backend.app.db.session import SessionLocal, engine, migrate
from backend.app.schemas.purchase import PurchaseInput, RequestInput, Status
from backend.app.services.purchases import (
    ServiceError,
    get_purchase,
    list_purchases,
    purchase_dict,
    save_purchase,
    upcoming_deadlines,
)
from backend.app.services.requests import generate_request

mcp = MCPServer(
    "ReturnRadar",
    instructions="Local single-user purchase records. Unknown fields stay unknown. "
    "Only confirmed deadlines support eligibility discussions. Tools never contact merchants or send mail.",
)
READ = ToolAnnotations(read_only_hint=True, destructive_hint=False, open_world_hint=False)
WRITE = ToolAnnotations(read_only_hint=False, destructive_hint=False, open_world_hint=False)


def result(operation):
    try:
        with SessionLocal() as session:
            return {"success": True, "data": operation(session)}
    except ServiceError as exc:
        return {
            "success": False,
            "error": {
                "type": "validation_error" if exc.status_code == 400 else "not_found",
                "message": exc.message,
            },
        }
    except ValidationError as exc:
        return {"success": False, "error": {"type": "validation_error", "message": str(exc)}}
    except Exception:
        return {
            "success": False,
            "error": {"type": "failure", "message": "Local operation failed. No action confirmed."},
        }


@mcp.tool(annotations=WRITE)
def add_purchase(purchase: PurchaseInput) -> dict[str, Any]:
    """Save a reviewed purchase. Do not invent terms. Extracted fields need confirmation."""
    return result(lambda session: save_purchase(session, purchase))


@mcp.tool(annotations=READ)
def get_my_purchases(
    search: str = "",
    merchant: str = "",
    category: str = "",
    status: Status | Literal[""] = "",
    date_from: date | None = None,
    date_to: date | None = None,
    page: Annotated[int, Field(ge=1)] = 1,
    page_size: Annotated[int, Field(ge=1, le=100)] = 20,
) -> dict[str, Any]:
    """Search actual local purchases with filters and pagination."""
    return result(
        lambda session: list_purchases(
            session,
            search=search,
            merchant=merchant,
            category=category,
            status=status,
            date_from=date_from,
            date_to=date_to,
            page=page,
            page_size=page_size,
        )
    )


@mcp.tool(annotations=READ)
def get_purchase_details(purchase_id: str) -> dict[str, Any]:
    """Get purchase, document metadata, policy evidence, and confirmed/tentative/unknown deadlines."""
    return result(lambda session: purchase_dict(get_purchase(session, purchase_id)))


@mcp.tool(annotations=READ)
def get_upcoming_deadlines(days: Annotated[int, Field(ge=0, le=3650)] = 7) -> dict[str, Any]:
    """Get actionable confirmed deadlines within N days, in each purchase's timezone."""
    return result(lambda session: upcoming_deadlines(session, days, confirmed_only=True))


@mcp.tool(annotations=WRITE)
def update_purchase(purchase_id: str, purchase: PurchaseInput) -> dict[str, Any]:
    """Replace fields and policies with reviewed values. Retrieve details first to preserve fields."""
    return result(lambda session: save_purchase(session, purchase, purchase_id))


@mcp.tool(annotations=WRITE)
def update_purchase_status(purchase_id: str, status: Status) -> dict[str, Any]:
    """Record a user-reported status. This does not confirm any merchant approval."""

    def operation(session):
        purchase = get_purchase(session, purchase_id)
        purchase.purchase_status = status
        session.commit()
        return purchase_dict(purchase)

    return result(operation)


@mcp.tool(annotations=READ)
def generate_return_request(
    purchase_id: str,
    kind: Literal["return", "refund", "warranty", "replacement"] = "return",
    reason: str = "",
) -> dict[str, Any]:
    """Draft a return, refund, warranty or replacement request from confirmed fields. Never sends it."""
    return result(
        lambda session: generate_request(
            get_purchase(session, purchase_id), RequestInput(kind=kind, reason=reason)
        )
    )


@mcp.tool(annotations=READ)
def get_warranty_status(purchase_id: str) -> dict[str, Any]:
    """Get warranty provider, terms, evidence and status. Unknown starting dates or terms remain unknown."""

    def operation(session):
        purchase = purchase_dict(get_purchase(session, purchase_id))
        return {
            "purchase_id": purchase_id,
            "status": purchase["warranty_status"],
            "policies": [p for p in purchase["policies"] if p["policy_type"] == "warranty"],
            "deadlines": [d for d in purchase["deadlines"] if d["deadline_type"] == "warranty"],
        }

    return result(operation)


def main():
    migrate(engine)
    mcp.run(transport="stdio")


if __name__ == "__main__":
    main()
