# 开源方案扫描清单

> 🔥 **v2 升级(2026-05-23)**:在 v1 11 个 R 能力基础上,**新增 R12-R15 共 4 个能力**(证据引擎 / 共识算法 / IM bot / 方法论模板)。详见末尾"v2 新增能力"章节。



> 用途:每个必需能力(R 编号)的"复用 vs 自研"决策依据。
> 默认立场:**优先复用 + 许可证友好 + 近期活跃**,自研需在对应章节填写差距理由。

---

## R1: 提案文本摄入与解构

**关键词**:`structured output zod schema LLM`

### 候选方案

| 名称 | Stars | 最近活跃 | License | 适配度 | 集成成本 | 链接 |
| --- | --- | --- | --- | --- | --- | --- |
| **Vercel AI SDK v6 `generateObject` + Zod** | 16k+ | 2026-Q2 | Apache-2.0 | **5/5** | low | [github.com/vercel/ai](https://github.com/vercel/ai) |
| Instructor(Python 主) | 11k+ | 活跃 | MIT | 4/5 | medium | [github.com/instructor-ai/instructor](https://github.com/instructor-ai/instructor) |
| LangChain structured output | 100k+ | 活跃 | MIT | 4/5 | medium | LangChain |

### 推荐

**优先选用:AI SDK v6 `generateObject` + Zod schema**。Next.js 原生集成、TS 生态、与 R7(AI Gateway)同栈零额外配置。

---

## R2: 角色 Persona 管理

**关键词**:`persona management CRUD`(标准 CRUD,无需专用框架)

### 推荐

**自研,理由**:这是普通的应用层数据(name / goal / KPI / risk_appetite / catchphrase / decisions[]),用 Drizzle ORM + Zod 即可,无需独立框架。

---

## R3: 多视角并发推理

**关键词**:`multi-agent role-playing framework 2026`

### 候选方案

| 名称 | Stars | 最近活跃 | License | 适配度 | 集成成本 | 链接 |
| --- | --- | --- | --- | --- | --- | --- |
| **LangGraph 0.4**(JS/TS 版) | 12k+ | 2026 活跃 | MIT | **5/5** | medium | [github.com/langchain-ai/langgraphjs](https://github.com/langchain-ai/langgraphjs) |
| CrewAI | 26k+ | 活跃 | MIT | 4/5 | medium | [github.com/crewAIInc/crewAI](https://github.com/crewAIInc/crewAI) (Python 主) |
| AutoGen | 35k+ | **maintenance mode** | MIT | 3/5 | high | 已转 MS Agent Framework |
| Mastra | 5k+ | 2026 活跃 | Apache-2.0 | 4/5 | low | TS 原生 Agent 框架 |

### 推荐

**优先选用:LangGraph.js 0.4**。
- 内置 Send API 支持节点级并发(完美匹配"6 角色对 N 论点并行打分")
- 内置 `interrupt()` checkpointer(直接复用到 R10 HITL,**双能力一栈搞定**)
- TS/Node 生态完备
- AutoGen 已 maintenance mode 淘汰

**淘汰**:AutoGen(maintenance mode)、CrewAI(Python 主,与 Next.js 同进程不友好)

---

## R4: 分歧聚合与可视化(矩阵 + 热力图)

**关键词**:`react heatmap matrix visualization 2026`

### 候选方案

| 名称 | Stars | 最近活跃 | License | 适配度 | 集成成本 | 链接 |
| --- | --- | --- | --- | --- | --- | --- |
| **Nivo `HeatMap`** | 13k+ | 2026 活跃 | MIT | **5/5** | low | [nivo.rocks/heatmap](https://nivo.rocks/heatmap) |
| Visx(D3 primitive) | 19k+ | 2026 活跃 | MIT | 4/5 | medium | [airbnb.io/visx](https://airbnb.io/visx) |
| Tremor | 16k+ | 2026 活跃 | Apache-2.0 | 3/5(无原生 heatmap) | low | [tremor.so](https://tremor.so) |
| Recharts v3 | 24k+ | 活跃 | MIT | 2/5(**无 heatmap**) | low | [recharts.org](https://recharts.org) |

### 推荐

**优先选用:Nivo HeatMap** 用于分歧矩阵核心视图。
- 原生 heatmap + 自定义 cell renderer(支持 hover citation popover)
- SVG 渲染,清晰锐利,Demo 截图友好
- Recharts 在 2026 仍无 heatmap 能力

**辅助**:其他基础图表(柱/线)用 Tremor(SaaS 风格默认值,省样式工作)。

---

## R5: 讨论框架生成

**关键词**:`agenda generation LLM`(纯 prompt 工程 + R1 同栈)

### 推荐

**自研 prompt + 复用 AI SDK `generateObject`**。无需额外框架。

---

## R6: 会议决议沉淀

**关键词**:`CRUD with versioning`

### 推荐

**自研,基于 Drizzle ORM + 版本字段**。

---

## R7: LLM 编排与降级链

**关键词**:`LLM gateway provider fallback routing 2026`

### 候选方案

| 名称 | 形态 | License | 适配度 | 集成成本 | 链接 |
| --- | --- | --- | --- | --- | --- |
| **Vercel AI Gateway** | 托管服务 | 商业(免费额度) | **5/5** | very low | [vercel.com/docs/ai-gateway](https://vercel.com/docs/ai-gateway) |
| OpenRouter | 托管服务 | 商业 | 4/5 | low | openrouter.ai |
| LiteLLM | 自托管 Python proxy | MIT | 4/5 | high | [litellm.ai](https://litellm.ai) |
| Portkey | 托管 / 自托管 | MIT(SDK) | 4/5 | medium | portkey.ai |

### 推荐

**优先选用:Vercel AI Gateway + AI SDK v6 providerOptions**。
- 在 AI SDK 内 `providerOptions.gateway` 即可配 `order / only / sort` 实现自动 failover(2026-02-09 起官方支持)
- string model ID(`"anthropic/claude-opus-4-7"`)直接走 Gateway,无额外集成
- 与 R1/R3/R5/R8 同栈

---

## R8: 数据脱敏与还原

**关键词**:`PII redaction typescript javascript 2026`

### 候选方案

| 名称 | 形态 | License | 适配度 | 集成成本 | 链接 |
| --- | --- | --- | --- | --- | --- |
| Microsoft Presidio | Python lib | MIT | 4/5(但 Python 栈) | high(跨进程) | [github.com/microsoft/presidio](https://github.com/microsoft/presidio) |
| Protecto | 商业 SaaS / 自托管 | 商业 | 5/5 | medium | protecto.ai |
| Private AI | 商业 SaaS | 商业 | 5/5 | medium | private-ai.com |
| GLiNER zero-shot | LLM-based(可在 AI SDK 内做) | MIT | 4/5 | low | github.com/urchade/GLiNER |

### 推荐

**自研 + LLM 兜底,理由**:
- JS/TS 生态没有 Presidio 级别的成熟方案
- 黑客松场景:**轻量正则白名单**覆盖珠宝零售常见敏感字段(SKU 成本/供应商名/客户名/手机号/邮箱/价格区间),配 **LLM 兜底**(用 Haiku 4.5 做 zero-shot 检测,成本极低)
- 关键产出 **diff 视图**(W4 Safety Center) — Presidio 没现成 UI,自研无 UI 包袱
- 若赛后产品化,可平滑替换为 Protecto / Private AI(接口预留)

---

## R9: 可追溯输出

**关键词**:`LLM citation metadata schema`

### 推荐

**自研,基于 Zod schema 强制 citation 字段**(每条 finding 必须带 `source_text` + `source_persona_rule`)。AI SDK `generateObject` 自动校验。无独立框架。

---

## R10: 输出可靠度护栏(置信度 + HITL + 回滚)

**关键词**:`langgraph human in the loop interrupt checkpoint 2026`

### 候选方案

| 名称 | 形态 | License | 适配度 | 集成成本 | 链接 |
| --- | --- | --- | --- | --- | --- |
| **LangGraph `interrupt()` + checkpointer** | 与 R3 同栈 | MIT | **5/5** | low(与 R3 复用) | LangGraph |
| Inngest 工作流 | 商业 / 开源 | Apache-2.0 | 4/5 | medium | inngest.com |
| Temporal | 自托管 / 商业 | MIT | 5/5(过重) | high | temporal.io |

### 推荐

**优先选用:LangGraph `interrupt()` + `PostgresSaver`(生产,**配 Neon WebSocket driver**)/ MemorySaver(Demo)**。
**v2.3 GAN-B 修**:正确包名是 `@langchain/langgraph-checkpoint-postgres` 导出的 `PostgresSaver`(非 AsyncPostgresSaver),且必须用 Neon WebSocket 协议(`@neondatabase/serverless` 的 `Pool`),HTTP driver 不支持 PostgresSaver 需要的事务/prepared statement。
- 与 R3 同栈零额外集成
- 内建版本回放(checkpoint 是天然的版本号),直接支撑"回滚到上一版"
- 置信度评分:自研(在 Zod schema 强制 `confidence` 字段)

---

## R11: 表达压缩护栏

**关键词**:`prompt summarization template`(纯 prompt 工程)

### 推荐

**自研 prompt 模板,在 AI SDK system prompt 中强制**:`output.summary` 必须 ≤3 句、`output.headline_conflict` 必须 ≤1 句,通过 Zod schema 长度校验。

---

## 汇总:复用 vs 自研

| R | 决策 | 主选方案 |
| --- | --- | --- |
| R1 解构 | 复用 | AI SDK v6 `generateObject` + Zod |
| R2 Persona | 自研 | Drizzle + Zod |
| R3 多 Agent | **复用** | LangGraph.js 0.4 |
| R4 可视化 | **复用** | Nivo HeatMap + Tremor |
| R5 议程生成 | 自研 | prompt + AI SDK |
| R6 决议沉淀 | 自研 | Drizzle |
| R7 LLM 编排 | **复用** | Vercel AI Gateway |
| R8 数据脱敏 | 自研 + LLM 兜底 | 正则白名单 + Haiku 4.5 |
| R9 可溯源 | 自研(schema 层) | Zod 强制字段 |
| R10 HITL/回滚 | **复用** | LangGraph `interrupt()` + checkpointer |
| R11 压缩护栏 | 自研 prompt | system prompt + Zod 长度校验 |

**复用率:5/11(45%)**,符合"开源优先 + 自研需理由"的红线 5。

---

## 技术栈最终构成(v2)

```
Frontend:  Next.js 15 App Router + Tailwind 4 + shadcn/ui + Nivo + Tremor + framer-motion
Backend:   Next.js Route Handlers + LangGraph.js 0.4 + AI SDK v6 + AI Gateway + Drizzle ORM
LLM:       Opus 4.7 → Sonnet 4.6 → Haiku 4.5 → 离线规则
Evidence:  内置 fixture loader + **in-memory JSON + cosine(P0,< 200 条)** / **Neon pgvector(V2)**
Consensus: 自研 lib/consensus(TWS(自研轨迹加权评分) + Blind First-Vote + Anchoring 检测 + 复现测试)
IM Bot:    暂不实现(V2 路线图,P08 提及)
Storage:   Neon Postgres + Drizzle ORM(v2 新表:internal_objectives, evidence_sources, evidence_cards, reproducibility_runs)
Deploy:    Vercel(Fluid Compute 默认 300s)
```

---

## v2 新增能力(R12-R15)

### R12: 证据/数据引擎

**关键词**:`embedding search retrieval RAG enterprise 2026`

| 名称 | Stars | 适配度 | 集成成本 | 链接 |
| --- | --- | --- | --- | --- |
| **AI SDK v6 + 自研轻量 retriever** | — | 5/5 | low | 与 R1/R7 同栈 |
| LlamaIndex.TS | 2k+ | 4/5 | medium | llamaindex.ai |
| LangChain Retriever | 同 R3 | 4/5 | medium | LangChain |
| **in-memory JSON + cosine(P0)** | — | 5/5 (P0) | very low | 自研 ~50 行 |
| **Neon pgvector(V2)** | 官方 extension | 5/5 (V2) | low | neon.tech/docs/extensions/pgvector |
| ~~sqlite-vec~~ | ~~4k+~~ | ~~Vercel serverless 无持久化~~ | ~~高~~ | ~~已废弃~~ |

**推荐(v2.1 GAN-B 修)**:**自研轻量 retriever**(`lib/evidence/retriever.ts`),用 OpenAI 或 Voyage embedding(经 AI Gateway):
- **P0**:fixture JSON 启动时一次性加载到 in-memory + cosine similarity(< 200 条直接遍历 < 5ms)
- **V2**:数据量上去后切 **Neon pgvector**(Neon 原生支持 pgvector extension)
- **理由**:原 sqlite-vec 方案在 Vercel Fluid Compute serverless 下无法持久化(只读 fs + /tmp 易失);in-memory JSON 在 P0 数据量下性能更好、零部署成本。详见 [architecture.md § v2.1 GAN 修](architecture.md)。

### R13: 共识算法(TWS(自研轨迹加权评分) + Blind First-Vote + Anchoring + 复现测试)

**关键词**:`multi-agent debate consensus reproducibility 2026`

| 名称 | 形态 | 适配度 | 集成成本 | 链接 |
| --- | --- | --- | --- | --- |
| **自研 lib/consensus** | — | 5/5 | medium | — |
| AutoGen GroupChat | Python 库 | 3/5 | high(语言鸿沟) | maintenance mode |
| CrewAI Consensus Process | Python 库 | 3/5 | high | Python 主 |
| Hermes Agent Consensus Engine | 早期项目 | 2/5 | high | hermes-agent |

**推荐**:**自研**。理由:
- **TWS 是自研算法**(启发自 Du et al. 2023 multi-agent debate / Asch 一致性实验 / MAD-Bench),无对应开源实现 — 自研可作为产品的"学术深度"卖点
- Blind First-Vote / Anchoring 检测都是产品级业务逻辑,无通用框架
- 总代码量预计 < 500 行 TS,自研可控

### R14: IM Bot(飞书 / 微信)

**关键词**:`feishu wecom bot SDK 2026 typescript`

| 名称 | 形态 | 适配度 | 集成成本 | 链接 |
| --- | --- | --- | --- | --- |
| 飞书 OpenAPI Node SDK | 官方 SDK | 5/5(V2) | medium | open.feishu.cn |
| WeCom 企业微信 Node SDK | 第三方 | 4/5(V2) | high | — |
| 自建 Webhook 网关 | 自研 | 4/5 | medium | — |

**推荐**:**V2 才做。P0 阶段不实现,在 P08 评审视角对照页提及作为 V2 路线图即可。** 黑客松 72h 内做 IM 集成 ROI 低。

### R15: 方法论模板库

**关键词**:`prompt template management 2026`

**推荐**:**自研** `lib/methodology/`,纯 TypeScript 文件 + Zod schema。无需框架。每个方法论模板:
- 一个 `.ts` 文件
- 导出 `template`(string)+ `expectedKeywords`(测试 fixture)+ `outputSchema`(Zod)

---

## v2 复用 vs 自研更新表

| R | 决策 | 主选方案 |
| --- | --- | --- |
| R1 解构 | 复用 | AI SDK v6 `generateObject` + Zod |
| R2 Persona | 自研 | Drizzle + Zod(v2 加 interest_boundary 字段) |
| R3 多 Agent | **复用** | LangGraph.js 0.4 |
| R4 可视化 | **复用** | Nivo HeatMap + Tremor |
| R5 议程生成 | 自研 → v2 升级为决策报告生成 | prompt + AI SDK |
| R6 决议沉淀 | 自研 → v2 升级为 AAR | Drizzle |
| R7 LLM 编排 | **复用** | Vercel AI Gateway |
| R8 数据脱敏 | 自研 + LLM 兜底 | 正则 + Haiku 4.5 |
| R9 可溯源 | 自研(schema) | Zod 强制字段 |
| R10 HITL/回滚 | **复用** | LangGraph `interrupt()` + checkpointer |
| R11 压缩护栏 | 自研 prompt | system prompt + Zod 长度校验 |
| **R12 证据引擎(v2)** | 自研 + **in-memory JSON(P0)** / **Neon pgvector(V2)** | embedding + cosine 检索 |
| **R13 共识算法(v2)** | **自研**(学术深度卖点) | TWS(自研轨迹加权评分) + Blind First-Vote + 复现测试 |
| **R14 IM Bot(v2)** | 推迟 V2 | 飞书 / 微信 |
| **R15 方法论模板(v2)** | 自研 | 纯 TS + Zod |

**v2 复用率:5/15 = 33%**(下降),自研增多但都是产品差异化核心(共识算法 / 方法论 / 证据引擎)。符合"开源优先 + 自研需理由"红线 5。
