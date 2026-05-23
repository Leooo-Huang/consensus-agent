// lib/schema/disagreement.ts
// §4.6 DisagreementResolution(P12 § 关键分歧强约束)
import { z } from "zod";
import { RoleEnum } from "./role";

export const DisagreementResolutionSchema = z
  .object({
    shared_interest: z.string().min(10), // ≥ 10 字
    objective_criterion: z.string().min(10), // ≥ 10 字
    next_step: z.string().min(5), // ≥ 5 字
  })
  .strict();

export const KeyDisagreementSchema = z
  .object({
    claim_id: z.string(),
    claim_text: z.string(),
    supporting_roles: z.array(RoleEnum),
    opposing_roles: z.array(RoleEnum),
    why_diverge: z.string().min(20),
    resolution: DisagreementResolutionSchema,
  })
  .strict();

// Plan GAN 已统一上限为 3:P12 UI 仅展示 top 3 关键分歧。
// 注:api.md §4.6 代码块仍写 .max(5),但其行内注释为「最多 top 3(P12 § ③)」,
// 且 rules.md / plan GAN 修复以 3 为准 —— 此处取 max(3) 与 UI 契约对齐。
export const KeyDisagreementsArraySchema = z.array(KeyDisagreementSchema).max(3);

export type DisagreementResolution = z.infer<typeof DisagreementResolutionSchema>;
export type KeyDisagreement = z.infer<typeof KeyDisagreementSchema>;
