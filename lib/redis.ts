// lib/redis.ts
// Upstash Redis 客户端 — 限流 / Provider manual override 300s TTL / HITL auto-approve 时间戳。
// (GAN-B B-B-3:@vercel/kv 已下线,统一用 @upstash/redis)
//
// env 名适配:Vercel Upstash 集成注入 KV_ 前缀(KV_REST_API_URL / KV_REST_API_TOKEN),
// fallback 到 plan 原名 UPSTASH_REDIS_REST_URL / UPSTASH_REDIS_REST_TOKEN。
// 懒初始化:无 env 时 import 不崩。
import { Redis } from "@upstash/redis";

let _redis: Redis | null = null;

export function getRedis(): Redis {
  if (_redis) return _redis;
  const url = process.env.KV_REST_API_URL ?? process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.KV_REST_API_TOKEN ?? process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) {
    throw new Error(
      "[redis] KV_REST_API_URL/TOKEN not set — 运行 `vercel env pull .env.local`",
    );
  }
  _redis = new Redis({ url, token });
  return _redis;
}
