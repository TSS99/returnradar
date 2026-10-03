import { useEffect, useState } from "react";
import { CalendarDays, ShieldCheck } from "lucide-react";
import { DeadlineCard, Empty } from "../components/common";
import { api } from "../services/api";
import type { Deadline } from "../types";

export function Calendar({ open }: { open: (id: string) => void }) {
  const [items, setItems] = useState<Deadline[]>([]);
  const [kind, setKind] = useState("all");
  const [range, setRange] = useState("365");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(true);
  useEffect(() => {
    setBusy(true);
    void api<Deadline[]>(`/deadlines?days=${range}`)
      .then(setItems)
      .catch((e) => setError(e.message))
      .finally(() => setBusy(false));
  }, [range]);
  const filtered = items.filter(
    (d) => kind === "all" || d.deadline_type === kind,
  );
  const months = [
    ...new Set(filtered.map((d) => d.deadline_date?.slice(0, 7))),
  ];
  return (
    <>
      <div className="page-heading">
        <div>
          <span className="eyebrow">Stay a step ahead</span>
          <h1>Deadline calendar</h1>
          <p>Your confirmed dates, in a simple timeline.</p>
        </div>
        <CalendarDays size={32} strokeWidth={1.4} />
      </div>
      <div className="calendar-tools">
        <div className="tabs">
          {["all", "return", "warranty"].map((k) => (
            <button
              className={kind === k ? "selected" : ""}
              key={k}
              onClick={() => setKind(k)}
            >
              {k === "all"
                ? "All deadlines"
                : k === "return"
                  ? "Returns"
                  : "Warranties"}
            </button>
          ))}
        </div>
        <label className="field">
          <span className="sr-only">Time range</span>
          <select value={range} onChange={(e) => setRange(e.target.value)}>
            <option value="30">Next 30 days</option>
            <option value="90">Next 90 days</option>
            <option value="365">Next year</option>
            <option value="3650">Next 10 years</option>
          </select>
        </label>
      </div>
      <div className="notice-box">
        <ShieldCheck size={20} />
        <p>
          Only confirmed, actionable deadlines appear here. Unverified policies
          can be checked in the purchase library.
        </p>
      </div>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      {busy ? (
        <p className="panel-empty">Loading dates…</p>
      ) : filtered.length ? (
        months.map((month) => (
          <section className="timeline-month" key={month}>
            <h2>
              {new Date(`${month}-15T12:00:00`).toLocaleDateString(undefined, {
                month: "long",
                year: "numeric",
              })}
            </h2>
            <div className="panel">
              {filtered
                .filter((d) => d.deadline_date?.startsWith(month || ""))
                .map((d) => (
                  <DeadlineCard item={d} open={open} key={d.id} />
                ))}
            </div>
          </section>
        ))
      ) : (
        <section className="panel">
          <Empty
            title="A clear calendar."
            text="There are no confirmed deadlines in this range. Check your policy details or try a longer time range."
          />
        </section>
      )}
    </>
  );
}
