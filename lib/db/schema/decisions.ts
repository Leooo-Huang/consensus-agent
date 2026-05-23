// lib/db/schema/decisions.ts
// §2.3.7 decisions(immutable)— 决议(AAR 模板,append-only)
import { pgTable, uuid, text, jsonb, integer, timestamp, pgEnum } from "drizzle-orm/pg-core";
import { proposals } from "./proposals";
import { analysis_versions } from "./analysis-versions";
import type { WeightSuggestion } from "@/lib/schema/aar";

export const decisionStatusEnum = pgEnum("decision_status", [
  "approved", // 通过
  "deferred", // 暂缓
  "rejected", // 驳回
  "need_more_data", // 需补数据
]);

export const decisions = pgTable("decisions", {
  id: uuid("id").primaryKey().defaultRandom(),
  proposal_id: uuid("proposal_id")
    .notNull()
    .references(() => proposals.id),
  analysis_version_id: uuid("analysis_version_id")
    .notNull()
    .references(() => analysis_versions.id),
  prev_decision_id: uuid("prev_decision_id"), // 链式决议
  status: decisionStatusEnum("status").notNull(),
  summary: text("summary").notNull(), // 1-2 句决议摘要
  key_changes: jsonb("key_changes").$type<string[]>().notNull(), // ["原 X → 现 Y"]
  attendees: jsonb("attendees").$type<string[]>().notNull(),
  meeting_date: timestamp("meeting_date", { withTimezone: true }).notNull(),
  affected_persona_ids: jsonb("affected_persona_ids").$type<string[]>().notNull(),

  // === AAR 模板(v2,4 字段,至少 2 非空) ===
  aar_expected: text("aar_expected"), // 预期发生什么
  aar_actual: text("aar_actual"), // 实际发生什么
  aar_gap_reason: text("aar_gap_reason"), // 差距原因
  aar_next_improvement: text("aar_next_improvement"), // 下次怎么改

  // === 权重调整建议(AI 生成,用户决定是否采纳) ===
  weight_suggestions: jsonb("weight_suggestions").$type<WeightSuggestion[]>(),
  weight_suggestions_accepted: jsonb("weight_suggestions_accepted").$type<string[]>(),
  // 已采纳的建议 ID
  schema_version: integer("schema_version").notNull().default(1),
  created_at: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});
