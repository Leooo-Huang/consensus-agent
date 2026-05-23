// lib/methodology/l1-objective-template.ts
// L1 战略/目标共识(OKR)— 目标对齐 prompt 三件套。
//
// methodology.md §L1「推理流程」给出节点定义(输入:提案 + 选定公司级目标;
// 输出:对齐度评分 0-1 + 偏离风险;对齐度 < 0.5 触发系统警告),并在 §L3 给出
// 注入目标的片段({objective.description} / {objective.key_results})。
// 原文未给完整 L1 prompt 字符串,本模板按该描述补全(已注明),expectedKeywords
// 与 outputSchema 严格对齐节点契约(对齐度 0-1 + 偏离风险)。
import { z } from "zod";

export const L1_OBJECTIVE_TEMPLATE = `本次决策必须服从以下公司级目标(OKR):
目标:{objective.name}
描述:{objective.description}
关键结果(KR):{objective.key_results}

待评估的提案:
{proposal}

请评估本提案与上述公司级目标的对齐度:
- alignment_score: 0-1 的对齐度评分(1=完全服从该目标,0=与目标无关或冲突)
- deviation_risk: 一句话指出本提案可能偏离该目标的风险(若无明显偏离,说明为何高度对齐)

注意:对齐度低于 0.5 将触发系统警告「该提案可能偏离声明目标」,因此评分必须基于
KR 的可衡量口径,不要凭印象给分。
`;

export const L1_EXPECTED_KEYWORDS = ["目标", "对齐", "KR", "偏离", "服从"];

// L1 目标对齐节点输出 schema(对齐度评分 0-1 + 偏离风险)。
// 这是 L1 节点特有输出,P2.1 lib/schema 未定义对齐度结构,故在此声明,
// 不与 citation / action-item / premortem / aar 重叠。
export const L1_ALIGNMENT_SCHEMA = z
  .object({
    alignment_score: z.number().min(0).max(1),
    deviation_risk: z.string().min(1),
  })
  .strict();

export type L1Alignment = z.infer<typeof L1_ALIGNMENT_SCHEMA>;
