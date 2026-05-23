// lib/methodology/l2-evidence-template.ts
// L2 事实/证据共识 — 证据召回 prompt 三件套。
//
// template + expectedKeywords 1:1 来自 methodology.md §「L2 evidence template」。
// outputSchema 复用 P2.1 lib/schema 的 CitationsArraySchema(不重新定义 citation schema):
// 原文骨架里的 L2_CITATION_SCHEMA 与 P2.1 CitationsArraySchema 同义(min 1 + source_id +
// snippet + relevance),按 task「禁重新定义」要求统一复用 P2.1 版本。
import { CitationsArraySchema } from "@/lib/schema/citation";

export const L2_EVIDENCE_TEMPLATE = `
你必须从以下召回的证据集中选用支持你观点的内容,**不允许凭空引用**:

{recalled_evidence}

每条结论必须包含 >= 1 条 citation,格式:
- source_id: 必须来自上述召回集合
- snippet: 引用的原文片段(可与原文不完全一致,但语义必须可追溯)
- relevance: 0-1,你判断该证据与本结论的相关度
`;

export const L2_EXPECTED_KEYWORDS = ["证据", "数据", "来源", "citation", "引用"];

// outputSchema 复用 P2.1:每条 claim 的 citations 数组(min 1,否则 LangGraph 重试)。
export const L2_OUTPUT_SCHEMA = CitationsArraySchema;
