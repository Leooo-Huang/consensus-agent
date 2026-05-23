// lib/db/schema/reproducibility-runs.ts
// §2.3.10 reproducibility_runs — 稳定性测试结果
import { pgTable, uuid, jsonb, integer, timestamp, pgEnum } from "drizzle-orm/pg-core";
import { proposals } from "./proposals";

export const reproVerdictEnum = pgEnum("repro_verdict", ["stable", "partial", "unstable"]);

export const reproducibility_runs = pgTable("reproducibility_runs", {
  id: uuid("id").primaryKey().defaultRandom(),
  proposal_id: uuid("proposal_id")
    .notNull()
    .references(() => proposals.id),
  run_count: integer("run_count").notNull().default(3),
  // 引用本次复现产生的 3 个 analysis_version(独立保存,不污染原版,无 FK,应用层保证)
  analysis_version_ids: jsonb("analysis_version_ids").$type<string[]>().notNull(),
  temperatures: jsonb("temperatures").$type<number[]>().notNull(), // [0.3, 0.4, 0.5]
  seeds: jsonb("seeds").$type<number[]>().notNull(), // [42, 84, 126]

  // === 一致性指标(3 个) ===
  conclusion_consistency_pct: integer("conclusion_consistency_pct").notNull(), // 0-100
  top3_jaccard: integer("top3_jaccard").notNull(), // 0-100(×100 整数)
  evidence_overlap_pct: integer("evidence_overlap_pct").notNull(), // 0-100

  verdict: reproVerdictEnum("verdict").notNull(),

  total_duration_ms: integer("total_duration_ms").notNull(),
  schema_version: integer("schema_version").notNull().default(1),
  created_at: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});
