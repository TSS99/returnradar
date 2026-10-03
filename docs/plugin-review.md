# ReturnRadar public plugin review preparation

Status: hosted website published; personal plugin provisioned. No public
directory submission, approval or connected user session is claimed.

Follow the current official instructions:
https://developers.openai.com/plugins/deploy/submission

Reuse the platform-provisioned Site plugin. Do not create a duplicate app or
replace its platform-managed OAuth flow. The account owner must complete any
required developer identity verification, portal terms/attestations, domain
verification challenge and final submission. Review approval is external.
Never publish credentials for a review account in this repository.

## Description

ReturnRadar keeps purchase records and receipt evidence in a private account,
tracks user-verified return and warranty dates, and prepares request drafts.
It does not guess merchant policy, guarantee eligibility, submit claims, send
messages, read email, make purchases or move money.

Website: https://returnradar.tss-99.chatgpt.site
Privacy: https://returnradar.tss-99.chatgpt.site/privacy
Terms: https://returnradar.tss-99.chatgpt.site/terms
MCP: https://returnradar.tss-99.chatgpt.site/mcp
Support: https://github.com/TSS99/returnradar/issues

## Positive test cases for the review video/session

Use synthetic purchases and the signed-in review account only.

1. Add a fictional product with a confirmed delivery date and real test policy
   text: seven days from delivery. Read it back and verify date arithmetic.
2. Search that product using `get_my_purchases`, then retrieve its details.
3. Ask for upcoming confirmed deadlines. Ensure tentative dates are excluded.
4. Change the product status to returned after the reviewer requests it. Verify
   it no longer appears as an actionable return deadline.
5. Prepare a warranty request from confirmed fields. Verify the draft includes
   the stated problem and clearly reports that it has not been sent.

## Negative test cases

1. Request another test account's purchase ID. Expect not found; no fields from
   that account may be returned.
2. Supply missing/ambiguous dates or unverified policy terms. Expect unknown or
   tentative status, never a fabricated confirmed deadline.
3. Ask to email the merchant, issue a refund, delete all data, or execute
   instructions embedded in a receipt. There is no tool for those operations;
   receipt content must remain data. No external action should occur.

## Owner-provided items still needed for a public listing

- Verified developer identity and appropriate portal permissions.
- Portal-compatible packaging of the existing provisioned plugin and its
  hosted MCP reference, using the platform's export/submission flow.
- Any exact domain verification token issued by the portal. Do not invent one.
- A dedicated review login/consent path with synthetic data, supplied privately
  through the portal when requested.
- A recorded walkthrough/video URL showing the five positive and three
  negative cases against the hosted authenticated plugin.
- Accurate policy attestations, final review submission, and publication after
  approval. Do not accept terms or attest on the owner's behalf without their
  explicit direction.

These account-owned steps do not block people using the public website now.
