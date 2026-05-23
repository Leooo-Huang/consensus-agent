// lib/db/schema/evidence-cards.ts
// §2.3.4 evidence_cards(v2 新)— 证据卡片(含 embedding,P0 全内存)
import { pgTable, uuid, text, jsonb, integer, timestamp } from "drizzle-orm/pg-core";
import { evidence_sources } from "./evidence-sources";

export const evidence_cards = pgTable("evidence_cards", {
  id: uuid("id").primaryKey().defaultRandom(),
  source_id: uuid("source_id")
    .notNull()
    .references(() => evidence_sources.id),
  title: text("title").notNull(),
  snippet: text("snippet").notNull(), // 前 200 字摘录
  full_content: text("full_content").notNull(),
  // P0:embedding 存内存,但 schema 字段保留以便 V2 切 pgvector 无 migration
  // 1536 维(OpenAI text-embedding-3-small 默认),P0 用 jsonb / nullable,V2 切 pgvector
  embedding: jsonb("embedding").$type<number[]>(),
  tags: jsonb("tags").$type<string[]>().notNull().default([]),
  cited_count: integer("cited_count").notNull().default(0), // 引用计数,推理时累加
  schema_version: integer("schema_version").notNull().default(1),
  created_at: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

// 索引(P0 不需要,但 V2 切 pgvector 后启用)
// CREATE INDEX evidence_cards_embedding_idx ON evidence_cards USING ivfflat (embedding vector_cosine_ops);
