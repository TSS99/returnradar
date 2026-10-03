# ReturnRadar hosted beta

The hosted version of [ReturnRadar](https://github.com/TSS99/returnradar) runs on
managed infrastructure, independently of the developer's computer. It uses
ChatGPT sign-in, Cloudflare-compatible Workers through OpenAI Sites, D1 for
account-owned records and R2 for private PDF storage. No paid model/API is used.

## User flow

Visit the published website, sign in with ChatGPT, upload a text PDF or add a
purchase, review the details and verify the actual policy. Use the same account
on every device. The `/guide` page explains web and ChatGPT usage. `/privacy`
and `/terms` describe the hosted beta's behavior and limitations.

The owner can open `/admin` for aggregate registered/active users, purchase,
receipt, draft and MCP usage. The dashboard cannot browse other users' receipts.
`RETURNRADAR_OWNER_EMAIL` must be set as a server-side secret to the verified
owner address. On that account's first owner check, the app binds its stable
site-specific subject ID. No visitor can claim ownership by being first.

## Architecture

- `app/`: sign-in, account workspace, API/MCP route adapters, guide, privacy,
  terms and owner analytics.
- `src/`: ReturnRadar's React interface, ported from the local version.
- `server/domain.ts`: strict input schemas, date calculations and request drafts.
- `server/store.ts`: authenticated service layer shared by HTTP and MCP.
- `server/http.ts`: bounded uploads, protected downloads, export and deletion.
- `server/mcp.ts`: eight tools using the official TypeScript MCP SDK and
  stateless streamable HTTP.
- `db/schema.ts` and `drizzle/`: versioned D1 schema and migrations.
- `tests/`: SQLite-backed ownership and service tests; real browser journeys.

All data-bearing operations require identity. Ownership predicates are required
on every read/write, and composite foreign keys prevent cross-account document
and notification links. The platform strips and supplies trusted identity
headers. Do not expose this Worker behind a proxy that forwards unverified
`oai-authenticated-user-*` headers. Authentication is not implemented by a
client-side login flag. Development sign-in exists only on loopback and is
excluded from the production build.

PDF extraction runs in a browser worker, is bounded to 50 pages/200,000 text
characters, and requires human review. The server validates PDF bytes, bounds
request streams, checks ownership and limits account storage. Raw files are
served only as authenticated attachments. No invoice text is logged. Documents
remain untrusted data throughout.

## Local development

Use Node.js 24+ (Node 26 also tested).

```bash
npm ci
npm run typecheck
npm test
npm run build
node --import ./scripts/sites-env.mjs ./node_modules/wrangler/bin/wrangler.js d1 execute DB --local --config dist/server/wrangler.json --persist-to .wrangler/state --file drizzle/0000_left_wendell_vaughn.sql
npm run dev -- --port 5174 --host 127.0.0.1
```

Apply each local migration once. Do not replay already-applied SQL. For local
owner-dashboard testing only, create ignored `.dev.vars` with
`RETURNRADAR_OWNER_EMAIL="seedy@sites.test"`. This is the starter's fictional
loopback identity, never a production administrator value.

With the local server running:

```bash
npx playwright install chromium
npm run test:e2e
npm audit --omit=dev
```

The source manifest identifies the managed Site. Production publishing uses the
Sites workflow, which builds an archive, pushes its exact source and applies
versioned migrations before deploying. Runtime secrets belong in the platform's
environment settings, never in `.openai/hosting.json` or browser code.

## MCP and distribution

The hosted endpoint is `/mcp`. The hosting platform manages authentication and
provisions the Site's personal plugin. Reuse that plugin on updates; don't
create a second application or put credentials in a manifest. Tool discovery
contains no private data. Every tool call uses a fresh authenticated user
context, with no shared global user state. No deletion or unrestricted file or
command tools are exposed.

The owner can install/connect the provisioned plugin through **Plugins →
Personal → Created by you**. Public website access does not imply a public
ChatGPT directory listing. Broader plugin distribution depends on the platform's
sharing controls or a separate verified submission, scans, review materials and
approval. See the official [submission guide](https://developers.openai.com/plugins/deploy/submission).

## Limits and operations

This beta allows 250 purchases, 20 PDFs and 20 MB of receipts per account; each
PDF is at most 10 MB. The API limits authenticated requests to 120 per minute.
These are application limits, not a promise of hosting capacity or unlimited
free usage. No paid resources, domains, AI credits or auto-billing were enabled.

In-app reminders are processed on visits and every minute while the workspace
is open. Catch-up is idempotent and bounded to 25 notices per request. No worker
needs to run on a user's computer between visits, but there is no email/push
notification service or independent cloud scheduler in this release.

Exports and backup ZIPs are account-scoped. Backup restore is not automatic.
Delete-data removes active account records, PDF objects and associated usage
history; provider backup retention and forensic erasure are outside app control.
All real users start empty. Fictional demo data is opt-in and labeled.

Usage counts measure authenticated activity, including workspace refreshes and
the owner. No anonymous visitor tracker or advertising cookies are installed.
Daily activity older than 90 days is pruned on that account's next activity.
Only aggregate counts appear in the owner dashboard.

## Dependency security

The starter's affected Next.js, React server runtime, Vite and Worker build
packages were upgraded before publication. The runtime audit is a release
check. The full development audit also reports an upstream `braces <=3.0.3`
stack-exhaustion advisory through build-time glob tools; no patched upstream
version was available when checked. Those glob tools consume repository/build
patterns and are not shipped in the published application. Do not build
untrusted source. Keep the development audit visible and revisit the upstream
fix when available; do not confuse runtime and development audit results.

MIT. See `LICENSE`.
