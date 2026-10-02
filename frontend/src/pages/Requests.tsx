import { useEffect, useState } from "react";
import { Check, Copy, Download, FilePenLine } from "lucide-react";
import { api, downloadText } from "../services/api";
import type { Purchase } from "../types";

export function Requests({ initialId }: { initialId?: string }) {
  const [items, setItems] = useState<Purchase[]>([]);
  const [id, setId] = useState(initialId || "");
  const [kind, setKind] = useState("return");
  const [reason, setReason] = useState("");
  const [query, setQuery] = useState("");
  const [draft, setDraft] = useState<{ subject: string; body: string }>();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    let stopped = false;
    void api<{ items: Purchase[] }>(
      `/purchases?page_size=100&search=${encodeURIComponent(query)}`,
    )
      .then(async (r) => {
        if (initialId && !r.items.some((p) => p.id === initialId))
          r.items.unshift(await api<Purchase>(`/purchases/${initialId}`));
        if (!stopped) setItems(r.items);
      })
      .catch((e) => {
        if (!stopped) setError(e.message);
      });
    return () => {
      stopped = true;
    };
  }, [query, initialId]);
  async function generate(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      setDraft(
        await api(`/purchases/${id}/request`, {
          method: "POST",
          body: JSON.stringify({ kind, reason }),
        }),
      );
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function copy() {
    if (!draft) return;
    try {
      await navigator.clipboard.writeText(`${draft.subject}\n\n${draft.body}`);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setError("Clipboard unavailable. Select the draft text or download it.");
    }
  }
  return (
    <>
      <div className="page-heading">
        <div>
          <span className="eyebrow">A good starting point</span>
          <h1>Prepare a request</h1>
          <p>Find the words. Make them your own.</p>
        </div>
        <FilePenLine size={32} strokeWidth={1.4} />
      </div>
      <div className="request-columns">
        <form className="panel form-section" onSubmit={generate}>
          <h2>What can we help with?</h2>
          <label className="field">
            <span>Find a purchase</span>
            <input
              placeholder="Search your library"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </label>
          <label className="field">
            <span>Purchase</span>
            <select
              required
              value={id}
              onChange={(e) => {
                setId(e.target.value);
                setDraft(undefined);
              }}
            >
              <option value="">Select a purchase</option>
              {items.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.product_name} · {p.merchant_name || "Unknown merchant"}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>Request type</span>
            <select
              value={kind}
              onChange={(e) => {
                setKind(e.target.value);
                setDraft(undefined);
              }}
            >
              <option value="return">Product return</option>
              <option value="refund">Refund follow-up</option>
              <option value="warranty">Warranty claim</option>
              <option value="replacement">Replacement request</option>
            </select>
          </label>
          <label className="field">
            <span>
              Reason or extra details <small>optional</small>
            </span>
            <textarea
              rows={5}
              maxLength={2000}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Describe the problem and what you’d like to happen."
            />
          </label>
          <button className="button" disabled={busy || !id}>
            {busy ? "Preparing…" : "Generate draft"}
          </button>
          <p className="muted small">
            Only reviewed purchase details are included. No merchant approval is
            assumed.
          </p>
        </form>
        <section className="panel form-section draft-panel">
          <div className="panel-heading">
            <h2>Your editable draft</h2>
            <span className="badge neutral">Draft only</span>
          </div>
          {draft ? (
            <>
              <label className="field">
                <span>Subject</span>
                <input
                  value={draft.subject}
                  onChange={(e) =>
                    setDraft({ ...draft, subject: e.target.value })
                  }
                />
              </label>
              <label className="field">
                <span>Message</span>
                <textarea
                  rows={17}
                  value={draft.body}
                  onChange={(e) => setDraft({ ...draft, body: e.target.value })}
                />
              </label>
              <div className="form-actions">
                <button
                  className="button secondary"
                  onClick={() => void copy()}
                >
                  {copied ? <Check size={16} /> : <Copy size={16} />}{" "}
                  {copied ? "Copied" : "Copy draft"}
                </button>
                <button
                  className="button"
                  onClick={() =>
                    downloadText(
                      `${draft.subject}\n\n${draft.body}`,
                      "returnradar-request.txt",
                    )
                  }
                >
                  <Download size={16} />
                  Download
                </button>
              </div>
            </>
          ) : (
            <div className="draft-empty">
              <FilePenLine size={38} strokeWidth={1.3} />
              <p>
                Your request will appear here.
                <br />
                Review it before sending it yourself.
              </p>
            </div>
          )}
          <p className="privacy-caption">Nothing is sent automatically.</p>
        </section>
      </div>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
    </>
  );
}
