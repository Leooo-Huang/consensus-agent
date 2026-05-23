// lib/schema/aar.ts
// §4.12 AAR Schema(P09)— After Action Review + 权重建议
import { z } from "zod";
import { RoleEnum } from "./role";

// v2.3 GAN-A H-A-3 修:防"无"/"N/A"/空格 等敷衍输入,每字段若填则 trim 后 ≥ 10 字
export const DecisionAarSchema = z
  .object({
    aar_expected: z.string().min(10).optional(),
    aar_actual: z.string().min(10).optional(),
    aar_gap_reason: z.string().min(10).optional(),
    aar_next_improvement: z.string().min(10).optional(),
  })
  .strict()
  .refine(
    (d) =>
      [d.aar_expected, d.aar_actual, d.aar_gap_reason, d.aar_next_improvement].filter(
        (s) => s && s.trim().length >= 10,
      ).length >= 2,
    { message: "AAR 4 字段至少 2 个非空,每个至少 10 字(防敷衍,F12 反方法论形式化)" },
  );

export const WeightSuggestionSchema = z
  .object({
    id: z.string(),
    role: RoleEnum,
    current_weight: z.number(),
    suggested_weight: z.number().min(0.5).max(2.0),
    reason: z.string().min(10),
  })
  .strict();

export type DecisionAar = z.infer<typeof DecisionAarSchema>;
export type WeightSuggestion = z.infer<typeof WeightSuggestionSchema>;
