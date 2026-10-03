import { z } from "zod";
import type { Purchase, Policy, Deadline } from "../src/types";
export class ServiceError extends Error {
  constructor(
    message: string,
    public status = 400,
  ) {
    super(message);
  }
}
export const statuses = [
  "tracking",
  "returned",
  "refunded",
  "kept",
  "warranty_claimed",
  "archived",
] as const;
const text = (n: number) => z.string().trim().max(n);
const nullable = (n: number) => text(n).nullable().default(null);
export function isDate(value: string) {
  return (
    /^\d{4}-\d{2}-\d{2}$/.test(value) &&
    value >= "0001-01-01" &&
    value <= "9999-12-31" &&
    !Number.isNaN(Date.parse(value)) &&
    new Date(value + "T12:00:00Z").toISOString().slice(0, 10) === value
  );
}
const date = z.string().refine(isDate, "Use a valid YYYY-MM-DD date");
const zone = text(100).refine((v) => {
  try {
    new Intl.DateTimeFormat("en", { timeZone: v });
    return true;
  } catch {
    return false;
  }
}, "Use a valid IANA timezone");
export const policySchema = z
  .object({
    policy_type: z.enum(["return", "warranty"]),
    policy_source: nullable(200),
    source_reference: nullable(500),
    policy_text: text(10000).default(""),
    duration: z.number().int().min(0).max(36500).nullable().default(null),
    duration_unit: z.enum(["days", "months", "years"]).default("days"),
    start_date_basis: z
      .enum([
        "purchase_date",
        "delivery_date",
        "warranty_start",
        "explicit",
        "unknown",
      ])
      .default("unknown"),
    start_date: date.nullable().default(null),
    start_date_verified: z.boolean().default(false),
    cutoff_date: date.nullable().default(null),
    provider: nullable(200),
    verification_status: z
      .enum(["unknown", "unverified", "verified"])
      .default("unknown"),
  })
  .strict()
  .superRefine((p, c) => {
    const fail = (message: string) =>
      c.addIssue({ code: z.ZodIssueCode.custom, message });
    if (p.cutoff_date && p.duration !== null)
      fail("Use either a cutoff or a duration, not both");
    if (p.cutoff_date && p.start_date && p.start_date > p.cutoff_date)
      fail("Start date cannot follow cutoff");
    if (p.cutoff_date && p.start_date_basis !== "explicit")
      fail("A cutoff requires the explicit basis");
    if (p.start_date_basis === "explicit" && p.duration !== null)
      fail("Explicit basis requires a cutoff");
    if (p.verification_status === "verified") {
      if (!p.policy_source || !(p.policy_text || p.source_reference))
        fail("Verified policies require a source and terms or reference");
      if (p.duration === null && !p.cutoff_date)
        fail("Verified policies require duration or cutoff");
      if (p.duration !== null && p.start_date_basis === "unknown")
        fail("Verify which date the policy starts from");
    }
  });
export const purchaseSchema = z
  .object({
    merchant_name: nullable(200),
    product_name: text(300).min(1),
    product_category: text(80).min(1).default("Other"),
    order_number: nullable(120),
    invoice_number: nullable(120),
    purchase_date: date.nullable().default(null),
    delivery_date: date.nullable().default(null),
    purchase_amount: z
      .string()
      .regex(
        /^(?:0|[1-9]\d{0,17})(?:\.\d{1,4})?$/,
        "Enter an exact nonnegative decimal amount",
      )
      .refine((v) => v.replace(".", "").length <= 18, "Use at most 18 digits")
      .nullable()
      .default(null),
    currency: z
      .string()
      .regex(/^[A-Z]{3}$/)
      .nullable()
      .default(null),
    purchase_status: z.enum(statuses).default("tracking"),
    timezone: zone.default("UTC"),
    notes: text(5000).default(""),
    field_status: z
      .record(
        z.enum([
          "automatically_extracted",
          "user_confirmed",
          "manually_entered",
          "unknown",
        ]),
      )
      .default({}),
    evidence: z.record(text(2000)).default({}),
    policies: z.array(policySchema).max(2).default([]),
    document_ids: z.array(z.string().uuid()).max(10).default([]),
  })
  .strict()
  .superRefine((p, c) => {
    if (p.purchase_date && p.delivery_date && p.delivery_date < p.purchase_date)
      c.addIssue({
        code: "custom",
        message: "Delivery date cannot precede purchase date",
      });
    if (
      new Set(p.policies.map((p) => p.policy_type)).size !== p.policies.length
    )
      c.addIssue({
        code: "custom",
        message: "Only one policy of each type is supported",
      });
    const allowed = Object.keys(p).filter(
      (k) =>
        !["policies", "document_ids", "field_status", "evidence"].includes(k),
    );
    if (
      [...Object.keys(p.field_status), ...Object.keys(p.evidence)].some(
        (k) => !allowed.includes(k),
      )
    )
      c.addIssue({
        code: "custom",
        message: "Evidence and statuses must name purchase fields",
      });
  })
  .transform((p) => {
    for (const [key, value] of Object.entries(p)) {
      if (
        ["policies", "document_ids", "field_status", "evidence"].includes(key)
      )
        continue;
      if (value === null || value === "") p.field_status[key] = "unknown";
      else p.field_status[key] ??= "manually_entered";
    }
    return p;
  });
export type Input = z.infer<typeof purchaseSchema>;
export const preferencesSchema = z
  .object({
    timezone: zone.default("UTC"),
    reminders_enabled: z.boolean().default(true),
    reminder_offsets: z
      .array(z.number().int().min(0).max(365))
      .max(10)
      .default([7, 3, 1, 0])
      .transform((v) => [...new Set(v)].sort((a, b) => b - a)),
  })
  .strict();
export const requestSchema = z
  .object({
    kind: z
      .enum(["return", "refund", "warranty", "replacement"])
      .default("return"),
    reason: text(2000).default(""),
  })
  .strict();
export function today(timezone: string, now = new Date()) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const get = (k: string) => parts.find((p) => p.type === k)!.value;
  return `${get("year").padStart(4, "0")}-${get("month")}-${get("day")}`;
}
export function daysBetween(a: string, b: string) {
  return Math.round(
    (Date.parse(b + "T12:00:00Z") - Date.parse(a + "T12:00:00Z")) / 86400000,
  );
}
export function addDate(start: string, amount: number, unit: string) {
  const d = new Date(start + "T12:00:00Z");
  if (unit === "days") d.setUTCDate(d.getUTCDate() + amount);
  else {
    const day = d.getUTCDate();
    d.setUTCDate(1);
    d.setUTCMonth(d.getUTCMonth() + amount * (unit === "years" ? 12 : 1));
    const last = new Date(d);
    last.setUTCMonth(last.getUTCMonth() + 1);
    last.setUTCDate(0);
    d.setUTCDate(Math.min(day, last.getUTCDate()));
  }
  if (d.getUTCFullYear() < 1 || d.getUTCFullYear() > 9999) return null;
  return d.toISOString().slice(0, 10);
}
export function calculate(
  p: Pick<
    Purchase,
    "id" | "timezone" | "purchase_date" | "delivery_date" | "field_status"
  >,
  policy: Policy | undefined,
  kind: "return" | "warranty",
): Deadline {
  const basis: Deadline["calculation_basis"] = {
    reason: "No policy has been supplied",
    policy_source: undefined,
    start_date: undefined,
  };
  const result: Deadline = {
    id: `${p.id}:${kind}`,
    purchase_id: p.id,
    deadline_type: kind,
    deadline_date: null,
    timezone: p.timezone,
    verification_status: "unknown",
    calculation_basis: basis,
  };
  if (!policy) return result;
  Object.assign(basis, {
    policy_source: policy.policy_source,
    source_reference: policy.source_reference,
    policy_verification: policy.verification_status,
    start_date_basis: policy.start_date_basis,
    duration: policy.duration,
    duration_unit: policy.duration_unit,
    last_verified_at: policy.last_verified_at,
    reason: "Required policy information is missing",
  });
  let verified = false;
  if (policy.cutoff_date) {
    result.deadline_date = policy.cutoff_date;
    verified = true;
    basis.reason = "Explicit cutoff supplied by the user";
    if (policy.start_date && policy.start_date_verified)
      basis.start_date = policy.start_date;
  } else {
    const key = policy.start_date_basis;
    let start: string | null | undefined;
    if (key === "purchase_date" || key === "delivery_date") {
      start = p[key];
      verified = ["user_confirmed", "manually_entered"].includes(
        p.field_status[key],
      );
    } else if (key === "warranty_start") {
      start = policy.start_date;
      verified = !!policy.start_date_verified;
    }
    if (!start) {
      basis.reason =
        key === "unknown"
          ? "Window starting basis is unknown"
          : `Missing ${key.replaceAll("_", " ")}`;
      return result;
    }
    basis.start_date = start;
    if (policy.duration === null) return result;
    result.deadline_date = addDate(
      start,
      policy.duration,
      policy.duration_unit,
    );
    if (!result.deadline_date) {
      basis.reason = "The calculated date is outside the supported calendar";
      return result;
    }
    basis.reason = `${policy.duration} ${policy.duration_unit} from ${key.replaceAll("_", " ")}`;
  }
  result.verification_status =
    verified && policy.verification_status === "verified"
      ? "confirmed"
      : "tentative";
  if (result.verification_status === "tentative")
    basis.reason += "; policy or starting date needs verification";
  basis.cutoff_precision = "date_only";
  return result;
}
export function actionable(p: Purchase, kind: string) {
  return (
    !["archived", "returned", "refunded"].includes(p.purchase_status) &&
    !(kind === "return" && p.purchase_status === "kept") &&
    !(kind === "warranty" && p.purchase_status === "warranty_claimed")
  );
}
export function hydrate(p: Purchase, now = new Date()): Purchase {
  p.deadlines = (["return", "warranty"] as const).map((kind) =>
    calculate(
      p,
      p.policies.find((x) => x.policy_type === kind),
      kind,
    ),
  );
  const w = p.deadlines[1],
    t = today(p.timezone, now),
    start = w.calculation_basis.start_date;
  p.warranty_status =
    w.verification_status !== "confirmed" || !w.deadline_date
      ? "unknown"
      : start && start > t
        ? "not_started"
        : w.deadline_date < t
          ? "expired"
          : !start
            ? "end_date_confirmed"
            : daysBetween(t, w.deadline_date) <= 30
              ? "expiring_soon"
              : "active";
  return p;
}
export function requestDraft(p: Purchase, input: unknown) {
  const { kind, reason } = requestSchema.parse(input);
  const confirmed = (field: string) =>
    ["manually_entered", "user_confirmed"].includes(p.field_status[field])
      ? (p as unknown as Record<string, unknown>)[field]
      : null;
  const labels = {
    return: "Return request",
    refund: "Refund follow-up",
    warranty: "Warranty claim",
    replacement: "Replacement request",
  };
  const actions = {
    return: "I would like to request a return",
    refund: "I would like an update on the status of my refund request",
    warranty:
      "I would like to request an assessment under the applicable warranty",
    replacement: "I would like to request a replacement",
  };
  const product = confirmed("product_name"),
    merchant = confirmed("merchant_name");
  const lines = [
    `Hello ${merchant ? merchant + " team" : "Customer Support"},`,
    "",
    `${actions[kind]} for ${product || "my purchase"}.`,
    "",
  ];
  for (const [field, label] of [
    ["order_number", "Order reference"],
    ["invoice_number", "Invoice reference"],
    ["purchase_date", "Purchase date"],
  ]) {
    const value = confirmed(field);
    if (value) lines.push(`${label}: ${value}`);
  }
  if (reason) lines.push("", `Reason / additional details: ${reason}`);
  lines.push(
    "",
    "Please let me know the next steps and any documentation you need.",
    "",
    "Thank you,",
    "[Your name]",
  );
  return {
    subject: `${labels[kind]}${product ? ": " + product : ""}`,
    body: lines.join("\n"),
    sent: false,
    notice:
      "Editable draft only. Eligibility and refund approval have not been confirmed.",
  };
}
