# 架构方向(v2.1):Next.js 单体 + LangGraph 子图 + 证据引擎 + 共识算法层

> 🔥 **v2 升级 + v2.1 GAN 修订**:在 v1 基础上**新增证据引擎层 + 共识算法层 + 方法论模板库**。
> 具体框架/库选型见 [oss-scan.md](oss-scan.md)。
> 方法论详见 [methodology.md](methodology.md),共识算法详见 [consensus-algorithm.md](consensus-algorithm.md)。
>
> **v2.1 GAN 修**:
> - 节点数统一为 **8 主节点 + Premortem(P0 必做) = 共 9 节点**(原文档 3 处数字不一致已修复)
> - **Premortem 改为 P0 必做**(原"可选"违反红线 3 降阶,因为 P12 决策报告第 5 部分依赖它)
> - 端到端 SLA 从"≤ 60s"改为"**P50 ≤ 67s, P99 ≤ 90s**"(基于真实算力账)
> - 证据引擎 P0 从 sqlite-vec 改为 **in-memory JSON + cosine**(Vercel Serverless 无持久化)

## 决策

**最终选了**:**Next.js 15 App Router 单体应用 + LangGraph.js 主图(8 主节点 + Premortem = 9 节点)+ 证据引擎子模块 + 共识算法子模块**。

**为什么(v2 新增)**:
- 证据引擎和共识算法都需要与 LangGraph 节点紧耦合(每个角色推理节点都要拿证据 + 走 TWS 轨迹加权评分(自研)),拆成独立服务会引入跨网络延迟
- 方法论模板库(L1-L4 prompt templates)就是一组 markdown 文件 + Zod schema,无需独立服务

## v2 架构总览

```
┌─────────────────────────────────────────────────────────────────┐
│  Browser                                                         │
│   ↓                                                              │
│  Next.js UI (RSC + shadcn + Nivo + framer)                      │
│   ↓ Route Handlers (streaming SSE)                              │
│  app/api/{analyze, evidence, consensus, reproducibility}/route  │
│   ↓                                                              │
│  ┌─ LangGraph 主图 (lib/graph/consensus-graph.ts) ────────────┐ │
│  │                                                             │ │
│  │  1. 提案解构 + 决策类型识别                                 │ │
│  │     ↓                                                       │ │
│  │  2. L1 目标对齐 (methodology.md § L1)                       │ │
│  │     ↓                                                       │ │
│  │  3. L2 证据召回 (调 evidence-engine)                        │ │
│  │     ↓                                                       │ │
│  │  4. Round 0: Blind First-Vote (Send API 并发 7 角色)        │ │
│  │     ↓                                                       │ │
│  │  5. Round 1: 二轮调整 + Anchoring 检测                     │ │
│  │     ↓                                                       │ │
│  │  6. TWS(自研轨迹加权评分) 共识评分 + L4 权重加权                        │ │
│  │     ↓                                                       │ │
│  │  7. Premortem (并发 7 角色)                                │ │
│  │     ↓                                                       │ │
│  │  8. 决策报告生成 (7 部分)                                  │ │
│  │                                                             │ │
│  │  [interrupt() HITL checkpoint] 任意步均可暂停人工接管       │ │
│  └─────────────────────────────────────────────────────────────┘ │
│        ↓                            ↓                            │
│  ┌─ Evidence Engine ──┐  ┌─ Consensus Algorithm ──────────────┐ │
│  │ lib/evidence/      │  │ lib/consensus/                     │ │
│  │ - source-registry  │  │ - trajectory-weighted-scoring.ts   │ │
│  │ - fixture-loader   │  │   (TWS,自研,启发自 MAD 文献)     │ │
│  │ - in-memory-index  │  │ - attitude.ts (4 档锁定表)         │ │
│  │   (cosine,P0)     │  │ - anchoring-detector.ts            │ │
│  │ - citation-builder │  │ - weight-calculator.ts (L4 权重)   │ │
│  │ - pgvector-client  │  │ - reproducibility-runner.ts        │ │
│  │   (V2)             │  │                                    │ │
│  └────────────────────┘  └────────────────────────────────────┘ │
│        ↓                            ↓                            │
│  ┌─ AI Gateway (lib/llm/gateway.ts) ─────────────────────────┐ │
│  │  Opus 4.7 → Sonnet 4.6 → Haiku 4.5 → 离线规则             │ │
│  └────────────────────────────────────────────────────────────┘ │
│                                                                  │
│  ┌─ 方法论模板库 (lib/methodology/) ─────────────────────────┐ │
│  │ - l1-objective-templates.ts (OKR — P0)                    │ │
│  │ - l2-evidence-templates.ts (证据召回 prompt)              │ │
│  │ - l3-stakeholder-templates.ts (Stakeholder Mapping — P0)  │ │
│  │ - l4-weight-templates.ts (RACI — P0)                      │ │
│  │ - premortem-template.ts (Premortem — P0 必做)             │ │
│  │ - aar-template.ts (After Action Review — P0)              │ │
│  │ - p0-objective-fixtures.ts (5 条公司目标示范数据)         │ │
│  └────────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────────┘
         ↓ 持久化层
┌──────────────────────────────────────────────────────────────────┐
│  Drizzle ORM → Neon Postgres                                     │
│   persona(v2: + interest_boundary, natural_conflicts)           │
│   proposal(v2: + decision_type, declared_objective_id)          │
│   analysis_version                                               │
│   decision(v2: + aar_template_data)                              │
│   audit_log                                                      │
│   【v2 新表】internal_objectives (公司级目标库)                   │
│   【v2 新表】evidence_sources / evidence_cards                    │
│   【v2 新表】reproducibility_runs (稳定性测试结果)                │
└──────────────────────────────────────────────────────────────────┘
```

## v2 新增模块说明

### 证据引擎(`lib/evidence/`)

- **职责**:统一管理内外部数据源 + 召回相关证据 + 构建 citation 元数据
- **P0**:从 fixture JSON 读取(4 个场景预置数据 + 2-3 个共享证据池)
- **V2**:接入飞书 OpenAPI / ERP / 公开 API
- **关键设计**:Agent 推理时**只能从已召回的证据集中选用**,无法凭空捏造引用

### 共识算法引擎(`lib/consensus/`)

- **职责**:实现 Blind First-Vote / Anchoring 检测 / TWS 轨迹加权评分(自研) / L4 权重加权 / 稳定复现测试
- 见 [consensus-algorithm.md](consensus-algorithm.md) 详细算法

### 方法论模板库(`lib/methodology/`)

- **职责**:把 L1-L4 + Premortem + AAR 等方法论变成可注入的 prompt template
- 每个 template 都有对应测试 fixture(验证 LLM 输出包含预期关键词)

### 数据接入(P0 仅 fixture)

为了不让黑客松 P0 卡在数据接入上,**P0 阶段:**
- 4 个 Demo 场景的 fixture JSON 包含完整证据池
- 演示"接入飞书"的样子(UI 可见菜单,但点击显示"V2 即将支持,目前用模拟数据")

## v2 选项对比(新增证据引擎层)

| 选项 | 优点 | 缺点 | 适合 |
| --- | --- | --- | --- |
| **A. 证据引擎内嵌(选了)** | 与 LangGraph 节点零延迟 / Demo 简单 | 与主程序共享内存 / 大规模时受限 | 黑客松 + SaaS MVP |
| B. 独立证据微服务 | 可扩展 / 多产品复用 | 跨网络延迟 / 部署复杂 | 真生产长期 |
| C. 现成 RAG 框架(LlamaIndex / LangChain Retriever) | 开箱即用 | 与现有 LangGraph 重复 / 学习成本 | 复杂检索需求 |

## v2.1 选这个的代价

- LangGraph 主图节点数从 4 涨到 **9 节点(8 主 + Premortem,Premortem v2.1 已改 P0 必做)** → 端到端延迟 P50 44-67s / P99 90s(详见 [consensus-algorithm.md § 5 性能预算表](consensus-algorithm.md))
  - **对策**:Demo 期间用四层共识进度条 + 9 节点详细进度条双层显示,把延迟包装为专业感(进度条逐步推进 + 角色"思考中"状态)
- 证据引擎 P0 用 fixture(in-memory JSON + cosine)→ Demo 时主动声明"V2 真接飞书/ERP,P0 模拟"
- 稳定复现测试如果默认开启 → 每次推理成本 × 3 → **默认关闭,Demo 时主动开**

## v2.1 ❓ 需你拍板

- 是否接受 Demo 期间稳定复现走"预录视频" vs "真跑 3 次"?— 推荐**预录**(节省演讲时间,且 67% 一致率可靠)— 详见 [consensus-algorithm.md § 4](consensus-algorithm.md)
- ~~Premortem 可选~~ (v2.1 已决定:**P0 必做**,因为 P12 § 风险依赖它)
- ~~L1 + 决策类型合并~~ (v2.1 已决定:**保持分开**,Demo 演示语义更清晰)
