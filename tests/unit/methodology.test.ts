import { describe, it, expect } from "vitest";
import { z } from "zod";

import { P0_OBJECTIVES } from "@/lib/methodology/p0-objective-fixtures";
import { fill } from "@/lib/methodology/fill";
import {
  L1_OBJECTIVE_TEMPLATE,
  L1_EXPECTED_KEYWORDS,
  L1_ALIGNMENT_SCHEMA,
} from "@/lib/methodology/l1-objective-template";
import {
  L2_EVIDENCE_TEMPLATE,
  L2_EXPECTED_KEYWORDS,
  L2_OUTPUT_SCHEMA,
} from "@/lib/methodology/l2-evidence-template";
import {
  L3_STAKEHOLDER_TEMPLATE,
  L3_EXPECTED_KEYWORDS_BY_ROLE,
  buildL3Prompt,
} from "@/lib/methodology/l3-stakeholder-template";
import {
  L4_RACI_TEMPLATE,
  L4_EXPECTED_KEYWORDS,
  L4_OUTPUT_SCHEMA,
} from "@/lib/methodology/l4-raci-template";
import {
  PREMORTEM_TEMPLATE,
  PREMORTEM_EXPECTED_KEYWORDS,
  PREMORTEM_OUTPUT_SCHEMA,
} from "@/lib/methodology/premortem-template";
import {
  AAR_TEMPLATE,
  AAR_EXPECTED_KEYWORDS,
  AAR_OUTPUT_SCHEMA,
} from "@/lib/methodology/aar-template";

// 复用的 P2.1 schema(用于验证 import 同一引用,而非重新定义)
import { CitationsArraySchema } from "@/lib/schema/citation";
import { ActionItemSchema } from "@/lib/schema/action-item";
import { PremortemArraySchema } from "@/lib/schema/premortem";
import { DecisionAarSchema } from "@/lib/schema/aar";

describe("§L1 P0_OBJECTIVES fixture", () => {
  it("[#1] 恰好 5 条,每条 >= 2 个 key_results", () => {
    expect(P0_OBJECTIVES).toHaveLength(5);
    for (const obj of P0_OBJECTIVES) {
      expect(obj.key_results.length).toBeGreaterThanOrEqual(2);
    }
  });

  it("[#2] 含 obj-2026-q3-qixi(七夕)+ obj-2026-q3-cross-border(跨境)", () => {
    const ids = P0_OBJECTIVES.map((o) => o.id);
    expect(ids).toContain("obj-2026-q3-qixi");
    expect(ids).toContain("obj-2026-q3-cross-border");
  });

  it("每条目标字段完整(name/description/key_results/year/quarter/owner/active)", () => {
    for (const obj of P0_OBJECTIVES) {
      expect(obj.name.length).toBeGreaterThan(0);
      expect(obj.description.length).toBeGreaterThan(0);
      expect(obj.year).toBe(2026);
      expect(typeof obj.quarter).toBe("number");
      expect(obj.owner.length).toBeGreaterThan(0);
      expect(obj.active).toBe(true);
    }
  });
});

describe("§L3 stakeholder template fill", () => {
  const personaVars = {
    "persona.name": "财务负责人",
    "persona.role_type": "finance",
    "persona.objective": "守住毛利与现金流",
    "persona.kpis": ["毛利率", "回款周期", "ROI"],
    "persona.interest_boundary": "不突破预算红线",
    "persona.natural_conflicts": ["marketing", "supply_chain"],
    "persona.decision_catchphrase": "先算账再拍板",
    "persona.risk_appetite": "conservative",
  };

  it("[#3] fill 注入 persona 后无残留占位符(无 '{')", () => {
    const filled = buildL3Prompt(personaVars, "formal");
    expect(filled).not.toContain("{");
    expect(filled).not.toContain("}");
  });

  it("formal 与 casual 双语气都能产出且无残留占位符", () => {
    const formal = buildL3Prompt(personaVars, "formal");
    const casual = buildL3Prompt(personaVars, "casual");
    expect(formal).not.toContain("{");
    expect(casual).not.toContain("{");
    expect(formal).not.toBe(casual); // 语气后缀不同
    // 数组字段被「、」连接注入
    expect(formal).toContain("毛利率、回款周期、ROI");
  });

  it("[#4] L3_EXPECTED_KEYWORDS_BY_ROLE.finance 含 ROI / 毛利", () => {
    expect(L3_EXPECTED_KEYWORDS_BY_ROLE.finance).toContain("ROI");
    expect(L3_EXPECTED_KEYWORDS_BY_ROLE.finance).toContain("毛利");
  });
});

describe("§Premortem keywords", () => {
  it("[#5] PREMORTEM_EXPECTED_KEYWORDS 含 失败 / 原因", () => {
    expect(PREMORTEM_EXPECTED_KEYWORDS).toContain("失败");
    expect(PREMORTEM_EXPECTED_KEYWORDS).toContain("原因");
  });
});

describe("§template 字符串非空 + 含预期占位符", () => {
  it("[#6] 每个 template 非空且含预期 placeholder", () => {
    expect(L1_OBJECTIVE_TEMPLATE).toContain("{objective");
    expect(L1_OBJECTIVE_TEMPLATE).toContain("{proposal}");

    expect(L2_EVIDENCE_TEMPLATE.trim().length).toBeGreaterThan(0);
    expect(L2_EVIDENCE_TEMPLATE).toContain("{recalled_evidence}");

    expect(L3_STAKEHOLDER_TEMPLATE).toContain("{persona");

    expect(L4_RACI_TEMPLATE.trim().length).toBeGreaterThan(0);
    expect(L4_RACI_TEMPLATE).toContain("RACI");

    expect(PREMORTEM_TEMPLATE).toContain("{persona");

    expect(AAR_TEMPLATE.trim().length).toBeGreaterThan(0);
    expect(AAR_TEMPLATE).toContain("aar_expected");
  });

  it("expectedKeywords 全部为非空字符串数组", () => {
    for (const arr of [
      L1_EXPECTED_KEYWORDS,
      L2_EXPECTED_KEYWORDS,
      L4_EXPECTED_KEYWORDS,
      PREMORTEM_EXPECTED_KEYWORDS,
      AAR_EXPECTED_KEYWORDS,
    ]) {
      expect(Array.isArray(arr)).toBe(true);
      expect(arr.length).toBeGreaterThan(0);
      for (const k of arr) expect(typeof k).toBe("string");
    }
  });
});

describe("§outputSchema 是 ZodType 且复用 P2.1(不重复定义)", () => {
  it("[#7] 各 template 关联 outputSchema 都是 ZodType", () => {
    expect(L1_ALIGNMENT_SCHEMA).toBeInstanceOf(z.ZodType);
    expect(L2_OUTPUT_SCHEMA).toBeInstanceOf(z.ZodType);
    expect(L4_OUTPUT_SCHEMA).toBeInstanceOf(z.ZodType);
    expect(PREMORTEM_OUTPUT_SCHEMA).toBeInstanceOf(z.ZodType);
    expect(AAR_OUTPUT_SCHEMA).toBeInstanceOf(z.ZodType);
  });

  it("[#8] L2/L4/Premortem/AAR 的 outputSchema === P2.1 lib/schema 同一引用(复用,非重定义)", () => {
    expect(L2_OUTPUT_SCHEMA).toBe(CitationsArraySchema);
    expect(L4_OUTPUT_SCHEMA).toBe(ActionItemSchema);
    expect(PREMORTEM_OUTPUT_SCHEMA).toBe(PremortemArraySchema);
    expect(AAR_OUTPUT_SCHEMA).toBe(DecisionAarSchema);
  });

  it("[#9] 复用的 schema 行为正确:L2 拒空数组 / Premortem 拒 <3 条", () => {
    expect(() => L2_OUTPUT_SCHEMA.parse([])).toThrow();
    expect(() => PREMORTEM_OUTPUT_SCHEMA.parse([])).toThrow();
  });
});
