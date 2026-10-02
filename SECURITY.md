# Security policy

ReturnRadar 0.1 supports local single-user use only. Keep API and frontend
bound to `127.0.0.1`. Do not deploy the unauthenticated API or its document
downloads to a public interface or tunnel.

## Implemented controls

- PDF magic bytes, 10 MB request/upload limit, 50-page and extracted-text limits.
- Fixed parser subprocess with a 15-second timeout, CPU limit on Unix and a
  512 MB address-space limit on Linux. This is process isolation, not an OS sandbox.
  macOS does not enforce the address-space limit; untrusted PDF parsing is still
  a residual risk. pypdf never executes document JavaScript or embedded code.
- UUID-generated stored names, hash metadata, traversal/symlink checks, private
  data directories, and attached-document-only downloads by record ID.
- Strict input validation, constrained browser origins/Host headers, and request
  body limits even when Content-Length is missing.
- SQLAlchemy-bound queries, foreign keys, cascade deletion and CSV formula escaping.
- No arbitrary MCP filesystem or command tools; no deletion tools; local web
  deletion needs explicit confirmation. MCP annotation hints are not authorization.
- Dependencies pinned in lockfiles. Ruff, Bandit, pip-audit and npm audit in CI.
  Two narrow Bandit annotations cover the fixed PDF parser subprocess; uploaded
  bytes enter stdin and cannot change its executable, arguments, or shell.

There are no stored passwords, API keys or email credentials. SQLite and receipt
files are not encrypted at rest. A malicious local user/process with filesystem
access can read them. OS account controls and disk encryption are recommended.
Browser-origin defenses do not authenticate other local processes.

## Reporting

Use GitHub's private vulnerability reporting if enabled on this repository.
If unavailable, open a minimal issue requesting a private contact without
posting exploit details, credentials, real invoices, or personal data. Report
affected version, reproduction with synthetic data, and likely impact privately.
Security fixes target the latest release; there is no promised response SLA.

## Public deployment is separate work

A public version requires identity management, per-record authorization,
tenant isolation, encrypted/controlled document storage, TLS, OAuth for MCP,
rate and resource limits, trusted proxy configuration, access auditing without
invoice logging, retention and incident procedures, and a privacy review.
This release implements none of those remote-hosting guarantees. See
`docs/deployment.md` for the template and required boundary.
