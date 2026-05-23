// lib/methodology/aar-template.ts
// After Action Review(AAR)— 决议回写 4 问 prompt 三件套。
//
// methodology.md 未给完整 AAR prompt 字符串,仅给出:§方法论表「P09 表单 4 字段」
// + L88「PDCA = Predict-Actual-Diff-Improve」+ P2.1 DecisionAarSchema 的 4 字段
// (aar_expected / aar_actual / aar_gap_reason / aar_next_improvement)。
// 本模板按这 4 个字段补全标准 AAR 四问 prompt(已注明),expectedKeywords 对齐四问,
// outputSchema 严格复用 P2.1 DecisionAarSchema(不重新定义 aar schema)。
import { DecisionAarSchema } from "@/lib/schema/aar";

export const AAR_TEMPLATE = `
本决策已执行完毕,请基于实际结果做 After Action Review(AAR),回答以下 4 问:
1. aar_expected — 当初预期达成什么?(对应决策时设定的目标/KR)
2. aar_actual — 实际发生了什么?(以可衡量口径陈述真实结果)
3. aar_gap_reason — 预期与实际为何有差距?(找根因,不要只描述现象)
4. aar_next_improvement — 下次如何改进?(可落地的具体行动,而非口号)

至少认真回答其中 2 问,每个回答 >= 10 字,不允许填「无」「N/A」等敷衍内容。
`;

export const AAR_EXPECTED_KEYWORDS = ["预期", "实际", "差距", "改进"];

// outputSchema 复用 P2.1:AAR 4 字段(>= 2 个非空且 trim >= 10 字,防形式化)。
export const AAR_OUTPUT_SCHEMA = DecisionAarSchema;
