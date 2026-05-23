// lib/methodology/l4-raci-template.ts
// L4 权重/权责共识 — RACI prompt 三件套。
//
// L4_RACI_TEMPLATE 1:1 来自 methodology.md §「L4 RACI template」。
// outputSchema 复用 P2.1 lib/schema 的 ActionItemSchema(不重新定义 action-item schema):
// 原文骨架里的 L4_ACTION_ITEM_SCHEMA 与 P2.1 ActionItemSchema 同义(RACI 4 列 +
// accountable 唯一),且 P2.1 版本更严格(accountable 用 RoleEnum 而非 z.string()),
// 按 task「禁重新定义」要求统一复用 P2.1 版本。
import { ActionItemSchema } from "@/lib/schema/action-item";

export const L4_RACI_TEMPLATE = `
基于本次讨论的待回答问题,为每个行动项分配 RACI 责任:
- Responsible(R): 实际执行者(1-N 人)
- Accountable(A): 唯一最终负责人(必须 1 人)
- Consulted(C): 决策前需要咨询的(0-N 人)
- Informed(I): 决策后需要知会的(0-N 人)

行动项必须可执行(动词开头),有明确截止日期。
`;

export const L4_EXPECTED_KEYWORDS = ["Responsible", "Accountable", "Consulted", "Informed", "行动项"];

// outputSchema 复用 P2.1:单条 RACI 行动项。
export const L4_OUTPUT_SCHEMA = ActionItemSchema;
