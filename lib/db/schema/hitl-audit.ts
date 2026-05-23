// lib/db/schema/hitl-audit.ts
// §2.3.8 hitl_audit — HITL 接管审计(业务层)
// v2.3 GAN-B B-B-4 修:表名 hitl_audit(非 langgraph_checkpoints)。
// LangGraph 4 张 checkpoint 表(checkpoints / checkpoint_blobs / checkpoint_writes /
// checkpoint_migrations)由 PostgresSaver 自管,不在 Drizzle 定义。
import { pgTable, uuid, text, jsonb, integer, timestamp } from "drizzle-orm/pg-core";
import { analysis_versions } from "./analysis-versions";

export const hitl_audit = pgTable("hitl_audit", {
  id: uuid("id").primaryKey().defaultRandom(),
  analysis_version_id: uuid("analysis_version_id")
    .notNull()
    .references(() => analysis_versions.id),
  thread_id: text("thread_id").notNull(), // LangGraph thread ID(=analysis_version_id 的 string 形式)
  node_id: text("node_id").notNull(), // 暂停时的节点(N1~N9)
  state_summary: text("state_summary"), // 暂停时点的人类可读摘要(用于 P07 列表)
  paused_at: timestamp("paused_at", { withTimezone: true }).notNull(),
  resumed_at: timestamp("resumed_at", { withTimezone: true }),
  resume_decision: text("resume_decision"), // "approve" / "edit" / "reject"
  resume_reason: text("resume_reason"), // ≥ 5 字必填(若已 resume)
  edited_state_keys: jsonb("edited_state_keys").$type<string[]>(),
  // edit 时改了哪些 state key(具体内容由 PostgresSaver 持久化)
  // 5 分钟自动批准时间戳(H-A-6),null=人工已 resume
  auto_approve_at: timestamp("auto_approve_at", { withTimezone: true }),
  schema_version: integer("schema_version").notNull().default(1),
  created_at: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});
