import { useState } from "react";
import { Check, ChevronDown, FileCheck2, Save } from "lucide-react";
import type { Extraction, FieldStatus, Policy, Purchase } from "../types";
import { api } from "../services/api";

type FormProps = {
  purchase?: Purchase;
  extraction?: Extraction;
  timezone: string;
  saved: (purchase: Purchase) => void;
  cancel?: () => void;
};
type PolicyDraft = {
  enabled: boolean;
  source: string;
  reference: string;
  text: string;
  duration: string;
  unit: Policy["duration_unit"];
  basis: Policy["start_date_basis"];
  start: string;
  cutoff: string;
  provider: string;
  verified: boolean;
  startVerified: boolean;
};
const newPolicy = (
  kind: "return" | "warranty",
  value?: Partial<Policy>,
): PolicyDraft => ({
  enabled: !!value,
  source: value?.policy_source || "",
  reference: value?.source_reference || "",
  text: value?.policy_text || "",
  duration: value?.duration?.toString() ?? "",
  unit: value?.duration_unit || (kind === "warranty" ? "months" : "days"),
  basis:
    value?.start_date_basis ||
    (kind === "warranty" ? "warranty_start" : "delivery_date"),
  start: value?.start_date || "",
  cutoff: value?.cutoff_date || "",
  provider: value?.provider || "",
  verified: value?.verification_status === "verified",
  startVerified: value?.start_date_verified || false,
});

export function PurchaseForm({
  purchase,
  extraction,
  timezone,
  saved,
  cancel,
}: FormProps) {
  const defaults: Record<string, string> = {
    product_name: "",
    merchant_name: "",
    product_category: "Other",
    purchase_date: "",
    delivery_date: "",
    purchase_amount: "",
    currency: "",
    order_number: "",
    invoice_number: "",
    timezone,
    notes: "",
  };
  if (purchase)
    Object.keys(defaults).forEach((key) => {
      defaults[key] = String(purchase[key as keyof Purchase] ?? "");
    });
  if (extraction)
    Object.entries(extraction.fields).forEach(([key, value]) => {
      defaults[key] = value || "";
    });
  const [fields, setFields] = useState(defaults);
  const [fieldStatus, setFieldStatus] = useState<Record<string, FieldStatus>>(
    purchase?.field_status || extraction?.field_status || {},
  );
  const [confirmed, setConfirmed] = useState(false);
  const [policies, setPolicies] = useState({
    return: newPolicy(
      "return",
      (purchase?.policies || extraction?.policies)?.find(
        (p) => p.policy_type === "return",
      ),
    ),
    warranty: newPolicy(
      "warranty",
      (purchase?.policies || extraction?.policies)?.find(
        (p) => p.policy_type === "warranty",
      ),
    ),
  });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const change = (key: string, value: string) => {
    setFields((f) => ({ ...f, [key]: value }));
    setFieldStatus((s) => ({
      ...s,
      [key]: value ? "manually_entered" : "unknown",
    }));
  };
  const policyChange = (
    kind: "return" | "warranty",
    patch: Partial<PolicyDraft>,
  ) => {
    // Editing verified terms requires verification again.
    setPolicies((p) => ({
      ...p,
      [kind]: {
        ...p[kind],
        ...(Object.keys(patch).some((k) => !["verified", "enabled"].includes(k))
          ? { verified: false }
          : {}),
        ...patch,
      },
    }));
  };
  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    const policyValues: Policy[] = (["return", "warranty"] as const)
      .filter((kind) => policies[kind].enabled)
      .map((kind) => {
        const p = policies[kind];
        return {
          policy_type: kind,
          policy_source: p.source || null,
          source_reference: p.reference || null,
          policy_text: p.text,
          duration:
            p.basis === "explicit" || p.duration === ""
              ? null
              : Number(p.duration),
          duration_unit: p.unit,
          start_date_basis: p.basis,
          start_date:
            p.basis === "warranty_start" ||
            (kind === "warranty" && p.basis === "explicit")
              ? p.start || null
              : null,
          start_date_verified: p.startVerified,
          cutoff_date: p.basis === "explicit" ? p.cutoff || null : null,
          provider: p.provider || null,
          verification_status: p.verified ? "verified" : "unverified",
        };
      });
    const statuses = { ...fieldStatus };
    if (confirmed)
      Object.keys(statuses).forEach((k) => {
        if (statuses[k] === "automatically_extracted")
          statuses[k] = "user_confirmed";
      });
    const body = {
      ...fields,
      purchase_amount: fields.purchase_amount || null,
      currency: fields.currency || null,
      merchant_name: fields.merchant_name || null,
      purchase_date: fields.purchase_date || null,
      delivery_date: fields.delivery_date || null,
      order_number: fields.order_number || null,
      invoice_number: fields.invoice_number || null,
      purchase_status: purchase?.purchase_status || "tracking",
      field_status: statuses,
      evidence: purchase?.evidence || extraction?.evidence || {},
      policies: policyValues,
      document_ids:
        purchase?.documents.map((d) => d.id) ||
        (extraction ? [extraction.document.id] : []),
    };
    try {
      saved(
        await api<Purchase>(
          purchase ? `/purchases/${purchase.id}` : "/purchases",
          { method: purchase ? "PUT" : "POST", body: JSON.stringify(body) },
        ),
      );
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  function field(key: string, label: string, type = "text", required = false) {
    const extracted = fieldStatus[key] === "automatically_extracted";
    return (
      <label className="field" key={key}>
        <span>
          {label}
          {!required && <small>optional</small>}
        </span>
        <input
          type={type}
          value={fields[key]}
          required={required}
          maxLength={key === "product_name" ? 300 : 200}
          min={type === "number" ? "0" : undefined}
          step={type === "number" ? "0.0001" : undefined}
          onChange={(e) => change(key, e.target.value)}
        />
        {extracted && (
          <span className="field-evidence">
            From receipt · {extraction?.confidence[key] || "review required"}{" "}
            confidence
          </span>
        )}
        {(extraction?.evidence[key] || purchase?.evidence[key]) && (
          <details className="evidence">
            <summary>View extraction evidence</summary>
            {extraction?.evidence[key] || purchase?.evidence[key]}
          </details>
        )}
      </label>
    );
  }
  return (
    <form onSubmit={submit} className="purchase-form">
      {extraction && (
        <div className="notice-box">
          <FileCheck2 size={21} />
          <div>
            <strong>Your receipt is ready to review</strong>
            <p>
              Check the suggestions below. Missing details stay unknown, and
              return terms still need verification.
            </p>
          </div>
        </div>
      )}
      {extraction?.warnings.map((w) => (
        <p className="warning" key={w}>
          {w}
        </p>
      ))}
      <section className="panel form-section">
        <div className="section-heading">
          <h2>Purchase details</h2>
          <span>01</span>
        </div>
        <p className="muted">
          A few details now. A little peace of mind later.
        </p>
        <div className="form-grid">
          {field("product_name", "Product name", "text", true)}
          {field("merchant_name", "Merchant")}
          <label className="field">
            <span>Category</span>
            <select
              value={fields.product_category}
              onChange={(e) => change("product_category", e.target.value)}
            >
              {[
                ...new Set([
                  "Other",
                  "Electronics",
                  "Home",
                  "Clothing",
                  "Accessories",
                  "Beauty",
                  fields.product_category,
                ]),
              ].map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </label>
          {field("purchase_date", "Purchase date", "date")}
          {field("delivery_date", "Delivery date", "date")}
          {field("purchase_amount", "Amount paid", "number")}
          {field("currency", "Currency (e.g. INR, USD)")}
          {field("order_number", "Order number")}
          {field("invoice_number", "Invoice number")}
          {field("timezone", "Deadline timezone")}
        </div>
        {Object.values(fieldStatus).includes("automatically_extracted") && (
          <label className="check-line">
            <input
              type="checkbox"
              checked={confirmed}
              onChange={(e) => setConfirmed(e.target.checked)}
            />
            <span>
              I checked the extracted purchase details against my receipt.
            </span>
          </label>
        )}
      </section>
      {(["return", "warranty"] as const).map((kind, index) => {
        const p = policies[kind];
        return (
          <section className="panel form-section" key={kind}>
            <div className="section-heading">
              <h2>{kind === "return" ? "Return policy" : "Warranty"}</h2>
              <span>0{index + 2}</span>
            </div>
            <p className="muted">
              {kind === "return"
                ? "Use the terms that apply to this item. A familiar merchant name is not enough."
                : "Warranty dates depend on the actual terms. Nothing is assumed."}
            </p>
            <label className="check-line">
              <input
                type="checkbox"
                checked={p.enabled}
                onChange={(e) =>
                  policyChange(kind, { enabled: e.target.checked })
                }
              />
              <span>
                I have {kind === "return" ? "return policy" : "warranty"}{" "}
                information
              </span>
              <ChevronDown size={16} />
            </label>
            {p.enabled && (
              <>
                <div className="form-grid policy-grid">
                  <label className="field">
                    <span>Policy source</span>
                    <input
                      value={p.source}
                      maxLength={200}
                      placeholder="Receipt, merchant policy page, written terms"
                      onChange={(e) =>
                        policyChange(kind, { source: e.target.value })
                      }
                    />
                  </label>
                  <label className="field">
                    <span>
                      Source reference <small>optional</small>
                    </span>
                    <input
                      value={p.reference}
                      maxLength={500}
                      placeholder="URL or document reference"
                      onChange={(e) =>
                        policyChange(kind, { reference: e.target.value })
                      }
                    />
                  </label>
                  <label className="field">
                    <span>Window starts from</span>
                    <select
                      value={p.basis}
                      onChange={(e) =>
                        policyChange(kind, {
                          basis: e.target.value as Policy["start_date_basis"],
                        })
                      }
                    >
                      <option value="unknown">Unknown — check the terms</option>
                      <option value="delivery_date">Delivery date</option>
                      <option value="purchase_date">Purchase date</option>
                      <option value="warranty_start">
                        Specific start date
                      </option>
                      <option value="explicit">Explicit cutoff date</option>
                    </select>
                  </label>
                  {p.basis === "explicit" ? (
                    <label className="field">
                      <span>Cutoff date</span>
                      <input
                        type="date"
                        value={p.cutoff}
                        onChange={(e) =>
                          policyChange(kind, { cutoff: e.target.value })
                        }
                      />
                    </label>
                  ) : (
                    <div className="field">
                      <span>Policy duration</span>
                      <div className="input-pair">
                        <input
                          aria-label={`${kind} duration`}
                          type="number"
                          min="0"
                          max="36500"
                          value={p.duration}
                          onChange={(e) =>
                            policyChange(kind, { duration: e.target.value })
                          }
                        />
                        <select
                          aria-label={`${kind} duration unit`}
                          value={p.unit}
                          onChange={(e) =>
                            policyChange(kind, {
                              unit: e.target.value as Policy["duration_unit"],
                            })
                          }
                        >
                          <option>days</option>
                          <option>months</option>
                          <option>years</option>
                        </select>
                      </div>
                    </div>
                  )}
                  {(p.basis === "warranty_start" ||
                    (kind === "warranty" && p.basis === "explicit")) && (
                    <label className="field">
                      <span>Start date</span>
                      <input
                        type="date"
                        value={p.start}
                        onChange={(e) =>
                          policyChange(kind, {
                            start: e.target.value,
                            startVerified: false,
                          })
                        }
                      />
                    </label>
                  )}
                  {kind === "warranty" && (
                    <label className="field">
                      <span>Warranty provider</span>
                      <input
                        value={p.provider}
                        maxLength={200}
                        onChange={(e) =>
                          policyChange(kind, { provider: e.target.value })
                        }
                      />
                    </label>
                  )}
                  <label className="field full">
                    <span>Applicable terms</span>
                    <textarea
                      value={p.text}
                      maxLength={10000}
                      rows={3}
                      placeholder="Include exclusions and special conditions that matter for this item."
                      onChange={(e) =>
                        policyChange(kind, { text: e.target.value })
                      }
                    />
                  </label>
                </div>
                {(p.basis === "warranty_start" ||
                  (kind === "warranty" && p.basis === "explicit")) && (
                  <label className="check-line">
                    <input
                      type="checkbox"
                      checked={p.startVerified}
                      onChange={(e) =>
                        policyChange(kind, { startVerified: e.target.checked })
                      }
                    />
                    <span>
                      I verified this start date in the applicable terms.
                    </span>
                  </label>
                )}
                <label className="check-line">
                  <input
                    type="checkbox"
                    checked={p.verified}
                    onChange={(e) =>
                      policyChange(kind, { verified: e.target.checked })
                    }
                  />
                  <span>
                    I verified these terms apply to this purchase, including the
                    duration and starting date.
                  </span>
                  <Check size={16} />
                </label>
              </>
            )}
          </section>
        );
      })}
      <section className="panel form-section">
        <label className="field">
          <span>
            Notes <small>optional</small>
          </span>
          <textarea
            value={fields.notes}
            maxLength={5000}
            rows={3}
            onChange={(e) => change("notes", e.target.value)}
          />
        </label>
      </section>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      <div className="form-actions">
        {cancel && (
          <button type="button" className="button secondary" onClick={cancel}>
            Cancel
          </button>
        )}
        <button className="button" disabled={busy}>
          <Save size={17} />
          {busy ? "Saving…" : purchase ? "Save changes" : "Save purchase"}
        </button>
      </div>
    </form>
  );
}
