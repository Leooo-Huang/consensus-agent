// lib/consensus/trajectory-weighted-scoring.ts
// 对策 2:轨迹加权评分(Trajectory-Weighted Scoring,TWS,自研)
// 权威算法源:docs/design/03-tech-direction/consensus-algorithm.md §对策 2
//
// 公式:
//   tws = w0 * weightedAvg(round0) + w1 * weightedAvg(round1)
//   weightedAvg(votes) = Σ_p ( weight_p * ATTITUDE_SCORE[a_p] ) / Σ_p weight_p
//   w0 = 0.6, w1 = 0.4(R0 未被他人观点污染,按 Asch 一致性实验该权重更高;归一化 w0+w1=1)
//   输出值域 ∈ [-1.0, +1.0]
//
// 纯函数,不调 LLM / DB(P3.1 完全离线可测)。复用 P2.1 的 ATTITUDE_SCORE,不重新定义。
import { ATTITUDE_SCORE, type Attitude } from "@/lib/schema/attitude";

export interface PersonaVoteForTws {
  personaId: string;
  weight: number; // L4 权重
  attitude: Attitude;
}

/**
 * 单论点 trajectory_score。
 *
 * w0=0.6 / w1=0.4 为算法锁定常量(consensus-algorithm.md §衰减系数),禁止改成 0.5/0.5。
 * sumWeight=0(空数组或全 0 权重)时该轮加权均值返回 0,函数不崩。
 */
export function tws(round0: PersonaVoteForTws[], round1: PersonaVoteForTws[]): number {
  const w0 = 0.6;
  const w1 = 0.4;

  const weightedAvg = (votes: PersonaVoteForTws[]): number => {
    const sumWeight = votes.reduce((s, v) => s + v.weight, 0);
    if (sumWeight === 0) return 0;
    return (
      votes.reduce((s, v) => s + v.weight * ATTITUDE_SCORE[v.attitude], 0) / sumWeight
    );
  };

  return w0 * weightedAvg(round0) + w1 * weightedAvg(round1);
}

export type TwsConsensusLabel =
  | "strong_support"
  | "weak_support"
  | "no_consensus"
  | "weak_oppose"
  | "strong_oppose";

/**
 * 把 tws 分值映射到 5 档共识强度(consensus-algorithm.md §算法 完整版本)。
 *
 *   > +0.5        → strong_support(强共识支持)
 *   +0.1 ~ +0.5   → weak_support(弱共识支持)
 *   -0.1 ~ +0.1   → no_consensus(无共识)
 *   -0.5 ~ -0.1   → weak_oppose(弱共识反对)
 *   < -0.5        → strong_oppose(强共识反对)
 *
 * 边界归属(文档区间相邻,显式拍板,避免落空):
 *   - 恰好 +0.5 归 weak_support(strong 要求严格 > +0.5)
 *   - 恰好 +0.1 / -0.1 归 no_consensus(弱共识区间为开区间端点,中性带含边界)
 *   - 恰好 -0.5 归 weak_oppose(strong_oppose 要求严格 < -0.5)
 */
export function twsConsensusLabel(score: number): TwsConsensusLabel {
  if (score > 0.5) return "strong_support";
  if (score > 0.1) return "weak_support";
  if (score >= -0.1) return "no_consensus";
  if (score >= -0.5) return "weak_oppose";
  return "strong_oppose";
}
