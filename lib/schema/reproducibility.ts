// lib/schema/reproducibility.ts
// §4.11 ReproducibilityMetrics(P07 面板 7)— 3 次并行稳定性测试指标
import { z } from "zod";

export const ReproducibilityMetricsSchema = z
  .object({
    run_count: z.literal(3),
    analysis_version_ids: z.array(z.string().uuid()).length(3),
    temperatures: z.array(z.number()).length(3),
    seeds: z.array(z.number().int()).length(3),

    conclusion_consistency_pct: z.number().min(0).max(100),
    top3_jaccard: z.number().min(0).max(100),
    evidence_overlap_pct: z.number().min(0).max(100),

    verdict: z.enum(["stable", "partial", "unstable"]),
    total_duration_ms: z.number().int().min(0),
  })
  .strict();

export type ReproducibilityMetrics = z.infer<typeof ReproducibilityMetricsSchema>;
