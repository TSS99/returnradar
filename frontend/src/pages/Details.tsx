import { useEffect, useState } from "react";
import {
  ArrowLeft,
  Download,
  FileText,
  Pencil,
  Send,
  ShieldCheck,
  Trash2,
} from "lucide-react";
import {
  DeadlineBadge,
  ProductIcon,
  formatDate,
  money,
} from "../components/common";
import { PurchaseForm } from "../components/PurchaseForm";
import { api } from "../services/api";
import type { Purchase, Status } from "../types";

export function Details({
  id,
  back,
  changed,
  request,
}: {
  id: string;
  back: () => void;
  changed: () => void;
  request: (id: string) => void;
}) {
  const [purchase, setPurchase] = useState<Purchase>();
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    setPurchase(undefined);
    setError("");
    void api<Purchase>(`/purchases/${id}`)
      .then(setPurchase)
      .catch((e) => setError(e.message));
  }, [id]);
  async function status(value: Status) {
    setError("");
    setBusy(true);
    try {
      setPurchase(
        await api<Purchase>(`/purchases/${id}/status`, {
          method: "PATCH",
          body: JSON.stringify({ status: value }),
        }),
      );
      changed();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function remove() {
    if (!window.confirm("Delete this purchase and its receipt permanently?"))
      return;
    setBusy(true);
    try {
      await api(`/purchases/${id}?confirm=true`, { method: "DELETE" });
      changed();
      back();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  if (!purchase)
    return (
      <>
        <button className="text-link" onClick={back}>
          <ArrowLeft size={16} />
          Back to library
        </button>
        {error ? (
          <p className="error" role="alert">
            {error}
          </p>
        ) : (
          <p className="panel-empty">Loading purchase…</p>
        )}
      </>
    );
  const p = purchase;
  return (
    <>
      <button className="text-link back-link" onClick={back}>
        <ArrowLeft size={16} />
        Back to library
      </button>
      <div className="page-heading">
        <div>
          <span className="eyebrow">
            {p.merchant_name || "Merchant unknown"}
          </span>
          <h1>{p.product_name}</h1>
          <p>
            {p.product_category} · {money(p)}
            {p.is_demo ? " · Fictional demo" : ""}
          </p>
        </div>
        <button
          className="button secondary"
          onClick={() => setEditing((e) => !e)}
        >
          <Pencil size={16} />
          {editing ? "Close editor" : "Edit purchase"}
        </button>
      </div>
      {editing ? (
        <PurchaseForm
          purchase={p}
          timezone={p.timezone}
          saved={(value) => {
            setPurchase(value);
            setEditing(false);
            changed();
          }}
          cancel={() => setEditing(false)}
        />
      ) : (
        <>
          {error && (
            <p className="error" role="alert">
              {error}
            </p>
          )}
          <div className="detail-columns">
            <section className="panel detail-summary">
              <ProductIcon category={p.product_category} large />
              <h2>Your purchase</h2>
              <dl>
                {[
                  ["Purchase date", formatDate(p.purchase_date)],
                  ["Delivery date", formatDate(p.delivery_date)],
                  ["Order number", p.order_number || "Unknown"],
                  ["Invoice number", p.invoice_number || "Unknown"],
                  ["Timezone", p.timezone],
                  ["Warranty status", p.warranty_status.replaceAll("_", " ")],
                ].map(([k, v]) => (
                  <div key={k}>
                    <dt>{k}</dt>
                    <dd>{v}</dd>
                  </div>
                ))}
              </dl>
              <label className="field">
                <span>Purchase status</span>
                <select
                  value={p.purchase_status}
                  disabled={busy}
                  onChange={(e) => void status(e.target.value as Status)}
                >
                  {[
                    "tracking",
                    "returned",
                    "refunded",
                    "kept",
                    "warranty_claimed",
                    "archived",
                  ].map((s) => (
                    <option value={s} key={s}>
                      {s.replaceAll("_", " ")}
                    </option>
                  ))}
                </select>
              </label>
              <p className="muted small">
                Status records your update. It does not confirm a merchant
                action.
              </p>
              <button className="button full" onClick={() => request(p.id)}>
                <Send size={16} />
                Prepare a request
              </button>
            </section>
            <div className="detail-policies">
              {p.deadlines.map((d) => {
                const policy = p.policies.find(
                  (pol) => pol.policy_type === d.deadline_type,
                );
                return (
                  <section className="panel deadline-detail" key={d.id}>
                    <div className="panel-heading">
                      <h2>
                        <ShieldCheck size={19} />
                        {d.deadline_type === "return"
                          ? "Return window"
                          : "Warranty coverage"}
                      </h2>
                      <DeadlineBadge deadline={d} />
                    </div>
                    <div className="deadline-value">
                      {d.deadline_date
                        ? formatDate(d.deadline_date)
                        : "Date unknown"}
                    </div>
                    <p className="muted">{d.calculation_basis.reason}</p>
                    <p className="muted small">
                      Date only · {d.timezone}. Check the terms for an exact
                      time cutoff.
                    </p>
                    {policy && (
                      <>
                        <dl className="policy-facts">
                          <div>
                            <dt>Policy source</dt>
                            <dd>{policy.policy_source || "Unknown"}</dd>
                          </div>
                          {policy.provider && (
                            <div>
                              <dt>Provider</dt>
                              <dd>{policy.provider}</dd>
                            </div>
                          )}
                          <div>
                            <dt>Verification</dt>
                            <dd>{policy.verification_status}</dd>
                          </div>
                          {policy.last_verified_at && (
                            <div>
                              <dt>Last checked</dt>
                              <dd>
                                {new Date(
                                  policy.last_verified_at,
                                ).toLocaleString()}
                              </dd>
                            </div>
                          )}
                          {policy.source_reference && (
                            <div>
                              <dt>Reference</dt>
                              <dd>{policy.source_reference}</dd>
                            </div>
                          )}
                        </dl>
                        <blockquote>
                          {policy.policy_text || "Terms not supplied"}
                        </blockquote>
                      </>
                    )}
                    {d.verification_status !== "confirmed" && (
                      <button
                        className="text-link"
                        onClick={() => setEditing(true)}
                      >
                        Add or verify details <Pencil size={14} />
                      </button>
                    )}
                  </section>
                );
              })}
            </div>
          </div>
          <section className="panel form-section">
            <div className="panel-heading">
              <h2>
                <FileText size={18} />
                Receipts & evidence
              </h2>
            </div>
            {p.documents.length ? (
              p.documents.map((d) => (
                <a
                  className="attachment-strip"
                  key={d.id}
                  href={`/api/documents/${d.id}`}
                  download
                >
                  <FileText size={17} />
                  {d.original_filename}
                  <Download size={16} />
                </a>
              ))
            ) : (
              <p className="muted">
                No receipt attached. Add one through invoice upload when
                creating a purchase.
              </p>
            )}
            <div className="evidence-list">
              {Object.entries(p.field_status)
                .filter(
                  ([k]) =>
                    ![
                      "notes",
                      "timezone",
                      "product_category",
                      "purchase_status",
                    ].includes(k),
                )
                .map(([key, value]) => (
                  <details key={key}>
                    <summary>
                      {key.replaceAll("_", " ")}
                      <span className="badge neutral">
                        {value.replaceAll("_", " ")}
                      </span>
                    </summary>
                    <p>
                      {p.evidence[key] ||
                        "No extraction evidence. This value was entered locally or is unknown."}
                    </p>
                  </details>
                ))}
            </div>
          </section>
          {p.notes && (
            <section className="panel form-section">
              <h2>Notes</h2>
              <p className="preserve-text">{p.notes}</p>
            </section>
          )}
          <div className="danger-action">
            <button
              className="button danger secondary"
              disabled={busy}
              onClick={() => void remove()}
            >
              <Trash2 size={16} />
              Delete purchase
            </button>
          </div>
        </>
      )}
    </>
  );
}
