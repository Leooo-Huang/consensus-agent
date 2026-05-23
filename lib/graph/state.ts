// lib/graph/state.ts
// P4.0 — LangGraph GraphState(贯穿 9 节点 N1-N9)
// 设计依据:
//   - docs/plans/2026-05-23-collab-agent-api.md §7(9 节点 ↔ av JSONB 字段映射)
//   - docs/design/03-tech-direction/consensus-algorithm.md(节点 I/O)
// API 锁定:LangGraph 0.4 `Annotation.Root`(非旧 StateGraphArgs<T>)。
//   - 并发 Send fan-out 字段(round0/round1/anchoring/premortem/provider)用
//     `Annotation<T[]>({ reducer: (a, b) => [...a, ...b], default: () => [] })`,
//     7 角色各返回 1 条 → concat 合并(否则 last-write-wins 只剩 1 条)。
//   - 单写字段用默认 `Annotation<T>()`(LastValue,last-write-wins)。
// 类型一律复用 P2.1 lib/schema(不重定义);persona 配置复用 lib/db/schema personas 行类型。

import { Annotation } from "@langchain/langgraph";
import type { InferSelectModel } from "drizzle-orm";

import type { DecisionType } from "@/lib/schema/decision-type";
import type { Role } from "@/lib/schema/role";
import type { StructuredClaim, PersonaVote } from "@/lib/schema/persona-vote";
import type { AnchoringFlag } from "@/lib/schema/anchoring";
import type { PremortemRisk } from "@/lib/schema/premortem";
import type { DecisionReport } from "@/lib/schema/decision-report";
import type { ProviderEvent } from "@/lib/schema/provider-event";
import type { personas } from "@/lib/db/schema/personas";

/**
 * 单个角色配置(贯穿 9 节点)。复用 lib/db/schema personas 表行类型,
 * 不重定义角色字段(role_type / kpis / interest_boundary / risk_appetite 等)。
 */
export type PersonaConfig = InferSelectModel<typeof personas>;

/** 并发数组字段的 concat reducer 工厂(7 角色 Send fan-out 各返回 1 条 → 合并)。 */
function concatReducer<T>() {
  return {
    reducer: (left: T[], right: T[]): T[] => [...left, ...right],
    default: (): T[] => [],
  };
}

/**
 * GraphState 注解定义(LangGraph 0.4 Annotation.Root)。
 * 字段顺序对应 N1→N9 数据流。
 */
export const StateAnnotation = Annotation.Root({
  // === 入口(预处理,贯穿) ===
  // 脱敏后提案(进 LLM 的版本);单写。
  redactedProposal: Annotation<string>(),
  // L1 声明目标 id(由调用方传入,N2 用于对齐);单写。
  declaredObjectiveId: Annotation<string>(),
  // 参与的角色配置(默认 7 全选,至少 2);单写,贯穿全程。
  personas: Annotation<PersonaConfig[]>(),

  // === N1 结构化 + 决策类型识别 ===
  // 决策类型(selection/marketing/budget/operation/cross_border);单写。
  decisionType: Annotation<DecisionType>(),
  // 结构化论点;单写(N1 一次性产出)。
  structuredClaims: Annotation<StructuredClaim[]>(),

  // === N2 L1 目标对齐 ===
  // 0-100 对齐分;单写。
  l1AlignmentScore: Annotation<number>(),

  // === N3 L2 证据召回 ===
  // 召回证据卡片 id 列表;单写。
  recalledEvidenceIds: Annotation<string[]>(),

  // === N4 Round 0 Blind First-Vote(Send 7× 并发) ===
  // concat reducer:7 角色各返回 1 条 PersonaVote。
  round0Votes: Annotation<PersonaVote[]>(concatReducer<PersonaVote>()),

  // === N5 Round 1 伪并发 + Anchoring(Send 7× 并发) ===
  round1Votes: Annotation<PersonaVote[]>(concatReducer<PersonaVote>()),
  anchoringFlags: Annotation<AnchoringFlag[]>(concatReducer<AnchoringFlag>()),

  // === N6 TWS 轨迹评分(纯计算) ===
  // claim_id → TWS 分;单写。
  twsScoresByClaim: Annotation<Record<string, number>>(),

  // === N7 L4 权重加权(纯计算) ===
  // role → 有效权重;单写。
  effectiveWeights: Annotation<Record<Role, number>>(),

  // === N8 Premortem(Send 7× 并发) ===
  premortemRisks: Annotation<PremortemRisk[]>(concatReducer<PremortemRisk>()),

  // === N9 决策报告生成 ===
  // 完成前为 null;单写。
  decisionReport: Annotation<DecisionReport | null>(),

  // === 错误 / 降级 metadata(任意节点可追加) ===
  // concat reducer:多节点降级事件累加,不互相覆盖。
  providerEvents: Annotation<ProviderEvent[]>(concatReducer<ProviderEvent>()),
});

/** 贯穿 9 节点的 GraphState 类型。 */
export type GraphState = typeof StateAnnotation.State;

// === Send fan-out 输入类型(供 N4 / N5 / N8 的并发分支用) ===

/**
 * N4 Round 0 Blind First-Vote 单角色输入。
 * 盲投:角色仅看到提案 + 目标 + 召回证据,看不到其他角色的票。
 */
export interface Round0Input {
  persona: PersonaConfig;
  redactedProposal: string;
  declaredObjectiveId: string;
  recalledEvidenceIds: string[];
}

/**
 * N5 Round 1 单角色输入。
 * 在 Round 0 基础上,额外提供其他角色的 R0 快照 + 本角色自己的 R0 态度,
 * 用于检测 anchoring(立场翻转无理由 / 高 cosine 相似)。
 */
export interface Round1Input extends Round0Input {
  othersRound0Snapshot: PersonaVote[];
  myR0Attitude: PersonaVote;
}

/**
 * N8 Premortem 单角色输入。
 * 角色基于初步结论做事前验尸(假设决策已失败,倒推风险)。
 */
export interface PremortemInput {
  persona: PersonaConfig;
  preliminaryConclusion: string;
}
