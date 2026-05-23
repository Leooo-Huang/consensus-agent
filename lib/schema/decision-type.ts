// lib/schema/decision-type.ts
// §4.2 决策类型枚举(5 类型)+ L4 动态权重表(5×7 矩阵,methodology.md 已锁)
import { z } from "zod";
import { RoleEnum, type Role } from "./role";

export const DecisionTypeEnum = z.enum([
  "selection", // 选品
  "marketing", // 营销
  "budget", // 预算
  "operation", // 经营
  "cross_border", // 跨境-区域
]);

export type DecisionType = z.infer<typeof DecisionTypeEnum>;

// L4 权重表(数值 1:1 照抄 api.md §4.2,methodology.md 已锁)
export const DEFAULT_WEIGHTS: Record<DecisionType, Record<Role, number>> = {
  selection:    { operations: 1.2, products: 1.3, marketing: 1.2, finance: 1.2, brand: 1.0, supply_chain: 1.3, regional: 1.0 },
  marketing:    { operations: 1.1, products: 1.0, marketing: 1.5, finance: 1.1, brand: 1.3, supply_chain: 1.0, regional: 0.9 },
  budget:       { operations: 1.0, products: 0.9, marketing: 1.0, finance: 1.6, brand: 0.9, supply_chain: 1.0, regional: 0.9 },
  operation:    { operations: 1.2, products: 1.1, marketing: 1.1, finance: 1.2, brand: 1.0, supply_chain: 1.1, regional: 1.0 },
  cross_border: { operations: 1.0, products: 1.1, marketing: 1.2, finance: 1.1, brand: 1.2, supply_chain: 1.1, regional: 1.5 },
};

// 引用 RoleEnum 以保持值域一致(避免未使用导入告警,同时锚定 7 角色键集合)
export const WEIGHT_ROLE_KEYS: readonly Role[] = RoleEnum.options;
