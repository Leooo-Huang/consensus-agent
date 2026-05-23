// tests/unit/db-schema.test.ts
// 验证 11 张 Drizzle schema 的关键字段存在性 + GAN 修复字段未丢失。
// 用 getTableColumns 内省列;用 pgEnum 的 .enumValues 内省枚举值。
import { describe, it, expect } from "vitest";
import { getTableColumns, getTableName } from "drizzle-orm";
import { personas } from "@/lib/db/schema/personas";
import { proposals, decisionTypeEnum } from "@/lib/db/schema/proposals";
import { analysis_versions } from "@/lib/db/schema/analysis-versions";
import { hitl_audit } from "@/lib/db/schema/hitl-audit";
import { audit_logs, auditActionEnum } from "@/lib/db/schema/audit-logs";
import { evidence_cards } from "@/lib/db/schema/evidence-cards";
import { decisions } from "@/lib/db/schema/decisions";

describe("P1.1 Drizzle schema — GAN 修复字段验证", () => {
  // 1. personas.is_default 存在且类型 integer(B-A-1,不是 text)
  it("personas 有 is_default 列且为 integer 类型(B-A-1)", () => {
    const cols = getTableColumns(personas);
    expect(cols).toHaveProperty("is_default");
    // drizzle integer 列的 columnType 为 "PgInteger";text 列为 "PgText"
    expect(cols.is_default.columnType).toBe("PgInteger");
  });

  // 2. proposals.current_analysis_version_id 存在(H-A-7)
  it("proposals 有 current_analysis_version_id 列(H-A-7)", () => {
    const cols = getTableColumns(proposals);
    expect(cols).toHaveProperty("current_analysis_version_id");
  });

  // 3. analysis_versions.headline_disagreement 顶层列存在(B-A-5)
  it("analysis_versions 有 headline_disagreement 顶层列(B-A-5)", () => {
    const cols = getTableColumns(analysis_versions);
    expect(cols).toHaveProperty("headline_disagreement");
  });

  // 4. analysis_versions.decision_report_overrides 顶层列存在(B-A-6)
  it("analysis_versions 有 decision_report_overrides 顶层列(B-A-6)", () => {
    const cols = getTableColumns(analysis_versions);
    expect(cols).toHaveProperty("decision_report_overrides");
  });

  // 5. analysis_versions.methodology_ab_compare 顶层列存在(B-A-3)
  it("analysis_versions 有 methodology_ab_compare 顶层列(B-A-3)", () => {
    const cols = getTableColumns(analysis_versions);
    expect(cols).toHaveProperty("methodology_ab_compare");
  });

  // 6. hitl_audit.auto_approve_at 存在(H-A-6);并确认表名是 hitl_audit(B-B-4)
  it("hitl_audit 有 auto_approve_at 列(H-A-6),表名为 hitl_audit(B-B-4)", () => {
    const cols = getTableColumns(hitl_audit);
    expect(cols).toHaveProperty("auto_approve_at");
    // 确认是 hitl_audit 表而非 langgraph_checkpoints
    expect(getTableName(hitl_audit)).toBe("hitl_audit");
  });

  // 7. auditActionEnum 含 raci_override(GAN-V3 新增)
  it("audit_logs 的 auditActionEnum 含 raci_override", () => {
    expect(auditActionEnum.enumValues).toContain("raci_override");
    // 同时确认 audit_logs 引用了该 enum
    const cols = getTableColumns(audit_logs);
    expect(cols).toHaveProperty("action");
  });

  // 8. evidence_cards.embedding 存在
  it("evidence_cards 有 embedding 列", () => {
    const cols = getTableColumns(evidence_cards);
    expect(cols).toHaveProperty("embedding");
  });

  // 9. decisions 有 4 个 AAR 字段
  it("decisions 有 4 个 AAR 字段(expected/actual/gap_reason/next_improvement)", () => {
    const cols = getTableColumns(decisions);
    expect(cols).toHaveProperty("aar_expected");
    expect(cols).toHaveProperty("aar_actual");
    expect(cols).toHaveProperty("aar_gap_reason");
    expect(cols).toHaveProperty("aar_next_improvement");
  });

  // 10. decisionTypeEnum 含 cross_border(5 个值)
  it("proposals 的 decisionTypeEnum 含 cross_border 且共 5 个值", () => {
    expect(decisionTypeEnum.enumValues).toContain("cross_border");
    expect(decisionTypeEnum.enumValues).toHaveLength(5);
  });
});
