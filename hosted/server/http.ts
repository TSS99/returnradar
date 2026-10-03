import { z } from "zod";
import { zipSync, strToU8 } from "fflate";
import { Store, type Bindings, type Identity, type Doc } from "./store";
import { ServiceError, statuses } from "./domain";
import { extractFields } from "./extraction";
export const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
      "Referrer-Policy": "same-origin",
    },
  });
export function identity(request: Request): Identity {
  const id = request.headers.get("oai-authenticated-user-id"),
    email = request.headers.get("oai-authenticated-user-email");
  if (!id || !email)
    throw new ServiceError(
      "Sign in with ChatGPT to open your private workspace.",
      401,
    );
  let name = email;
  try {
    if (
      request.headers.get("oai-authenticated-user-full-name-encoding") ===
      "percent-encoded-utf-8"
    )
      name = decodeURIComponent(
        request.headers.get("oai-authenticated-user-full-name") || email,
      );
  } catch {
    /* Email is a safe display fallback. */
  }
  return { id, email, name };
}
export async function boundedBody(request: Request, max: number) {
  if (Number(request.headers.get("content-length")) > max)
    throw new ServiceError("Request is too large", 413);
  const reader = request.body?.getReader();
  if (!reader) return new Uint8Array();
  const chunks: Uint8Array[] = [];
  let total = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.length;
    if (total > max) {
      await reader.cancel();
      throw new ServiceError("Request is too large", 413);
    }
    chunks.push(value);
  }
  const all = new Uint8Array(total);
  let offset = 0;
  for (const c of chunks) {
    all.set(c, offset);
    offset += c.length;
  }
  return all;
}
export async function bodyJson(request: Request) {
  const bytes = await boundedBody(request, 160000);
  try {
    return JSON.parse(new TextDecoder().decode(bytes));
  } catch {
    throw new ServiceError("Invalid JSON");
  }
}
export function failure(error: unknown) {
  if (error instanceof z.ZodError)
    return json(
      {
        detail: "Check the supplied fields",
        errors: error.issues.map((i) => ({
          field: i.path.join("."),
          message: i.message,
        })),
      },
      422,
    );
  if (error instanceof ServiceError)
    return json({ detail: error.message }, error.status);
  // Never log request bodies, receipts, tokens or personal fields.
  console.error(
    "ReturnRadar operation failed",
    error instanceof Error ? error.name : "UnknownError",
  );
  return json(
    {
      detail:
        "The service could not complete this action. Please retry; your form has been kept.",
    },
    503,
  );
}
export function checkBrowserWrite(request: Request) {
  if (["GET", "HEAD", "OPTIONS"].includes(request.method)) return;
  const origin = request.headers.get("origin");
  if (
    origin !== new URL(request.url).origin ||
    request.headers.get("x-returnradar-request") !== "1" ||
    request.headers.get("sec-fetch-site") === "cross-site"
  )
    throw new ServiceError(
      "This action must be made from your ReturnRadar workspace.",
      403,
    );
}
async function hash(bytes: BufferSource) {
  return [...new Uint8Array(await crypto.subtle.digest("SHA-256", bytes))]
    .map((v) => v.toString(16).padStart(2, "0"))
    .join("");
}
async function upload(store: Store, request: Request) {
  if (!request.headers.get("content-type")?.startsWith("multipart/form-data;"))
    throw new ServiceError("Upload a PDF file");
  const bytes = await boundedBody(request, 11 * 1024 * 1024);
  const form = await new Response(bytes, {
    headers: { "Content-Type": request.headers.get("content-type")! },
  }).formData();
  const file = form.get("file"),
    text = form.get("extracted_text");
  if (
    !file ||
    typeof file === "string" ||
    file.size === 0 ||
    file.size > 10 * 1024 * 1024
  )
    throw new ServiceError("Upload a PDF up to 10 MB");
  const data = new Uint8Array(await file.arrayBuffer());
  if (new TextDecoder().decode(data.slice(0, 5)) !== "%PDF-")
    throw new ServiceError("The file contents are not PDF");
  if (
    typeof text !== "string" ||
    text.length > 200000 ||
    text.trim().length < 10
  )
    throw new ServiceError(
      "No readable text found. Use a text PDF or enter the purchase manually.",
    );
  const id = crypto.randomUUID(),
    key = `receipts/${await hash(new TextEncoder().encode(store.user.id))}/${id}.pdf`;
  const name =
      file.name.replace(/[^\w .-]/g, "_").slice(0, 160) || "receipt.pdf",
    stamp = store.now.toISOString(),
    digest = await hash(data);
  await store
    .bucket()
    .put(key, data, { httpMetadata: { contentType: "application/pdf" } });
  try {
    const result = await store
      .sql(
        "INSERT INTO documents(id,owner_id,purchase_id,original_filename,object_key,content_hash,size,upload_timestamp) SELECT ?,?,NULL,?,?,?,?,? WHERE (SELECT COUNT(*) FROM documents WHERE owner_id=?)<20 AND (SELECT COALESCE(SUM(size),0) FROM documents WHERE owner_id=?)+?<=20971520",
        id,
        store.user.id,
        name,
        key,
        digest,
        file.size,
        stamp,
        store.user.id,
        store.user.id,
        file.size,
      )
      .run();
    if (!result.meta.changes)
      throw new ServiceError(
        "Receipt storage is full: the beta allows 20 PDFs and 20 MB per account. Export or delete older receipts.",
        409,
      );
  } catch (e) {
    await store.bucket().delete(key);
    throw e;
  }
  await store.event("receipts_uploaded");
  return json(
    {
      document: {
        id,
        original_filename: name,
        content_hash: digest,
        upload_timestamp: stamp,
      },
      ...extractFields(text),
    },
    201,
  );
}
function download(body: BodyInit, type: string, name: string) {
  return new Response(body, {
    headers: {
      "Content-Type": type,
      "Content-Disposition": `attachment; filename="${name}"`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "sandbox; default-src 'none'",
    },
  });
}
export async function handleApi(
  request: Request,
  env: Bindings,
): Promise<Response> {
  try {
    const url = new URL(request.url),
      path = url.pathname.slice(4).replace(/\/$/, ""),
      method = request.method;
    if (path === "/health" && method === "GET")
      return json({
        status: "ok",
        version: "0.2.0",
        mode: "hosted_multi_user",
      });
    checkBrowserWrite(request);
    const user = identity(request),
      store = new Store(env, user);
    await store.register("web");
    if (path === "/me" && method === "GET")
      return json({
        name: user.name,
        email: user.email,
        is_admin: await store.isAdmin(),
        limits: { purchases: 250, receipts: 20, receipt_bytes: 20971520 },
      });
    if (path === "/admin/analytics" && method === "GET")
      return json(await store.analytics());
    if (path === "/purchases" && method === "GET")
      return json(await store.list(Object.fromEntries(url.searchParams)));
    if (path === "/purchases" && method === "POST")
      return json(await store.save(await bodyJson(request)), 201);
    const purchase = path.match(
      /^\/purchases\/([^/]+)(?:\/(status|request))?$/,
    );
    if (purchase) {
      const [, id, action] = purchase;
      if (!action && method === "GET") return json(await store.get(id));
      if (!action && method === "PUT")
        return json(await store.save(await bodyJson(request), id));
      if (!action && method === "DELETE") {
        if (url.searchParams.get("confirm") !== "true")
          throw new ServiceError("Confirm deletion");
        return json(await store.remove(id));
      }
      if (action === "status" && method === "PATCH") {
        const data = z
          .object({ status: z.enum(statuses) })
          .strict()
          .parse(await bodyJson(request));
        return json(await store.status(id, data.status));
      }
      if (action === "request" && method === "POST")
        return json(await store.draft(id, await bodyJson(request)));
    }
    if (path === "/documents" && method === "POST")
      return await upload(store, request);
    const document = path.match(/^\/documents\/([^/]+)$/);
    if (document && method === "DELETE")
      return json(await store.discard(document[1]));
    if (document && method === "GET") {
      const d = await store.document(document[1]),
        object = await store.bucket().get(d.object_key);
      if (!object) throw new ServiceError("Receipt file is unavailable", 404);
      return download(object.body, "application/pdf", d.original_filename);
    }
    if (path === "/dashboard" && method === "GET")
      return json(await store.dashboard());
    if (path === "/facets" && method === "GET") {
      const all = await store.all();
      return json({
        merchants: [
          ...new Set(all.map((p) => p.merchant_name).filter(Boolean)),
        ].sort(),
        categories: [...new Set(all.map((p) => p.product_category))].sort(),
      });
    }
    if (path === "/deadlines" && method === "GET")
      return json(
        await store.upcoming(
          Number(url.searchParams.get("days") || 365),
          url.searchParams.get("confirmed_only") !== "false",
        ),
      );
    if (path === "/settings" && method === "GET")
      return json(await store.settings());
    if (path === "/settings" && method === "PUT")
      return json(await store.setSettings(await bodyJson(request)));
    if (path === "/notifications" && method === "GET") {
      await store.reminders();
      return json(await store.notices());
    }
    const notification = path.match(/^\/notifications\/([^/]+)$/);
    if (notification && method === "PATCH")
      return json(await store.readNotice(notification[1]));
    if (path === "/reminders/run" && method === "POST")
      return json(await store.reminders());
    if (path === "/reminders" && method === "GET")
      return json(await store.notices());
    if (path === "/demo" && method === "POST") return json(await store.demo());
    if (path === "/delete-data" && method === "POST") {
      const data = z
        .object({ confirmation: z.string().max(40) })
        .strict()
        .parse(await bodyJson(request));
      return json(await store.wipe(data.confirmation));
    }
    if (path === "/export" && method === "GET") {
      const all = await store.all(),
        format = url.searchParams.get("format") || "json";
      if (format === "json")
        return download(
          JSON.stringify({ version: "0.2.0", purchases: all }, null, 2),
          "application/json",
          "returnradar.json",
        );
      if (format !== "csv") throw new ServiceError("Choose CSV or JSON");
      const keys = [
        "id",
        "merchant_name",
        "product_name",
        "product_category",
        "order_number",
        "invoice_number",
        "purchase_date",
        "delivery_date",
        "purchase_amount",
        "currency",
        "purchase_status",
        "timezone",
        "notes",
      ];
      const csv = (v: unknown) => {
        let s = String(v ?? "");
        if (/^[\s]*[=+\-@]/.test(s)) s = "'" + s;
        return '"' + s.replaceAll('"', '""') + '"';
      };
      return download(
        [
          keys.join(","),
          ...all.map((p) =>
            keys
              .map((k) => csv((p as unknown as Record<string, unknown>)[k]))
              .join(","),
          ),
        ].join("\r\n"),
        "text/csv",
        "returnradar.csv",
      );
    }
    if (path === "/backup" && method === "GET") {
      const docs = await store.docs();
      if (docs.reduce((n, d) => n + d.size, 0) > 20971520)
        throw new ServiceError(
          "Download receipts individually before creating a smaller backup",
        );
      const files: Record<string, Uint8Array> = {
        "purchases.json": strToU8(
          JSON.stringify(
            { version: "0.2.0", purchases: await store.all() },
            null,
            2,
          ),
        ),
        "settings.json": strToU8(JSON.stringify(await store.settings())),
        "notifications.json": strToU8(JSON.stringify(await store.notices())),
      };
      for (const d of docs) {
        const object = await store.bucket().get(d.object_key);
        if (!object)
          throw new ServiceError(
            "A receipt is unavailable; please retry the backup.",
            503,
          );
        files[`documents/${d.id}.pdf`] = new Uint8Array(
          await object.arrayBuffer(),
        );
      }
      return download(
        zipSync(files, { level: 0 }),
        "application/zip",
        "returnradar-backup.zip",
      );
    }
    throw new ServiceError("Route not found", 404);
  } catch (error) {
    return failure(error);
  }
}
