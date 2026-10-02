export type FieldStatus =
  "automatically_extracted" | "user_confirmed" | "manually_entered" | "unknown";
export type Status =
  | "tracking"
  | "returned"
  | "refunded"
  | "kept"
  | "warranty_claimed"
  | "archived";
export type Policy = {
  policy_type: "return" | "warranty";
  policy_source: string | null;
  source_reference?: string | null;
  policy_text: string;
  duration: number | null;
  duration_unit: "days" | "months" | "years";
  start_date_basis:
    | "purchase_date"
    | "delivery_date"
    | "warranty_start"
    | "explicit"
    | "unknown";
  start_date?: string | null;
  start_date_verified?: boolean;
  cutoff_date?: string | null;
  provider?: string | null;
  verification_status: "unknown" | "unverified" | "verified";
  last_verified_at?: string | null;
};
export type Deadline = {
  id: string;
  purchase_id: string;
  deadline_type: "return" | "warranty";
  deadline_date: string | null;
  timezone: string;
  verification_status: "unknown" | "tentative" | "confirmed";
  calculation_basis: {
    reason: string;
    policy_source?: string;
    start_date?: string;
    [key: string]: unknown;
  };
  product_name?: string;
  merchant_name?: string;
  days_remaining?: number;
  is_demo?: boolean;
};
export type DocumentInfo = {
  id: string;
  original_filename: string;
  content_hash: string;
  upload_timestamp: string;
};
export type Purchase = {
  id: string;
  merchant_name: string | null;
  product_name: string;
  product_category: string;
  order_number: string | null;
  invoice_number: string | null;
  purchase_date: string | null;
  delivery_date: string | null;
  purchase_amount: string | null;
  currency: string | null;
  purchase_status: Status;
  timezone: string;
  notes: string;
  is_demo: boolean;
  field_status: Record<string, FieldStatus>;
  evidence: Record<string, string>;
  policies: Policy[];
  deadlines: Deadline[];
  documents: DocumentInfo[];
  warranty_status: string;
};
export type Extraction = {
  document: DocumentInfo;
  fields: Record<string, string | null>;
  field_status: Record<string, FieldStatus>;
  evidence: Record<string, string>;
  confidence: Record<string, string>;
  policies: Partial<Policy>[];
  warnings: string[];
};
export type Dashboard = {
  total: number;
  upcoming_returns: number;
  active_warranties: number;
  attention_count: number;
  attention: Purchase[];
  recent: Purchase[];
  upcoming: Deadline[];
  demo: boolean;
};
export type Preferences = {
  timezone: string;
  reminders_enabled: boolean;
  reminder_offsets: number[];
};
export type Notice = {
  id: string;
  purchase_id: string;
  message: string;
  created_at: string;
  read: boolean;
};
