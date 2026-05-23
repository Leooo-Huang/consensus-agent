// lib/methodology/p0-objective-fixtures.ts
// L1 OKR 公司目标库 — 5 条 P0 fixture(1:1 照抄 methodology.md §L1 P0_OBJECTIVES)。
//
// 数据来源声明(methodology.md §L1):基于公开零售行业知识 + 珠宝零售常识
// + 企业 X 公开年报数据估算,非企业 X 内部真实数据。
// V2 真接企业 OKR 系统后由 CEO 办公室录入,届时直接替换本数组即可。

export type InternalObjective = {
  id: string;
  name: string; // "Q3 七夕销售额突破 8 亿"
  description: string; // 一段话
  key_results: string[]; // ["GMV ≥ 8 亿", "DAU ≥ 200 万", "复购率 ≥ 35%"]
  year: number; // 2026
  quarter: number; // 3(0=全年)
  owner: string; // "CEO 办公室" / "电商事业部"
  active: boolean;
};

export const P0_OBJECTIVES: InternalObjective[] = [
  {
    id: "obj-2026-q3-qixi",
    name: "Q3 七夕销售额突破 8 亿",
    description: "七夕大促作为下半年关键节点,实现品类突破 + 客单价提升",
    key_results: ["七夕周 GMV ≥ 8 亿", "客单价 ≥ ¥4500", "新客占比 ≥ 25%"],
    year: 2026,
    quarter: 3,
    owner: "电商事业部",
    active: true,
  },
  {
    id: "obj-2026-overseas-brand",
    name: "2026 海外市场品牌认知提升",
    description: "在日本/韩国/东南亚提升消费者品牌主动提及率",
    key_results: ["海外 5 国主动提及率提升 30%", "海外 GMV 占比 ≥ 25%", "海外 NPS ≥ 50"],
    year: 2026,
    quarter: 0,
    owner: "品牌中心",
    active: true,
  },
  {
    id: "obj-2026-q3-supply",
    name: "Q3 供应链产能优化",
    description: "解决去年大促 30% 断货问题,提升备货效率",
    key_results: ["大促前 14 天备货完成率 ≥ 95%", "断货率 ≤ 5%", "产能利用率 ≥ 80%"],
    year: 2026,
    quarter: 3,
    owner: "供应链中心",
    active: true,
  },
  {
    id: "obj-2026-cashflow",
    name: "2026 全年现金流健康",
    description: "保持毛利率 + 缩短回款周期,确保扩张期资金安全",
    key_results: ["整体毛利率 ≥ 55%", "回款周期 ≤ 45 天", "库存周转 ≥ 5 次/年"],
    year: 2026,
    quarter: 0,
    owner: "CFO 办公室",
    active: true,
  },
  {
    id: "obj-2026-q3-cross-border",
    name: "Q3 跨境新品突破",
    description: "在东南亚市场(印尼/泰国)验证情侣对戒品类,为 2027 全面铺货做准备",
    key_results: ["东南亚 5 国情侣对戒 GMV ≥ 5000 万", "复购率 ≥ 20%", "本地 KOL 合作 ≥ 30"],
    year: 2026,
    quarter: 3,
    owner: "海外事业部",
    active: true,
  },
];
