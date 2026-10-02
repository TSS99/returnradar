import {
  ArrowUpRight,
  Coffee,
  Headphones,
  Package,
  ShieldCheck,
  ShoppingBag,
  Watch,
} from "lucide-react";
import type { Deadline, Purchase } from "../types";

export function formatDate(value: string | null | undefined) {
  if (!value) return "Unknown";
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(`${value}T12:00:00`));
}
export function money(p: Purchase) {
  if (p.purchase_amount === null) return "Amount unknown";
  if (!p.currency) return `${p.purchase_amount} · currency unknown`;
  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency: p.currency,
    }).format(Number(p.purchase_amount));
  } catch {
    return `${p.purchase_amount} ${p.currency}`;
  }
}
export function ProductIcon({
  category,
  large = false,
}: {
  category: string;
  large?: boolean;
}) {
  const Icon =
    category === "Electronics"
      ? Headphones
      : category === "Home"
        ? Coffee
        : category === "Accessories"
          ? ShoppingBag
          : Package;
  return (
    <span
      className={`product-icon ${large ? "large" : ""} ${category.toLowerCase()}`}
    >
      <Icon size={large ? 35 : 23} strokeWidth={1.6} />
    </span>
  );
}
export function DeadlineBadge({
  deadline,
}: {
  deadline: Deadline | undefined;
}) {
  if (!deadline || deadline.verification_status === "unknown")
    return <span className="badge neutral">Policy needed</span>;
  if (deadline.verification_status === "tentative")
    return <span className="badge amber">Needs verification</span>;
  const parts = new Intl.DateTimeFormat("en", {
    timeZone: deadline.timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const part = (type: string) => parts.find((p) => p.type === type)?.value;
  const today = `${part("year")}-${part("month")}-${part("day")}`;
  if (deadline.deadline_date && deadline.deadline_date < today)
    return <span className="badge neutral">Window passed</span>;
  return (
    <span className="badge green">
      <ShieldCheck size={12} />
      Confirmed
    </span>
  );
}
export function Empty({
  title,
  text,
  action,
}: {
  title: string;
  text: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="empty">
      <span className="empty-icon">
        <ShoppingBag size={30} strokeWidth={1.5} />
      </span>
      <h2>{title}</h2>
      <p>{text}</p>
      {action}
    </div>
  );
}
export function PurchaseRow({
  purchase,
  open,
}: {
  purchase: Purchase;
  open: (id: string) => void;
}) {
  const deadline = purchase.deadlines.find((d) => d.deadline_type === "return");
  return (
    <button className="purchase-row" onClick={() => open(purchase.id)}>
      <ProductIcon category={purchase.product_category} />
      <div className="row-main">
        <strong>{purchase.product_name}</strong>
        <span>{purchase.merchant_name || "Merchant unknown"}</span>
      </div>
      <div className="row-date">
        <span>Return by</span>
        <strong>
          {deadline?.deadline_date
            ? formatDate(deadline.deadline_date)
            : "Unknown"}
        </strong>
      </div>
      <DeadlineBadge deadline={deadline} />
      <strong className="row-amount">{money(purchase)}</strong>
      <ArrowUpRight size={16} />
    </button>
  );
}
export function DeadlineCard({
  item,
  open,
}: {
  item: Deadline;
  open: (id: string) => void;
}) {
  const urgent = (item.days_remaining ?? 99) <= 3;
  return (
    <button className="deadline-card" onClick={() => open(item.purchase_id)}>
      <span className={`day-count ${urgent ? "urgent" : ""}`}>
        <strong>{item.days_remaining}</strong>
        <span>{item.days_remaining === 1 ? "day left" : "days left"}</span>
      </span>
      <div className="row-main">
        <strong>{item.product_name}</strong>
        <span>
          {item.deadline_type === "return" ? "Return window" : "Warranty"} ·{" "}
          {formatDate(item.deadline_date)}
        </span>
      </div>
      {item.deadline_type === "warranty" ? (
        <ShieldCheck size={18} />
      ) : (
        <Watch size={18} />
      )}
      <ArrowUpRight size={16} />
    </button>
  );
}
