// lib/schema/anchoring.ts
// §4.5 Anchoring Flag — 锚定效应检测标记
import { z } from "zod";

export const AnchoringFlagSchema = z
  .object({
    persona_id: z.string(),
    claim_id: z.string(),
    reason: z.enum([
      "stance_flip_no_reason", // 立场翻转 + 理由 < 30 字
      "high_cosine_similarity", // 措辞与某 R0 cosine > 0.85
    ]),
    evidence_persona_id: z.string().optional(), // 与哪个 R0 高相似度
    cosine_score: z.number().min(0).max(1).optional(),
  })
  .strict();

export type AnchoringFlag = z.infer<typeof AnchoringFlagSchema>;
