// lib/consensus/weight-calculator.ts
// 对策对应 N7:L4 动态权重加权(纯计算)
// 权威源:docs/design/03-tech-direction/methodology.md L4 权重表 + api.md §4.2 DEFAULT_WEIGHTS / §4.4 weight min(0.5).max(2.0)
//
// 取决策类型的默认 7 角色权重,叠加用户 override(每个角色单独覆盖)。
// override 超出 [0.5, 2.0] → 抛错(api.md/plan:超范围应拒绝,不 clamp)。
//
// 纯函数,不调 LLM / DB。复用 P2.1 的 DEFAULT_WEIGHTS / RoleEnum,不重新定义。
import { DEFAULT_WEIGHTS } from "@/lib/schema/decision-type";
import type { DecisionType } from "@/lib/schema/decision-type";
import { RoleEnum, type Role } from "@/lib/schema/role";

export const WEIGHT_MIN = 0.5;
export const WEIGHT_MAX = 2.0;

export class WeightOverrideRangeError extends Error {
  constructor(
    public readonly role: Role,
    public readonly value: number,
  ) {
    super(
      `权重 override 超出范围 [${WEIGHT_MIN}, ${WEIGHT_MAX}]:role=${role} value=${value}`,
    );
    this.name = "WeightOverrideRangeError";
  }
}

/**
 * 根据决策类型取默认 7 角色权重,叠加用户 override,返回完整 7 角色实际权重。
 *
 * - 未提供 override 的角色保留 DEFAULT_WEIGHTS 默认值。
 * - 提供 override 的角色:校验 [0.5, 2.0],超范围抛 WeightOverrideRangeError。
 * - 返回值是新对象,不修改 DEFAULT_WEIGHTS。
 */
export function calculateWeights(
  decisionType: DecisionType,
  overrides?: Partial<Record<Role, number>>,
): Record<Role, number> {
  const base = DEFAULT_WEIGHTS[decisionType];

  // 以 RoleEnum 为权威键集合逐角色构建,确保 7 角色齐全且无多余键。
  const result = {} as Record<Role, number>;
  for (const role of RoleEnum.options) {
    const overrideValue = overrides?.[role];
    if (overrideValue === undefined) {
      result[role] = base[role];
      continue;
    }
    if (overrideValue < WEIGHT_MIN || overrideValue > WEIGHT_MAX) {
      throw new WeightOverrideRangeError(role, overrideValue);
    }
    result[role] = overrideValue;
  }

  return result;
}
