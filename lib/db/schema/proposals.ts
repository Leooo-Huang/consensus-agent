// lib/db/schema/proposals.ts
// §2.3.5 proposals — 提案主表(含 decision_type / L1)
import { pgTable, uuid, text, jsonb, integer, timestamp, pgEnum } from "drizzle-orm/pg-core";
import { internal_objectives } from "./internal-objectives";

export const decisionTypeEnum = pgEnum("decision_type", [
  "selection", // 选品
  "marketing", // 营销
  "budget", // 预算
  "operation", // 经营
  "cross_border", // 跨境-区域(v2.1 新)
]);

export const proposals = pgTable("proposals", {
  id: uuid("id").primaryKey().defaultRandom(),
  title: text("title").notNull(), // 自动从前 30 字截取
  raw_text: text("raw_text").notNull(), // 用户原始输入(可能含敏感字段)
  redacted_text: text("redacted_text").notNull(), // 脱敏后(进 LLM 的版本)
  decision_type: decisionTypeEnum("decision_type").notNull(),
  decision_type_confidence: integer("decision_type_confidence").notNull(), // 0-100,AI 识别置信度
  declared_objective_id: uuid("declared_objective_id")
    .notNull()
    .references(() => internal_objectives.id), // L1 必选
  weight_overrides: jsonb("weight_overrides").$type<Record<string, number>>(),
  // { "finance": 1.4, ... } 可空,用户调整
  selected_persona_ids: jsonb("selected_persona_ids").$type<string[]>().notNull(),
  // 默认 7 全选,至少 2
  is_demo: integer("is_demo").notNull().default(0), // 是否来自 P01 Demo Sim
  demo_scenario_id: text("demo_scenario_id"), // "scenario-1" ~ "scenario-4"
  // v2.3 GAN-A H-A-7 修:显式跟踪"当前主线版本",避免 P04/P12 取版本时歧义
  // FK 不显式声明(循环引用,应用层保证)
  current_analysis_version_id: uuid("current_analysis_version_id"),
  deleted_at: timestamp("deleted_at", { withTimezone: true }), // 软删除,90 天后真删
  schema_version: integer("schema_version").notNull().default(1),
  created_at: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updated_at: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});
