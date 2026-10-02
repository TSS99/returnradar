import hashlib
import json

# The parser module/arguments are fixed; document content only enters stdin.
import subprocess  # nosec B404
import sys
from pathlib import Path

from sqlalchemy.orm import Session

from backend.app.core.config import MAX_UPLOAD_BYTES, ROOT
from backend.app.models.entities import PurchaseDocument, identifier
from backend.app.schemas.purchase import safe_download_name
from backend.app.services.purchases import ServiceError, serialize_row


def document_path(data_dir: Path, reference: str) -> Path:
    from uuid import UUID

    UUID(reference.removesuffix(".pdf"))
    path = data_dir / "uploads" / reference
    if path.is_symlink() or path.resolve().parent != (data_dir / "uploads").resolve():
        raise ServiceError("Unsafe document reference")
    return path


def process_upload(session: Session, data_dir: Path, data: bytes, filename: str) -> dict:
    if len(data) > MAX_UPLOAD_BYTES:
        raise ServiceError("File is too large. The maximum is 10 MB", 413)
    if not data.startswith(b"%PDF-"):
        raise ServiceError("Only text-based PDF files are supported. Image OCR is unavailable", 415)
    try:
        parsed = subprocess.run(  # nosec B603
            [sys.executable, "-m", "backend.app.utils.pdf_worker"],
            input=data,
            capture_output=True,
            timeout=15,
            cwd=ROOT,
            check=False,
        )
        result = json.loads(parsed.stdout)
    except (subprocess.TimeoutExpired, json.JSONDecodeError):
        raise ServiceError("PDF processing timed out or failed. Try a smaller text-based PDF", 422) from None
    if not result.get("ok"):
        raise ServiceError(result["error"], 422)
    document = PurchaseDocument(
        id=identifier(),
        original_filename=safe_download_name(Path(filename).name),
        content_hash=hashlib.sha256(data).hexdigest(),
    )
    document.storage_reference = document.id + ".pdf"
    path = document_path(data_dir, document.storage_reference)
    with path.open("xb") as handle:
        handle.write(data)
    path.chmod(0o600)
    session.add(document)
    try:
        session.commit()
    except Exception:
        path.unlink(missing_ok=True)
        raise
    return {"document": serialize_row(document, ("storage_reference",)), **result["data"]}
