// lib/db/schema/evidence-sources.ts
// §2.3.3 evidence_sources(v2 新)— 证据源注册表
import { pgTable, uuid, text, integer, timestamp, pgEnum } from "drizzle-orm/pg-core";

export const sourceTypeEnum = pgEnum("source_type", ["internal", "external"]);
export const sourceStatusEnum = pgEnum("source_status", ["active", "pending_v2"]);

export const evidence_sources = pgTable("evidence_sources", {
  id: uuid("id").primaryKey().defaultRandom(),
  source_type: sourceTypeEnum("source_type").notNull(),
  name: text("name").notNull(), // "历史决议" / "小红书声量(Fixture)"
  url: text("url"), // 可空(fixture 无 URL)
  owner: text("owner").notNull(),
  status: sourceStatusEnum("status").notNull().default("active"),
  description: text("description"), // P11 卡片显示
  schema_version: integer("schema_version").notNull().default(1),
  created_at: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});
