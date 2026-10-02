import { useCallback, useEffect, useState } from "react";
import {
  Bell,
  CalendarDays,
  ChevronRight,
  FilePenLine,
  LayoutDashboard,
  Menu,
  Moon,
  Plus,
  Radar,
  Search,
  Settings2,
  ShieldCheck,
  ShoppingBag,
  Sun,
  X,
} from "lucide-react";
import { useRoute } from "./hooks/useRoute";
import { api } from "./services/api";
import type { Dashboard, Notice, Preferences, Purchase } from "./types";
import { Overview } from "./pages/Overview";
import { Library } from "./pages/Library";
import { AddPurchase } from "./pages/AddPurchase";
import { Details } from "./pages/Details";
import { Calendar } from "./pages/Calendar";
import { Requests } from "./pages/Requests";
import { Settings } from "./pages/Settings";

const links = [
  { id: "overview", label: "Overview", Icon: LayoutDashboard },
  { id: "library", label: "Purchase library", Icon: ShoppingBag },
  { id: "calendar", label: "Deadline calendar", Icon: CalendarDays },
  { id: "requests", label: "Request studio", Icon: FilePenLine },
];
export default function App() {
  const [route, navigate] = useRoute();
  const [dashboard, setDashboard] = useState<Dashboard>();
  const [preferences, setPreferences] = useState<Preferences>();
  const [notices, setNotices] = useState<Notice[]>([]);
  const [error, setError] = useState("");
  const [revision, setRevision] = useState(0);
  const [mobile, setMobile] = useState(false);
  const [dark, setDark] = useState(
    localStorage.getItem("returnradar-theme") === "dark",
  );
  const refresh = useCallback(async () => {
    try {
      const [d, p, n] = await Promise.all([
        api<Dashboard>("/dashboard"),
        api<Preferences>("/settings"),
        api<Notice[]>("/notifications"),
      ]);
      setDashboard(d);
      setPreferences(p);
      setNotices(n);
      setError("");
    } catch (e) {
      setError((e as Error).message);
    }
  }, []);
  useEffect(() => {
    void refresh();
    const timer = setInterval(() => void refresh(), 60000);
    return () => clearInterval(timer);
  }, [refresh]);
  useEffect(() => {
    document.documentElement.dataset.theme = dark ? "dark" : "light";
    localStorage.setItem("returnradar-theme", dark ? "dark" : "light");
  }, [dark]);
  const changed = () => {
    setRevision((r) => r + 1);
    void refresh();
  };
  const go = (page: string) => {
    navigate(page);
    setMobile(false);
  };
  const open = (id: string) => go(`purchase/${id}`);
  const saved = (p: Purchase) => {
    changed();
    open(p.id);
  };
  async function demo() {
    try {
      await api("/demo", { method: "POST" });
      changed();
    } catch (e) {
      setError((e as Error).message);
    }
  }
  async function readNotice(id: string) {
    try {
      await api(`/notifications/${id}`, { method: "PATCH" });
      void refresh();
    } catch (e) {
      setError((e as Error).message);
    }
  }
  const title = route.startsWith("purchase/")
    ? "Purchase details"
    : route.startsWith("requests")
      ? "Request studio"
      : route === "settings"
        ? "Settings"
        : route === "add"
          ? "Add purchase"
          : links.find((l) => l.id === route)?.label || "Overview";
  let content;
  if (dashboard && preferences) {
    if (route === "library")
      content = (
        <Library open={open} add={() => go("add")} revision={revision} />
      );
    else if (route === "add")
      content = <AddPurchase timezone={preferences.timezone} saved={saved} />;
    else if (route.startsWith("purchase/"))
      content = (
        <Details
          id={route.split("/")[1]}
          back={() => go("library")}
          changed={changed}
          request={(id) => go(`requests/${id}`)}
        />
      );
    else if (route === "calendar") content = <Calendar open={open} />;
    else if (route.startsWith("requests"))
      content = <Requests key={route} initialId={route.split("/")[1]} />;
    else if (route === "settings")
      content = (
        <Settings
          key="settings"
          preferences={preferences}
          saved={changed}
          notices={notices}
          reset={() => {
            changed();
            go("overview");
          }}
        />
      );
    else
      content = (
        <Overview
          data={dashboard}
          notices={notices}
          open={open}
          navigate={go}
          demo={() => void demo()}
          readNotice={(id) => void readNotice(id)}
        />
      );
  }
  return (
    <div className="app-shell">
      <a
        className="skip-link"
        href="#main-content"
        onClick={(e) => {
          e.preventDefault();
          document.getElementById("main-content")?.focus();
        }}
      >
        Skip to content
      </a>
      {mobile && (
        <button
          className="mobile-scrim"
          aria-label="Close navigation"
          onClick={() => setMobile(false)}
        />
      )}
      <aside className={`sidebar ${mobile ? "open" : ""}`}>
        <a className="brand" href="#overview">
          <span className="brand-symbol">
            <Radar size={27} strokeWidth={1.6} />
          </span>
          <span>
            Return<span className="brand-light">Radar</span>
            <small>A LITTLE PEACE OF MIND</small>
          </span>
        </a>
        <button
          className="mobile-close icon-button"
          aria-label="Close menu"
          onClick={() => setMobile(false)}
        >
          <X size={20} />
        </button>
        <span className="nav-caption">YOUR SPACE</span>
        <nav>
          {links.map(({ id, label, Icon }) => (
            <a
              key={id}
              href={`#${id}`}
              onClick={() => setMobile(false)}
              className={
                route === id ||
                (id === "library" && route.startsWith("purchase/")) ||
                (id === "requests" && route.startsWith("requests"))
                  ? "active"
                  : ""
              }
            >
              <Icon size={19} strokeWidth={1.7} />
              {label}
              {id === "library" && dashboard ? (
                <span className="nav-count">{dashboard.total}</span>
              ) : null}
            </a>
          ))}
          <a
            href="#add"
            className={route === "add" ? "active" : ""}
            onClick={() => setMobile(false)}
          >
            <Plus size={19} />
            Add purchase
          </a>
        </nav>
        <div className="sidebar-bottom">
          <div className="local-card">
            <ShieldCheck size={21} />
            <strong>Yours. And only yours.</strong>
            <p>
              Your receipts stay right
              <br />
              here on your computer.
            </p>
            <span>
              <span className="status-dot" />
              LOCAL & PRIVATE
            </span>
          </div>
          <a
            className={`settings-link ${route === "settings" ? "active" : ""}`}
            href="#settings"
          >
            <Settings2 size={18} />
            Settings
          </a>
          <div className="profile">
            <span className="avatar">
              <ShoppingBag size={18} />
            </span>
            <div>
              <strong>Your local workspace</strong>
              <small>Single-user · v0.1</small>
            </div>
            <button
              className="icon-button"
              aria-label={dark ? "Use light theme" : "Use dark theme"}
              onClick={() => setDark((d) => !d)}
            >
              {dark ? <Sun size={17} /> : <Moon size={17} />}
            </button>
          </div>
        </div>
      </aside>
      <div className="main-shell">
        <header className="topbar">
          <div className="breadcrumb">
            <button
              className="mobile-menu icon-button"
              aria-label="Open navigation"
              onClick={() => setMobile(true)}
            >
              <Menu size={20} />
            </button>
            <span>Your workspace</span>
            <ChevronRight size={14} />
            <strong>{title}</strong>
          </div>
          <div className="topbar-actions">
            <button
              className="icon-button"
              aria-label="Search purchase library"
              onClick={() => go("library")}
            >
              <Search size={19} />
            </button>
            <button
              className="icon-button notification-bell"
              aria-label="View reminders"
              onClick={() => go("settings")}
            >
              <Bell size={19} />
              {notices.some((n) => !n.read) && <i />}
            </button>
            <span className="local-chip">
              <span className="status-dot" />
              Local workspace
            </span>
          </div>
        </header>
        <main id="main-content" tabIndex={-1} className="main-content">
          {dashboard?.demo && (
            <div className="demo-banner">
              FICTIONAL DEMO · These are synthetic purchases and policies.
              Delete them in Settings before adding your own.
            </div>
          )}
          {error && (
            <div className="error" role="alert">
              {error}
              <button className="text-link" onClick={() => void refresh()}>
                Retry connection
              </button>
            </div>
          )}
          {content ||
            (!error && (
              <p className="panel-empty" role="status">
                Opening your workspace…
              </p>
            ))}
          <footer className="app-footer">
            <span>
              ReturnRadar <span className="footer-dot">·</span> Never miss a
              window.
            </span>
            <span>
              <ShieldCheck size={13} />
              Private by default.
            </span>
          </footer>
        </main>
      </div>
    </div>
  );
}
