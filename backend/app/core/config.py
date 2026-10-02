import os
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
DATA_DIR = Path(os.environ.get("RETURNRADAR_DATA_DIR", ROOT / "private_data")).resolve()
MAX_UPLOAD_BYTES = 10 * 1024 * 1024
MAX_PDF_PAGES = 50
MAX_TEXT_CHARS = 200_000
ALLOWED_ORIGINS = {"http://127.0.0.1:5173", "http://localhost:5173", "http://127.0.0.1:8000"}


def prepare_data_dir(path: Path) -> None:
    path.mkdir(parents=True, exist_ok=True, mode=0o700)
    (path / "uploads").mkdir(exist_ok=True, mode=0o700)
