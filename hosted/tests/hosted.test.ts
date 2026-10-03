import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { unzipSync, strFromU8 } from "fflate";
import { fixture, alice, bob, owner, request } from "./helpers";
import { Store } from "../server/store";
import { handleApi, boundedBody } from "../server/http";
import { handleMcp } from "../server/mcp";
import { purchaseSchema, hydrate, addDate, today } from "../server/domain";
import { extractFields } from "../server/extraction";
const verified = {
  policy_type: "return",
  policy_source: "Merchant terms",
  policy_text: "7 days from delivery",
  duration: 7,
  start_date_basis: "delivery_date",
  verification_status: "verified",
};
async function data(r: Response) {
  return (await r.json()) as any;
}
async function make(env: any, who = alice) {
  const s = new Store(env, who, new Date("2026-10-03T10:00:00Z"));
  await s.register("web");
  return s;
}

test("anonymous API access and cross-site writes are rejected", async () => {
  const { env } = fixture();
  assert.equal((await handleApi(request("/purchases", null), env)).status, 401);
  const cross = request("/purchases", alice, "POST", { product_name: "Test" });
  cross.headers.set("Origin", "https://evil.example");
  assert.equal((await handleApi(cross, env)).status, 403);
  const noHeader = request("/purchases", alice, "POST", {
    product_name: "Test",
  });
  noHeader.headers.delete("X-ReturnRadar-Request");
  assert.equal((await handleApi(noHeader, env)).status, 403);
});
test("users cannot get, modify, delete or reference another user’s purchase", async () => {
  const { env } = fixture();
  const a = await make(env),
    b = await make(env, bob);
  const p = await a.save({
    product_name: "Private item",
    purchase_amount: "99999999999999.1234",
  });
  assert.equal(p.purchase_amount, "99999999999999.1234");
  assert.equal((await b.list()).total, 0);
  for (const method of ["GET", "PUT", "DELETE"])
    assert.equal(
      (
        await handleApi(
          request(
            `/purchases/${p.id}?confirm=true`,
            bob,
            method,
            method === "PUT" ? { product_name: "Intrusion" } : undefined,
          ),
          env,
        )
      ).status,
      404,
    );
  assert.equal(
    (
      await handleApi(
        request(`/purchases/${p.id}/status`, bob, "PATCH", {
          status: "refunded",
        }),
        env,
      )
    ).status,
    404,
  );
  assert.equal(
    (
      await handleApi(
        request(`/purchases/${p.id}/request`, bob, "POST", { kind: "return" }),
        env,
      )
    ).status,
    404,
  );
  assert.equal((await a.get(p.id)).product_name, "Private item");
});
test("filters, status updates, JSON and CSV export preserve isolation", async () => {
  const { env } = fixture(),
    a = await make(env),
    b = await make(env, bob);
  const p = await a.save({
    product_name: "=unsafe formula",
    merchant_name: "Acme",
    purchase_date: "2026-01-02",
  });
  await b.save({ product_name: "Bob secret" });
  assert.equal(
    (
      await a.list({
        search: "unsafe",
        merchant: "Acme",
        date_from: "2026-01-01",
      })
    ).total,
    1,
  );
  assert.equal((await a.list({ date_to: "2025-12-31" })).total, 0);
  assert.equal((await a.status(p.id, "kept")).purchase_status, "kept");
  const exp = await data(await handleApi(request("/export"), env));
  assert.equal(exp.purchases.length, 1);
  assert.equal(exp.purchases[0].product_name, "=unsafe formula");
  const csv = await (
    await handleApi(request("/export?format=csv"), env)
  ).text();
  assert.match(csv, /'=unsafe formula/);
  assert.ok(!csv.includes("Bob secret"));
});
test("strict validation rejects forged ownership, duplicate policies and invalid dates", () => {
  for (const input of [
    { product_name: "X", owner_id: "bob" },
    { product_name: "X", is_demo: true },
    { product_name: "X", purchase_date: "2026-02-30" },
    {
      product_name: "X",
      purchase_date: "2026-10-03",
      delivery_date: "2026-10-01",
    },
    { product_name: "X", timezone: "Not/AZone" },
    { product_name: "X", purchase_amount: "1.23456" },
    { product_name: "X", policies: [verified, verified] },
  ])
    assert.equal(purchaseSchema.safeParse(input).success, false);
});
test("deadlines require verified terms and the correct confirmed start", async () => {
  const { env } = fixture(),
    s = await make(env);
  let p = await s.save({
    product_name: "X",
    purchase_date: "2026-10-01",
    policies: [verified],
  });
  assert.equal(p.deadlines[0].verification_status, "unknown");
  p = await s.save({
    product_name: "X",
    purchase_date: "2026-10-01",
    delivery_date: "2026-10-03",
    policies: [verified],
    field_status: { delivery_date: "automatically_extracted" },
  });
  assert.equal(p.deadlines[0].deadline_date, "2026-10-10");
  assert.equal(p.deadlines[0].verification_status, "tentative");
  p = await s.save({
    product_name: "X",
    delivery_date: "2026-10-03",
    policies: [verified],
  });
  assert.equal(p.deadlines[0].verification_status, "confirmed");
  assert.equal(
    purchaseSchema.safeParse({
      product_name: "X",
      policies: [{ ...verified, start_date_basis: "unknown" }],
    }).success,
    false,
  );
});
test("calendar arithmetic clamps month ends and leaves overflow unknown", () => {
  assert.equal(addDate("2024-02-29", 1, "years"), "2025-02-28");
  assert.equal(addDate("2026-01-31", 1, "months"), "2026-02-28");
  assert.equal(addDate("9999-12-31", 1, "days"), null);
  assert.equal(
    today("America/Los_Angeles", new Date("2026-10-03T02:00:00Z")),
    "2026-10-02",
  );
});
test("explicit warranty cutoff does not invent an active warranty start", async () => {
  const { env } = fixture(),
    s = await make(env);
  const p = await s.save({
    product_name: "X",
    policies: [
      {
        policy_type: "warranty",
        policy_source: "Terms",
        policy_text: "Until cutoff",
        start_date_basis: "explicit",
        cutoff_date: "2027-01-01",
        verification_status: "verified",
      },
    ],
  });
  assert.equal(p.warranty_status, "end_date_confirmed");
});
test("verification timestamps are stable across unrelated edits", async () => {
  const { env } = fixture(),
    s = await make(env);
  const input = {
    product_name: "X",
    delivery_date: "2026-10-03",
    policies: [verified],
  };
  const p = await s.save(input);
  s.now = new Date("2026-10-04T10:00:00Z");
  const edited = await s.save({ ...input, notes: "Changed note" }, p.id);
  assert.equal(
    edited.policies[0].last_verified_at,
    p.policies[0].last_verified_at,
  );
});
test("reminders catch up without duplicates and remain account-owned", async () => {
  const { env } = fixture(),
    s = await make(env),
    b = await make(env, bob);
  const p = await s.save({
    product_name: "Due item",
    policies: [
      {
        policy_type: "return",
        policy_source: "Terms",
        policy_text: "Cutoff",
        start_date_basis: "explicit",
        cutoff_date: "2026-10-03",
        verification_status: "verified",
      },
    ],
  });
  assert.equal((await s.reminders()).generated, 4);
  assert.equal((await s.reminders()).generated, 0);
  assert.equal((await b.notices()).length, 0);
  const notices = await s.notices();
  assert.equal(
    (
      await handleApi(
        request("/notifications/" + notices[0].id, bob, "PATCH"),
        env,
      )
    ).status,
    404,
  );
  await s.status(p.id, "returned");
  assert.equal((await s.reminders()).generated, 0);
});
test("reminders respect local 9 am, disable setting, and bounded catch-up", async () => {
  const { env } = fixture(),
    s = await make(env);
  s.now = new Date("2026-10-03T08:30:00Z");
  await s.setSettings({
    timezone: "UTC",
    reminders_enabled: true,
    reminder_offsets: [0],
  });
  await s.save({
    product_name: "Due",
    policies: [
      {
        policy_type: "return",
        policy_source: "Terms",
        policy_text: "Cutoff",
        start_date_basis: "explicit",
        cutoff_date: "2026-10-03",
        verification_status: "verified",
      },
    ],
  });
  assert.equal((await s.reminders()).generated, 0);
  s.now = new Date("2026-10-03T09:00:00Z");
  assert.equal((await s.reminders()).generated, 1);
  await s.setSettings({ reminders_enabled: false });
  assert.equal((await s.reminders()).enabled, false);
});
test("drafts use only confirmed fields and are never sent", async () => {
  const { env } = fixture(),
    s = await make(env);
  const p = await s.save({
    product_name: "Widget",
    merchant_name: "Unconfirmed merchant",
    field_status: { merchant_name: "automatically_extracted" },
  });
  const draft = await s.draft(p.id, {
    kind: "warranty",
    reason: "Stopped working",
  });
  assert.equal(draft.sent, false);
  assert.ok(draft.body.includes("Widget"));
  assert.ok(!draft.body.includes("Unconfirmed merchant"));
  assert.ok(draft.body.includes("Stopped working"));
});
test("PDF upload, private download, attachment isolation, backup and removal", async () => {
  const { env, files } = fixture();
  const a = await make(env),
    b = await make(env, bob);
  const form = new FormData();
  form.set(
    "file",
    new File(
      [readFileSync("sample_data/synthetic-receipt.pdf")],
      "../../receipt.pdf",
      { type: "application/pdf" },
    ),
  );
  form.set(
    "extracted_text",
    "Merchant: Fictional Store\nProduct: Example item\nPurchase date: 2026-10-01\nTotal: INR 2499.00\nCurrency: INR",
  );
  const req = new Request("https://returnradar.example/api/documents", {
    method: "POST",
    headers: {
      "oai-authenticated-user-id": alice.id,
      "oai-authenticated-user-email": alice.email,
      Origin: "https://returnradar.example",
      "X-ReturnRadar-Request": "1",
    },
    body: form,
  });
  const response = await handleApi(req, env);
  assert.equal(response.status, 201);
  const upload = await data(response);
  assert.equal(upload.fields.purchase_amount, "2499.00");
  assert.equal(upload.field_status.purchase_date, "automatically_extracted");
  await assert.rejects(() =>
    b.save({ product_name: "Steal", document_ids: [upload.document.id] }),
  );
  const p = await a.save({
    product_name: "Example",
    document_ids: [upload.document.id],
  });
  assert.equal(
    (await handleApi(request("/documents/" + upload.document.id, bob), env))
      .status,
    404,
  );
  assert.equal(
    (await handleApi(request("/documents/" + upload.document.id), env)).status,
    200,
  );
  const backup = await handleApi(request("/backup"), env);
  const zip = unzipSync(new Uint8Array(await backup.arrayBuffer()));
  assert.ok(zip["documents/" + upload.document.id + ".pdf"]);
  assert.equal(
    JSON.parse(strFromU8(zip["purchases.json"])).purchases.length,
    1,
  );
  await a.remove(p.id);
  assert.equal(files.size, 0);
  assert.equal((await a.docs()).length, 0);
});
test("oversized bodies are rejected before parsing even without content-length", async () => {
  const r = new Request("https://returnradar.example/api/purchases", {
    method: "POST",
    body: "x".repeat(500),
  });
  await assert.rejects(() => boundedBody(r, 100), /too large/);
});
test("bulk deletion removes only the signed-in user and their usage", async () => {
  const { env, sql } = fixture(),
    a = await make(env),
    b = await make(env, bob);
  await a.save({ product_name: "Alice" });
  await b.save({ product_name: "Bob" });
  await assert.rejects(() => a.wipe("DELETE"));
  await a.wipe("DELETE ALL MY DATA");
  assert.equal((await b.all()).length, 1);
  assert.equal(
    (
      sql
        .prepare("SELECT COUNT(*) AS n FROM activity WHERE owner_id=?")
        .get(alice.id) as any
    ).n,
    0,
  );
});
test("owner dashboard rejects ordinary users and contains aggregates only", async () => {
  const { env } = fixture(),
    a = await make(env),
    o = await make(env, owner);
  await a.save({
    product_name: "Confidential receipt label",
    purchase_amount: "123.45",
  });
  await assert.rejects(() => a.analytics(), /Owner access/);
  const report = await o.analytics();
  assert.equal(report.totals?.registered_users, 2);
  assert.equal(report.totals?.purchases, 1);
  assert.ok(!JSON.stringify(report).includes("Confidential"));
  assert.ok(!JSON.stringify(report).includes(alice.email));
  assert.equal((await handleApi(request("/admin/analytics"), env)).status, 403);
});
test("database composite foreign key prevents cross-user document attachment", async () => {
  const { env, sql } = fixture(),
    a = await make(env),
    b = await make(env, bob),
    p = await a.save({ product_name: "A" });
  assert.throws(
    () =>
      sql
        .prepare(
          "INSERT INTO documents(id,owner_id,purchase_id,original_filename,object_key,content_hash,size,upload_timestamp) VALUES(?,?,?,?,?,?,?,?)",
        )
        .run("bad", b.user.id, p.id, "x", "x", "x", 1, "now"),
    /FOREIGN KEY/,
  );
});
test("extraction leaves ambiguous dates and absent terms unknown", () => {
  const result = extractFields(
    "Merchant: Sample\nPurchase date: 03/04/2026\nTotal: 19,99\nProduct: A\nProduct: B",
  );
  assert.equal(result.fields.purchase_date, null);
  assert.equal(result.fields.purchase_amount, null);
  assert.equal(result.fields.product_name, null);
  assert.equal(result.policies.length, 0);
});
test("MCP SDK discovery and actual tool calls preserve authentication and isolation", async () => {
  const { env } = fixture(),
    a = await make(env);
  const p = await a.save({ product_name: "Private A" });
  const rpc = (method: string, params: any, who: typeof alice | null = alice) =>
    new Request("https://returnradar.example/mcp", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json, text/event-stream",
        ...(who
          ? {
              "oai-authenticated-user-id": who.id,
              "oai-authenticated-user-email": who.email,
            }
          : {}),
      },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
    });
  const init = await data(
    await handleMcp(
      rpc(
        "initialize",
        {
          protocolVersion: "2025-03-26",
          capabilities: {},
          clientInfo: { name: "tests", version: "1" },
        },
        null,
      ),
      env,
    ),
  );
  assert.ok(init.result.serverInfo);
  const tools = await data(await handleMcp(rpc("tools/list", {}, null), env));
  assert.equal(tools.result.tools.length, 8);
  assert.equal(
    (
      await handleMcp(
        rpc("tools/call", { name: "get_my_purchases", arguments: {} }, null),
        env,
      )
    ).status,
    401,
  );
  const result = await data(
    await handleMcp(
      rpc("tools/call", { name: "get_my_purchases", arguments: {} }),
      env,
    ),
  );
  assert.equal(result.result.structuredContent.data.total, 1);
  const denied = await data(
    await handleMcp(
      rpc(
        "tools/call",
        { name: "get_purchase_details", arguments: { purchase_id: p.id } },
        bob,
      ),
      env,
    ),
  );
  assert.equal(denied.result.isError, true);
  const invalid = await data(
    await handleMcp(
      rpc("tools/call", {
        name: "get_upcoming_deadlines",
        arguments: { days: -1 },
      }),
      env,
    ),
  );
  assert.equal(invalid.result.isError, true);
});

test("named receipt dates reject impossible days rather than normalizing them", () => {
  assert.equal(
    extractFields("Purchase date: 30 February 2026").fields.purchase_date,
    null,
  );
  assert.equal(
    extractFields("Purchase date: February 29, 2025").fields.purchase_date,
    null,
  );
  assert.equal(
    extractFields("Purchase date: 29 Feb 2024").fields.purchase_date,
    "2024-02-29",
  );
  assert.equal(
    extractFields("Purchase date: October 3, 2026").fields.purchase_date,
    "2026-10-03",
  );
});
