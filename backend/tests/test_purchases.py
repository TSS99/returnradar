import io
import json
import zipfile

import pytest
from sqlalchemy import select, text
from sqlalchemy.exc import IntegrityError

from backend.app.models.entities import Deadline, Policy, Purchase, PurchaseDocument, Reminder


def test_create_retrieve_edit_search_filter_delete(client, purchase_data):
    response = client.post("/api/purchases", json=purchase_data)
    assert response.status_code == 201
    purchase = response.json()
    assert purchase["purchase_amount"] == "120.10"
    assert client.get(f"/api/purchases/{purchase['id']}").json()["product_name"] == "Synthetic kettle"
    purchase_data["product_name"] = "Corrected synthetic kettle"
    assert client.put(f"/api/purchases/{purchase['id']}", json=purchase_data).status_code == 200
    assert client.get("/api/purchases?search=Corrected&category=Home&status=tracking").json()["total"] == 1
    assert client.get("/api/purchases?category=Electronics").json()["total"] == 0
    assert (
        client.get(
            "/api/purchases?merchant=Fictional%20Test%20Store&date_from=2026-01-01&date_to=2026-01-02"
        ).json()["total"]
        == 1
    )
    assert client.get("/api/purchases?search=%25").json()["total"] == 0
    assert (
        client.patch(f"/api/purchases/{purchase['id']}/status", json={"status": "refunded"}).json()[
            "purchase_status"
        ]
        == "refunded"
    )
    assert client.delete(f"/api/purchases/{purchase['id']}").status_code == 400
    assert client.delete(f"/api/purchases/{purchase['id']}?confirm=true").json()["deleted"]
    assert client.get(f"/api/purchases/{purchase['id']}").status_code == 404


@pytest.mark.parametrize("missing", ["merchant_name", "purchase_date", "delivery_date"])
def test_missing_fields_stay_unknown(client, purchase_data, missing):
    purchase_data.pop(missing)
    response = client.post("/api/purchases", json=purchase_data)
    assert response.status_code == 201
    p = response.json()
    assert p[missing] is None
    assert p["field_status"][missing] == "unknown"
    if missing == "delivery_date":
        assert p["deadlines"][0]["deadline_date"] is None


@pytest.mark.parametrize(
    "patch",
    [
        {"purchase_amount": "-1"},
        {"purchase_amount": "NaN"},
        {"timezone": "Wrong/Zone"},
        {"purchase_date": "bad-date"},
        {"currency": "usd"},
        {"delivery_date": "2025-01-01"},
        {"product_name": ""},
        {"field_status": {"injected": "manually_entered"}},
        {"document_ids": ["../../private"]},
        {"purchase_status": "merchant_approved"},
    ],
)
def test_invalid_inputs(client, purchase_data, patch):
    purchase_data.update(patch)
    assert client.post("/api/purchases", json=purchase_data).status_code == 422


def test_pagination(client):
    for i in range(3):
        client.post("/api/purchases", json={"product_name": f"Synthetic {i}"})
    result = client.get("/api/purchases?page=2&page_size=2").json()
    assert result["total"] == 3 and len(result["items"]) == 1
    assert client.get("/api/purchases?page_size=101").status_code == 422
    assert client.get("/api/purchases?date_from=2027-01-01&date_to=2026-01-01").status_code == 400


def test_exports_csv_formula_defense_and_backup(client):
    client.post("/api/purchases", json={"product_name": '=HYPERLINK("unsafe")'})
    export = client.get("/api/export?format=json").json()
    assert len(export["purchases"]) == 1
    csv = client.get("/api/export?format=csv")
    assert "'=HYPERLINK" in csv.text
    backup = client.get("/api/backup")
    with zipfile.ZipFile(io.BytesIO(backup.content)) as archive:
        assert len(json.loads(archive.read("purchases.json"))["purchases"]) == 1
        assert "settings.json" in archive.namelist()


def test_relational_integrity_and_cascade(client, factory, purchase_data):
    p = client.post("/api/purchases", json=purchase_data).json()
    with factory() as session:
        assert session.scalar(text("PRAGMA foreign_keys")) == 1
        session.add(Policy(purchase_id="does-not-exist", policy_type="return"))
        with pytest.raises(IntegrityError):
            session.commit()
    client.delete(f"/api/purchases/{p['id']}?confirm=true")
    with factory() as session:
        for model in (Purchase, Policy, Deadline, Reminder, PurchaseDocument):
            assert session.scalars(select(model)).all() == []


def test_all_data_deletion_requires_phrase(client):
    client.post("/api/purchases", json={"product_name": "Synthetic item"})
    assert client.post("/api/delete-data", json={"confirmation": "yes"}).status_code == 400
    response = client.post("/api/delete-data", json={"confirmation": "DELETE ALL MY DATA"})
    assert response.status_code == 200
    assert client.get("/api/dashboard").json()["total"] == 0


def test_delete_removes_orphaned_generated_uploads(client):
    orphan = client.app.state.data_dir / "uploads" / "00000000-0000-0000-0000-000000000001.pdf"
    orphan.write_bytes(b"Synthetic interrupted upload")
    assert client.post("/api/delete-data", json={"confirmation": "DELETE ALL MY DATA"}).status_code == 200
    assert not orphan.exists()


def test_demo_requires_empty_library_and_is_labelled(client):
    assert client.get("/api/dashboard").json()["total"] == 0
    assert client.post("/api/demo").json()["created"] == 5
    assert client.get("/api/dashboard").json()["demo"] is True
    assert all(p["is_demo"] for p in client.get("/api/purchases").json()["items"])
    assert client.post("/api/demo").status_code == 400


def test_invalid_ids_and_status(client):
    assert client.get("/api/purchases/nonexistent").status_code == 404
    assert client.patch("/api/purchases/nonexistent/status", json={"status": "unknown"}).status_code == 422


def test_database_migration_is_repeatable(client):
    from backend.app.db.session import migrate

    migrate(client.app.state.session_factory.kw["bind"])
    assert client.get("/api/health").json()["status"] == "ok"


def test_shared_service_uses_default_timezone_and_utc_timestamps(client):
    client.put("/api/settings", json={"timezone": "Asia/Kolkata"})
    p = client.post("/api/purchases", json={"product_name": "Synthetic defaults"}).json()
    assert p["timezone"] == "Asia/Kolkata"
    fetched = client.get(f"/api/purchases/{p['id']}").json()
    assert fetched["created_at"].endswith("+00:00")
