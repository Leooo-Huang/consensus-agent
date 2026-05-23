// lib/schema/decision-report.ts
// §4.9 DecisionReport(P12 完整 7 部分)
import { z } from "zod";
import { RoleEnum } from "./role";
import { CitationsArraySchema } from "./citation";
import { KeyDisagreementsArraySchema } from "./disagreement";
import { PremortemArraySchema } from "./premortem";
import { ActionItemSchema } from "./action-item";

export const DecisionConclusionEnum = z.enum([
  "approved",
  "deferred",
  "rejected",
  "need_more_data",
]);

export const AttitudeDistributionSchema = z
  .object({
    support: z.number().min(0).max(100), // 百分比
    conditional: z.number().min(0).max(100),
    insufficient: z.number().min(0).max(100),
    oppose: z.number().min(0).max(100),
  })
  .strict()
  .refine(
    (d) => Math.abs(d.support + d.conditional + d.insufficient + d.oppose - 100) < 0.01,
    { message: "4 档分布百分比必须等于 100" },
  );

export const EvidenceChainItemSchema = z
  .object({
    conclusion: z.string(),
    citations: CitationsArraySchema,
  })
  .strict();

export const DecisionReportSchema = z
  .object({
    // ① 结论
    conclusion: z
      .object({
        status: DecisionConclusionEnum,
        summary: z.string().min(10).max(50), // 一句话 ≤ 50 字(R11 压缩护栏)
        served_objective_id: z.string().uuid(), // L1 引用
        served_objective_name: z.string(),
      })
      .strict(),

    // ② 评分
    scoring: z
      .object({
        weighted_total: z.number().min(0).max(100), // 加权总分
        tws_score: z.number().min(-1).max(1), // TWS 原值
        attitude_distribution: AttitudeDistributionSchema,
        weights_used: z.record(RoleEnum, z.number().min(0.5).max(2.0)),
        formula_explanation: z.string(), // hover 显示公式
      })
      .strict(),

    // ③ 关键分歧 top 3
    key_disagreements: KeyDisagreementsArraySchema,

    // ④ 证据链
    evidence_chain: z.array(EvidenceChainItemSchema),

    // ⑤ 风险(Premortem)
    risks: PremortemArraySchema,

    // ⑥ 建议行动 RACI
    action_items: z.array(ActionItemSchema).min(1),

    // ⑦ 纪要
    minutes: z
      .object({
        markdown: z.string().min(200).max(500), // 200-500 字
        headline_disagreement: z.string().max(50), // 一句话核心分歧
        three_sentence_summary: z.array(z.string().max(30)).length(3),
      })
      .strict(),
  })
  .strict();

export type DecisionReport = z.infer<typeof DecisionReportSchema>;
export type AttitudeDistribution = z.infer<typeof AttitudeDistributionSchema>;
