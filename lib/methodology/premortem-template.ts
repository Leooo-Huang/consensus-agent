// lib/methodology/premortem-template.ts
// Premortem(Gary Klein 事前验尸)— prompt 三件套。
//
// PREMORTEM_TEMPLATE + PREMORTEM_EXPECTED_KEYWORDS 1:1 来自 methodology.md
// §「Premortem template」。
// outputSchema 复用 P2.1 lib/schema 的 PremortemArraySchema(>= 3 条,P0 必做强制),
// 不重新定义 premortem schema。
import { PremortemArraySchema } from "@/lib/schema/premortem";

export const PREMORTEM_TEMPLATE = `
假设这个决策 6 个月后失败了。从你的角色({persona.role_type})角度,
最可能的失败原因是什么?给出 1-3 个具体场景,**必须基于真实历史教训或行业常识**,不要泛泛而谈。
`;

export const PREMORTEM_EXPECTED_KEYWORDS = ["失败", "原因", "场景", "如果"];

// outputSchema 复用 P2.1:Premortem 风险数组(>= 3 条强制)。
export const PREMORTEM_OUTPUT_SCHEMA = PremortemArraySchema;
