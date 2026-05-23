// lib/db/ws-pool.ts
// Neon WebSocket Pool — 给 LangGraph PostgresSaver 用(需要交互式事务 + prepared statement,
// HTTP driver 不支持)。§8.2 混合连接:业务查询走 lib/db/index.ts(HTTP),
// LangGraph checkpoint 走这里(WebSocket)。
//
// env 名适配:用 **unpooled** 直连(DATABASE_URL_UNPOOLED),因为 PostgresSaver 的事务
// 不能走 PgBouncer pooled 连接。fallback 到 plan 原名 NEON_DATABASE_URL_WS。
import { Pool } from "@neondatabase/serverless";

let _pool: Pool | null = null;

export function getWsPool(): Pool {
  if (_pool) return _pool;
  const url =
    process.env.DATABASE_URL_UNPOOLED ??
    process.env.POSTGRES_URL_NON_POOLING ??
    process.env.NEON_DATABASE_URL_WS ??
    process.env.DATABASE_URL;
  if (!url) {
    throw new Error(
      "[ws-pool] DATABASE_URL_UNPOOLED not set — 运行 `vercel env pull .env.local`",
    );
  }
  _pool = new Pool({ connectionString: url });
  return _pool;
}
