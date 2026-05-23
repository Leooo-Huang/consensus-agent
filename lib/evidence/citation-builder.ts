// lib/evidence/citation-builder.ts
// 构建并校验 citation 元数据 — 防 LLM 幻觉引用(architecture.md §证据引擎关键设计)
//
// 关键约束:每条 citation 的 source_id 必须 ∈ 召回集(recalledIds),否则抛错。
// 这保证 Agent 推理时只能引用真实召回的证据,无法凭空捏造来源。
// 用 P2.1 CitationsArraySchema 做结构校验(min 1,复用不重定义)。
import { CitationsArraySchema, type Citation } from "@/lib/schema/citation";

/**
 * 校验一组 citation:
 *   1. 每条 source_id 必须 ∈ recalledIds(召回集),否则抛 `not in recalled`
 *   2. 整体过 CitationsArraySchema(每条结构合法 + 数组 min 1)
 *
 * 返回校验通过的 citations(类型收窄为 Citation[])。
 */
export function buildCitations(
  citations: unknown[],
  recalledIds: Set<string>,
): Citation[] {
  // 先过 schema:结构合法性 + min 1(空数组在此抛错)
  const parsed = CitationsArraySchema.parse(citations);

  // 再校验来源合法性:source_id 必须来自召回集(防幻觉)
  for (const c of parsed) {
    if (!recalledIds.has(c.source_id)) {
      throw new Error(
        `Citation source_id "${c.source_id}" not in recalled set`,
      );
    }
  }

  return parsed;
}
