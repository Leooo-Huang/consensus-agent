// lib/schema/citation.ts
// §4.3 Citation Schema(L2 证据强制)— 每条 claim 必须 ≥ 1 条 citation
import { z } from "zod";

export const CitationSchema = z
  .object({
    source_type: z.enum([
      "proposal_text", // 来自提案原句
      "internal_doc", // 内部文档(飞书/历史决议)
      "external_data", // 外部数据(小红书/行业报告)
      "historical_decision", // 历史决议引用
      "persona_rule", // 角色规则(KPI / 风险偏好)
    ]),
    source_id: z.string().min(1), // 必须来自召回集合或 personas
    snippet: z.string().min(10), // ≥ 10 字
    relevance: z.number().min(0).max(1),
  })
  .strict();

export type Citation = z.infer<typeof CitationSchema>;

// 每条 claim 必须 ≥ 1 条 citation,LangGraph 重试保证
export const CitationsArraySchema = z.array(CitationSchema).min(1);
