import {
  sqliteTable,
  text,
  integer,
  primaryKey,
  uniqueIndex,
  index,
  foreignKey,
} from "drizzle-orm/sqlite-core";
export const users = sqliteTable("users", {
  id: text("id").primaryKey(),
  created_at: text("created_at").notNull(),
  last_active: text("last_active").notNull(),
  settings: text("settings").notNull(),
});
export const purchases = sqliteTable(
  "purchases",
  {
    id: text("id").primaryKey(),
    owner_id: text("owner_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    data: text("data").notNull(),
    is_demo: integer("is_demo").notNull().default(0),
    created_at: text("created_at").notNull(),
    updated_at: text("updated_at").notNull(),
  },
  (t) => [
    uniqueIndex("purchases_owner_id_id").on(t.owner_id, t.id),
    index("purchases_owner_created").on(t.owner_id, t.created_at),
  ],
);
export const documents = sqliteTable(
  "documents",
  {
    id: text("id").primaryKey(),
    owner_id: text("owner_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    purchase_id: text("purchase_id"),
    original_filename: text("original_filename").notNull(),
    object_key: text("object_key").notNull(),
    content_hash: text("content_hash").notNull(),
    size: integer("size").notNull(),
    upload_timestamp: text("upload_timestamp").notNull(),
  },
  (t) => [
    index("documents_owner").on(t.owner_id),
    foreignKey({
      columns: [t.owner_id, t.purchase_id],
      foreignColumns: [purchases.owner_id, purchases.id],
    }).onDelete("cascade"),
  ],
);
export const notifications = sqliteTable(
  "notifications",
  {
    id: text("id").primaryKey(),
    owner_id: text("owner_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    purchase_id: text("purchase_id").notNull(),
    idempotency_key: text("idempotency_key").notNull(),
    message: text("message").notNull(),
    created_at: text("created_at").notNull(),
    read: integer("read").notNull().default(0),
  },
  (t) => [
    uniqueIndex("notifications_owner_key").on(t.owner_id, t.idempotency_key),
    index("notifications_owner_created").on(t.owner_id, t.created_at),
    foreignKey({
      columns: [t.owner_id, t.purchase_id],
      foreignColumns: [purchases.owner_id, purchases.id],
    }).onDelete("cascade"),
  ],
);
export const activity = sqliteTable(
  "activity",
  {
    owner_id: text("owner_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    day: text("day").notNull(),
    web_requests: integer("web_requests").notNull().default(0),
    mcp_calls: integer("mcp_calls").notNull().default(0),
    purchases_added: integer("purchases_added").notNull().default(0),
    drafts_prepared: integer("drafts_prepared").notNull().default(0),
    receipts_uploaded: integer("receipts_uploaded").notNull().default(0),
  },
  (t) => [
    primaryKey({ columns: [t.owner_id, t.day] }),
    index("activity_day").on(t.day),
  ],
);
export const limits = sqliteTable(
  "request_limits",
  {
    owner_id: text("owner_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    bucket: text("bucket").notNull(),
    requests: integer("requests").notNull(),
  },
  (t) => [primaryKey({ columns: [t.owner_id, t.bucket] })],
);
export const administrators = sqliteTable("administrators", {
  id: integer("id").primaryKey(),
  subject: text("subject").notNull(),
});
