// lib/schema/provider-event.ts
// §4.10 ProviderEvent(SSE)
// 注:api.md §4.10 引用了 Drizzle 的 providerEnum / degradeReasonEnum(pgEnum)。
// 本文件是 Zod 验证层,用 z.enum 1:1 表达同一值域(值取自 api.md Drizzle 段 L673-687)。
// 数据库 pgEnum 在 P1.1 Drizzle 定义,二者并存(规则:pgEnum 用 z.enum 表达)。
import { z } from "zod";

export const ProviderZodEnum = z.enum([
  "opus-4-7",
  "sonnet-4-6",
  "haiku-4-5",
  "offline-rules",
]);

export const DegradeReasonZodEnum = z.enum([
  "timeout",
  "rate_limit", // 429
  "server_error", // 5xx
  "quota_exhausted",
  "manual", // Demo 演示用
  "all_failed", // 切到离线规则
]);

export const ProviderEventSchema = z
  .object({
    from: ProviderZodEnum, // "opus-4-7" | ...
    to: ProviderZodEnum,
    reason: DegradeReasonZodEnum,
    node_id: z.string().optional(),
    at: z.string().datetime(),
  })
  .strict();

export type Provider = z.infer<typeof ProviderZodEnum>;
export type DegradeReason = z.infer<typeof DegradeReasonZodEnum>;
export type ProviderEvent = z.infer<typeof ProviderEventSchema>;
