// lib/db/schema/internal-objectives.ts
// §2.3.2 internal_objectives(v2 新)— L1 公司目标库,5 条 P0 fixture
import { pgTable, uuid, text, jsonb, integer, timestamp } from "drizzle-orm/pg-core";

export const internal_objectives = pgTable("internal_objectives", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(), // "Q3 七夕销售额突破 8 亿"
  description: text("description").notNull(),
  key_results: jsonb("key_results").$type<string[]>().notNull(),
  year: integer("year").notNull(), // 2026
  quarter: integer("quarter").notNull(), // 3(0=全年)
  owner: text("owner").notNull(), // "电商事业部"
  is_active: integer("is_active").notNull().default(1), // 0/1
  schema_version: integer("schema_version").notNull().default(1),
  created_at: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});
