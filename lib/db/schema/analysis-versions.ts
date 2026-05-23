// lib/db/schema/analysis-versions.ts
// §2.3.6 analysis_versions(immutable)— 单次推理快照(append-only)— 核心表
import { pgTable, uuid, text, jsonb, integer, timestamp, pgEnum } from "drizzle-orm/pg-core";
import { proposals } from "./proposals";
import type {
  StructuredClaim,
  PersonaVote,
} from "@/lib/schema/persona-vote";
import type { AnchoringFlag } from "@/lib/schema/anchoring";
import type { PremortemRisk } from "@/lib/schema/premortem";
import type { DecisionReport } from "@/lib/schema/decision-report";
import type { ActionItem } from "@/lib/schema/action-item";
import type { ProviderEvent } from "@/lib/schema/provider-event";

export const analysisStatusEnum = pgEnum("analysis_status", [
  "running", // 推理进行中(SSE 流式)
  "paused_hitl", // HITL 暂停
  "completed", // 全部完成
  "failed", // 失败(LangGraph 重试用尽)
  "degraded_offline", // 全部 Provider 失败,只跑了 N1 离线规则
]);

export const analysis_versions = pgTable("analysis_versions", {
  id: uuid("id").primaryKey().defaultRandom(),
  proposal_id: uuid("proposal_id")
    .notNull()
    .references(() => proposals.id),
  version_label: text("version_label").notNull(), // "v1.0", "v1.1", "v1.3(回滚自 v1.1)"
  rollback_from_id: uuid("rollback_from_id"), // 若回滚,指向旧版
  status: analysisStatusEnum("status").notNull().default("running"),

  // === 推理参数(用于复现) ===
  temperature: integer("temperature").notNull(), // 30/40/50(×100,避免 float)
  seed: integer("seed").notNull(), // 42/84/126

  // === 9 节点输出快照(append-only,immutable) ===
  // N1 结构化 + 决策类型识别
  structured_claims: jsonb("structured_claims").$type<StructuredClaim[]>(),
  // N2 L1 目标对齐
  l1_alignment_score: integer("l1_alignment_score"), // 0-100
  l1_alignment_warnings: jsonb("l1_alignment_warnings").$type<string[]>(),
  // N3 L2 证据召回
  recalled_evidence_ids: jsonb("recalled_evidence_ids").$type<string[]>(),
  // N4 Round 0 + N5 Round 1
  round_0_votes: jsonb("round_0_votes").$type<PersonaVote[]>(),
  round_1_votes: jsonb("round_1_votes").$type<PersonaVote[]>(),
  anchoring_flags: jsonb("anchoring_flags").$type<AnchoringFlag[]>(),
  // N6 TWS 评分
  tws_scores_by_claim: jsonb("tws_scores_by_claim").$type<Record<string, number>>(),
  // N7 L4 权重(快照)
  effective_weights: jsonb("effective_weights").$type<Record<string, number>>(),
  // N8 Premortem
  premortem_risks: jsonb("premortem_risks").$type<PremortemRisk[]>(),
  // N9 决策报告
  decision_report: jsonb("decision_report").$type<DecisionReport>(),

  // === 用户可编辑衍生字段(immutable 豁免,v2.3 GAN-A B-A-5 修)===
  // 纯展示用,不影响推理结果,允许 UPDATE(P04 编辑顶部一句话)
  headline_disagreement: text("headline_disagreement"), // ≤ 50 字

  // === 用户局部覆盖(v2.3 GAN-A B-A-6 修)===
  // 仅 RACI 行动项可改不创新版本(协作字段,频繁改);其他改动走 §5.12.2/§5.12.3 新建版本路径
  // 读取 decision_report 时,如果 decision_report_overrides.action_items 非空,用它覆盖 decision_report.action_items
  decision_report_overrides: jsonb("decision_report_overrides").$type<{
    action_items?: ActionItem[]; // 用户编辑后的 RACI 行动项
  }>(),

  // N8 Premortem 等留作 methodology_ab_compare(v2.3 B-A-3)
  methodology_ab_compare: jsonb("methodology_ab_compare").$type<{
    with_methodology: { top3_disagreements_count: number; citations_count: number };
    without_methodology: { top3_disagreements_count: number; citations_count: number };
    generated_at: string;
  }>(), // null=未跑;由 §5.7.17 异步触发

  // === 性能 / 降级 metadata ===
  total_duration_ms: integer("total_duration_ms"),
  provider_used: jsonb("provider_used").$type<ProviderEvent[]>(), // 每节点用了哪个 Provider
  llm_call_count: integer("llm_call_count"),
  // === Hash(R8 审计) ===
  input_hash: text("input_hash").notNull(), // SHA-256 of redacted_text + objective
  output_hash: text("output_hash"), // SHA-256 of decision_report(完成后)

  schema_version: integer("schema_version").notNull().default(1),
  created_at: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  completed_at: timestamp("completed_at", { withTimezone: true }),
});
