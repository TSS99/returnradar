import pytest


def deadline(p, kind="return"):
    return next(d for d in p["deadlines"] if d["deadline_type"] == kind)


@pytest.mark.parametrize("basis,expected", [("purchase_date", "2026-01-08"), ("delivery_date", "2026-01-11")])
def test_purchase_vs_delivery(client, purchase_data, basis, expected):
    purchase_data["policies"][0]["start_date_basis"] = basis
    p = client.post("/api/purchases", json=purchase_data).json()
    assert deadline(p)["deadline_date"] == expected
    assert deadline(p)["verification_status"] == "confirmed"
    assert deadline(p)["calculation_basis"]["policy_source"] == "Fictional receipt"
    assert deadline(p)["calculation_basis"]["last_verified_at"]


def test_unknown_and_unverified_policy(client, purchase_data):
    purchase_data["policies"] = []
    p = client.post("/api/purchases", json=purchase_data).json()
    assert deadline(p)["deadline_date"] is None
    purchase_data["policies"] = [
        {
            "policy_type": "return",
            "duration": 7,
            "start_date_basis": "delivery_date",
            "verification_status": "unverified",
        }
    ]
    p = client.post("/api/purchases", json=purchase_data).json()
    assert deadline(p)["verification_status"] == "tentative"


def test_unverified_start_and_missing_delivery(client, purchase_data):
    purchase_data["field_status"] = {"delivery_date": "automatically_extracted"}
    p = client.post("/api/purchases", json=purchase_data).json()
    assert deadline(p)["verification_status"] == "tentative"
    purchase_data["delivery_date"] = None
    p = client.post("/api/purchases", json=purchase_data).json()
    assert deadline(p)["deadline_date"] is None


def test_warranty_month_end_leap_year_and_specific_start(client, purchase_data):
    purchase_data["policies"] = [
        {
            "policy_type": "warranty",
            "policy_source": "Fictional terms",
            "policy_text": "One calendar month from stated activation",
            "duration": 1,
            "duration_unit": "months",
            "start_date_basis": "warranty_start",
            "start_date": "2028-01-31",
            "start_date_verified": True,
            "verification_status": "verified",
            "provider": "Fictional provider",
        }
    ]
    p = client.post("/api/purchases", json=purchase_data).json()
    assert deadline(p, "warranty")["deadline_date"] == "2028-02-29"
    assert p["policies"][0]["provider"] == "Fictional provider"
    purchase_data["policies"][0]["start_date"] = None
    p = client.post("/api/purchases", json=purchase_data).json()
    assert deadline(p, "warranty")["deadline_date"] is None


def test_explicit_cutoff_and_invalid_policy(client, purchase_data):
    purchase_data["policies"] = [
        {
            "policy_type": "return",
            "policy_source": "Fictional terms",
            "policy_text": "Until cutoff",
            "cutoff_date": "2026-02-02",
            "start_date_basis": "explicit",
            "verification_status": "verified",
        }
    ]
    p = client.post("/api/purchases", json=purchase_data).json()
    assert deadline(p)["deadline_date"] == "2026-02-02"
    purchase_data["policies"][0]["duration"] = 7
    assert client.post("/api/purchases", json=purchase_data).status_code == 422
    purchase_data["policies"][0].pop("duration")
    purchase_data["policies"][0]["policy_source"] = None
    assert client.post("/api/purchases", json=purchase_data).status_code == 422


def test_overflow_stays_unknown(client, purchase_data):
    purchase_data["policies"][0].update(duration=36500, duration_unit="years")
    p = client.post("/api/purchases", json=purchase_data).json()
    assert deadline(p)["deadline_date"] is None
    assert deadline(p)["verification_status"] == "unknown"


def test_verified_date_correction_and_stable_deadline_id(client, purchase_data):
    p = client.post("/api/purchases", json=purchase_data).json()
    p2 = client.put(f"/api/purchases/{p['id']}", json=purchase_data).json()
    assert deadline(p)["id"] == deadline(p2)["id"]
    assert (
        deadline(p)["calculation_basis"]["last_verified_at"]
        == deadline(p2)["calculation_basis"]["last_verified_at"]
    )
    purchase_data["delivery_date"] = "2026-01-05"
    p3 = client.put(f"/api/purchases/{p['id']}", json=purchase_data).json()
    assert deadline(p3)["deadline_date"] == "2026-01-12"


def test_unknown_warranty_does_not_assume_purchase_start(client):
    p = client.post(
        "/api/purchases",
        json={
            "product_name": "Synthetic item",
            "purchase_date": "2026-01-01",
            "policies": [
                {
                    "policy_type": "warranty",
                    "duration": 12,
                    "duration_unit": "months",
                    "start_date_basis": "warranty_start",
                }
            ],
        },
    ).json()
    assert deadline(p, "warranty")["deadline_date"] is None
    assert p["warranty_status"] == "unknown"


def test_unspecified_policy_basis_never_defaults_to_purchase(client):
    p = client.post(
        "/api/purchases",
        json={
            "product_name": "Synthetic",
            "purchase_date": "2026-01-01",
            "policies": [{"policy_type": "return", "duration": 7}],
        },
    ).json()
    assert deadline(p)["deadline_date"] is None
    assert deadline(p)["verification_status"] == "unknown"


def test_explicit_warranty_end_does_not_assume_active_coverage(client):
    p = client.post(
        "/api/purchases",
        json={
            "product_name": "Synthetic warranty item",
            "purchase_date": "2026-01-01",
            "policies": [
                {
                    "policy_type": "warranty",
                    "policy_source": "Fictional terms",
                    "policy_text": "Known end only",
                    "cutoff_date": "2099-01-01",
                    "start_date_basis": "explicit",
                    "verification_status": "verified",
                }
            ],
        },
    ).json()
    assert p["warranty_status"] == "end_date_confirmed"
    assert deadline(p, "warranty")["calculation_basis"]["start_date"] is None
