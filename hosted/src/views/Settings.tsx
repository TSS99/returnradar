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
          <span>Enable in-app reminders</span>
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
            ReturnRadar checks reminders when you open your workspace, then
            every minute while it is open. Due reminders catch up on your next
            visit. Nothing needs to run on your computer between visits. These
            are in-app notices, not email or push alerts; due times use 9 am in
            each purchase’s timezone.
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
          Backups are downloadable archives of your data. Automatic restore is
          not yet available. The beta allows 250 purchases and 20 PDFs (20 MB
          total) per account.
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
            Private to your account
          </h2>
        </div>
        <p className="muted">
          Your records and receipt files are stored with the hosting provider
          and restricted to your signed-in account. Connecting ChatGPT shares
          the tool results you request with ChatGPT. Receipt contents are not
          sent to an AI extraction service.
        </p>
        <p className="muted small">
          The owner can see aggregate usage counts. The usage dashboard does not
          display your receipts or purchase details. Read the Privacy page for
          hosting and retention details.
        </p>
      </section>
      <section className="panel form-section danger-zone">
        <h2>Delete my cloud data</h2>
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
          Delete all my cloud data
        </button>
      </section>
    </>
  );
}
