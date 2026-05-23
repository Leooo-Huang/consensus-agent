// lib/db/schema/provider-events.ts
// §2.3.11 provider_events — LLM 降级事件流(P07 面板 1)
import { pgTable, uuid, text, timestamp, pgEnum } from "drizzle-orm/pg-core";
import { analysis_versions } from "./analysis-versions";

export const providerEnum = pgEnum("provider", [
  "opus-4-7",
  "sonnet-4-6",
  "haiku-4-5",
  "offline-rules",
]);

export const degradeReasonEnum = pgEnum("degrade_reason", [
  "timeout",
  "rate_limit", // 429
  "server_error", // 5xx
  "quota_exhausted",
  "manual", // Demo 演示用
  "all_failed", // 切到离线规则
]);

export const provider_events = pgTable("provider_events", {
  id: uuid("id").primaryKey().defaultRandom(),
  analysis_version_id: uuid("analysis_version_id").references(() => analysis_versions.id),
  // 可空(全局事件)
  from_provider: providerEnum("from_provider").notNull(),
  to_provider: providerEnum("to_provider").notNull(),
  reason: degradeReasonEnum("reason").notNull(),
  node_id: text("node_id"), // N1~N9(可空)
  error_message: text("error_message"),
  recovered_at: timestamp("recovered_at", { withTimezone: true }), // null=未恢复
  created_at: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});
