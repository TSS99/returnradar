# MCP and plugin setup

ReturnRadar uses **mcp 2.2.0**, the official Python SDK, with `MCPServer` and
stdio transport. It shares schemas, SQLAlchemy services and the data directory
with FastAPI. The HTTP backend need not run for purchase tools. Reminders require
the backend worker or the one-shot scheduled worker.

## Verify a real local connection

From the repository root with `.venv` activated:

```bash
python -m scripts.mcp_smoke
python -m scripts.local_mcp_config
```

The smoke script launches a server subprocess, initializes a client, lists eight
tools and calls `get_my_purchases`. It is read-only. The config generator prints
valid JSON with the actual interpreter, repository cwd and private data directory.
Do not commit that machine-specific JSON. Copy it into your local MCP client's
server settings according to that client's documentation.

For Codex, the equivalent `config.toml` fields are:

```toml
[mcp_servers.returnradar]
command = "/absolute/path/to/returnradar/.venv/bin/python"
args = ["-m", "mcp_server.server"]
cwd = "/absolute/path/to/returnradar"

[mcp_servers.returnradar.env]
RETURNRADAR_DATA_DIR = "/absolute/path/to/private-returnradar"
```

Replace every path with your installation. On Windows use the virtual
environment's `Scripts/python.exe`. You can also run the installed
`returnradar-mcp` executable if the client can find the activated environment
on PATH. Desktop applications often do not inherit your terminal's PATH.

## Tools

| Tool | Main input | Result |
| --- | --- | --- |
| `add_purchase` | `purchase` per strict purchase schema | Saved local purchase |
| `get_my_purchases` | Search/filter/date/page arguments | Paginated records |
| `get_purchase_details` | `purchase_id` | Record, terms, evidence, deadlines, attachment metadata |
| `get_upcoming_deadlines` | `days`, default 7 | Actionable confirmed dates only |
| `update_purchase` | ID and replacement `purchase` | Updated purchase |
| `update_purchase_status` | ID and allowed `status` | User-reported local status |
| `generate_return_request` | ID, request `kind`, optional `reason` | Editable draft, `sent=false` |
| `get_warranty_status` | ID | Actual terms, computed date and status |

Tools provide explicit schemas, annotations, and structured `success/data` or
`success=false/error` output. SDK-level invalid inputs produce MCP errors. No
tool provides arbitrary command execution, file access, deletion, merchant
contact, email sending, or external policy verification.

For updates, retrieve details first and map output fields back to the input
schema; output IDs, timestamps, calculated deadlines, `is_demo`, warranty status
and document metadata are not valid purchase-input fields. Use `document_ids` for
existing receipt references. MCP does not expose raw invoice text or a PDF upload
tool in 0.1; use the dashboard for extraction and review.

## Portable local package

`plugin/plugin.json` follows the Agent Plugins 1.0 schema. Skills live at
`plugin/skills/returnradar/SKILL.md`; `plugin/mcp.json` declares explicit stdio
transport. `.codex-plugin/plugin.json` and `.mcp.json` provide Codex compatibility.

Install ReturnRadar first and make the command accessible to the runtime.
Package with `python -m scripts.package_plugin`. The ZIP contains public plugin
files and a licence, and no data, credentials, installed dependencies, or machine
paths. The package declares a dependency on an already installed local runtime;
it does not install software when enabled. Local marketplace installation and
client approval settings vary by host; this release does not modify your Codex
configuration automatically.

## ChatGPT and future public distribution

Local stdio support is available only where a client can execute the server.
ChatGPT web/public distribution requires a separately accessible HTTPS MCP
service and appropriate authentication/platform review. No localhost address is
presented as a public endpoint, and no production URL/client ID is invented.

`docs/deployment.md` describes the boundary and a deployment template. It is
not activated or deployed in this release. A hosted service must isolate users,
authorize every purchase access and add OAuth/transport/privacy controls before
accepting sensitive documents. Packaging this source is not directory submission.

Documentation consulted for this release:

- [Official Python SDK](https://github.com/modelcontextprotocol/python-sdk)
- [OpenAI MCP concepts](https://developers.openai.com/plugins/concepts/mcp-server)
- [OpenAI portable plugin packaging](https://developers.openai.com/plugins/build/plugins)
- [Codex MCP configuration](https://developers.openai.com/codex/mcp)
