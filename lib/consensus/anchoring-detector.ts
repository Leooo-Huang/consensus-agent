// lib/consensus/anchoring-detector.ts
// 对策 1:Anchoring(锚定效应)检测
// 权威算法源:docs/design/03-tech-direction/consensus-algorithm.md §对策 1
//
// 两类锚定信号(命中任一即 flag):
//   1. stance_flip_no_reason  — 立场翻转(R1 attitude !== R0 attitude)且调整理由 < 30 字
//   2. high_cosine_similarity — Round 1 措辞 embedding 与某个 R0 观点 cosine > 0.85
//
// 纯函数,不调 LLM / DB(cosine 用本文件自带 helper)。复用 P2.1 的 AnchoringFlag 类型。
import type { Attitude } from "@/lib/schema/attitude";
import type { AnchoringFlag } from "@/lib/schema/anchoring";

const STANCE_FLIP_REASON_MIN_CHARS = 30; // 调整理由 < 30 字 → 视为无合理理由
const COSINE_SIMILARITY_THRESHOLD = 0.85; // 措辞 cosine > 0.85 → 视为过度借用

/**
 * 余弦相似度(纯函数 helper)。
 *
 * cos(a, b) = (a · b) / (|a| * |b|)
 * 长度不一致或任一向量为零向量(模为 0)时返回 0(无法定义相似度,保守不触发 anchoring)。
 */
export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length || a.length === 0) return 0;

  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    const ai = a[i] ?? 0; // noUncheckedIndexedAccess: 数组访问可能为 undefined
    const bi = b[i] ?? 0;
    dot += ai * bi;
    normA += ai * ai;
    normB += bi * bi;
  }

  if (normA === 0 || normB === 0) return 0;
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

export interface AnchoringR1Input {
  personaId: string;
  claimId: string;
  attitude: Attitude; // Round 1 立场
  r0Attitude: Attitude; // Round 0 立场
  adjustReason: string; // Round 1 调整理由
  embedding?: number[]; // Round 1 措辞向量(可选)
}

export interface AnchoringR0SnapshotItem {
  personaId: string;
  embedding?: number[]; // Round 0 措辞向量(可选)
}

/**
 * 检测单个 Round 1 观点是否存在 anchoring 嫌疑。
 *
 * 优先返回 stance_flip_no_reason(立场翻转 + 无合理理由),否则检查 cosine 借用。
 * 都不命中返回 null。
 *
 * 注意:立场翻转但理由 ≥ 30 字 → 视为基于他人证据的合理调整,不算 anchoring(不返回 flip flag)。
 *       但即便理由充分,若措辞与某 R0 cosine > 0.85 仍触发 high_cosine_similarity。
 */
export function detectAnchoring(
  r1: AnchoringR1Input,
  r0Snapshot: AnchoringR0SnapshotItem[],
): AnchoringFlag | null {
  // 信号 1:立场翻转 + 调整理由 < 30 字
  const stanceFlipped = r1.attitude !== r1.r0Attitude;
  if (stanceFlipped && r1.adjustReason.length < STANCE_FLIP_REASON_MIN_CHARS) {
    return {
      persona_id: r1.personaId,
      claim_id: r1.claimId,
      reason: "stance_flip_no_reason",
    };
  }

  // 信号 2:措辞 cosine 与某 R0 > 0.85
  if (r1.embedding && r1.embedding.length > 0) {
    for (const r0 of r0Snapshot) {
      if (!r0.embedding || r0.embedding.length === 0) continue;
      const score = cosineSimilarity(r1.embedding, r0.embedding);
      if (score > COSINE_SIMILARITY_THRESHOLD) {
        return {
          persona_id: r1.personaId,
          claim_id: r1.claimId,
          reason: "high_cosine_similarity",
          evidence_persona_id: r0.personaId,
          cosine_score: score,
        };
      }
    }
  }

  return null;
}
