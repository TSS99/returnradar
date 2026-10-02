from datetime import UTC, datetime
from pathlib import Path

import pytest
from sqlalchemy import select

from backend.app.models.entities import Notification, Reminder
from backend.app.services.documents import document_path
from backend.app.services.reminders import process_reminders


def test_reminder_catchup_and_idempotency(client, factory, purchase_data):
    p = client.post("/api/purchases", json=purchase_data).json()
    with factory() as session:
        result = process_reminders(session, datetime(2026, 1, 11, 5, tzinfo=UTC))
        assert result["generated"] == 4
        assert process_reminders(session, datetime(2026, 1, 11, 6, tzinfo=UTC))["generated"] == 0
        assert len(session.scalars(select(Notification)).all()) == 4
    client.put(f"/api/purchases/{p['id']}", json=purchase_data)
    with factory() as session:
        assert process_reminders(session, datetime(2026, 1, 11, 7, tzinfo=UTC))["generated"] == 0


def test_timezone_midnight_dst_boundary(client, factory, purchase_data):
    purchase_data["timezone"] = "America/New_York"
    purchase_data["policies"] = [
        {
            "policy_type": "return",
            "cutoff_date": "2026-03-08",
            "start_date_basis": "explicit",
            "policy_source": "Fictional",
            "policy_text": "Cutoff date",
            "verification_status": "verified",
        }
    ]
    client.post("/api/purchases", json=purchase_data)
    client.put("/api/settings", json={"reminder_offsets": [0]})
    with factory() as session:
        assert process_reminders(session, datetime(2026, 3, 8, 12, 59, tzinfo=UTC))["generated"] == 0
        assert process_reminders(session, datetime(2026, 3, 8, 13, tzinfo=UTC))["generated"] == 1
        reminder = session.scalar(select(Reminder))
        assert reminder.scheduled_at.hour == 13  # 9am after US daylight-saving transition.


def test_unverified_return_disabled_reminders_and_closed_status(client, factory, purchase_data):
    purchase_data["policies"][0]["verification_status"] = "unverified"
    p = client.post("/api/purchases", json=purchase_data).json()
    with factory() as session:
        assert process_reminders(session, datetime(2026, 1, 11, 10, tzinfo=UTC))["generated"] == 0
    purchase_data["policies"][0]["verification_status"] = "verified"
    client.put(f"/api/purchases/{p['id']}", json=purchase_data)
    client.patch(f"/api/purchases/{p['id']}/status", json={"status": "kept"})
    with factory() as session:
        assert process_reminders(session, datetime(2026, 1, 11, 10, tzinfo=UTC))["generated"] == 0
    client.patch(f"/api/purchases/{p['id']}/status", json={"status": "tracking"})
    client.put("/api/settings", json={"reminders_enabled": False})
    assert client.post("/api/reminders/run").json()["enabled"] is False


@pytest.mark.parametrize("kind", ["return", "refund", "warranty", "replacement"])
def test_request_generation_confirmed_fields_only(client, purchase_data, kind):
    purchase_data["order_number"] = "EXTRACTED-UNVERIFIED"
    purchase_data["field_status"] = {"order_number": "automatically_extracted"}
    p = client.post("/api/purchases", json=purchase_data).json()
    result = client.post(
        f"/api/purchases/{p['id']}/request", json={"kind": kind, "reason": "Synthetic test reason"}
    ).json()
    assert "Synthetic kettle" in result["body"]
    assert "EXTRACTED-UNVERIFIED" not in result["body"]
    assert "Synthetic test reason" in result["body"]
    assert result["sent"] is False
    assert "approved" not in result["body"].lower()


def test_origin_host_upload_and_json_size_protection(client):
    assert client.get("/api/purchases", headers={"Origin": "https://foreign.example"}).status_code == 403
    assert (
        client.post(
            "/api/purchases", json={"product_name": "Synthetic"}, headers={"Sec-Fetch-Site": "cross-site"}
        ).status_code
        == 403
    )
    assert client.get("/api/health", headers={"Host": "rebinding.example"}).status_code == 400
    assert client.get("/api/health", headers={"Origin": "http://127.0.0.1:5173"}).status_code == 200
    assert client.post("/api/purchases", content=b"0" * (1024 * 1024 + 1)).status_code == 413
    assert client.get("/api/health").headers["x-content-type-options"] == "nosniff"
    assert (
        client.post(
            "/api/purchases",
            content=iter([b"0" * 700000, b"0" * 700000]),
            headers={"Content-Type": "application/json"},
        ).status_code
        == 413
    )


def test_path_traversal_and_symlink(tmp_path):
    (tmp_path / "uploads").mkdir()
    with pytest.raises(ValueError):
        document_path(tmp_path, "../../secrets.pdf")
    from backend.app.services.purchases import ServiceError

    name = "00000000-0000-0000-0000-000000000001.pdf"
    (tmp_path / "uploads" / name).symlink_to(Path("/etc/passwd"))
    with pytest.raises(ServiceError):
        document_path(tmp_path, name)


def test_notification_mark_read_and_settings_validation(client, factory, purchase_data):
    client.post("/api/purchases", json=purchase_data)
    with factory() as session:
        process_reminders(session, datetime(2026, 1, 11, 5, tzinfo=UTC))
    notification = client.get("/api/notifications").json()[0]
    assert client.patch(f"/api/notifications/{notification['id']}").json()["read"] is True
    assert client.put("/api/settings", json={"reminder_offsets": [-1]}).status_code == 422
    assert client.put("/api/settings", json={"reminder_offsets": [3, 3, 0]}).json()["reminder_offsets"] == [
        3,
        0,
    ]
