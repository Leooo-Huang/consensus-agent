// lib/db/index.ts
// Drizzle 业务查询客户端 — Neon HTTP driver(§8.2 混合连接:业务查询走 HTTP,
// LangGraph PostgresSaver 走 WebSocket Pool,见 lib/db/ws-pool.ts)
//
// env 名适配(Vercel Neon 集成实际注入名,fallback 到 plan 原名):
//   DATABASE_URL          → Drizzle HTTP(pooled,单条非交互查询)
//   NEON_DATABASE_URL     → 兼容 plan 原名
// 懒初始化(Proxy):import 时不连接,首次访问 db.xxx 才建连 —— 修 P3.3 发现的
// "import 即调 neon() 占位串崩溃" 问题,且测试环境无 env 时 import 不崩。
import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "./schema";

type DrizzleDb = ReturnType<typeof drizzle<typeof schema>>;

let _db: DrizzleDb | null = null;

function getDb(): DrizzleDb {
  if (_db) return _db;
  const url = process.env.DATABASE_URL ?? process.env.NEON_DATABASE_URL;
  if (!url) {
    throw new Error(
      "[db] DATABASE_URL (or NEON_DATABASE_URL) not set — 运行 `vercel env pull .env.local`",
    );
  }
  _db = drizzle(neon(url), { schema });
  return _db;
}

// Proxy 保持 `db` 为命名导出 + 延迟初始化(现有 db.select() 等调用不变)
export const db = new Proxy({} as DrizzleDb, {
  get(_target, prop) {
    const real = getDb() as unknown as Record<string | symbol, unknown>;
    const value = real[prop];
    return typeof value === "function" ? value.bind(real) : value;
  },
});
