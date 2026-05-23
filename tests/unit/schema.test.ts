import { describe, it, expect } from "vitest";

import { AttitudeEnum, ATTITUDE_SCORE, ATTITUDE_ICON, ATTITUDE_TOKEN } from "@/lib/schema/attitude";
import { RoleEnum } from "@/lib/schema/role";
import { DEFAULT_WEIGHTS, DecisionTypeEnum } from "@/lib/schema/decision-type";
import { CitationSchema, CitationsArraySchema } from "@/lib/schema/citation";
import { DisagreementResolutionSchema, KeyDisagreementsArraySchema } from "@/lib/schema/disagreement";
import { PremortemArraySchema } from "@/lib/schema/premortem";
import { ActionItemSchema } from "@/lib/schema/action-item";
import { AttitudeDistributionSchema, DecisionReportSchema } from "@/lib/schema/decision-report";
import { DecisionAarSchema } from "@/lib/schema/aar";

// ---- fixtures ----
const validCitation = {
  source_type: "proposal_text" as const,
  source_id: "src-1",
  snippet: "这是一条满足十字最低长度的引用片段",
  relevance: 0.8,
};

const validPremortemRisk = (i: number) => ({
  risk: `风险描述至少十五个字符的占位文本编号${i}`,
  raised_by: ["finance" as const],
  severity: "high" as const,
  scenario: "具体场景描述至少二十个字符以满足下限约束的占位文本",
  mitigations: [],
});

describe("§4.1 AttitudeEnum + ATTITUDE_SCORE / ICON / TOKEN", () => {
  it("[#1] ATTITUDE_SCORE 4 档锁定: support=1.0 / conditional=0.5 / insufficient=0.0 / oppose=-1.0", () => {
    expect(ATTITUDE_SCORE.support).toBe(1.0);
    expect(ATTITUDE_SCORE.conditional).toBe(0.5);
    expect(ATTITUDE_SCORE.insufficient).toBe(0.0);
    expect(ATTITUDE_SCORE.oppose).toBe(-1.0);
  });

  it("AttitudeEnum 恰好 4 个值; ICON/TOKEN 锁定 (非 emoji)", () => {
    expect(AttitudeEnum.options).toHaveLength(4);
    expect(ATTITUDE_ICON.support).toBe("CheckCircle2");
    expect(ATTITUDE_ICON.oppose).toBe("XCircle");
    expect(ATTITUDE_TOKEN.support).toBe("--success");
    expect(ATTITUDE_TOKEN.oppose).toBe("--destructive");
  });
});

describe("§4.2 RoleEnum + DEFAULT_WEIGHTS", () => {
  it("[#2] RoleEnum 恰好 7 个值", () => {
    expect(RoleEnum.options).toHaveLength(7);
  });

  it("DecisionTypeEnum 恰好 5 个值 (5 个 Tab)", () => {
    expect(DecisionTypeEnum.options).toHaveLength(5);
  });

  it("[#3] DEFAULT_WEIGHTS.cross_border.regional === 1.5 (跨境-区域 区域权重最高)", () => {
    expect(DEFAULT_WEIGHTS.cross_border.regional).toBe(1.5);
  });

  it("[#4] DEFAULT_WEIGHTS.budget.finance === 1.6 (预算-财务 权重最高)", () => {
    expect(DEFAULT_WEIGHTS.budget.finance).toBe(1.6);
  });

  it("DEFAULT_WEIGHTS 是 5×7 完整矩阵", () => {
    expect(Object.keys(DEFAULT_WEIGHTS)).toHaveLength(5);
    for (const dt of DecisionTypeEnum.options) {
      expect(Object.keys(DEFAULT_WEIGHTS[dt])).toHaveLength(7);
    }
  });
});

describe("§4.3 Citation", () => {
  it("[#5] CitationsArraySchema.parse([]) 抛错 (min 1)", () => {
    expect(() => CitationsArraySchema.parse([])).toThrow();
  });

  it("[#6] CitationsArraySchema.parse([1 条合法]) 通过", () => {
    expect(() => CitationsArraySchema.parse([validCitation])).not.toThrow();
  });

  it("CitationSchema 拒绝 snippet < 10 字", () => {
    expect(() => CitationSchema.parse({ ...validCitation, snippet: "短" })).toThrow();
  });
});

describe("§4.6 DisagreementResolution + KeyDisagreements", () => {
  const valid = {
    shared_interest: "双方都关心的共同利益十字以上文本",
    objective_criterion: "可量化的客观判断标准十字以上文本",
    next_step: "下一步行动",
  };

  it("[#7] 拒绝 shared_interest < 10 字", () => {
    expect(() => DisagreementResolutionSchema.parse({ ...valid, shared_interest: "太短了" })).toThrow();
  });

  it("[#8] 拒绝 next_step < 5 字", () => {
    expect(() => DisagreementResolutionSchema.parse({ ...valid, next_step: "短" })).toThrow();
  });

  it("接受 3 字段合法", () => {
    expect(() => DisagreementResolutionSchema.parse(valid)).not.toThrow();
  });

  it("KeyDisagreementsArraySchema 上限为 3 (P12 top 3)", () => {
    const item = {
      claim_id: "claim_1",
      claim_text: "分歧论点文本",
      supporting_roles: ["finance" as const],
      opposing_roles: ["marketing" as const],
      why_diverge: "分歧原因描述至少二十个字符的占位说明文本内容",
      resolution: valid,
    };
    expect(() => KeyDisagreementsArraySchema.parse([item, item, item])).not.toThrow();
    expect(() => KeyDisagreementsArraySchema.parse([item, item, item, item])).toThrow();
  });
});

describe("§4.7 Premortem", () => {
  it("[#9] PremortemArraySchema.parse([2 条]) 抛错 (min 3)", () => {
    expect(() => PremortemArraySchema.parse([validPremortemRisk(1), validPremortemRisk(2)])).toThrow();
  });

  it("[#10] PremortemArraySchema.parse([3 条合法]) 通过", () => {
    expect(() =>
      PremortemArraySchema.parse([validPremortemRisk(1), validPremortemRisk(2), validPremortemRisk(3)]),
    ).not.toThrow();
  });
});

describe("§4.8 ActionItem RACI", () => {
  const base = {
    id: "ai_1",
    action: "执行某项具体行动",
    responsible: ["operations" as const],
    accountable: "finance" as const,
    consulted: [] as const,
    informed: [] as const,
    due_date: "2026-06-01T00:00:00.000Z",
  };

  it("[#11] 拒绝 accountable 为非 RoleEnum 字符串 (如 '财务/运营')", () => {
    expect(() => ActionItemSchema.parse({ ...base, accountable: "财务/运营" })).toThrow();
  });

  it("[#12] 拒绝 accountable 出现在 consulted 数组 (refine)", () => {
    expect(() => ActionItemSchema.parse({ ...base, consulted: ["finance"] })).toThrow();
  });

  it("拒绝 accountable 出现在 informed 数组 (refine)", () => {
    expect(() => ActionItemSchema.parse({ ...base, informed: ["finance"] })).toThrow();
  });

  it("[#13] 拒绝 responsible 为空数组 (min 1)", () => {
    expect(() => ActionItemSchema.parse({ ...base, responsible: [] })).toThrow();
  });

  it("接受合法 ActionItem", () => {
    expect(() => ActionItemSchema.parse(base)).not.toThrow();
  });
});

describe("§4.9 AttitudeDistribution + DecisionReport", () => {
  it("[#14] 拒绝 4 档和 ≠ 100 (50+30+10+5=95)", () => {
    expect(() =>
      AttitudeDistributionSchema.parse({ support: 50, conditional: 30, insufficient: 10, oppose: 5 }),
    ).toThrow();
  });

  it("[#15] 接受和=100", () => {
    expect(() =>
      AttitudeDistributionSchema.parse({ support: 50, conditional: 30, insufficient: 15, oppose: 5 }),
    ).not.toThrow();
  });

  it("[#18] DecisionReport.conclusion.summary 拒绝 >50 字", () => {
    const longSummary = "字".repeat(51);
    const report = buildValidReport();
    report.conclusion.summary = longSummary;
    expect(() => DecisionReportSchema.parse(report)).toThrow();
  });

  it("DecisionReport 接受完整 7 部分合法对象", () => {
    expect(() => DecisionReportSchema.parse(buildValidReport())).not.toThrow();
  });
});

describe("§4.12 AAR", () => {
  it("[#16] 拒绝只填 1 个字段 (需 ≥2 非空)", () => {
    expect(() => DecisionAarSchema.parse({ aar_expected: "预期结果描述至少十个字" })).toThrow();
  });

  it("[#17] 拒绝填了但 trim 后 <10 字的字段 (如 '无 ')", () => {
    // 注意:.min(10) 在 trim 前先拦截 "无 "(长度 2);此用例验证敷衍输入被拒
    expect(() =>
      DecisionAarSchema.parse({ aar_expected: "无         ", aar_actual: "实际发生情况描述至少十个字" }),
    ).toThrow();
  });

  it("接受 2 个非空且 trim≥10 字的字段", () => {
    expect(() =>
      DecisionAarSchema.parse({
        aar_expected: "预期结果的完整描述十个字以上",
        aar_actual: "实际发生情况的完整描述十个字以上",
      }),
    ).not.toThrow();
  });
});

// ---- helper: 构造完整合法 DecisionReport ----
function buildValidReport() {
  const resolution = {
    shared_interest: "双方都关心的共同利益十字以上文本",
    objective_criterion: "可量化的客观判断标准十字以上文本",
    next_step: "下一步行动",
  };
  return {
    conclusion: {
      status: "approved" as const,
      summary: "建议通过该提案并进入执行阶段",
      served_objective_id: "11111111-1111-1111-1111-111111111111",
      served_objective_name: "目标 A",
    },
    scoring: {
      weighted_total: 82,
      tws_score: 0.6,
      attitude_distribution: { support: 50, conditional: 30, insufficient: 15, oppose: 5 },
      weights_used: { finance: 1.6 },
      formula_explanation: "TWS = Σ(w_i · s_i) / Σ w_i",
    },
    key_disagreements: [
      {
        claim_id: "claim_1",
        claim_text: "分歧论点文本",
        supporting_roles: ["finance" as const],
        opposing_roles: ["marketing" as const],
        why_diverge: "分歧原因描述至少二十个字符的占位说明文本内容",
        resolution,
      },
    ],
    evidence_chain: [
      {
        conclusion: "证据链结论",
        citations: [validCitation],
      },
    ],
    risks: [validPremortemRisk(1), validPremortemRisk(2), validPremortemRisk(3)],
    action_items: [
      {
        id: "ai_1",
        action: "执行某项具体行动",
        responsible: ["operations" as const],
        accountable: "finance" as const,
        consulted: [],
        informed: [],
        due_date: "2026-06-01T00:00:00.000Z",
      },
    ],
    minutes: {
      markdown: "会议纪要正文".repeat(40), // 240 字, 在 200-500 区间
      headline_disagreement: "核心分歧一句话",
      three_sentence_summary: ["第一句摘要", "第二句摘要", "第三句摘要"],
    },
  };
}
