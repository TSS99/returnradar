"use client";
import { useEffect, useState } from "react";
import { api } from "../../src/services/api";
type Metrics = {
  totals: Record<string, number | null>;
  daily: {
    day: string;
    active_users: number;
    mcp_calls: number;
    web_requests: number;
    purchases_added: number;
    drafts_prepared: number;
    receipts_uploaded: number;
  }[];
  generated_at: string;
  definitions: string;
};
export default function Analytics() {
  const [data, setData] = useState<Metrics>(),
    [error, setError] = useState("");
  const load = () =>
    void api<Metrics>("/admin/analytics")
      .then((d) => {
        setData(d);
        setError("");
      })
      .catch((e) => setError(e.message));
  useEffect(() => {
    load();
  }, []);
  const labels: [string, string][] = [
    ["registered_users", "Registered users"],
    ["active_24h", "Active · 24 hours"],
    ["active_7d", "Active · 7 days"],
    ["active_30d", "Active · 30 days"],
    ["new_7d", "New · 7 days"],
    ["activated_users", "Users with purchases"],
    ["purchases", "Real purchases tracked"],
  ];
  return (
    <main className="analytics-page">
      <div className="page-heading">
        <div>
          <a className="text-link" href="/">
            Back to my workspace
          </a>
          <h1>ReturnRadar usage</h1>
          <p>
            Owner-only counts. No receipt contents or individual purchase
            details.
          </p>
        </div>
        <button className="button secondary" onClick={load}>
          Refresh
        </button>
      </div>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      {!data && !error && <p role="status">Loading usage…</p>}
      {data && (
        <>
          <section className="usage-grid">
            {labels.map(([key, label]) => (
              <article className="panel usage-card" key={key}>
                <span>{label}</span>
                <strong>{data.totals[key] || 0}</strong>
              </article>
            ))}
          </section>
          <section className="panel form-section">
            <h2>Last 30 days</h2>
            <div className="usage-table">
              <table>
                <thead>
                  <tr>
                    {[
                      "Date · UTC",
                      "Active users",
                      "MCP calls",
                      "Web requests",
                      "Purchases added",
                      "Drafts prepared",
                      "Receipts uploaded",
                    ].map((l) => (
                      <th key={l}>{l}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {data.daily.map((d) => (
                    <tr key={d.day}>
                      <td>{d.day}</td>
                      <td>{d.active_users}</td>
                      <td>{d.mcp_calls}</td>
                      <td>{d.web_requests}</td>
                      <td>{d.purchases_added}</td>
                      <td>{d.drafts_prepared}</td>
                      <td>{d.receipts_uploaded}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {!data.daily.length && <p>No activity recorded yet.</p>}
            </div>
          </section>
          <p className="muted">{data.definitions}</p>
          <p className="muted small">
            Updated {new Date(data.generated_at).toLocaleString()}.
          </p>
        </>
      )}
    </main>
  );
}
