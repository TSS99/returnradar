import {
  ArrowRight,
  ArrowUpRight,
  Bell,
  CheckCheck,
  Plus,
  ReceiptText,
  ShieldCheck,
  Sparkles,
  Timer,
} from "lucide-react";
import { DeadlineCard, Empty, PurchaseRow } from "../components/common";
import type { Dashboard, Notice } from "../types";

export function Overview({
  data,
  notices,
  navigate,
  open,
  demo,
  readNotice,
}: {
  data: Dashboard;
  notices: Notice[];
  navigate: (p: string) => void;
  open: (id: string) => void;
  demo: () => void;
  readNotice: (id: string) => void;
}) {
  const unread = notices.filter((n) => !n.read);
  const stats = [
    {
      label: "Tracked purchases",
      value: data.total,
      Icon: ReceiptText,
      note: "Everything, in one place",
    },
    {
      label: "Returns coming up",
      value: data.upcoming_returns,
      Icon: Timer,
      note: "Confirmed · next 30 days",
    },
    {
      label: "Active warranties",
      value: data.active_warranties,
      Icon: ShieldCheck,
      note: "A little extra protection",
    },
    {
      label: "Needs a closer look",
      value: data.attention_count,
      Icon: Sparkles,
      note: "Policy details to verify",
    },
  ];
  return (
    <>
      <div className="page-heading">
        <div>
          <span className="eyebrow">Your purchases, looked after</span>
          <h1>A little peace of mind.</h1>
          <p>Keep the things you love. Stay on top of the rest.</p>
        </div>
        <button className="button" onClick={() => navigate("add")}>
          <Plus size={18} />
          Add purchase
        </button>
      </div>
      <section className="hero-card">
        <div>
          <span className="hero-label">
            <span className="status-dot" />
            YOUR PERSONAL PURCHASE COMPANION
          </span>
          <h2>
            Good purchases.
            <br />
            No missed windows.
          </h2>
          <p>
            Receipts, return dates, and warranties.
            <br />
            All together. Ready on any device.
          </p>
          <button className="text-link" onClick={() => navigate("calendar")}>
            See what’s coming up <ArrowRight size={17} />
          </button>
        </div>
        <div className="radar-art" aria-hidden="true">
          <svg viewBox="0 0 300 230">
            <g fill="none" stroke="currentColor">
              <circle cx="165" cy="119" r="95" />
              <circle cx="165" cy="119" r="65" />
              <circle cx="165" cy="119" r="35" />
              <path d="M70 119h190M165 24v190M165 119l67-67" />
              <path
                d="M165 119 232 52A95 95 0 0 1 260 119Z"
                fill="currentColor"
                opacity=".08"
              />
            </g>
            <circle cx="165" cy="119" r="5" fill="currentColor" />
            <circle cx="207" cy="89" r="6" fill="currentColor" />
            <circle cx="116" cy="164" r="4" fill="currentColor" />
          </svg>
          <span className="radar-label">
            <CheckCheck size={17} /> A little more organized
          </span>
        </div>
      </section>
      <div className="stats-grid">
        {stats.map(({ label, value, Icon, note }) => (
          <div className="stat-card" key={label}>
            <div className="stat-top">
              <span>{label}</span>
              <Icon size={19} />
            </div>
            <strong>{value.toString().padStart(2, "0")}</strong>
            <span className="stat-note">{note}</span>
          </div>
        ))}
      </div>
      {data.total === 0 ? (
        <section className="panel">
          <Empty
            title="Your next purchase has a home."
            text="Upload a receipt or add an item by hand. We’ll help you keep track of the dates once you’ve checked the terms."
            action={
              <div className="empty-actions">
                <button className="button" onClick={() => navigate("add")}>
                  <Plus size={17} />
                  Add your first purchase
                </button>
                <button className="button secondary" onClick={demo}>
                  Explore fictional demo
                </button>
              </div>
            }
          />
        </section>
      ) : (
        <>
          <div className="dashboard-columns">
            <section className="panel">
              <div className="panel-heading">
                <div>
                  <span className="eyebrow">RIGHT ON TIME</span>
                  <h2>Coming up next</h2>
                </div>
                <button
                  className="text-link"
                  onClick={() => navigate("calendar")}
                >
                  View all <ArrowUpRight size={16} />
                </button>
              </div>
              {data.upcoming.length ? (
                data.upcoming
                  .slice(0, 4)
                  .map((d) => <DeadlineCard item={d} open={open} key={d.id} />)
              ) : (
                <p className="panel-empty">
                  No confirmed deadlines in the next 30 days. You’re up to date.
                </p>
              )}
              <div className="panel-foot">
                <ShieldCheck size={14} />
                Only verified dates appear here.
              </div>
            </section>
            <section className="panel attention-panel">
              <div className="panel-heading">
                <div>
                  <span className="eyebrow">A QUICK CHECK</span>
                  <h2>Needs your attention</h2>
                </div>
                <span className="badge amber">
                  {data.attention_count} items
                </span>
              </div>
              {data.attention.length ? (
                data.attention.slice(0, 3).map((p) => (
                  <button
                    className="attention-item"
                    onClick={() => open(p.id)}
                    key={p.id}
                  >
                    <span className="attention-dot" />
                    <div>
                      <strong>{p.product_name}</strong>
                      <p>
                        {p.deadlines.find((d) => d.deadline_type === "return")
                          ?.calculation_basis.reason ||
                          "Add return policy details"}
                      </p>
                    </div>
                    <ArrowRight size={16} />
                  </button>
                ))
              ) : (
                <p className="panel-empty">
                  All tracked return policies have been checked.
                </p>
              )}
              <div className="panel-foot">
                Unknown doesn’t mean ineligible. Check the applicable terms.
              </div>
            </section>
          </div>
          <section className="panel recent-panel">
            <div className="panel-heading">
              <div>
                <span className="eyebrow">IN YOUR LIBRARY</span>
                <h2>Recent purchases</h2>
              </div>
              <button className="text-link" onClick={() => navigate("library")}>
                Open library <ArrowUpRight size={16} />
              </button>
            </div>
            {data.recent.map((p) => (
              <PurchaseRow purchase={p} open={open} key={p.id} />
            ))}
          </section>
        </>
      )}
      {unread.length > 0 && (
        <section className="panel notifications">
          <div className="panel-heading">
            <h2>
              <Bell size={18} />
              Your reminders
            </h2>
            <span className="badge neutral">{unread.length} unread</span>
          </div>
          {unread.slice(0, 5).map((n) => (
            <div className="notification" key={n.id}>
              <button onClick={() => open(n.purchase_id)}>{n.message}</button>
              <button
                className="icon-button"
                aria-label="Mark reminder read"
                onClick={() => readNotice(n.id)}
              >
                <CheckCheck size={18} />
              </button>
            </div>
          ))}
        </section>
      )}
    </>
  );
}
