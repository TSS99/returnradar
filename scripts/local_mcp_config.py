"""Print a local client JSON configuration using this installation's absolute executable."""

import json
import sys
from pathlib import Path

from backend.app.core.config import DATA_DIR, ROOT

print(
    json.dumps(
        {
            "mcpServers": {
                "returnradar": {
                    "command": str(Path(sys.executable).absolute()),
                    "args": ["-m", "mcp_server.server"],
                    "cwd": str(ROOT),
                    "env": {"RETURNRADAR_DATA_DIR": str(DATA_DIR)},
                }
            }
        },
        indent=2,
    )
)
