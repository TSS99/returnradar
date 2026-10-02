"""Review tracked content for private artifacts and common credential patterns before publication."""

import re
import subprocess  # nosec B404 - fixed read-only Git command
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
PATTERNS = [
    re.compile(rb"-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----"),
    re.compile(rb"gh[pousr]_[A-Za-z0-9]{30,}"),
    re.compile(rb"github_pat_[A-Za-z0-9_]{40,}"),
    re.compile(rb"\bAKIA[A-Z0-9]{16}\b"),
    re.compile(rb"\bsk-(?:proj-)?[A-Za-z0-9_-]{30,}"),
]
FORBIDDEN = {".venv", "node_modules", "private_data", "uploads", "receipts", "test-results", ".cache"}
files = subprocess.check_output(["git", "ls-files", "-z"], cwd=ROOT).decode().split("\0")  # nosec B603,B607
failures = []
for name in filter(None, files):
    path = Path(name)
    if (
        set(path.parts) & FORBIDDEN
        or path.suffix in {".db", ".sqlite", ".sqlite3", ".pem", ".key"}
        or path.name.startswith(".env")
        and path.name != ".env.example"
    ):
        failures.append(f"Private artifact: {name}")
    data = (ROOT / name).read_bytes()
    if any(pattern.search(data) for pattern in PATTERNS):
        failures.append(f"Possible credential: {name}")
    if path.suffix.lower() == ".pdf" and name != "sample_data/synthetic-receipt.pdf":
        failures.append(f"Unexpected PDF: {name}")
if failures:
    raise SystemExit("\n".join(failures))
print(f"Reviewed {len(list(filter(None, files)))} tracked files: no private artifacts or common credentials")
