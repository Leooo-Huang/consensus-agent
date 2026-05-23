// lib/schema/role.ts
// §4.2 角色枚举(7 角色全局锁定)+ 中文标签 + Lucide 图标名
import { z } from "zod";

export const RoleEnum = z.enum([
  "operations",
  "products",
  "marketing",
  "finance",
  "brand",
  "supply_chain",
  "regional",
]);

export type Role = z.infer<typeof RoleEnum>;

export const RoleLabelZh: Record<Role, string> = {
  operations: "运营",
  products: "商品",
  marketing: "市场",
  finance: "财务",
  brand: "品牌",
  supply_chain: "供应链",
  regional: "区域管理",
};

// Lucide 组件名字符串(非 emoji)
export const RoleIcon: Record<Role, string> = {
  operations: "Briefcase",
  products: "Package",
  marketing: "Megaphone",
  finance: "Coins",
  brand: "Sparkles",
  supply_chain: "Truck",
  regional: "Globe",
};
