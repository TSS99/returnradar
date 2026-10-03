import type {
  Purchase,
  Preferences,
  DocumentInfo,
  Deadline,
} from "../src/types";
import {
  ServiceError,
  preferencesSchema,
  purchaseSchema,
  hydrate,
  actionable,
  today,
  daysBetween,
  addDate,
  requestDraft,
} from "./domain";
export type Bindings = {
  DB?: D1Database;
  BUCKET?: R2Bucket;
  RETURNRADAR_OWNER_EMAIL?: string;
  OPENAI_APPS_CHALLENGE?: string;
};
export type Identity = { id: string; email: string; name: string };
export const DEFAULT_SETTINGS: Preferences = {
  timezone: "UTC",
  reminders_enabled: true,
  reminder_offsets: [7, 3, 1, 0],
};
type Row = {
  id: string;
  owner_id: string;
  data: string;
  is_demo: number;
  created_at: string;
  updated_at: string;
};
export type Doc = DocumentInfo & {
  owner_id: string;
  purchase_id: string | null;
  object_key: string;
  size: number;
};
export class Store {
  readonly db: D1Database;
  constructor(
    public env: Bindings,
    public user: Identity,
    public now = new Date(),
  ) {
    if (!env.DB)
      throw new ServiceError(
        "Storage is temporarily unavailable. Please try again.",
        503,
      );
    this.db = env.DB;
  }
  sql(query: string, ...values: unknown[]) {
    return this.db.prepare(query).bind(...values);
  }
  async register(channel: "web" | "mcp") {
    const stamp = this.now.toISOString(),
      day = stamp.slice(0, 10);
    await this.db.batch([
      this.sql(
        "INSERT INTO users(id,created_at,last_active,settings) VALUES(?,?,?,?) ON CONFLICT(id) DO UPDATE SET last_active=excluded.last_active",
        this.user.id,
        stamp,
        stamp,
        JSON.stringify(DEFAULT_SETTINGS),
      ),
      this.sql(
        "INSERT INTO activity(owner_id,day,web_requests,mcp_calls) VALUES(?,?,?,?) ON CONFLICT(owner_id,day) DO UPDATE SET web_requests=web_requests+excluded.web_requests,mcp_calls=mcp_calls+excluded.mcp_calls",
        this.user.id,
        day,
        channel === "web" ? 1 : 0,
        channel === "mcp" ? 1 : 0,
      ),
      this.sql(
        "DELETE FROM request_limits WHERE owner_id=? AND bucket<?",
        this.user.id,
        stamp.slice(0, 16),
      ),
      this.sql(
        "INSERT INTO request_limits(owner_id,bucket,requests) VALUES(?,?,1) ON CONFLICT(owner_id,bucket) DO UPDATE SET requests=requests+1",
        this.user.id,
        stamp.slice(0, 16),
      ),
      this.sql(
        "DELETE FROM activity WHERE owner_id=? AND day<?",
        this.user.id,
        new Date(this.now.getTime() - 90 * 86400000).toISOString().slice(0, 10),
      ),
    ]);
    const limit = await this.sql(
      "SELECT requests FROM request_limits WHERE owner_id=? AND bucket=?",
      this.user.id,
      stamp.slice(0, 16),
    ).first<{ requests: number }>();
    if ((limit?.requests || 0) > 120)
      throw new ServiceError(
        "Too many requests. Please wait a minute and try again.",
        429,
      );
  }
  async isAdmin() {
    // Only a verified hosting identity matching the configured owner can bind the stable subject.
    // A unique singleton prevents first-visitor takeover and concurrent administrator claims.
    const configured = this.env.RETURNRADAR_OWNER_EMAIL?.trim().toLowerCase();
    if (configured && this.user.email.toLowerCase() === configured)
      await this.sql(
        "INSERT INTO administrators(id,subject) VALUES(1,?) ON CONFLICT(id) DO NOTHING",
        this.user.id,
      ).run();
    const row = await this.sql(
      "SELECT subject FROM administrators WHERE id=1",
    ).first<{ subject: string }>();
    return row?.subject === this.user.id;
  }
  async event(
    column: "purchases_added" | "drafts_prepared" | "receipts_uploaded",
  ) {
    await this.sql(
      `INSERT INTO activity(owner_id,day,${column}) VALUES(?,?,1) ON CONFLICT(owner_id,day) DO UPDATE SET ${column}=${column}+1`,
      this.user.id,
      this.now.toISOString().slice(0, 10),
    ).run();
  }
  async settings() {
    const row = await this.sql(
      "SELECT settings FROM users WHERE id=?",
      this.user.id,
    ).first<{ settings: string }>();
    return preferencesSchema.parse(
      row ? JSON.parse(row.settings) : DEFAULT_SETTINGS,
    );
  }
  async setSettings(input: unknown) {
    const value = preferencesSchema.parse(input);
    await this.sql(
      "UPDATE users SET settings=? WHERE id=?",
      JSON.stringify(value),
      this.user.id,
    ).run();
    return value;
  }
  async docs() {
    return (
      await this.sql(
        "SELECT * FROM documents WHERE owner_id=?",
        this.user.id,
      ).all<Doc>()
    ).results;
  }
  documentInfo(d: Doc): DocumentInfo {
    return {
      id: d.id,
      original_filename: d.original_filename,
      content_hash: d.content_hash,
      upload_timestamp: d.upload_timestamp,
    };
  }
  async all() {
    const rows = (
      await this.sql(
        "SELECT * FROM purchases WHERE owner_id=? ORDER BY created_at DESC",
        this.user.id,
      ).all<Row>()
    ).results;
    const docs = await this.docs();
    return rows.map((r) => this.fromRow(r, docs));
  }
  fromRow(r: Row, docs: Doc[]) {
    return hydrate(
      {
        ...JSON.parse(r.data),
        id: r.id,
        is_demo: !!r.is_demo,
        created_at: r.created_at,
        updated_at: r.updated_at,
        documents: docs
          .filter((d) => d.purchase_id === r.id)
          .map((d) => this.documentInfo(d)),
      },
      this.now,
    );
  }
  async get(id: string) {
    const row = await this.sql(
      "SELECT * FROM purchases WHERE owner_id=? AND id=?",
      this.user.id,
      id,
    ).first<Row>();
    if (!row) throw new ServiceError("Purchase not found", 404);
    return this.fromRow(row, await this.docs());
  }
  async save(input: unknown, id?: string, demo = false) {
    const data = purchaseSchema.parse(input),
      old = id ? await this.get(id) : undefined;
    if (!id && !(input as Record<string, unknown>).timezone)
      data.timezone = (await this.settings()).timezone;
    const stamp = this.now.toISOString(),
      purchaseId = id || crypto.randomUUID();
    const docs = await this.docs();
    for (const docId of new Set(data.document_ids)) {
      const doc = docs.find((d) => d.id === docId);
      if (!doc || (doc.purchase_id && doc.purchase_id !== purchaseId))
        throw new ServiceError(
          "Document is unavailable or attached to another purchase",
        );
    }
    if (old)
      for (const [key, value] of Object.entries(data)) {
        if (
          ["field_status", "evidence", "policies", "document_ids"].includes(key)
        )
          continue;
        if (
          (old as unknown as Record<string, unknown>)[key] !== value &&
          data.field_status[key] === "automatically_extracted"
        )
          data.field_status[key] =
            value === null ? "unknown" : "manually_entered";
      }
    const policies = data.policies.map((p) => {
      const previous = old?.policies.find(
        (x) => x.policy_type === p.policy_type,
      );
      const same =
        previous &&
        Object.entries(p).every(
          ([k, v]) => (previous as unknown as Record<string, unknown>)[k] === v,
        );
      return {
        ...p,
        last_verified_at:
          p.verification_status === "verified"
            ? same
              ? previous.last_verified_at || stamp
              : stamp
            : null,
      };
    });
    const { document_ids, ...fields } = data;
    const json = JSON.stringify({ ...fields, policies });
    const write = id
      ? this.sql(
          "UPDATE purchases SET data=?,updated_at=? WHERE owner_id=? AND id=?",
          json,
          stamp,
          this.user.id,
          id,
        )
      : this.sql(
          "INSERT INTO purchases(id,owner_id,data,is_demo,created_at,updated_at) SELECT ?,?,?,?,?,? WHERE (SELECT COUNT(*) FROM purchases WHERE owner_id=?)<250",
          purchaseId,
          this.user.id,
          json,
          demo ? 1 : 0,
          stamp,
          stamp,
          this.user.id,
        );
    const operations = [
      write,
      ...document_ids.map((docId) =>
        this.sql(
          "UPDATE documents SET purchase_id=? WHERE owner_id=? AND id=? AND (purchase_id IS NULL OR purchase_id=?)",
          purchaseId,
          this.user.id,
          docId,
          purchaseId,
        ),
      ),
    ];
    const result = await this.db.batch(operations);
    if (!result[0].meta.changes)
      throw new ServiceError(
        "The beta supports up to 250 purchases per account. Export or delete older records to add more.",
        409,
      );
    if (!id && !demo) await this.event("purchases_added");
    return this.get(purchaseId);
  }
  async status(id: string, status: Purchase["purchase_status"]) {
    const p = await this.get(id);
    const {
      id: _,
      documents,
      deadlines: _d,
      warranty_status: _w,
      is_demo: _demo,
      ...rest
    } = p;
    delete (rest as Record<string, unknown>).created_at;
    delete (rest as Record<string, unknown>).updated_at;
    return this.save(
      {
        ...rest,
        purchase_status: status,
        policies: rest.policies.map(
          ({ last_verified_at: _v, ...policy }) => policy,
        ),
        document_ids: documents.map((d) => d.id),
      },
      id,
    );
  }
  async remove(id: string) {
    await this.get(id);
    const docs = (await this.docs()).filter((d) => d.purchase_id === id);
    // Keep metadata until object deletion succeeds so a failed deletion can be retried.
    for (const d of docs) await this.bucket().delete(d.object_key);
    await this.sql(
      "DELETE FROM purchases WHERE owner_id=? AND id=?",
      this.user.id,
      id,
    ).run();
    return { deleted: true };
  }
  bucket() {
    if (!this.env.BUCKET)
      throw new ServiceError("Receipt storage is temporarily unavailable", 503);
    return this.env.BUCKET;
  }
  async document(id: string, attached = true) {
    const d = await this.sql(
      "SELECT * FROM documents WHERE owner_id=? AND id=?",
      this.user.id,
      id,
    ).first<Doc>();
    if (!d || (attached && !d.purchase_id))
      throw new ServiceError("Document not found", 404);
    return d;
  }
  async discard(id: string) {
    const d = await this.document(id, false);
    if (d.purchase_id)
      throw new ServiceError("Only unattached uploads can be discarded");
    await this.bucket().delete(d.object_key);
    await this.sql(
      "DELETE FROM documents WHERE owner_id=? AND id=? AND purchase_id IS NULL",
      this.user.id,
      id,
    ).run();
    return { deleted: true };
  }
  async wipe(confirmation: string) {
    if (confirmation !== "DELETE ALL MY DATA")
      throw new ServiceError("Type DELETE ALL MY DATA to confirm");
    for (const d of await this.docs()) await this.bucket().delete(d.object_key);
    await this.sql("DELETE FROM users WHERE id=?", this.user.id).run();
    return { deleted: true };
  }
  async list(query: Record<string, unknown> = {}) {
    const page = Number(query.page || 1),
      size = Number(query.page_size || 20);
    if (
      !Number.isInteger(page) ||
      page < 1 ||
      !Number.isInteger(size) ||
      size < 1 ||
      size > 100
    )
      throw new ServiceError("Invalid pagination");
    let all = await this.all();
    const search = String(query.search || "").toLowerCase();
    if (search.length > 300) throw new ServiceError("Search is too long");
    all = all.filter(
      (p) =>
        (!search ||
          [
            p.product_name,
            p.merchant_name,
            p.order_number,
            p.invoice_number,
          ].some((v) => v?.toLowerCase().includes(search))) &&
        (!query.merchant || p.merchant_name === query.merchant) &&
        (!query.category || p.product_category === query.category) &&
        (!query.status || p.purchase_status === query.status) &&
        (!query.date_from ||
          (!!p.purchase_date && p.purchase_date >= String(query.date_from))) &&
        (!query.date_to ||
          (!!p.purchase_date && p.purchase_date <= String(query.date_to))),
    );
    return {
      items: all.slice((page - 1) * size, page * size),
      total: all.length,
      page,
      page_size: size,
    };
  }
  async upcoming(days = 365, confirmed = true) {
    if (!Number.isInteger(days) || days < 0 || days > 3650)
      throw new ServiceError("Days must be between 0 and 3650");
    const results: Deadline[] = [];
    for (const p of await this.all())
      for (const d of p.deadlines) {
        if (
          !d.deadline_date ||
          !actionable(p, d.deadline_type) ||
          (confirmed && d.verification_status !== "confirmed")
        )
          continue;
        const remaining = daysBetween(
          today(p.timezone, this.now),
          d.deadline_date,
        );
        if (remaining >= 0 && remaining <= days)
          results.push({
            ...d,
            product_name: p.product_name,
            merchant_name: p.merchant_name || undefined,
            days_remaining: remaining,
            is_demo: p.is_demo,
          });
      }
    return results.sort((a, b) => a.days_remaining! - b.days_remaining!);
  }
  async dashboard() {
    const all = await this.all(),
      upcoming = await this.upcoming(30);
    const attention = all.filter(
      (p) =>
        actionable(p, "return") &&
        p.deadlines[0].verification_status !== "confirmed",
    );
    return {
      total: all.length,
      upcoming_returns: upcoming.filter((d) => d.deadline_type === "return")
        .length,
      active_warranties: all.filter(
        (p) =>
          actionable(p, "warranty") &&
          ["active", "expiring_soon"].includes(p.warranty_status),
      ).length,
      attention_count: attention.length,
      attention: attention.slice(0, 5),
      recent: all.slice(0, 5),
      upcoming,
      demo: all.some((p) => p.is_demo),
    };
  }
  async notices() {
    const rows = (
      await this.sql(
        "SELECT id,purchase_id,message,created_at,read FROM notifications WHERE owner_id=? ORDER BY created_at DESC LIMIT 100",
        this.user.id,
      ).all<{
        id: string;
        purchase_id: string;
        message: string;
        created_at: string;
        read: number;
      }>()
    ).results;
    return rows.map((r) => ({ ...r, read: !!r.read }));
  }
  async readNotice(id: string) {
    const result = await this.sql(
      "UPDATE notifications SET read=1 WHERE owner_id=? AND id=?",
      this.user.id,
      id,
    ).run();
    if (!result.meta.changes)
      throw new ServiceError("Notification not found", 404);
    return { read: true };
  }
  async reminders() {
    const settings = await this.settings();
    if (!settings.reminders_enabled) return { generated: 0, enabled: false };
    let generated = 0;
    const seen = new Set(
      (
        await this.sql(
          "SELECT idempotency_key FROM notifications WHERE owner_id=?",
          this.user.id,
        ).all<{ idempotency_key: string }>()
      ).results.map((r) => r.idempotency_key),
    );
    for (const p of await this.all())
      for (const d of p.deadlines) {
        if (
          !actionable(p, d.deadline_type) ||
          d.verification_status !== "confirmed" ||
          !d.deadline_date
        )
          continue;
        const t = today(p.timezone, this.now),
          hour = Number(
            new Intl.DateTimeFormat("en-US", {
              timeZone: p.timezone,
              hour: "2-digit",
              hourCycle: "h23",
            }).format(this.now),
          );
        for (const offset of settings.reminder_offsets) {
          const scheduled = addDate(d.deadline_date, -offset, "days");
          if (!scheduled || scheduled > t || (scheduled === t && hour < 9))
            continue;
          const key = `${d.id}:${d.deadline_date}:${p.timezone}:${offset}`,
            remaining = daysBetween(t, d.deadline_date);
          if (seen.has(key)) continue;
          if (generated >= 25)
            return { generated, enabled: true, catch_up_pending: true };
          const message = `${p.product_name}: ${d.deadline_type} deadline ${remaining > 0 ? `in ${remaining} days` : remaining === 0 ? "today" : "has passed"} (${d.deadline_date}, ${p.timezone}).`;
          const result = await this.sql(
            "INSERT INTO notifications(id,owner_id,purchase_id,idempotency_key,message,created_at,read) VALUES(?,?,?,?,?,?,0) ON CONFLICT(owner_id,idempotency_key) DO NOTHING",
            crypto.randomUUID(),
            this.user.id,
            p.id,
            key,
            message,
            this.now.toISOString(),
          ).run();
          generated += result.meta.changes || 0;
        }
      }
    return { generated, enabled: true };
  }
  async draft(id: string, input: unknown) {
    const result = requestDraft(await this.get(id), input);
    await this.event("drafts_prepared");
    return result;
  }
  async demo() {
    if ((await this.all()).length)
      throw new ServiceError(
        "Demo mode is available in an empty workspace. Export and delete existing data first.",
      );
    const names = [
      "Fictional headphones",
      "Fictional trail shoes",
      "Fictional desk lamp",
    ];
    for (let i = 0; i < names.length; i++)
      await this.save(
        {
          product_name: names[i],
          merchant_name: "Example Store — fictional",
          purchase_date: today("UTC", this.now),
          policies:
            i < 2
              ? [
                  {
                    policy_type: "return",
                    policy_source: "Fictional demo terms",
                    policy_text: "Synthetic example only",
                    start_date_basis: "explicit",
                    cutoff_date: addDate(today("UTC", this.now), i + 3, "days"),
                    verification_status: "verified",
                  },
                ]
              : [],
        },
        undefined,
        true,
      );
    return { created: 3, demo: true };
  }
  async analytics() {
    if (!(await this.isAdmin()))
      throw new ServiceError("Owner access required", 403);
    const since = (days: number) =>
      new Date(this.now.getTime() - days * 86400000).toISOString();
    const totals = await this.sql(
      "SELECT COUNT(*) AS registered_users, SUM(last_active>=?) AS active_24h, SUM(last_active>=?) AS active_7d, SUM(last_active>=?) AS active_30d, SUM(created_at>=?) AS new_7d FROM users",
      since(1),
      since(7),
      since(30),
      since(7),
    ).first();
    const purchases = await this.sql(
      "SELECT COUNT(*) AS purchases,COUNT(DISTINCT owner_id) AS activated_users FROM purchases WHERE is_demo=0",
    ).first();
    const daily = (
      await this.sql(
        "SELECT day,COUNT(*) AS active_users,SUM(web_requests) AS web_requests,SUM(mcp_calls) AS mcp_calls,SUM(purchases_added) AS purchases_added,SUM(drafts_prepared) AS drafts_prepared,SUM(receipts_uploaded) AS receipts_uploaded FROM activity WHERE day>=? GROUP BY day ORDER BY day DESC",
        since(30).slice(0, 10),
      ).all()
    ).results;
    return {
      totals: { ...totals, ...purchases },
      daily,
      generated_at: this.now.toISOString(),
      definitions:
        "Active means an authenticated request, including an open workspace refreshing. Counts include the owner. Demo purchases are excluded. Daily activity is retained for 90 days; deleting an account removes its usage history. No anonymous visitor tracking.",
    };
  }
}
