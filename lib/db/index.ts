// lib/db/index.ts
// Drizzle 业务查询客户端 — Neon HTTP driver(§8.2 混合连接:业务查询走 HTTP,
// LangGraph PostgresSaver 走 WebSocket Pool,见 lib/graph/checkpointer.ts)
import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "./schema";

export const db = drizzle(
  neon(process.env.NEON_DATABASE_URL ?? "postgresql://placeholder"),
  { schema },
);
