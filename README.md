# 议见 YiJian — Enterprise AI Consensus Formation System

> 企业 AI 共识形成系统:把"各说各话、反复扯皮"变成一次性可执行决策
>
> **企业 AI Agent 黑客松参赛项目**(赛题方向 B:协作沟通 Agent)

## 这是什么

**议见**把一份业务提案拆成"角色 × 事实 × 分歧 × 权重 × 证据链",输出**可复现、可解释、有方法论支撑**的决策结论。

不是普通的多 Agent 辩论室,而是工程化的**四层共识框架**:

```
L1 战略/目标共识  (OKR)
       ↓
L2 事实/证据共识  (证据链 + Issue Tree)
       ↓
L3 利益/角色共识  (Stakeholder Mapping × 7 角色)
       ↓
L4 权重/权责共识  (RACI + 5 决策类型动态权重)
       ↓
  TWS 轨迹加权评分(自研,启发自 Asch 实验)
       ↓
  Premortem 风险预想(P0 必做)
       ↓
  决策报告 7 部分
```

## 适用场景

电商运营选品提案(七夕大促 / 双 11 / 跨境新品 / 季度主推 ...)→ 多部门视角解读 → 识别关注点和分歧 → 形成结构化讨论框架 → 一次性拍板。

## 4 个 Demo 场景

| 场景 | 决策类型 | 演示焦点 |
|---|---|---|
| 小红书声量 A 款项链 | 选品 | 跨区域差异(东南亚 KOL 影响力低)|
| 七夕情侣对戒 | 选品 | 节奏冲突(海外 ≠ 七夕,日本 2/14)|
| 百万旗舰款 | 选品 | 财务 vs 品牌强冲突 |
| 跨境新品 | 跨境-区域 | 区域管理角色权重最高(1.5) |

## 7 角色 Persona

运营 / 商品 / 市场 / 财务 / 品牌 / 供应链 / **区域管理**

## 技术栈

- **前端**:Next.js 15 App Router · Tailwind 4 · shadcn/ui · Nivo HeatMap · Tremor · framer-motion · Lucide React
- **AI 编排**:LangGraph.js 0.4(9 节点主图)· AI SDK v6 · Vercel AI Gateway
- **LLM 降级链**:Anthropic Claude Opus 4.7 → Sonnet 4.6 → Haiku 4.5 → 离线规则
- **数据**:Drizzle ORM · Neon Postgres(混合 HTTP + WebSocket driver)· Upstash Redis · OpenAI text-embedding-3-small(1536d)
- **部署**:Vercel Fluid Compute(maxDuration=300s)

## 9 节点 LangGraph 主图

| 节点 | 任务 | 模型 |
|---|---|---|
| N1 结构化 + 决策类型识别 | 拆论点 + 识别 5 决策类型 | Haiku 4.5 |
| N2 L1 目标对齐 | 评估提案与公司目标的对齐度 | Haiku 4.5 |
| N3 L2 证据召回 | embedding + cosine top-12 | text-embedding-3-small |
| N4 Round 0 Blind First-Vote | 7 角色独立先发表(防 anchoring)| Sonnet 4.6 ×7 |
| N5 Round 1 伪并发 + Anchoring 检测 | 看 R0 后调整 + 立场翻转/cosine 检测 | Sonnet 4.6 ×7 |
| N6 TWS 轨迹加权评分 | 自研算法,纯计算 | — |
| N7 L4 权重加权 | 5×7 决策类型动态权重 | — |
| N8 Premortem | 7 角色集体预想失败原因 | Sonnet 4.6 ×7 |
| N9 决策报告生成 | 7 部分流式生成 | **Opus 4.7 streamObject** |

**P50 ≤ 67s · P99 ≤ 90s · 单次推理成本 ≈ $1.10**

## 风险护栏(8 面板 Safety Center)

降级链可见 / 数据脱敏 diff / 置信度统计 / 版本回滚 / HITL 接管(`interrupt()` + 5 分钟自动批准)/ 审计日志(SHA-256)/ **稳定性测试(3 并发复现,一致率 ≥ 67%)** / Prompt 透明度

## 项目文档结构

```
docs/
├── 比赛简介.md
├── 设计/                  ← 产品/技术规格(给人看,按页面拆)
│   ├── README.md          ← ❓ 待拍板汇总
│   ├── 01-product/        ← 产品定位 / 用户 / v2 方向
│   ├── 02-pages/          ← 12 页详细设计(P01-P12)
│   ├── 03-tech-direction/ ← 架构 / 算法 / 方法论 / 数据 / 安全 / 部署 / 选型
│   └── 04-rules/          ← 权限 / 数据生命周期 / 错误处理
├── 计划/                  ← 流水线产出
│   ├── 2026-05-23-collab-agent-ideation.md  ← Phase 1 创意
│   ├── 2026-05-23-collab-agent-ui.md        ← Phase 3 UI 设计(v2.2)
│   ├── 2026-05-23-collab-agent-api.md       ← Phase 4 API 设计(v2.3,57 端点 + 11 表 + 12 Zod schema)
│   └── 2026-05-23-collab-agent-plan.md      ← Phase 5 实施计划(P0-P8,~80 task)
└── pipeline/              ← 流水线元数据
    ├── state.yaml         ← 当前阶段
    ├── consistency-check.md ← 25 条红线
    └── env-capabilities.yaml ← 环境验证
```

> 注:实际目录用英文(`docs/design`、`docs/plans`),上表给出语义概览。

## 质量保证

经过 **3 轮 GAN 对抗审查 + 25 项修复**:
- GAN-A(业务/数据完整性):2 轮 V1→V2.2,修复 15+16 项
- GAN-B(技术真实性,WebSearch 验证):2 轮,修复 5 Blocker(模型 ID 点号格式 / KV→Upstash / 1536 维 / PostgresSaver / retry 字段)+ 5 High

**25 条红线** 持续扫描:模型 ID 格式 / 包名 / embedding 维度 / Schema 字段存在性 / 禁占位 / 禁 Mock / 禁降阶 / 禁过时 / 前端禁 emoji UI 等。

## 当前进度

- Phase 1 创意 ✅
- Phase 2 产品规格 ✅
- Phase 3 UI 设计 ✅(v2.2)
- Phase 4 API 设计 ✅(v2.3,25 项 GAN 修复完成)
- **Phase 5 实施计划 ✅**(本次刚完成,4660 行,~80 task)
- Phase 5.5 索引 + 规则 ⏳
- Plan GAN 审查 ⏳
- Phase 6 开发 — 未开始
- Phase 7 验证 — 未开始
- Phase 8 交付 — 未开始

## License

私有 / 黑客松参赛项目。

---

🤖 流水线由 [Claude Code](https://claude.com/claude-code) AutoDev 驱动生成
