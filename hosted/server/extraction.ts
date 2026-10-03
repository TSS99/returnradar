import { isDate } from "./domain";
export function extractFields(text: string) {
  const fields: Record<string, string | null> = {},
    evidence: Record<string, string> = {},
    field_status: Record<string, string> = {},
    confidence: Record<string, string> = {},
    warnings: string[] = [];
  const labels: Record<string, string> = {
    merchant_name: "(?:merchant|seller|sold by|store)",
    product_name: "(?:product|item|description)",
    purchase_date: "(?:purchase date|invoice date|order date)",
    delivery_date: "(?:delivery date|delivered on)",
    order_number: "(?:order (?:number|no\\.?|id)|order #)",
    invoice_number: "(?:invoice (?:number|no\\.?|id)|invoice #)",
    purchase_amount: "(?:grand total|amount paid|total amount|total)",
    currency: "currency",
  };
  for (const [field, label] of Object.entries(labels)) {
    const values = [
      ...new Set(
        [
          ...text.matchAll(
            new RegExp(`^\\s*${label}\\s*[:#]\\s*(.+?)\\s*$`, "gim"),
          ),
        ].map((m) => m[1]),
      ),
    ];
    fields[field] = null;
    field_status[field] = "unknown";
    confidence[field] = "unknown";
    if (values.length) evidence[field] = values.join(" | ").slice(0, 2000);
    if (values.length !== 1) {
      if (values.length > 1)
        warnings.push(
          `Multiple possible values for ${field.replaceAll("_", " ")}; review manually.`,
        );
      continue;
    }
    let value: string | null = values[0];
    if (field.endsWith("_date")) {
      if (!isDate(value)) {
        // Accept English named-month dates only; numeric locale guesses are forbidden.
        const match =
          value.match(/^(\d{1,2})\s+([A-Za-z]{3,9})\s+(\d{4})$/) ??
          value.match(/^([A-Za-z]{3,9})\s+(\d{1,2}),\s+(\d{4})$/);
        const firstIsDay = match && /^\d/.test(match[1]);
        const monthName = match?.[firstIsDay ? 2 : 1].toLowerCase();
        const months = [
          "january",
          "february",
          "march",
          "april",
          "may",
          "june",
          "july",
          "august",
          "september",
          "october",
          "november",
          "december",
        ];
        const month =
          months.findIndex(
            (name) => name === monthName || name.slice(0, 3) === monthName,
          ) + 1;
        const candidate =
          match && month
            ? `${match[3]}-${String(month).padStart(2, "0")}-${match[firstIsDay ? 1 : 2].padStart(2, "0")}`
            : null;
        value = candidate && isDate(candidate) ? candidate : null;
        if (!value)
          warnings.push(
            `Ambiguous or unsupported ${field.replaceAll("_", " ")} format.`,
          );
      }
    } else if (field === "purchase_amount") {
      const m = value.match(
        /^(?:[A-Z]{3}\s*|[$€£₹]\s*)?((?:\d+|\d{1,3}(?:,\d{3})+)(?:\.\d{1,4})?)$/,
      );
      value = m ? m[1].replaceAll(",", "") : null;
    } else if (field === "currency")
      value = /^[A-Za-z]{3}$/.test(value) ? value.toUpperCase() : null;
    if (value) {
      fields[field] = value;
      field_status[field] = "automatically_extracted";
      confidence[field] = ["merchant_name", "product_name"].includes(field)
        ? "medium"
        : "high";
    }
  }
  const policies: Record<string, unknown>[] = [];
  for (const [kind, label] of [
    ["return", "return policy"],
    ["warranty", "warranty"],
  ]) {
    const matches = [
      ...text.matchAll(new RegExp(`^\\s*${label}\\s*:\\s*(.+)$`, "gim")),
    ];
    if (matches.length === 1) {
      const terms = matches[0][1].slice(0, 10000);
      const policy: Record<string, unknown> = {
        policy_type: kind,
        policy_source: "Uploaded invoice (unverified)",
        policy_text: terms,
        verification_status: "unverified",
      };
      const duration = terms.match(
        /\b(\d+)\s*(days?|months?|years?)\s+(?:from|of|after)\s+(?:the\s+)?(purchase|delivery)\b/i,
      );
      if (duration && Number(duration[1]) <= 36500)
        Object.assign(policy, {
          duration: Number(duration[1]),
          duration_unit: duration[2].toLowerCase().replace(/s$/, "") + "s",
          start_date_basis: duration[3].toLowerCase() + "_date",
        });
      policies.push(policy);
    } else if (matches.length > 1)
      warnings.push(`Multiple ${kind} policy statements; review manually.`);
  }
  if (
    fields.purchase_date &&
    fields.delivery_date &&
    fields.delivery_date < fields.purchase_date
  ) {
    fields.delivery_date = null;
    field_status.delivery_date = "unknown";
    warnings.push("Delivery precedes purchase; verify both dates.");
  }
  return { fields, evidence, field_status, confidence, policies, warnings };
}
