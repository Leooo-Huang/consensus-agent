// lib/db/schema/audit-logs.ts
// §2.3.9 audit_logs(append-only,永不删)— 审计日志(SHA-256 hash)
import { pgTable, uuid, text, jsonb, timestamp, pgEnum } from "drizzle-orm/pg-core";

export const auditActionEnum = pgEnum("audit_action", [
  "proposal_create",
  "proposal_update",
  "proposal_soft_delete",
  "analysis_start",
  "analysis_complete",
  "analysis_failed",
  "hitl_pause",
  "hitl_approve",
  "hitl_edit",
  "hitl_reject",
  "rollback",
  "persona_edit",
  "persona_reset",
  "decision_create",
  "weight_override",
  "raci_override", // v2.3 B-A-6 新增
  "provider_degrade",
  "reproducibility_run",
  "evidence_search",
]);

export const audit_logs = pgTable("audit_logs", {
  id: uuid("id").primaryKey().defaultRandom(),
  actor: text("actor").notNull().default("anonymous"), // P0 单租户;V2 OAuth user_id
  action: auditActionEnum("action").notNull(),
  target_type: text("target_type").notNull(), // "proposal" / "persona" / ...
  target_id: uuid("target_id"), // 可空(如 evidence_search)
  input_hash: text("input_hash"), // SHA-256
  output_hash: text("output_hash"), // SHA-256
  metadata: jsonb("metadata"), // 操作详情,根据 action 不同
  user_agent: text("user_agent"),
  ip: text("ip"),
  created_at: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

// 索引(强约束查询效率)
// CREATE INDEX audit_logs_created_idx ON audit_logs (created_at DESC);
// CREATE INDEX audit_logs_target_idx ON audit_logs (target_type, target_id);
