import io

import pytest
from fastapi.testclient import TestClient
from pypdf import PdfWriter
from pypdf.generic import DecodedStreamObject, DictionaryObject, NameObject

from backend.app.main import create_app


def pdf_bytes(text: str) -> bytes:
    writer = PdfWriter()
    page = writer.add_blank_page(width=612, height=792)
    font = DictionaryObject(
        {
            NameObject("/Type"): NameObject("/Font"),
            NameObject("/Subtype"): NameObject("/Type1"),
            NameObject("/BaseFont"): NameObject("/Helvetica"),
        }
    )
    page[NameObject("/Resources")] = DictionaryObject(
        {NameObject("/Font"): DictionaryObject({NameObject("/F1"): writer._add_object(font)})}
    )
    lines = ["BT /F1 12 Tf 50 740 Td"]
    for line in text.splitlines():
        escaped = line.replace("\\", "\\\\").replace("(", "\\(").replace(")", "\\)")
        lines.append(f"({escaped}) Tj 0 -18 Td")
    lines.append("ET")
    stream = DecodedStreamObject()
    stream.set_data("\n".join(lines).encode("latin-1"))
    page[NameObject("/Contents")] = writer._add_object(stream)
    output = io.BytesIO()
    writer.write(output)
    return output.getvalue()


@pytest.fixture
def client(tmp_path):
    app = create_app(tmp_path, worker_enabled=False)
    with TestClient(app) as client:
        yield client


@pytest.fixture
def factory(client):
    return client.app.state.session_factory


@pytest.fixture
def receipt():
    return pdf_bytes("""FICTIONAL TEST RECEIPT - NOT A REAL PURCHASE
Merchant: Northline Test Store
Product: Synthetic headphones
Purchase date: 2026-09-20
Delivery date: 2026-09-22
Order number: TEST-001
Invoice number: SYNTHETIC-001
Total: USD 149.90
Currency: USD
Return policy: 14 days from delivery
Warranty: 12 months from purchase
""")


@pytest.fixture
def purchase_data():
    return {
        "merchant_name": "Fictional Test Store",
        "product_name": "Synthetic kettle",
        "purchase_date": "2026-01-01",
        "delivery_date": "2026-01-04",
        "purchase_amount": "120.10",
        "currency": "INR",
        "product_category": "Home",
        "timezone": "Asia/Kolkata",
        "policies": [
            {
                "policy_type": "return",
                "policy_source": "Fictional receipt",
                "policy_text": "Seven days from delivery",
                "duration": 7,
                "start_date_basis": "delivery_date",
                "verification_status": "verified",
            }
        ],
    }
