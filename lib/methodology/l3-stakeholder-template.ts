// lib/methodology/l3-stakeholder-template.ts
// L3 利益/角色共识 — Stakeholder Mapping prompt 三件套。
//
// L3_STAKEHOLDER_TEMPLATE 主体 1:1 来自 methodology.md §「L3 stakeholder template」
// (注入 persona 7 字段:name / role_type / objective / kpis / interest_boundary /
// natural_conflicts / decision_catchphrase + risk_appetite)。
//
// 补充(task 要求,methodology.md 骨架未给):formal / casual 双语气模式。
// 原文骨架只给了单一注入模板,task 明确要求 formal/casual 双语气,故按 task 补全
// 一个语气后缀片段(L3_TONE_SUFFIX),并提供 buildL3Prompt 组合 helper。
//
// L3_EXPECTED_KEYWORDS_BY_ROLE:finance / supply_chain / marketing 三项 1:1 照抄
// methodology.md;原文以「// ...其他角色」省略其余 4 个,按 7 角色锁定(role.ts)补齐
// operations / products / brand / regional(已注明为补全)。
import type { Role } from "@/lib/schema/role";
import { fill, type FillVars } from "./fill";

export const L3_STAKEHOLDER_TEMPLATE = `
你的角色:{persona.name}({persona.role_type})
你的核心目标:{persona.objective}
你的关键 KPI:{persona.kpis}
你的利益边界(绝不能突破):{persona.interest_boundary}
你与下列角色天然冲突,在他们的观点上你应该独立判断,不盲从:
{persona.natural_conflicts}
你的决策风格:{persona.decision_catchphrase}({persona.risk_appetite})
`;

export type L3Tone = "formal" | "casual";

// 双语气后缀(task 要求补全):formal = 正式书面;casual = 口语直白。
// 二者只改变表达语气,不改变 persona 立场与利益边界约束。
export const L3_TONE_SUFFIX: Record<L3Tone, string> = {
  formal: `
表达语气:正式、书面化。用完整句子陈述立场,引用 KPI 与利益边界时给出明确依据,
避免口语化与情绪化措辞。`,
  casual: `
表达语气:口语、直白。可以用第一人称直接表态,语气接近会议现场发言,
但仍须坚守你的利益边界,不允许为了气氛迁就而放弃立场。`,
};

export const L3_EXPECTED_KEYWORDS_BY_ROLE: Record<Role, string[]> = {
  // 以下 3 项 1:1 来自 methodology.md
  finance: ["ROI", "毛利", "回款", "成本"],
  supply_chain: ["备货", "产能", "周期", "合规"],
  marketing: ["品牌", "声量", "定位", "调性"],
  // 以下 4 项为 7 角色锁定补全(methodology.md 以「...其他角色」省略)
  operations: ["转化", "效率", "执行", "流程"],
  products: ["品类", "SKU", "选品", "需求"],
  brand: ["品牌", "调性", "认知", "心智"],
  regional: ["区域", "本地", "市场", "合规"],
};

/**
 * 组合 L3 prompt:注入 persona 7 字段 + 选定语气后缀。
 * @param vars persona 字段(键名形如 "persona.name" / "persona.kpis" 等)
 * @param tone formal | casual
 */
export function buildL3Prompt(vars: FillVars, tone: L3Tone = "formal"): string {
  return fill(L3_STAKEHOLDER_TEMPLATE + L3_TONE_SUFFIX[tone], vars);
}
