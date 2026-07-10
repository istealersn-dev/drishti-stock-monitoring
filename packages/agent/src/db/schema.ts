import { integer, primaryKey, real, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const stockConfig = sqliteTable("stock_config", {
  symbol: text("symbol").primaryKey(),
  slThreshold: real("sl_threshold").notNull(),
  targetOne: real("target_one"),
  targetTwo: real("target_two"),
  targetTwoOpen: integer("target_two_open", { mode: "boolean" }).default(false),
  entryLow: real("entry_low"),
  entryHigh: real("entry_high"),
  buyPrice: real("buy_price"),
  isActive: integer("is_active", { mode: "boolean" }).default(true),
  updatedAt: text("updated_at").notNull(),
});

export const pendingApprovals = sqliteTable("pending_approvals", {
  id: text("id").primaryKey(),
  symbol: text("symbol").notNull(),
  parsedJson: text("parsed_json").notNull(),
  suggestedQty: integer("suggested_qty").notNull(),
  overrideQty: integer("override_qty"),
  actionDisagreement: text("action_disagreement"),
  availableMargin: real("available_margin"),
  status: text("status").notNull(),
  slackTs: text("slack_ts"),
  createdAt: text("created_at").notNull(),
  resolvedAt: text("resolved_at"),
});

export const gttOrders = sqliteTable("gtt_orders", {
  id: text("id").primaryKey(),
  symbol: text("symbol").notNull(),
  type: text("type").notNull(),
  triggerPrice: real("trigger_price").notNull(),
  limitPrice: real("limit_price").notNull(),
  quantity: integer("quantity").notNull(),
  status: text("status").notNull(),
  approvalId: text("approval_id"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

export const agentLogs = sqliteTable("agent_logs", {
  id: integer("id", { mode: "number" }).primaryKey({ autoIncrement: true }),
  runId: text("run_id").notNull(),
  symbol: text("symbol"),
  action: text("action").notNull(),
  reasoning: text("reasoning"),
  dryRun: integer("dry_run", { mode: "boolean" }).notNull(),
  error: text("error"),
  createdAt: text("created_at").notNull(),
});

export const agentRuns = sqliteTable("agent_runs", {
  id: text("id").primaryKey(),
  startedAt: text("started_at").notNull(),
  completedAt: text("completed_at"),
  status: text("status").notNull(),
  summary: text("summary"),
});

export const agentSettings = sqliteTable("agent_settings", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
  updatedAt: text("updated_at").notNull(),
});

export const technicalLevels = sqliteTable(
  "technical_levels",
  {
    symbol: text("symbol").notNull(),
    date: text("date").notNull(),
    dma50: real("dma50"),
    dma200: real("dma200"),
    weekHigh52: real("week_high_52"),
    weekLow52: real("week_low_52"),
    swingHigh: real("swing_high"),
    swingLow: real("swing_low"),
    avgVolume20: real("avg_volume_20"),
    updatedAt: text("updated_at").notNull(),
  },
  (t) => ({ pk: primaryKey({ columns: [t.symbol, t.date] }) }),
);

export const webSearchCache = sqliteTable(
  "web_search_cache",
  {
    symbol: text("symbol").notNull(),
    date: text("date").notNull(),
    content: text("content").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  (t) => ({ pk: primaryKey({ columns: [t.symbol, t.date] }) }),
);

export const watchlist = sqliteTable("watchlist", {
  symbol: text("symbol").primaryKey(),
  displayName: text("display_name").notNull(),
  notes: text("notes"),
  addedAt: text("added_at").notNull(),
});

export const advisoryConversations = sqliteTable("advisory_conversations", {
  id: text("id").primaryKey(),
  sessionId: text("session_id").notNull(),
  role: text("role").notNull(),
  content: text("content").notNull(),
  channel: text("channel").notNull(),
  createdAt: text("created_at").notNull(),
});

export const slackSessions = sqliteTable("slack_sessions", {
  threadTs: text("thread_ts").primaryKey(),
  channel: text("channel").notNull(),
  sessionId: text("session_id").notNull(),
  lastActiveAt: text("last_active_at").notNull(),
});
