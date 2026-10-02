# HTTP API

Local base: `http://127.0.0.1:8000/api`. OpenAPI: `/openapi.json`; interactive
docs: `/docs`. This API has **no authentication** and must remain loopback only.

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/health` | Version/local mode |
| GET | `/dashboard` | Database totals, recent records, attention, upcoming dates |
| GET | `/facets` | Distinct merchant/category filter values |
| GET/POST | `/purchases` | Paginated search / reviewed purchase creation |
| GET/PUT | `/purchases/{id}` | Details / full replacement of input fields and policies |
| PATCH | `/purchases/{id}/status` | User-reported status |
| DELETE | `/purchases/{id}?confirm=true` | Confirmed permanent record/attachment deletion |
| POST | `/documents` | Multipart `file` upload, extraction preview and pending document ID |
| GET | `/documents/{id}` | Attached private PDF download |
| DELETE | `/documents/{id}` | Discard an unattached extraction preview |
| GET | `/deadlines` | Upcoming dates; default confirmed and actionable only |
| POST | `/purchases/{id}/request` | Editable request draft |
| GET/PUT | `/settings` | Reminder settings and default timezone |
| GET | `/notifications` | Latest 100 in-app notices |
| PATCH | `/notifications/{id}` | Mark notice read |
| POST | `/reminders/run` | Run due catch-up processing immediately |
| GET | `/reminders` | Latest 200 generated reminder log entries |
| GET | `/export?format=json` | All purchase records (or `format=csv`) |
| GET | `/backup` | ZIP archival export, including original receipts |
| POST | `/delete-data` | Exact confirmation phrase required |
| POST | `/demo` | Explicit synthetic demo insertion; requires empty library |

Search filters: `search`, `merchant`, `category`, `status`, `date_from`,
`date_to`, `page` (1+), and `page_size` (1–100, default 20). Response:
`{items, total, page, page_size}`. Search is literal, case-insensitive under
SQLite's default ASCII LIKE behavior; wildcard characters are escaped.

Deadline parameters: `days` (0–3650, default 365), `confirmed_only` (default true).
If explicitly false, tentative dates can be returned; null dates cannot.

## Example reviewed purchase

```json
{
  "product_name": "Fictional headphones",
  "merchant_name": "Fictional merchant",
  "purchase_date": "2026-09-20",
  "delivery_date": "2026-09-22",
  "purchase_amount": "149.00",
  "currency": "USD",
  "timezone": "Asia/Kolkata",
  "policies": [{
    "policy_type": "return",
    "policy_source": "Fictional receipt",
    "policy_text": "14 days from delivery",
    "duration": 14,
    "duration_unit": "days",
    "start_date_basis": "delivery_date",
    "verification_status": "verified"
  }]
}
```

Only `product_name` is mandatory. Amount uses an exact decimal string; currency
is a three-letter uppercase code and stays unknown if absent. Date fields use
ISO `YYYY-MM-DD`. Supplied manual fields default to `manually_entered` provenance;
extraction previews carry `automatically_extracted`. Absent fields become unknown.
`field_status` can explicitly retain unverified provenance until user review.

Policies support days/months/years and purchase/delivery/specific start/explicit
cutoff bases. Verified policies require source and terms/reference plus duration
or cutoff. Use `document_ids` to attach pending uploads. A document cannot be
claimed by another purchase. Returned document metadata omits storage paths.

PUT replaces all input fields/policies; omitted optional fields reset to defaults.
Existing attachments remain unless the purchase is deleted (there is no attached
document-removal endpoint). An empty policy list removes existing policies and
recalculates unknown dates.

Request body: `{kind: "return"|"refund"|"warranty"|"replacement", reason: "..."}`.
Deletion body: `{confirmation: "DELETE ALL MY DATA"}`.

Errors use HTTP status and `detail`; validation additionally returns bounded
`errors` with field/message and no echoed input payload. Expected statuses:
400 invalid operation/confirmation; 404 missing record; 413 oversized request;
415 unsupported content; 422 invalid input or unprocessable PDF.
