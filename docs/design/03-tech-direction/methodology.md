# 业务方法论:四层共识框架(v2.1 GAN 修)

> 本文档定义议见产品依赖的**业务方法论骨架**。它不是"装饰",而是产品功能 / 数据模型 / UI 流程的根本来源。
>
> 任何 P/W 编号能力的实现都必须能追溯到本文的某一层。
>
> ⚠️ **v2.1 GAN-A 修订**:原 v2 声明"10+ 方法论",但 GAN 审查发现其中 5 个仅为"名字摆设"(BSC / RAPID / Harvard Principled Negotiation / A3 / Vroom-Yetton-Jago)。**v2.1 砍到 5 个真落地的方法论 + 5 个 V2 候选(留作路线图,不在 P0 演示中作为亮点宣讲)**。
> 同时新增:**P0 公司级目标库示范内容** + **权重表业务依据 + 重平衡**。

---

## 为什么需要方法论?

普通"多 Agent 辩论"工具的问题:
- 各角色随机发言 → 容易跑偏
- 被强势角色(CEO / 资深 PM)带偏 → 不公平
- 互相迁就 → 表面一致,实际无共识
- 无可解释性 → 决策完了说不清"为什么这么定"

**议见的解法**:把企业管理学经典方法论**工程化为产品流程**。每一步推理都对应某个经典方法论,可解释、可复用、可改进。

---

## 四层共识框架(总览)

```
┌──────────────────────────────────────────────────────┐
│  L1 战略/目标共识 (OKR — P0)                          │
│  问:这次决策服从哪个公司级目标?                       │
└──────────────────────────────────────────────────────┘
                       ↓
┌──────────────────────────────────────────────────────┐
│  L2 事实/证据共识 (证据链 + Issue Tree)              │
│  问:基于什么数据/证据/历史案例发言?                    │
└──────────────────────────────────────────────────────┘
                       ↓
┌──────────────────────────────────────────────────────┐
│  L3 利益/角色共识 (Stakeholder Mapping — P0)         │
│  问:每个角色的立场和利益边界是什么?                    │
└──────────────────────────────────────────────────────┘
                       ↓
┌──────────────────────────────────────────────────────┐
│  L4 权重/权责共识 (RACI + 动态权重 — P0)             │
│  问:谁的话该重点听?谁负责执行?                        │
└──────────────────────────────────────────────────────┘
                       ↓
               【共识算法层】
        (见 consensus-algorithm.md)
                       ↓
       【决策报告 7 部分(P12)】
                       ↓
       【AAR 决议回写(P09)— P0】
                       ↓
       【Premortem 风险预想(P0 必做,在共识算法层执行)】
```

---

## v2.1 P0 方法论清单(5 个真落地 + 1 个共识算法支撑)

| 方法论 | 用在哪 | 落地方式 | 评审能在哪验证 |
| --- | --- | --- | --- |
| **OKR** | L1 战略对齐 | 目标库表 + system prompt 注入 + 对齐度评分 | P02 ComboBox / P12 § 结论 |
| **Stakeholder Mapping** | L3 利益/角色共识 | Persona 表 `interest_boundary` + `natural_conflicts` 字段 | P05 卡片 / P12 § 关键分歧 |
| **RACI** | L4 + 决策报告 § 行动项 | 决策报告生成 prompt 强制 RACI 4 列 | P12 § 建议行动 表格 |
| **Premortem** (Gary Klein) | 共识算法层 Premortem 节点 | LangGraph 独立节点 7 角色并发 | P12 § 风险 / P03 节点 8 |
| **AAR (After Action Review)** | 决议录入(P09) | P09 表单 4 个 AAR 字段 + 权重调整建议 | P09 表单 / P10 Persona 演化 |

**+ 共识算法支撑(非方法论但学术深度卖点)**:
| 工程方案 | 启发来源 | 落地方式 |
| --- | --- | --- |
| **Blind First-Vote** | Asch 一致性实验(社会心理学) | LangGraph Send 7 角色并发,prompt 注入"不收其他角色观点" |
| **TWS 轨迹加权评分** | Du et al. 2023 / MAD-Bench(自研) | `lib/consensus/trajectory-weighted-scoring.ts` |

---

## V2 候选方法论(P0 不做,路线图保留)

| 方法论 | 为什么 P0 不做 | V2 落地点 |
| --- | --- | --- |
| **Hoshin Kanri**(方针管理) | OKR 已覆盖核心场景(目标→KR),Hoshin 三层级对齐需要总部数据接入(V2 真接 ERP 时再做) | V2 内部目标库三层级 |
| **Balanced Scorecard**(BSC) | 与 OKR 实质重叠,P0 用 OKR 即可 | V2 给目标库加四象限标签 |
| **A3 Report** | 需要专门的 A3 模板渲染组件,P0 决策报告已覆盖核心信息 | V2 加 A3 导出格式 |
| **Issue Tree / MECE** | L2 证据召回隐式用了,但没显式 UI;P0 不暴露 | V2 提供"问题分解树"可视化 |
| **Harvard Principled Negotiation** | P12 § 关键分歧"如何收敛"会引用其原则,但完整 BATNA / 客观标准需要专门 schema(详见 [P12](../02-pages/P12-decision-report.md) v2.1 schema 升级) | P0 部分落地(P12 § 关键分歧 schema 加 shared_interest / objective_criterion / next_step,但不深入 BATNA) |
| **RAPID / DACI** | 与 RACI 实质重叠;评审能区分的人极少 | V2 提供切换 |
| **Vroom-Yetton-Jago** | 决策风格映射本质等价于 L4 动态权重,P0 用权重表已够 | V2 加"独裁/协商/群体"风格推荐 |
| **PDCA / PDSA** | AAR 已涵盖核心(Plan-Do-Check-Act = Predict-Actual-Diff-Improve) | 同 AAR |

**沟通策略**:P08 评审视角对照页 + 路演发言中,**只点名 5 个 P0 真落地的方法论 + 2 个共识算法工程方案**。**不再宣传"10+ 方法论"**,避免被追问"BSC 在哪体现"答不上。

---

## L1 战略/目标共识(P0 实现)

### 用 OKR

**为什么选 OKR 不选 Hoshin Kanri / BSC**:
- OKR 概念广为人知,业务评审一秒理解
- 数据结构最简单(Objective + 2-4 个 KR),P0 落地最低成本
- Google / Intel 等大企业实践完备,可信度高

### 在产品里怎么落地

#### 数据结构(internal_objectives 表)

```typescript
type InternalObjective = {
  id: string;
  name: string;                // "Q3 七夕销售额突破 8 亿"
  description: string;          // 一段话
  key_results: string[];        // ["GMV ≥ 8 亿", "DAU ≥ 200 万", "复购率 ≥ 35%"]
  year: number;                 // 2026
  quarter: number;              // 3
  owner: string;                // "CEO 办公室" / "电商事业部"
  active: boolean;
};
```

#### P0 内置目标库(GAN-B 修:必须有具体内容)

```typescript
// lib/methodology/p0-objective-fixtures.ts
export const P0_OBJECTIVES: InternalObjective[] = [
  {
    id: 'obj-2026-q3-qixi',
    name: 'Q3 七夕销售额突破 8 亿',
    description: '七夕大促作为下半年关键节点,实现品类突破 + 客单价提升',
    key_results: ['七夕周 GMV ≥ 8 亿', '客单价 ≥ ¥4500', '新客占比 ≥ 25%'],
    year: 2026, quarter: 3, owner: '电商事业部', active: true,
  },
  {
    id: 'obj-2026-overseas-brand',
    name: '2026 海外市场品牌认知提升',
    description: '在日本/韩国/东南亚提升消费者品牌主动提及率',
    key_results: ['海外 5 国主动提及率提升 30%', '海外 GMV 占比 ≥ 25%', '海外 NPS ≥ 50'],
    year: 2026, quarter: 0, owner: '品牌中心', active: true,
  },
  {
    id: 'obj-2026-q3-supply',
    name: 'Q3 供应链产能优化',
    description: '解决去年大促 30% 断货问题,提升备货效率',
    key_results: ['大促前 14 天备货完成率 ≥ 95%', '断货率 ≤ 5%', '产能利用率 ≥ 80%'],
    year: 2026, quarter: 3, owner: '供应链中心', active: true,
  },
  {
    id: 'obj-2026-cashflow',
    name: '2026 全年现金流健康',
    description: '保持毛利率 + 缩短回款周期,确保扩张期资金安全',
    key_results: ['整体毛利率 ≥ 55%', '回款周期 ≤ 45 天', '库存周转 ≥ 5 次/年'],
    year: 2026, quarter: 0, owner: 'CFO 办公室', active: true,
  },
  {
    id: 'obj-2026-q3-cross-border',
    name: 'Q3 跨境新品突破',
    description: '在东南亚市场(印尼/泰国)验证情侣对戒品类,为 2027 全面铺货做准备',
    key_results: ['东南亚 5 国情侣对戒 GMV ≥ 5000 万', '复购率 ≥ 20%', '本地 KOL 合作 ≥ 30'],
    year: 2026, quarter: 3, owner: '海外事业部', active: true,
  },
];
```

**✅ v2.1 已拍板:接受当前 fixture 数值**(GAN-A v2 修)。
- 标注:**"基于公开零售行业知识 + 珠宝零售常识 + 企业 X 公开年报数据估算,非企业 X 内部真实数据"**
- 评审若追问"数字来源",可答:"P0 是 fixture 演示,V2 真接企业 OKR 系统后由 CEO 办公室录入"
- 若用户后续提供企业 X 真实(脱敏)版,直接替换 P0_OBJECTIVES 数组即可

#### UI 流程
- **P02 提案输入**:提交前必须选/确认本提案对应的**公司级目标**(下拉,从目标库选)
- **P12 决策报告 § 结论**:必须显示"本结论服从于目标 X"

#### 推理流程
- LangGraph 子图节点 2:**L1 目标对齐节点**
  - 输入:提案 + 选定的公司级目标
  - 输出:本提案与该目标的对齐度评分(0-1) + 偏离风险
  - 如果对齐度 < 0.5 → 系统警告"该提案可能偏离声明目标"

---

## L2 事实/证据共识(P0 实现)

### 用证据链 + 隐式 Issue Tree

### 数据结构

```typescript
type EvidenceSource = {
  id: string;
  type: 'internal' | 'external';
  name: string;                // "历史决议" / "小红书声量(Fixture)"
  url?: string;
  owner: string;
  status: 'active' | 'pending_v2'; // V2 即将支持
};

type EvidenceCard = {
  id: string;
  source_id: string;
  title: string;
  snippet: string;             // 摘录
  full_content: string;
  embedding: number[];         // 384-dim
  tags: string[];              // ["产品", "市场", "财务"]
  cited_count: number;         // 被引次数
};
```

### 内外部数据接入

| 类型 | P0(Demo) | V2(生产) |
| --- | --- | --- |
| 内部:飞书文档 | 4 场景 fixture JSON 模拟 | 飞书 OpenAPI |
| 内部:ERP | fixture | 企业 ERP API |
| 内部:历史决议 | 真实(本系统的 decision 表) | 同 |
| 内部:历史项目文档 | fixture | 飞书/Confluence |
| 外部:市场趋势 | fixture(小红书/抖音风格摘录) | 公开数据 API |
| 外部:竞品 | fixture | 网页爬取 / 公开报告 |
| 外部:行业数据 | fixture | 公开报告 |

### UI 流程
- **P11 证据库管理页**(新):管理证据源 + 查看每条证据
- **证据链卡片组件**(`<EvidenceCard>`):全产品复用

### Schema 强约束(R9 可溯源 + GAN-A #10 防形式化)

```typescript
// 每个角色观点必须包含
type PersonaClaim = {
  claim: string;
  attitude: Attitude;        // 支持/谨慎支持/反对/信息不足
  confidence: number;        // 0-1
  citations: [{
    source_type: "proposal_text" | "internal_doc" | "external_data" | "historical_decision";
    source_id: string;
    snippet: string;         // 引用的原文片段
    relevance: number;       // 0-1
  }];                        // 至少 1 条,否则 Zod 校验失败 → LangGraph 重试
};
```

---

## L3 利益/角色共识(P0 实现)

### 用 Stakeholder Mapping

### 数据结构(Persona 表)

```typescript
type Persona = {
  id: string;
  name: string;
  role_type: 'operations' | 'products' | 'marketing' | 'finance' | 'brand' | 'supply_chain' | 'regional';
  objective: string;              // 业务目标
  kpis: string[];
  interest_boundary: string;      // 利益边界 — 不能突破什么
  natural_conflicts: string[];    // 与哪些角色天然冲突
  decision_catchphrase: string;   // 决策口头禅
  risk_appetite: 'conservative' | 'neutral' | 'aggressive';
  notes: string;                  // 决议回写追加
};
```

### system prompt 注入(给每个角色 Agent)

```
你是 {name}({role_type})。
本次决策服从公司级目标:{objective.description}(KR:{objective.key_results})。
你的核心目标:{objective}
你的关键 KPI:{kpis}
你的利益边界(绝不能突破):{interest_boundary}
你与下列角色天然冲突,在他们的观点上你应该独立判断,不盲从:
{natural_conflicts}
你的决策风格:{decision_catchphrase}({risk_appetite})

你必须基于以下召回的证据发言,不允许编造任何引用:
{recalled_evidence}

输出格式:Zod schema 严格校验,每条 claim 必须有 ≥ 1 条 citation。
```

---

## L4 权重/权责共识(P0 实现)

### 用 RACI + 动态权重

### 决策类型 → 权重映射表(v2.1 GAN-A 重平衡)

> **GAN-A #5 修**:原 v2 权重表被指"没业务依据 / 数字易被零售评审击穿"。v2.1 重平衡 + 加业务依据 + 引用真实零售场景常识。

| 决策类型 | 运营 | 商品 | 市场 | 财务 | 品牌 | 供应链 | **区域** |
| --- | --- | --- | --- | --- | --- | --- | --- |
| **选品决策** | 1.2 | 1.3 | 1.2 | **1.2** | 1.0 | 1.3 | 1.0 |
| **营销决策** | 1.1 | 1.0 | 1.5 | 1.1 | 1.3 | **1.0** | 0.9 |
| **预算决策** | 1.0 | 0.9 | 1.0 | 1.6 | 0.9 | 1.0 | 0.9 |
| **经营决策** | 1.2 | 1.1 | 1.1 | 1.2 | 1.0 | 1.1 | 1.0 |
| **跨境/区域决策**(v2.1 新增) | 1.0 | 1.1 | 1.2 | 1.1 | 1.2 | 1.1 | **1.5** |

### 权重业务依据(v2.1 新增)

**选品决策 — 财务调高到 1.2(原 1.0)**:
- **依据**:零售选品本质要算"客单价 × 转化率 - 成本",**财务必须是核心声音**,不能等同基线
- **同时供应链 1.3(原值)**:产能能不能跟上是选品成败关键
- **商品 1.3(原值)**:品类负责人最懂 SKU 选择

**营销决策 — 供应链调到 1.0(原 0.8)**:
- **依据**:GAN-A 指出"新品营销时备货周期决定能不能跑完活动,**供应链不该被降权**"
- **修正后**:从 0.8 提到 1.0(基线),仍低于市场/品牌(主导)但不被无视

**跨境/区域决策 — 区域 1.5(v2.1 新增决策类型)**:
- **依据**:GAN-A 指出"跨境新品场景区域权重应最高",原 v2 区域始终 ≤ 1.0 显然不合理
- **新增"跨境/区域决策"作为独立决策类型**(原只有选品/营销/预算/经营 4 种 → 现在 5 种)

**预算决策 — 财务保持 1.6**:
- 唯一不变,因为预算就是财务主战场,业内共识无争议

### 默认值 vs 用户覆盖

用户可在 P02 / P12 手动覆盖默认权重(0.5-2.0 范围),调整需留 ≥ 5 字理由,进入审计日志。

### 共识算法层接入

加权支持率 = Σ(角色权重 × 角色态度分) / Σ权重
态度分映射详见 [consensus-algorithm.md § 4 档态度分映射](consensus-algorithm.md)

### UI 流程
- **P02 提案输入**:识别决策类型 + 显示默认权重 + "调整权重"按钮
- **P12 决策报告 § 评分**:显示每角色实际权重 + 加权后总分 + 公式 hover

### RACI 在决策报告 § 建议行动

```typescript
type ActionItem = {
  action: string;
  responsible: string[];    // R - 执行者
  accountable: string;      // A - 唯一总负责人
  consulted: string[];      // C - 需要咨询的
  informed: string[];       // I - 需要知会的
  due_date: string;
};
```

---

## 反方法论"形式化"风险(F12 v2.1 强化)

**问题**:方法论容易被"形式化应用"— 看起来都做了,但 LLM 没真用。

**v2.1 加强防护(GAN-A #7 修)**:

1. **Schema 强约束**(已有):citation 字段缺失 → Zod 失败 → LangGraph 重试
2. **测试 fixture 关键词检测**(已有):每方法论 prompt 有预期输出关键词
3. **Prompt 透明度面板**(P07 面板 8):评审可看实际注入的方法论 prompt
4. **🆕 对比实验面板**(新加,关键):
   - P07 加新面板 "**方法论 A/B 对比**"
   - 同提案在"**有方法论 prompt**"vs"**无方法论 prompt**"下分别跑
   - 展示输出差异(关键分歧 top 3 重叠率、证据引用数、置信度均值)
   - 评审眼见为实:**方法论真改变了输出**,不是装饰
5. **🆕 RACI 字段强制**(GAN-A #10 修):P12 § 行动项 RACI 不允许空 Responsible,不然提交失败

---

---

## L2-L4 template fixture 骨架(v2.1 GAN-B 修)

> **GAN-B 修**:原 v2.1 只补了 L1 公司目标库 fixture,L2/L3/L4 仅有 prompt 描述无代码骨架。本节补齐三件套(template + expectedKeywords + outputSchema)。

### L2 evidence template

```typescript
// lib/methodology/l2-evidence-template.ts
import { z } from "zod";

export const L2_EVIDENCE_TEMPLATE = `
你必须从以下召回的证据集中选用支持你观点的内容,**不允许凭空引用**:

{recalled_evidence}

每条结论必须包含 ≥ 1 条 citation,格式:
- source_id: 必须来自上述召回集合
- snippet: 引用的原文片段(可与原文不完全一致,但语义必须可追溯)
- relevance: 0-1,你判断该证据与本结论的相关度
`;

export const L2_EXPECTED_KEYWORDS = ["证据", "数据", "来源", "citation", "引用"];

export const L2_CITATION_SCHEMA = z.array(z.object({
  source_type: z.enum(["proposal_text", "internal_doc", "external_data", "historical_decision"]),
  source_id: z.string(),
  snippet: z.string().min(10),
  relevance: z.number().min(0).max(1),
})).min(1);  // 至少 1 条,否则 LangGraph 重试
```

### L3 stakeholder template

```typescript
// lib/methodology/l3-stakeholder-template.ts
export const L3_STAKEHOLDER_TEMPLATE = `
你的角色:{persona.name}({persona.role_type})
你的核心目标:{persona.objective}
你的关键 KPI:{persona.kpis}
你的利益边界(绝不能突破):{persona.interest_boundary}
你与下列角色天然冲突,在他们的观点上你应该独立判断,不盲从:
{persona.natural_conflicts}
你的决策风格:{persona.decision_catchphrase}({persona.risk_appetite})
`;

export const L3_EXPECTED_KEYWORDS_BY_ROLE = {
  finance: ["ROI", "毛利", "回款", "成本"],
  supply_chain: ["备货", "产能", "周期", "合规"],
  marketing: ["品牌", "声量", "定位", "调性"],
  // ...其他角色
};

// 测试 fixture:运行 L3 template + 财务 Persona,LLM 输出应至少命中 2 个 L3_EXPECTED_KEYWORDS_BY_ROLE.finance
```

### L4 RACI template

```typescript
// lib/methodology/l4-raci-template.ts
import { z } from "zod";

export const L4_RACI_TEMPLATE = `
基于本次讨论的待回答问题,为每个行动项分配 RACI 责任:
- Responsible(R): 实际执行者(1-N 人)
- Accountable(A): 唯一最终负责人(必须 1 人)
- Consulted(C): 决策前需要咨询的(0-N 人)
- Informed(I): 决策后需要知会的(0-N 人)

行动项必须可执行(动词开头),有明确截止日期。
`;

export const L4_ACTION_ITEM_SCHEMA = z.object({
  action: z.string().min(5).regex(/^[一-龥\w]/),  // 动词开头
  responsible: z.array(z.string()).min(1),
  accountable: z.string(),  // 必填且唯一
  consulted: z.array(z.string()).default([]),
  informed: z.array(z.string()).default([]),
  due_date: z.string().datetime(),
});
```

### Premortem template

```typescript
// lib/methodology/premortem-template.ts
export const PREMORTEM_TEMPLATE = `
假设这个决策 6 个月后失败了。从你的角色({persona.role_type})角度,
最可能的失败原因是什么?给出 1-3 个具体场景,**必须基于真实历史教训或行业常识**,不要泛泛而谈。
`;

export const PREMORTEM_EXPECTED_KEYWORDS = ["失败", "原因", "场景", "如果"];
```

---

## 方法论速查表(v2.1)

| 在产品哪一步 | 用了什么方法论 | 落地证据 |
| --- | --- | --- |
| P02 输入 + L1 对齐 | **OKR** | `internal_objectives` 表 + 对齐度评分节点 |
| P11 证据库 + 推理引用 | (隐式 Issue Tree) | `evidence_cards` + Schema 强制 citation |
| P05 Persona + 利益边界 | **Stakeholder Mapping** | Persona 表 `interest_boundary` + `natural_conflicts` |
| P02 决策类型 + 权重 | (自研 + 受 Vroom-Yetton-Jago 启发) | 5 种决策类型 × 7 角色权重表 |
| P12 § 关键分歧 | (部分 Harvard 原则谈判) | Schema 加 `shared_interest` / `objective_criterion` / `next_step` |
| P12 § 建议行动 | **RACI** | `ActionItem` 4 列必填 |
| P12 § 风险 (Premortem) | **Premortem (Klein)** | LangGraph 节点 8 并发 7 角色 |
| P09 决议录入 (AAR) | **After Action Review** | P09 表单 4 字段 + 权重调整建议 |
| 共识算法层 (防跟风) | 自研(启发自 Asch 实验 + Du et al. 2023) | `lib/consensus/trajectory-weighted-scoring.ts` |
