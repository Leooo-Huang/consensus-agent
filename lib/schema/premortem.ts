// lib/schema/premortem.ts
// §4.7 PremortemRisk(P12 § ⑤)— 事前验尸,输出 ≥ 3 条(P0 必做强制)
import { z } from "zod";
import { RoleEnum } from "./role";

export const PremortemRiskSchema = z
  .object({
    risk: z.string().min(15),
    raised_by: z.array(RoleEnum).min(1),
    severity: z.enum(["high", "medium", "low"]),
    scenario: z.string().min(20), // 具体场景描述
    mitigations: z.array(z.string()).default([]),
  })
  .strict();

// Premortem 输出 ≥ 3 条(P0 必做强制)
export const PremortemArraySchema = z.array(PremortemRiskSchema).min(3);

export type PremortemRisk = z.infer<typeof PremortemRiskSchema>;
