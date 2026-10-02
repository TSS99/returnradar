# Privacy

ReturnRadar 0.1 keeps its SQLite purchase data and receipt PDFs in a local data
directory. Receipts are processed locally with pypdf. It has no telemetry,
advertising, analytics provider, paid inference API, or third-party invoice upload.
The interface uses system fonts and bundled assets; it does not fetch web fonts.

Stored data includes merchant/product descriptions, dates, amount/currency,
order/invoice references, user notes, policy sources and terms, field provenance
and limited extraction evidence, original PDF attachments, content hashes,
deadline/reminder history, timezone/preferences, and a synthetic demo flag.
Entire original PDFs may contain personal information that the field extractor
does not use. Upload only what you need; do not put secrets in notes or policies.

The app does not log full invoice text or parser exception contents. Normal
server access logs include route paths and record IDs. The parser's stderr is
captured privately and not returned to users or stored in application logs.

MCP tool results are shared with the client you connect. That client, including
an AI service, may process or retain returned purchase details under its own
terms. Local processing does not imply that external clients are private.
Never enable an untrusted client without considering what it can request.

Dependency installation and optional vulnerability audits contact package
registries/security databases. These are development actions, not invoice uploads.

## Export, retention and deletion

Use Settings to export CSV/JSON or download a ZIP with purchase records,
receipt attachments, preferences and notification history. Store these exports
privately. A ZIP is a readable archival export; automatic restore is not supplied.
For a restorable snapshot, stop local processes and privately copy the entire
data folder as described in `docs/local-setup.md`.

Purchase deletion removes associated records and original receipt files. All-data
deletion requires typing `DELETE ALL MY DATA`, removes preferences and pending
uploads too, and vacuums the database. Abandoned previews remain local until
discarded or all-data deletion. Previously exported copies and OS/cloud backups
are outside the app's control. Filesystem or SSD forensic erasure is not guaranteed.

No accounts exist in v0.1. All processes with access to the local data folder
share one library. Data is not encrypted by the app. Use a private OS account,
private folder and full-disk encryption. Keep private data out of Git.

Any hosted multi-user service needs a separate privacy policy/review, legitimate
processing basis, access controls, retention rules, and user data rights process
before launch. This policy describes only the local open-source application.
