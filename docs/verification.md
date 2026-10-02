# Local release verification

Executed on 2026-10-03 (Asia/Kolkata), macOS arm64, Python 3.11.15 and Node 26.9.0.
These are observed local results, not a claim about unrun platforms.

| Check | Observed result |
| --- | --- |
| `python -m pytest -q` | 58 passed |
| `ruff check .` | Passed |
| `ruff format --check .` | 56 Python files formatted |
| `bandit -r backend/app mcp_server -q` | Passed; narrow fixed-subprocess annotations documented in SECURITY.md |
| `pip-audit` | No known dependency vulnerabilities; unpublished local package itself excluded by auditor |
| `python -m scripts.mcp_smoke` | Real stdio connection, eight tools, read-only purchase call succeeded |
| `npm run build` | TypeScript and Vite production build passed |
| `npm run format:check` | Passed |
| `npm audit --audit-level=low` | Zero reported vulnerabilities |
| `npm run test:e2e` | Four real browser journeys passed |
| Portable plugin/MCP manifests | Validated against Agent Plugins 1.0 JSON schemas |
| Fresh virtual environment from lockfile | Installation and backend/MCP tests repeated successfully |

Browser journeys cover manual CRUD/search/unknown dates/draft/download/deletion;
PDF upload/correction/confirmation and delivery-based policy verification;
explicit fictional demo and actual light/dark/mobile screenshots with no horizontal
overflow; persisted settings, JSON download and deletion confirmation.

Backend scenarios include unknown merchant/dates/policy, malformed/scanned/
encrypted/oversized/unsupported uploads, ambiguous dates/amounts, date bases,
calendar-month/leap-year arithmetic, warranty start/expiry accuracy, stable
verification timestamps, timezone/DST boundaries, retry/catch-up/idempotency,
request types, MCP validation/stdio, foreign-key/cascade integrity, export/backup,
origin/Host/body-size/path controls, and orphaned-upload cleanup.

The source publication review checks all tracked files for excluded local-data
paths and common credential patterns. The only committed PDF is the explicitly
fictional receipt fixture. Screenshots were inspected from the running app and
label demo data. There are no real purchase records, private databases or `.env`
credentials in the tracked source. Initial lint/type/MCP/browser-test failures
were corrected; the final local runs have no remaining failures.

CI results are reported separately by GitHub Actions. The check suite also runs
there on every push and pull request. No public hosting or paid API was provisioned.

The first complete-source CI run passed all 58 backend tests, then detected
PYSEC-2026-3447 in the runner's preinstalled setuptools 79.0.1. The development
lock now includes setuptools 84.0.0 and isolated package builds require at least
83, so installations replace the vulnerable bootstrap tool rather than suppress
the audit finding.
