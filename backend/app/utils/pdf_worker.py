"""Isolated PDF parser: stdin bytes -> bounded extraction JSON. Never runs document content."""

import io
import json
import sys

from pypdf import PdfReader

from backend.app.core.config import MAX_PDF_PAGES, MAX_TEXT_CHARS, MAX_UPLOAD_BYTES
from backend.app.services.extraction import extract_fields


def main():
    if sys.platform != "win32":
        import resource

        resource.setrlimit(resource.RLIMIT_CPU, (10, 10))
        if sys.platform.startswith("linux"):
            resource.setrlimit(resource.RLIMIT_AS, (512 * 1024 * 1024, 512 * 1024 * 1024))
    try:
        data = sys.stdin.buffer.read(MAX_UPLOAD_BYTES + 1)
        if len(data) > MAX_UPLOAD_BYTES:
            raise ValueError("PDF is too large")
        reader = PdfReader(io.BytesIO(data), strict=True)
        if reader.is_encrypted:
            raise ValueError("Password-protected PDFs are unsupported")
        if len(reader.pages) > MAX_PDF_PAGES:
            raise ValueError("PDF exceeds the 50-page limit")
        parts, length = [], 0
        for page in reader.pages:
            text = page.extract_text() or ""
            length += len(text)
            if length > MAX_TEXT_CHARS:
                raise ValueError("PDF exceeds the text extraction limit")
            parts.append(text)
        text = "\n".join(parts)
        if not text.strip():
            raise ValueError("No extractable text. Scanned images require OCR, which is not included in v0.1")
        print(json.dumps({"ok": True, "data": extract_fields(text)}))
    except Exception:
        # Parser exceptions can contain invoice bytes, so never echo them.
        print(
            json.dumps(
                {
                    "ok": False,
                    "error": "PDF cannot be processed. Use an unencrypted text-based "
                    "PDF under 50 pages. Image-only PDFs require OCR, unsupported in v0.1.",
                }
            )
        )


if __name__ == "__main__":
    main()
