import { useEffect, useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Plus,
  Search,
  SlidersHorizontal,
} from "lucide-react";
import { Empty, PurchaseRow } from "../components/common";
import { api } from "../services/api";
import type { Purchase } from "../types";

export function Library({
  open,
  add,
  revision,
}: {
  open: (id: string) => void;
  add: () => void;
  revision: number;
}) {
  const [search, setSearch] = useState("");
  const [merchant, setMerchant] = useState("");
  const [category, setCategory] = useState("");
  const [status, setStatus] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [page, setPage] = useState(1);
  const [facets, setFacets] = useState<{
    merchants: string[];
    categories: string[];
  }>({ merchants: [], categories: [] });
  const [result, setResult] = useState<{ items: Purchase[]; total: number }>({
    items: [],
    total: 0,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  useEffect(() => {
    void api<typeof facets>("/facets")
      .then(setFacets)
      .catch((e) => setError(e.message));
  }, [revision]);
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError("");
    const timer = setTimeout(() => {
      const query = new URLSearchParams({
        search,
        merchant,
        category,
        status,
        page: String(page),
        page_size: "12",
      });
      if (from) query.set("date_from", from);
      if (to) query.set("date_to", to);
      void api<typeof result>(`/purchases?${query}`, {
        signal: controller.signal,
      })
        .then(setResult)
        .catch((e) => {
          if (e.name !== "AbortError") setError(e.message);
        })
        .finally(() => {
          if (!controller.signal.aborted) setLoading(false);
        });
    }, 180);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [search, merchant, category, status, from, to, page, revision]);
  function filter(setter: (v: string) => void, value: string) {
    setter(value);
    setPage(1);
  }
  return (
    <>
      <div className="page-heading">
        <div>
          <span className="eyebrow">Everything you’re keeping track of</span>
          <h1>Purchase library</h1>
          <p>A tidy home for receipts and possibilities.</p>
        </div>
        <button className="button" onClick={add}>
          <Plus size={18} />
          Add purchase
        </button>
      </div>
      <section className="panel library-panel">
        <div className="library-tools">
          <label className="search-input">
            <Search size={18} />
            <input
              aria-label="Search purchases"
              placeholder="Search product, merchant or order…"
              value={search}
              onChange={(e) => filter(setSearch, e.target.value)}
            />
          </label>
          <span className="muted small">
            <SlidersHorizontal size={15} />
            Refine your view
          </span>
        </div>
        <div className="filters">
          <label>
            Merchant
            <select
              value={merchant}
              onChange={(e) => filter(setMerchant, e.target.value)}
            >
              <option value="">All merchants</option>
              {facets.merchants.map((m) => (
                <option key={m}>{m}</option>
              ))}
            </select>
          </label>
          <label>
            Category
            <select
              value={category}
              onChange={(e) => filter(setCategory, e.target.value)}
            >
              <option value="">All categories</option>
              {facets.categories.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </label>
          <label>
            Status
            <select
              value={status}
              onChange={(e) => filter(setStatus, e.target.value)}
            >
              <option value="">All statuses</option>
              {[
                "tracking",
                "returned",
                "refunded",
                "kept",
                "warranty_claimed",
                "archived",
              ].map((s) => (
                <option key={s} value={s}>
                  {s.replaceAll("_", " ")}
                </option>
              ))}
            </select>
          </label>
          <label>
            Purchased from
            <input
              type="date"
              value={from}
              onChange={(e) => filter(setFrom, e.target.value)}
            />
          </label>
          <label>
            Purchased to
            <input
              type="date"
              value={to}
              onChange={(e) => filter(setTo, e.target.value)}
            />
          </label>
        </div>
        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}
        {loading ? (
          <p className="panel-empty" role="status">
            Loading purchases…
          </p>
        ) : result.items.length ? (
          result.items.map((p) => (
            <PurchaseRow key={p.id} purchase={p} open={open} />
          ))
        ) : (
          <Empty
            title="Nothing here just yet."
            text={
              search || merchant || category || status || from || to
                ? "Try adjusting your search or filters."
                : "Start with a receipt, or enter your purchase manually."
            }
            action={
              <button className="button secondary" onClick={add}>
                Add a purchase
              </button>
            }
          />
        )}
        <div className="pagination">
          <span>{result.total} purchases</span>
          <div>
            <button
              className="icon-button"
              aria-label="Previous page"
              disabled={page === 1}
              onClick={() => setPage((p) => p - 1)}
            >
              <ChevronLeft size={18} />
            </button>
            <span>
              Page {page} of {Math.max(1, Math.ceil(result.total / 12))}
            </span>
            <button
              className="icon-button"
              aria-label="Next page"
              disabled={page * 12 >= result.total}
              onClick={() => setPage((p) => p + 1)}
            >
              <ChevronRight size={18} />
            </button>
          </div>
        </div>
      </section>
    </>
  );
}
