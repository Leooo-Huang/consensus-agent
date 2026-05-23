import { describe, it, expect } from "vitest";

import {
  StateAnnotation,
  type GraphState,
  type PersonaConfig,
  type Round0Input,
  type Round1Input,
  type PremortemInput,
} from "@/lib/graph/state";
import type { PersonaVote } from "@/lib/schema/persona-vote";
import type { Role } from "@/lib/schema/role";

// LangGraph 0.4:Annotation<T>(...) 返回 channel **实例**(BinaryOperatorAggregate / LastValue),
// 直接挂在 StateAnnotation.spec[key] 上(非 factory)。channel 是共享单例,
// 因此每个会写入的测试都用 fromCheckpoint(undefined) 取一个全新 channel(value 重置为 default),
// 避免跨测试污染。
type MutableChannel<T> = {
  update: (values: T[]) => boolean;
  get: () => T;
  fromCheckpoint: (checkpoint?: T) => MutableChannel<T>;
  isAvailable: () => boolean;
};

function freshChannel<T>(key: keyof typeof StateAnnotation.spec): MutableChannel<T> {
  const shared = StateAnnotation.spec[key] as unknown as MutableChannel<T>;
  // fromCheckpoint(undefined) 复制 operator + initialValueFactory,value 由 factory 重置。
  return shared.fromCheckpoint(undefined);
}

// ---- fixtures ----

const makeVote = (personaId: string, role: Role): PersonaVote => ({
  persona_id: personaId,
  role,
  weight: 1.0,
  round: "round_0",
  duration_ms: 1200,
  claims: [
    {
      claim_id: "claim_1",
      attitude: "support",
      confidence: 0.8,
      reason: "理由至少二十个字符以满足下限约束的占位文本内容",
      citations: [
        {
          source_type: "proposal_text",
          source_id: "src-1",
          snippet: "这是一条满足十字最低长度的引用片段",
          relevance: 0.8,
        },
      ],
    },
  ],
});

describe("P4.0 GraphState — StateAnnotation 可实例化", () => {
  it("[#1] Annotation.Root spec 不抛错且含全部 15 个 channel", () => {
    expect(StateAnnotation).toBeDefined();
    expect(StateAnnotation.spec).toBeDefined();
    const keys = Object.keys(StateAnnotation.spec);
    expect(keys).toEqual(
      expect.arrayContaining([
        "redactedProposal",
        "declaredObjectiveId",
        "personas",
        "decisionType",
        "structuredClaims",
        "l1AlignmentScore",
        "recalledEvidenceIds",
        "round0Votes",
        "round1Votes",
        "anchoringFlags",
        "twsScoresByClaim",
        "effectiveWeights",
        "premortemRisks",
        "decisionReport",
        "providerEvents",
      ]),
    );
    expect(keys).toHaveLength(15);
  });
});

describe("P4.0 GraphState — 并发字段 concat reducer", () => {
  it("[#2] round0Votes reducer 合并:[voteA] + [voteB] → 长度 2(concat 而非覆盖)", () => {
    const voteA = makeVote("per_finance", "finance");
    const voteB = makeVote("per_marketing", "marketing");
    const channel = freshChannel<PersonaVote[]>("round0Votes");
    // BinaryOperatorAggregate.update 接收一组 update 值,初始 value=[](default),
    // 逐个折叠:[] + [voteA] = [voteA];[voteA] + [voteB] = [voteA, voteB]。
    // 模拟 N4 两个 Send 分支各写入 1 条票。
    channel.update([[voteA], [voteB]]);
    const merged = channel.get();
    expect(merged).toHaveLength(2);
    expect(merged.map((v) => v.persona_id)).toEqual(["per_finance", "per_marketing"]);
  });

  it("[#3] round0Votes default 是空数组 []", () => {
    const channel = freshChannel<PersonaVote[]>("round0Votes");
    expect(channel.isAvailable()).toBe(true); // default 已注入 → 非空 channel
    expect(channel.get()).toEqual([]);
  });

  it("[#3b] 其余并发字段(round1/anchoring/premortem/provider)default 均为 []", () => {
    for (const key of ["round1Votes", "anchoringFlags", "premortemRisks", "providerEvents"] as const) {
      const channel = freshChannel<unknown[]>(key);
      expect(channel.get()).toEqual([]);
    }
  });
});

describe("P4.0 GraphState — 单写字段 last-write-wins", () => {
  it("[#4] decisionType 是 LastValue:第二次写覆盖第一次(非合并)", () => {
    const channel = freshChannel<string>("decisionType");
    channel.update(["selection"]);
    expect(channel.get()).toBe("selection");
    channel.update(["marketing"]);
    expect(channel.get()).toBe("marketing"); // 覆盖
  });

  it("[#4b] structuredClaims 单写字段:第二次写整体替换第一次", () => {
    const channel = freshChannel<Array<{ id: string }>>("structuredClaims");
    channel.update([[{ id: "claim_1" }]]);
    expect(channel.get()).toEqual([{ id: "claim_1" }]);
    channel.update([[{ id: "claim_2" }]]);
    expect(channel.get()).toEqual([{ id: "claim_2" }]); // 替换,非 concat
  });
});

describe("P4.0 GraphState — 类型层面含全部 9 节点字段", () => {
  it("[#5] 一个赋值全部字段的 GraphState 对象能编译并通过断言", () => {
    const persona = {} as PersonaConfig; // 仅类型层面验证字段存在
    const vote = makeVote("per_ops", "operations");
    const weights = { operations: 1.2 } as Record<Role, number>;

    const state: GraphState = {
      redactedProposal: "脱敏后的提案文本",
      declaredObjectiveId: "obj-uuid",
      personas: [persona],
      decisionType: "selection",
      structuredClaims: [{ id: "claim_1", text: "论点原文占位" }],
      l1AlignmentScore: 80,
      recalledEvidenceIds: ["ev-1", "ev-2"],
      round0Votes: [vote],
      round1Votes: [{ ...vote, round: "round_1" }],
      anchoringFlags: [
        { persona_id: "per_ops", claim_id: "claim_1", reason: "stance_flip_no_reason" },
      ],
      twsScoresByClaim: { claim_1: 0.5 },
      effectiveWeights: weights,
      premortemRisks: [
        {
          risk: "风险描述至少十五个字符的占位文本",
          raised_by: ["finance"],
          severity: "high",
          scenario: "具体场景描述至少二十个字符以满足下限约束的占位文本",
          mitigations: [],
        },
      ],
      decisionReport: null,
      providerEvents: [],
    };

    expect(Object.keys(state)).toEqual(
      expect.arrayContaining([
        "redactedProposal",
        "declaredObjectiveId",
        "personas",
        "decisionType",
        "structuredClaims",
        "l1AlignmentScore",
        "recalledEvidenceIds",
        "round0Votes",
        "round1Votes",
        "anchoringFlags",
        "twsScoresByClaim",
        "effectiveWeights",
        "premortemRisks",
        "decisionReport",
        "providerEvents",
      ]),
    );
    expect(state.round0Votes).toHaveLength(1);
    expect(state.decisionReport).toBeNull();
  });
});

describe("P4.0 GraphState — Send fan-out 输入类型", () => {
  it("[#6] Round0Input / Round1Input / PremortemInput 类型可构造", () => {
    const persona = {} as PersonaConfig;
    const r0: Round0Input = {
      persona,
      redactedProposal: "脱敏提案",
      declaredObjectiveId: "obj-1",
      recalledEvidenceIds: ["ev-1"],
    };
    const vote = makeVote("per_ops", "operations");
    const r1: Round1Input = {
      ...r0,
      othersRound0Snapshot: [vote],
      myR0Attitude: vote,
    };
    const pm: PremortemInput = {
      persona,
      preliminaryConclusion: "初步结论占位",
    };
    expect(r0.recalledEvidenceIds).toHaveLength(1);
    expect(r1.othersRound0Snapshot).toHaveLength(1);
    expect(pm.preliminaryConclusion).toBe("初步结论占位");
  });
});
