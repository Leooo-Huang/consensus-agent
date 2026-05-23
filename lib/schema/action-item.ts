// lib/schema/action-item.ts
// §4.8 ActionItem RACI(P12 § ⑥)
import { z } from "zod";
import { RoleEnum } from "./role";

export const ActionItemSchema = z
  .object({
    id: z.string(),
    action: z.string().min(5).regex(/^[一-龥\w]/, "必须以中文或字母开头"),
    responsible: z.array(RoleEnum).min(1), // R 必须 ≥ 1
    // v2.3 GAN-A H-A-2:accountable 必须是单一 RoleEnum,
    // 防止 LLM 输出"财务/运营"等组合绕过 RACI 唯一性原则。禁 z.string()。
    accountable: RoleEnum, // A 必须唯一,严格枚举校验,不允许字符串拼接
    consulted: z.array(RoleEnum).default([]),
    informed: z.array(RoleEnum).default([]),
    due_date: z.string().datetime(),
  })
  .strict()
  .refine(
    // A 不能同时出现在 C/I 数组(避免角色重复出现)
    (d) => !d.consulted.includes(d.accountable) && !d.informed.includes(d.accountable),
    { message: "Accountable 角色不能同时出现在 Consulted 或 Informed" },
  );

export type ActionItem = z.infer<typeof ActionItemSchema>;
