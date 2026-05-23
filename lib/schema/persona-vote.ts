// lib/schema/persona-vote.ts
// §4.4 PersonaVote / Claim / Round 输出
import { z } from "zod";
import { AttitudeEnum } from "./attitude";
import { RoleEnum } from "./role";
import { CitationsArraySchema } from "./citation";

export const StructuredClaimSchema = z
  .object({
    id: z.string(), // "claim_1" ...
    text: z.string().min(5), // 论点原文
    assumption: z.string().optional(), // 提案中的假设
    data_gap: z.string().optional(), // 缺失的数据(若有)
  })
  .strict();

export const PersonaClaimSchema = z
  .object({
    claim_id: z.string(), // 引用 structured_claims
    attitude: AttitudeEnum,
    confidence: z.number().min(0).max(1),
    reason: z.string().min(20), // 理由 ≥ 20 字(防敷衍)
    citations: CitationsArraySchema, // ≥ 1 条
    adjust_reason: z.string().optional(), // Round 1 才有,理由 < 30 字 → anchoring 嫌疑
  })
  .strict();

export const PersonaVoteSchema = z
  .object({
    persona_id: z.string(),
    role: RoleEnum,
    weight: z.number().min(0.5).max(2.0), // L4 实际权重
    claims: z.array(PersonaClaimSchema).min(1),
    round: z.enum(["round_0", "round_1"]),
    duration_ms: z.number().int().min(0),
  })
  .strict();

export type StructuredClaim = z.infer<typeof StructuredClaimSchema>;
export type PersonaClaim = z.infer<typeof PersonaClaimSchema>;
export type PersonaVote = z.infer<typeof PersonaVoteSchema>;
