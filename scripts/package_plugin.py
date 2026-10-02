"""Package only reviewed public plugin files, never local data or credentials."""

import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
output = ROOT / "dist" / "returnradar-plugin-0.1.0.zip"
output.parent.mkdir(exist_ok=True)
with zipfile.ZipFile(output, "w", zipfile.ZIP_DEFLATED) as archive:
    for path in sorted((ROOT / "plugin").rglob("*")):
        if path.is_file():
            archive.write(path, path.relative_to(ROOT / "plugin"))
print(output)
