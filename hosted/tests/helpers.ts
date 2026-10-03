import { DatabaseSync } from "node:sqlite";
import { readFileSync, readdirSync } from "node:fs";
import type { Bindings } from "../server/store";
class Statement {
  values: any[] = [];
  constructor(
    public db: DatabaseSync,
    public query: string,
  ) {}
  bind(...values: unknown[]) {
    this.values = values;
    return this;
  }
  async run() {
    const r = this.db.prepare(this.query).run(...this.values);
    return { success: true, meta: { changes: Number(r.changes) }, results: [] };
  }
  async first<T>(column?: string): Promise<T | null> {
    const row = this.db.prepare(this.query).get(...this.values);
    return (row ? (column ? row[column] : row) : null) as T | null;
  }
  async all<T>() {
    return {
      success: true,
      results: this.db.prepare(this.query).all(...this.values) as T[],
      meta: {},
    };
  }
}
export function fixture() {
  const sql = new DatabaseSync(":memory:");
  sql.exec("PRAGMA foreign_keys=ON");
  for (const file of readdirSync("drizzle").filter((n) => n.endsWith(".sql")))
    sql.exec(readFileSync("drizzle/" + file, "utf8"));
  const db = {
    prepare: (query: string) => new Statement(sql, query),
    batch: async (ops: Statement[]) => {
      sql.exec("BEGIN");
      try {
        const result = [];
        for (const s of ops) result.push(await s.run());
        sql.exec("COMMIT");
        return result;
      } catch (e) {
        sql.exec("ROLLBACK");
        throw e;
      }
    },
  };
  const files = new Map<string, Uint8Array>();
  const bucket = {
    put: async (k: string, data: Uint8Array) => {
      files.set(k, data.slice());
    },
    get: async (k: string) => {
      const data = files.get(k);
      return data
        ? {
            body: new Blob([data.slice().buffer as ArrayBuffer]).stream(),
            arrayBuffer: async () => data.slice().buffer,
          }
        : null;
    },
    delete: async (k: string) => {
      files.delete(k);
    },
  };
  return {
    env: {
      DB: db as unknown as D1Database,
      BUCKET: bucket as unknown as R2Bucket,
      RETURNRADAR_OWNER_EMAIL: "owner@example.test",
    } satisfies Bindings,
    sql,
    files,
  };
}
export const alice = {
  id: "alice",
  email: "alice@example.test",
  name: "Alice",
};
export const bob = { id: "bob", email: "bob@example.test", name: "Bob" };
export const owner = {
  id: "owner",
  email: "owner@example.test",
  name: "Owner",
};
export function request(
  path: string,
  who: typeof alice | null = alice,
  method = "GET",
  body?: unknown,
) {
  return new Request("https://returnradar.example/api" + path, {
    method,
    headers: {
      ...(who
        ? {
            "oai-authenticated-user-id": who.id,
            "oai-authenticated-user-email": who.email,
          }
        : {}),
      "Content-Type": "application/json",
      Origin: "https://returnradar.example",
      "X-ReturnRadar-Request": "1",
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}
