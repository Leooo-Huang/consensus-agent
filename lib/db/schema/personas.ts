// lib/db/schema/personas.ts
// §2.3.1 personas — 7 角色,默认值锁定 + 用户可编辑
import { pgTable, uuid, text, jsonb, integer, timestamp, pgEnum } from "drizzle-orm/pg-core";

export const roleTypeEnum = pgEnum("role_type", [
  "operations",
  "products",
  "marketing",
  "finance",
  "brand",
  "supply_chain",
  "regional",
]);

export const riskAppetiteEnum = pgEnum("risk_appetite", [
  "conservative",
  "neutral",
  "aggressive",
]);

export const personas = pgTable("personas", {
  id: uuid("id").primaryKey().defaultRandom(),
  role_type: roleTypeEnum("role_type").notNull().unique(), // 7 角色枚举,unique 防重
  name: text("name").notNull(), // "运营"
  objective: text("objective").notNull(), // 业务目标
  kpis: jsonb("kpis").$type<string[]>().notNull(), // ["转化率", "ROAS"]
  interest_boundary: text("interest_boundary").notNull(), // "不超预算 / 不爆库存"
  natural_conflicts: jsonb("natural_conflicts").$type<string[]>().notNull(),
  // ["finance", "supply_chain"]
  decision_catchphrase: text("decision_catchphrase").notNull(),
  risk_appetite: riskAppetiteEnum("risk_appetite").notNull(),
  notes: text("notes").default(""), // append-only(决议回写追加)
  // 0=自定义新增 / 1=内置默认(v2.3 GAN-A B-A-1 修:原 text 类型与其他表 integer 0/1 风格冲突)
  is_default: integer("is_default").notNull().default(1),
  schema_version: integer("schema_version").notNull().default(1),
  created_at: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updated_at: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});
