import csv
import io
import json
import zipfile
from datetime import date
from typing import Annotated, Literal

from fastapi import APIRouter, Depends, File, Query, Request, UploadFile
from fastapi.responses import FileResponse, Response
from pydantic import Field
from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from backend.app.core.config import MAX_UPLOAD_BYTES
from backend.app.models.entities import Notification, Purchase, PurchaseDocument, Reminder, Settings
from backend.app.schemas.purchase import PurchaseInput, RequestInput, SettingsInput, Status, StrictModel
from backend.app.services.deadlines import actionable
from backend.app.services.demo import seed_demo
from backend.app.services.documents import document_path, process_upload
from backend.app.services.purchases import (
    ServiceError,
    get_purchase,
    get_settings,
    list_purchases,
    purchase_dict,
    save_purchase,
    serialize_row,
    upcoming_deadlines,
    update_settings,
)
from backend.app.services.reminders import process_reminders
from backend.app.services.requests import generate_request

router = APIRouter(prefix="/api")


def database(request: Request):
    with request.app.state.session_factory() as session:
        yield session


DB = Annotated[Session, Depends(database)]


@router.get("/health")
def health():
    return {"status": "ok", "version": "0.1.0", "mode": "local_single_user"}


@router.get("/purchases")
def purchases(
    session: DB,
    search: str = Query("", max_length=300),
    merchant: str = Query("", max_length=200),
    category: str = Query("", max_length=80),
    status: Status | Literal[""] = "",
    date_from: date | None = None,
    date_to: date | None = None,
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
):
    return list_purchases(
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


@router.post("/purchases", status_code=201)
def add_purchase(data: PurchaseInput, session: DB):
    return save_purchase(session, data)


@router.get("/purchases/{purchase_id}")
def details(purchase_id: str, session: DB):
    return purchase_dict(get_purchase(session, purchase_id))


@router.put("/purchases/{purchase_id}")
def update(purchase_id: str, data: PurchaseInput, session: DB):
    return save_purchase(session, data, purchase_id)


class StatusInput(StrictModel):
    status: Status


@router.patch("/purchases/{purchase_id}/status")
def update_status(purchase_id: str, data: StatusInput, session: DB):
    purchase = get_purchase(session, purchase_id)
    purchase.purchase_status = data.status
    session.commit()
    return purchase_dict(purchase)


@router.delete("/purchases/{purchase_id}")
def remove_purchase(purchase_id: str, session: DB, request: Request, confirm: bool = False):
    if not confirm:
        raise ServiceError("Confirm deletion with confirm=true")
    purchase = get_purchase(session, purchase_id)
    paths = [document_path(request.app.state.data_dir, d.storage_reference) for d in purchase.documents]
    session.delete(purchase)
    session.commit()
    for path in paths:
        path.unlink(missing_ok=True)
    return {"deleted": True}


@router.post("/documents", status_code=201)
async def upload(session: DB, request: Request, file: Annotated[UploadFile, File()]):
    data = await file.read(MAX_UPLOAD_BYTES + 1)
    await file.close()
    from starlette.concurrency import run_in_threadpool

    return await run_in_threadpool(
        process_upload, session, request.app.state.data_dir, data, file.filename or "receipt.pdf"
    )


@router.get("/documents/{document_id}")
def download_document(document_id: str, session: DB, request: Request):
    document = session.get(PurchaseDocument, document_id)
    if document is None or document.purchase_id is None:
        raise ServiceError("Attached document not found", 404)
    path = document_path(request.app.state.data_dir, document.storage_reference)
    if not path.is_file():
        raise ServiceError("Document file is missing", 404)
    return FileResponse(path, media_type="application/pdf", filename=document.original_filename)


@router.delete("/documents/{document_id}")
def discard_upload(document_id: str, session: DB, request: Request):
    document = session.get(PurchaseDocument, document_id)
    if not document or document.purchase_id:
        raise ServiceError("Unattached document not found", 404)
    path = document_path(request.app.state.data_dir, document.storage_reference)
    session.delete(document)
    session.commit()
    path.unlink(missing_ok=True)
    return {"deleted": True}


@router.get("/deadlines")
def deadlines(session: DB, days: int = Query(365, ge=0, le=3650), confirmed_only: bool = True):
    return upcoming_deadlines(session, days, confirmed_only)


@router.get("/dashboard")
def dashboard(session: DB):
    all_purchases = session.scalars(select(Purchase).order_by(Purchase.created_at.desc())).all()
    upcoming = upcoming_deadlines(session, 30)
    attention = [
        purchase_dict(p)
        for p in all_purchases
        if actionable(p, "return")
        and any(d.deadline_type == "return" and d.verification_status != "confirmed" for d in p.deadlines)
    ]
    active = sum(
        purchase_dict(p)["warranty_status"] in {"active", "expiring_soon"} and actionable(p, "warranty")
        for p in all_purchases
    )
    return {
        "total": len(all_purchases),
        "upcoming_returns": sum(d["deadline_type"] == "return" for d in upcoming),
        "active_warranties": active,
        "attention_count": len(attention),
        "attention": attention[:5],
        "recent": [purchase_dict(p) for p in all_purchases[:5]],
        "upcoming": upcoming,
        "demo": any(p.is_demo for p in all_purchases),
    }


@router.get("/facets")
def facets(session: DB):
    return {
        "merchants": sorted(
            session.scalars(
                select(Purchase.merchant_name).distinct().where(Purchase.merchant_name.is_not(None))
            ).all()
        ),
        "categories": sorted(session.scalars(select(Purchase.product_category).distinct()).all()),
    }


@router.post("/purchases/{purchase_id}/request")
def request_draft(purchase_id: str, data: RequestInput, session: DB):
    return generate_request(get_purchase(session, purchase_id), data)


@router.get("/settings")
def settings(session: DB):
    return serialize_row(get_settings(session))


@router.put("/settings")
def save_settings(data: SettingsInput, session: DB):
    return update_settings(session, data)


@router.get("/notifications")
def notifications(session: DB):
    return [
        serialize_row(n)
        for n in session.scalars(select(Notification).order_by(Notification.created_at.desc()).limit(100))
    ]


@router.patch("/notifications/{notification_id}")
def read_notification(notification_id: str, session: DB):
    notification = session.get(Notification, notification_id)
    if not notification:
        raise ServiceError("Notification not found", 404)
    notification.read = True
    session.commit()
    return serialize_row(notification)


@router.post("/reminders/run")
def run_reminders(session: DB):
    return process_reminders(session)


@router.get("/reminders")
def reminder_log(session: DB):
    return [
        serialize_row(r)
        for r in session.scalars(select(Reminder).order_by(Reminder.scheduled_at.desc()).limit(200))
    ]


def records(session):
    return [purchase_dict(p) for p in session.scalars(select(Purchase).order_by(Purchase.created_at))]


@router.get("/export")
def export(session: DB, format: Literal["json", "csv"] = "json"):
    items = records(session)
    if format == "json":
        content = json.dumps({"version": "0.1.0", "purchases": items}, indent=2)
        media_type = "application/json"
    else:
        buffer = io.StringIO()
        keys = [c.name for c in Purchase.__table__.columns if c.name not in {"field_status", "evidence"}]
        writer = csv.DictWriter(buffer, fieldnames=keys)
        writer.writeheader()
        for item in items:
            row = {key: item[key] for key in keys}
            # Prevent spreadsheet formula execution in downloaded CSVs.
            row = {
                k: "'" + v if isinstance(v, str) and v.lstrip().startswith(("=", "+", "-", "@")) else v
                for k, v in row.items()
            }
            writer.writerow(row)
        content, media_type = buffer.getvalue(), "text/csv"
    return Response(
        content,
        media_type=media_type,
        headers={"Content-Disposition": f'attachment; filename="returnradar.{format}"'},
    )


@router.get("/backup")
def backup(session: DB, request: Request):
    buffer = io.BytesIO()
    with zipfile.ZipFile(buffer, "w", zipfile.ZIP_DEFLATED) as archive:
        archive.writestr(
            "purchases.json", json.dumps({"version": "0.1.0", "purchases": records(session)}, indent=2)
        )
        archive.writestr("settings.json", json.dumps(serialize_row(get_settings(session)), indent=2))
        archive.writestr(
            "notifications.json",
            json.dumps([serialize_row(n) for n in session.scalars(select(Notification))], indent=2),
        )
        for document in session.scalars(select(PurchaseDocument)):
            path = document_path(request.app.state.data_dir, document.storage_reference)
            if path.exists():
                archive.write(path, f"documents/{document.id}.pdf")
    return Response(
        buffer.getvalue(),
        media_type="application/zip",
        headers={"Content-Disposition": 'attachment; filename="returnradar-backup.zip"'},
    )


class DeleteDataInput(StrictModel):
    confirmation: str = Field(max_length=40)


@router.post("/delete-data")
def delete_data(data: DeleteDataInput, session: DB, request: Request):
    if data.confirmation != "DELETE ALL MY DATA":
        raise ServiceError("Type DELETE ALL MY DATA to confirm")
    paths = [
        document_path(request.app.state.data_dir, d.storage_reference)
        for d in session.scalars(select(PurchaseDocument))
    ]
    # Remove generated files left orphaned by an interrupted upload too.
    for candidate in (request.app.state.data_dir / "uploads").glob("*.pdf"):
        try:
            safe_path = document_path(request.app.state.data_dir, candidate.name)
        except (ValueError, ServiceError):
            continue
        if safe_path.is_file() and safe_path not in paths:
            paths.append(safe_path)
    session.execute(delete(PurchaseDocument))
    session.execute(delete(Purchase))
    session.execute(delete(Settings))
    session.commit()
    for path in paths:
        path.unlink(missing_ok=True)
    # VACUUM removes deleted database pages; filesystem-level secure erasure is not guaranteed.
    connection = session.connection()
    connection.exec_driver_sql("PRAGMA wal_checkpoint(TRUNCATE)")
    connection.exec_driver_sql("VACUUM")
    return {"deleted": True}


@router.post("/demo")
def demo(session: DB):
    return seed_demo(session)
