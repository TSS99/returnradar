# Hosted ReturnRadar: use and ownership

Live website: https://returnradar.tss-99.chatgpt.site

## For people using it

1. Open the website on a phone or computer. Sign in with ChatGPT.
2. Choose **Add purchase** and upload a text-based receipt PDF or enter details.
3. Review the extracted fields and the actual return or warranty terms. A receipt
   does not automatically prove the merchant's return policy.
4. Use the overview/calendar to see confirmed deadlines. Open a purchase to
   prepare a request; review and send it yourself through the merchant's channel.
5. Use Settings to export, back up or delete your cloud data. Use the same account
   on every device. No local server, installation or API key is needed.

Every account starts empty. Demo data is explicitly optional and fictional.
The service supports 250 purchases, 20 PDFs and 20 MB total PDFs per account;
each PDF is limited to 10 MB/50 pages. Scanned and password-protected PDFs need
manual entry. Reminders appear in the app on visits and while it is open. This
release does not send email/push reminders while the app is closed.

## See how many people use it

Sign in with the owner ChatGPT account and open:
https://returnradar.tss-99.chatgpt.site/admin

The owner sees registered users; active users over 24 hours, seven days and
30 days; new users; users with purchases; and real purchases tracked. A daily
30-day table shows active users, web requests, MCP calls, purchases added,
receipt uploads and drafts prepared. Refresh to update the counts.

Counts include the owner and authenticated background refreshes. Registered
users means accounts that have accessed the data service. It is not an estimate
of anonymous visitors or a forecast. Deleting all account data also removes
that account's usage history. Daily data older than 90 days is pruned when that
account next becomes active. The dashboard exposes aggregates, not receipts.
The owner identity is protected by a production secret and a stable user ID.

## ChatGPT plugin

The Site has a hosted authenticated MCP endpoint:
https://returnradar.tss-99.chatgpt.site/mcp

The hosting platform provisioned ReturnRadar's personal plugin. The owner can
find **Plugins → Personal → Created by you → ReturnRadar**, then Install/Connect
as available. Use the same ChatGPT account as on the website. Try:

- “Show my purchases with confirmed return deadlines in the next seven days.”
- “What is the warranty status of my headphones?”
- “Draft a return request for this purchase; don't send it.”

Website access is public. Personal plugin installation/connection is a separate
user action, and the public ChatGPT directory has not approved this plugin.
See [the prepared review checklist](plugin-review.md) for broader distribution.
Do not promise users an available public directory listing before approval.

## Hosting and maintenance

The published version runs on managed Sites infrastructure using a Worker,
D1 database and private R2 objects. The developer's computer can be off.
No paid model API, paid domain, extra hosting subscription or automatic billing
was configured. Hosting capacity remains subject to platform availability and
quotas; this is not a promise of unlimited or permanently free service.

`hosted/` is a source mirror of the published Sites checkout, with an additional
repository-specific AGENTS.md. Published source commit:
`3b6ce326489b83b01120fbab7a356907e9d37ec5`.
Site version 1 was published successfully on 2026-10-03.
GitHub pushes run checks; they do not automatically publish the managed Site.
Use the existing Site project and the documented Sites workflow for updates.

Verification before publication: 19 SQLite-backed domain/API/MCP/security tests,
three Chromium browser journeys, TypeScript checking, production build, and
runtime dependency audit (zero vulnerabilities). The full dependency audit
reports eight high findings in the development-only `braces` glob dependency
chain; the upstream latest version was still affected at publication. Details
are in [hosted/README.md](../hosted/README.md#dependency-security).
No production user purchases or invoice contents were used for testing.
Browser WebMCP support is optional and was not validated in a supporting browser;
this does not affect the separately tested remote MCP server.

Production publishing was verified by the hosting platform's successful
version/deployment result. The cloud OAuth consent journey and plugin connection
still require the real user's action; local browser tests use a fictional
loopback-only account, never a production login bypass.

Report bugs through GitHub without posting receipts or personal information.
For private security reports, use GitHub's **Security → Report a vulnerability**.
