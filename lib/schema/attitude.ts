// lib/schema/attitude.ts
// §4.1 基础枚举与态度分(全局锁定)— 4 档态度,分值/图标/色彩 token 1:1 锁定
import { z } from "zod";

export const AttitudeEnum = z.enum([
  "support", // 支持
  "conditional", // 谨慎支持
  "insufficient", // 信息不足
  "oppose", // 反对
]);

export type Attitude = z.infer<typeof AttitudeEnum>;

export const ATTITUDE_SCORE = {
  support: +1.0,
  conditional: +0.5,
  insufficient: 0.0,
  oppose: -1.0,
} as const satisfies Record<Attitude, number>;

// UI 渲染锁定(禁止 emoji,严格按 ui.md §1.6)— 值为 Lucide 组件名字符串,非 emoji
export const ATTITUDE_ICON = {
  support: "CheckCircle2",
  conditional: "CheckCircle",
  insufficient: "HelpCircle",
  oppose: "XCircle",
} as const satisfies Record<Attitude, string>;

export const ATTITUDE_TOKEN = {
  support: "--success",
  conditional: "--conditional", // HSL(160 60% 50%)
  insufficient: "--warning",
  oppose: "--destructive",
} as const satisfies Record<Attitude, string>;
