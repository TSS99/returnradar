import { useState } from "react";
import {
  Archive,
  Bell,
  Check,
  Download,
  Globe2,
  LockKeyhole,
  Play,
  Trash2,
} from "lucide-react";
import { api } from "../services/api";
import type { Notice, Preferences } from "../types";

export function Settings({
  preferences,
  saved,
  reset,
  notices,
}: {
  preferences: Preferences;
  saved: () => void;
  reset: () => void;
  notices: Notice[];
}) {
  const [timezone, setTimezone] = useState(preferences.timezone);
  const [enabled, setEnabled] = useState(preferences.reminders_enabled);
  const [offsets, setOffsets] = useState(
    preferences.reminder_offsets.join(", "),
  );
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  async function save(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const values = offsets.trim()
        ? offsets.split(",").map((v) => {
            if (!/^\d+$/.test(v.trim()))
              throw new Error("Enter whole days separated by commas.");
            return Number(v.trim());
          })
        : [];
      await api("/settings", {
        method: "PUT",
        body: JSON.stringify({
          timezone,
          reminders_enabled: enabled,
          reminder_offsets: values,
        }),
      });
      saved();
      setMessage("Preferences saved.");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function run() {
    setError("");
    try {
      const result = await api<{ generated: number }>("/reminders/run", {
        method: "POST",
      });
      setMessage(`${result.generated} new reminders generated.`);
      saved();
    } catch (e) {
      setError((e as Error).message);
    }
  }
  async function wipe() {
    setBusy(true);
    setError("");
    try {
      await api("/delete-data", {
        method: "POST",
        body: JSON.stringify({ confirmation: confirm }),
      });
      reset();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <div className="page-heading">
        <div>
          <span className="eyebrow">Make yourself at home</span>
          <h1>Settings</h1>
          <p>Your preferences. Your data. Your control.</p>
        </div>
      </div>
      <form onSubmit={save} className="panel form-section">
        <div className="panel-heading">
          <h2>
            <Bell size={19} />
            Reminders & timezone
          </h2>
        </div>
        <label className="check-line">
          <input
            type="checkbox"
            checked={enabled}
            onChange={(e) => setEnabled(e.target.checked)}
          />
          <span>Enable local in-app reminders</span>
        </label>
        <div className="form-grid">
          <label className="field">
            <span>
              <Globe2 size={14} />
              Default timezone for new purchases
            </span>
            <input
              value={timezone}
              onChange={(e) => setTimezone(e.target.value)}
              placeholder="Asia/Kolkata"
            />
          </label>
          <label className="field">
            <span>Days before a deadline</span>
            <input
              value={offsets}
              onChange={(e) => setOffsets(e.target.value)}
            />
            <small>
              Separate whole days with commas. 0 means on the deadline.
            </small>
          </label>
        </div>
        <div className="notice-box">
          <Bell size={20} />
          <p>
            Reminders run every minute while the backend is on. They can’t reach
            you while your computer is off. Missed runs are caught up when it
            restarts. Due dates are checked at 9 am in each purchase’s timezone.
          </p>
        </div>
        <div className="form-actions">
          <button
            type="button"
            className="button secondary"
            onClick={() => void run()}
          >
            <Play size={16} />
            Check due reminders
          </button>
          <button className="button" disabled={busy}>
            <Check size={16} />
            Save preferences
          </button>
        </div>
      </form>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      {message && (
        <p className="success" role="status">
          {message}
        </p>
      )}
      <section className="panel form-section">
        <div className="panel-heading">
          <h2>
            <Download size={19} />
            Export & backup
          </h2>
        </div>
        <p className="muted">
          Exports contain your purchase records. A backup also includes
          receipts, settings, and notification history. Keep these files
          somewhere private.
        </p>
        <div className="form-actions">
          <a
            className="button secondary"
            href="/api/export?format=csv"
            download
          >
            Export CSV
          </a>
          <a
            className="button secondary"
            href="/api/export?format=json"
            download
          >
            Export JSON
          </a>
          <a className="button" href="/api/backup" download>
            <Archive size={16} />
            Download backup
          </a>
        </div>
        <p className="muted small">
          Backup restore is manual in v0.1; see the local setup guide for a
          restorable folder backup.
        </p>
      </section>
      <section className="panel form-section">
        <div className="panel-heading">
          <h2>
            <Bell size={19} />
            Reminder history
          </h2>
        </div>
        {notices.length ? (
          notices.map((n) => (
            <div className="history-entry" key={n.id}>
              <p>{n.message}</p>
              <small>
                {new Date(n.created_at).toLocaleString()} ·{" "}
                {n.read ? "Read" : "Unread"}
              </small>
            </div>
          ))
        ) : (
          <p className="muted">No reminders have been generated yet.</p>
        )}
      </section>
      <section className="panel form-section">
        <div className="panel-heading">
          <h2>
            <LockKeyhole size={19} />
            Local by design
          </h2>
        </div>
        <p className="muted">
          Your receipts stay on your computer. ReturnRadar does not send
          invoices to external AI services. Connecting an MCP client shares the
          tool results you request with that client.
        </p>
        <p className="muted small">
          This is a single-user local app. Keep it bound to localhost. Purchase
          documents and the database are not encrypted at rest; use your
          operating system’s disk encryption.
        </p>
      </section>
      <section className="panel form-section danger-zone">
        <h2>Delete local data</h2>
        <p className="muted">
          Permanently delete all purchase records, attachments, reminders, and
          preferences. Download a backup first if you need one.
        </p>
        <label className="field">
          <span>Type DELETE ALL MY DATA to confirm</span>
          <input value={confirm} onChange={(e) => setConfirm(e.target.value)} />
        </label>
        <button
          className="button danger"
          disabled={confirm !== "DELETE ALL MY DATA" || busy}
          onClick={() => void wipe()}
        >
          <Trash2 size={16} />
          Delete all local data
        </button>
      </section>
    </>
  );
}
