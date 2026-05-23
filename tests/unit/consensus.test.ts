import { describe, it, expect } from "vitest";

import {
  tws,
  twsConsensusLabel,
  type PersonaVoteForTws,
} from "@/lib/consensus/trajectory-weighted-scoring";
import {
  detectAnchoring,
  cosineSimilarity,
  type AnchoringR1Input,
  type AnchoringR0SnapshotItem,
} from "@/lib/consensus/anchoring-detector";
import {
  calculateWeights,
  WeightOverrideRangeError,
} from "@/lib/consensus/weight-calculator";

// ---- fixtures ----
const vote = (
  attitude: PersonaVoteForTws["attitude"],
  weight = 1,
  personaId = "p",
): PersonaVoteForTws => ({ personaId, weight, attitude });

const allSupport: PersonaVoteForTws[] = [
  vote("support", 1, "operations"),
  vote("support", 1, "finance"),
  vote("support", 1, "marketing"),
];
const allOppose: PersonaVoteForTws[] = [
  vote("oppose", 1, "operations"),
  vote("oppose", 1, "finance"),
];

describe("TWS — 轨迹加权评分(w0=0.6 / w1=0.4)", () => {
  it("[#1] 全 support(R0+R1)→ 1.0(满分)", () => {
    expect(tws(allSupport, allSupport)).toBeCloseTo(1.0, 10);
  });

  it("[#2] 全 oppose(R0+R1)→ -1.0", () => {
    expect(tws(allOppose, allOppose)).toBeCloseTo(-1.0, 10);
  });

  it("[#3] R0 全 support / R1 全 oppose → 0.6*1 + 0.4*(-1) = 0.2(验证衰减系数)", () => {
    expect(tws(allSupport, allOppose)).toBeCloseTo(0.2, 10);
  });

  it("[#4] 空数组(sumWeight=0)不崩,返回 0", () => {
    expect(tws([], [])).toBe(0);
  });

  it("[#3b] 加权均值按 weight 加权:不同权重 support → 仍为 1.0(同向)", () => {
    const mixedWeights: PersonaVoteForTws[] = [
      vote("support", 1.3, "products"),
      vote("support", 1.6, "finance"),
    ];
    expect(tws(mixedWeights, mixedWeights)).toBeCloseTo(1.0, 10);
  });

  it("[#5] twsConsensusLabel:0.6 → strong_support / 0 → no_consensus", () => {
    expect(twsConsensusLabel(0.6)).toBe("strong_support");
    expect(twsConsensusLabel(0)).toBe("no_consensus");
  });

  it("[#5b] twsConsensusLabel 5 档 + 边界归属", () => {
    expect(twsConsensusLabel(0.51)).toBe("strong_support");
    expect(twsConsensusLabel(0.5)).toBe("weak_support"); // 恰好 +0.5 归弱支持
    expect(twsConsensusLabel(0.3)).toBe("weak_support");
    expect(twsConsensusLabel(0.1)).toBe("no_consensus"); // 恰好 +0.1 归中性带
    expect(twsConsensusLabel(-0.1)).toBe("no_consensus"); // 恰好 -0.1 归中性带
    expect(twsConsensusLabel(-0.3)).toBe("weak_oppose");
    expect(twsConsensusLabel(-0.5)).toBe("weak_oppose"); // 恰好 -0.5 归弱反对
    expect(twsConsensusLabel(-0.51)).toBe("strong_oppose");
  });
});

describe("Anchoring 检测", () => {
  const r0Snapshot: AnchoringR0SnapshotItem[] = [
    { personaId: "finance", embedding: [1, 0, 0] },
    { personaId: "brand", embedding: [0, 1, 0] },
  ];

  it("[#6] 立场翻转 + 理由 <30 字 → flag(stance_flip_no_reason)", () => {
    const r1: AnchoringR1Input = {
      personaId: "marketing",
      claimId: "claim_1",
      attitude: "support",
      r0Attitude: "oppose",
      adjustReason: "看了别人的就改了", // < 30 字
    };
    const flag = detectAnchoring(r1, r0Snapshot);
    expect(flag).not.toBeNull();
    expect(flag?.reason).toBe("stance_flip_no_reason");
    expect(flag?.persona_id).toBe("marketing");
  });

  it("[#7] 立场翻转 + 理由 ≥30 字 → null(有合理理由不算 anchoring)", () => {
    const longReason =
      "财务在 R0 补充了完整的现金流测算与库存周转数据,这些是我 R0 时未掌握的关键信息,因此我基于新证据合理调整立场。";
    expect(longReason.length).toBeGreaterThanOrEqual(30);
    const r1: AnchoringR1Input = {
      personaId: "marketing",
      claimId: "claim_1",
      attitude: "support",
      r0Attitude: "oppose",
      adjustReason: longReason,
    };
    expect(detectAnchoring(r1, r0Snapshot)).toBeNull();
  });

  it("[#8] cosine > 0.85 → flag(high_cosine_similarity)", () => {
    const r1: AnchoringR1Input = {
      personaId: "operations",
      claimId: "claim_1",
      attitude: "support",
      r0Attitude: "support", // 立场未翻转,只测 cosine 路径
      adjustReason:
        "我的措辞与财务高度相似但这里给出足够长的理由以排除 stance_flip 干扰因素",
      embedding: [0.99, 0.01, 0], // 与 finance 的 [1,0,0] cosine ≈ 0.9999 > 0.85
    };
    const flag = detectAnchoring(r1, r0Snapshot);
    expect(flag).not.toBeNull();
    expect(flag?.reason).toBe("high_cosine_similarity");
    expect(flag?.evidence_persona_id).toBe("finance");
    expect(flag?.cosine_score ?? 0).toBeGreaterThan(0.85);
  });

  it("[#13] cosineSimilarity:同向=1 / 正交=0", () => {
    expect(cosineSimilarity([1, 0, 0], [1, 0, 0])).toBeCloseTo(1, 10);
    expect(cosineSimilarity([1, 0], [0, 1])).toBeCloseTo(0, 10);
  });

  it("[#13b] cosineSimilarity:长度不一致 / 零向量 → 0(保守不触发)", () => {
    expect(cosineSimilarity([1, 0, 0], [1, 0])).toBe(0);
    expect(cosineSimilarity([0, 0, 0], [1, 0, 0])).toBe(0);
    expect(cosineSimilarity([], [])).toBe(0);
  });
});

describe("L4 动态权重 calculateWeights", () => {
  it("[#9] selection 返回 7 角色,商品=1.3 财务=1.2(对照 DEFAULT_WEIGHTS)", () => {
    const w = calculateWeights("selection");
    expect(Object.keys(w)).toHaveLength(7);
    expect(w.products).toBe(1.3);
    expect(w.finance).toBe(1.2);
    expect(w.supply_chain).toBe(1.3);
  });

  it("[#10] cross_border 区域=1.5", () => {
    expect(calculateWeights("cross_border").regional).toBe(1.5);
  });

  it("[#11] override finance=1.5 → 财务被覆盖,其余保留默认", () => {
    const w = calculateWeights("selection", { finance: 1.5 });
    expect(w.finance).toBe(1.5);
    expect(w.products).toBe(1.3); // 未覆盖,保留默认
  });

  it("[#12] override finance=3.0 → 抛错(超 2.0 上限)", () => {
    expect(() => calculateWeights("selection", { finance: 3.0 })).toThrow(
      WeightOverrideRangeError,
    );
  });

  it("[#12b] override finance=0.2 → 抛错(低于 0.5 下限);边界 0.5 / 2.0 合法", () => {
    expect(() => calculateWeights("selection", { finance: 0.2 })).toThrow(
      WeightOverrideRangeError,
    );
    expect(calculateWeights("selection", { finance: 0.5 }).finance).toBe(0.5);
    expect(calculateWeights("selection", { finance: 2.0 }).finance).toBe(2.0);
  });

  it("[#9b] 返回新对象,不污染 DEFAULT_WEIGHTS", () => {
    const w = calculateWeights("budget", { finance: 1.0 });
    expect(w.finance).toBe(1.0);
    // 再取一次默认应仍是 1.6(未被上面的 override 污染)
    expect(calculateWeights("budget").finance).toBe(1.6);
  });
});
