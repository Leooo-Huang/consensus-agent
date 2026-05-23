# 议见 YiJian — API 设计(v2.2 Phase 4 产出)

> **基于**:`docs/design/`(v2.2 全部修复完成,12 页 + 03-tech-direction 9 文档)+ `docs/plans/2026-05-23-collab-agent-ui.md`(v2.2)
> **产出版本**:Phase 4 v1.0(2026-05-23)
> **作者**:autodev-api 流水线
> **下游**:Phase 5 Planning(将基于本文档生成 plan.md + Drizzle migrations + Route Handlers 实现任务)

## 0. 概览

### 0.1 输入摘要(已锁定决策,1:1 实现)

| 锁定项 | 值 | 来源 |
|---|---|---|
| **态度 4 档** | `support:+1.0 / conditional:+0.5 / insufficient:0.0 / oppose:-1.0` | [consensus-algorithm.md §4 档态度分映射](../design/03-tech-direction/consensus-algorithm.md) |
| **7 角色** | 运营 / 商品 / 市场 / 财务 / 品牌 / 供应链 / 区域管理 | [personas.md](../design/01-product/personas.md) |
| **5 决策类型** | 选品 / 营销 / 预算 / 经营 / 跨境-区域 | [methodology.md L4 权重表](../design/03-tech-direction/methodology.md) |
| **9 LangGraph 节点** | N1 结构化+决策类型 → N2 L1 目标对齐 → N3 L2 证据召回 → N4 Round 0 → N5 Round 1 → N6 TWS → N7 L4 权重 → N8 Premortem → N9 报告生成 | [architecture.md](../design/03-tech-direction/architecture.md) |
| **稳定性测试** | 3 次并行 (T=0.3/0.4/0.5,seed=42/84/126),阈值 ≥ 67% | [consensus-algorithm.md §4](../design/03-tech-direction/consensus-algorithm.md) |
| **证据引擎** | P0 in-memory JSON + cosine(<200 条);V2 Neon pgvector | [data-strategy.md](../design/03-tech-direction/data-strategy.md) |
| **ZDR API** | `providerOptions.gateway.zeroDataRetention: true` | [security-model.md](../design/03-tech-direction/security-model.md) |
| **P50/P99** | 67s / 90s,Vercel maxDuration=300s(3× 余量) | [consensus-algorithm.md §5](../design/03-tech-direction/consensus-algorithm.md) |

### 0.2 API 总体架构

```
┌────────────────────────────────────────────────────────────────────┐
│  浏览器                                                              │
│   ↓ fetch/EventSource                                                │
│  Next.js 15 App Router(单体)                                        │
│   ├─ Server Components(P08 SSR / P10 列表 / P05 卡片首屏)          │
│   ├─ Server Actions(P02 草稿 / P05 编辑 / P09 决议录入,RSC mutation) │
│   └─ Route Handlers(全部数据 API + SSE 流)                          │
│        ↓                                                             │
│   ┌─ /api/analyze(SSE,主流式入口,maxDuration=300s)──────────┐    │
│   │   驱动 LangGraph 9 节点 → 实时发送 SSE 事件 → 回填 DB        │    │
│   └────────────────────────────────────────────────────────────┘    │
│        ↓                                                             │
│   ┌─ /api/reproducibility-check(SSE 聚合,客户端并发 3 次/api/analyze)│
│   └────────────────────────────────────────────────────────────┘    │
│        ↓                                                             │
│   ┌─ 其余 REST 端点(60+)                                       ┐    │
│   │   /api/proposals / /api/personas / /api/objectives / ...   │    │
│   │   /api/evidence/* / /api/audit-logs / /api/hitl/* / ...    │    │
│   └────────────────────────────────────────────────────────────┘    │
│        ↓                                                             │
│   lib/llm/gateway.ts(集中 AI SDK v6 + Gateway 配置 + ZDR + fallback)│
│   lib/evidence/retriever.ts(in-memory cosine,P0)                    │
│   lib/consensus/*.ts(TWS / Anchoring / weight)                      │
│   lib/methodology/*.ts(L1-L4 + Premortem + AAR templates)           │
│   lib/db/(Drizzle + Neon Postgres)                                  │
└────────────────────────────────────────────────────────────────────┘
```

### 0.3 端点数量分布

| 类别 | 数量 | 主要页面 |
|---|---|---|
| **SSE 流式** | 2 | `/api/analyze`, `/api/reproducibility-check` |
| **REST GET** | 27 | 列表 / 详情 / 状态 / 导出 |
| **REST POST** | 14 | 创建 / 触发动作 |
| **REST PATCH** | 9 | 局部编辑(覆盖结论 / 权重 / 行动项 / Owner) |
| **REST DELETE** | 1 | 软删除提案 |
| **Server Action** | 4 | RSC mutation(P02 草稿 / P05 编辑 / P09 决议提交 / P12 fork) |
| **合计** | **57** | 覆盖 P01-P12(P08 纯 SSR) |

---

## 1. API 约定

### 1.1 全局规则

- **协议**:HTTPS(Vercel 自动 TLS)
- **数据格式**:`application/json; charset=utf-8`(SSE 端点除外)
- **URL 命名**:小写复数名词 + kebab-case(`/api/proposals`、`/api/audit-logs`、`/api/reproducibility-check`)
- **资源层级**:最多 2 级(`/api/analysis-versions/:id/decision-report`,不再深嵌)
- **时间**:全部 ISO 8601 UTC(`2026-05-23T03:14:15.000Z`)
- **ID**:UUID v4 字符串(`gen_random_uuid()` Postgres 生成)
- **分页**:cursor 模式(`?cursor=…&limit=…`),返回 `{ items, next_cursor }`
  - 默认 `limit=20`,上限 `limit=100`
  - 列表端点 100% 强制分页(防 P10 历史页 N+1 加载)

### 1.2 统一响应包装

成功(2xx):

```json
{
  "data": { ... }      // 单资源 → 对象;列表 → { items: [...], next_cursor: "..." }
}
```

失败(4xx/5xx):

```json
{
  "error": {
    "code": "PROPOSAL_TOO_SHORT",          // 语义化错误码,见 §9
    "message": "提案至少 50 字",            // 给开发者看,前端不直接展示
    "user_message": "提案过短,至少 50 字",  // 给用户看的本地化文案
    "field": "text",                       // 可选,字段级错误时填
    "recoverable": true                    // 客户端是否可重试
  },
  "request_id": "req_..."                  // 与 Sentry 关联
}
```

### 1.3 SSE 端点约定

仅 `/api/analyze` 和 `/api/reproducibility-check`。响应 header:

```
Content-Type: text/event-stream; charset=utf-8
Cache-Control: no-cache, no-transform
Connection: keep-alive
# v2.3 GAN-B H-B-2 修:移除 `X-Accel-Buffering: no`(nginx 专用头,Vercel 边缘网络不使用 nginx,此头无效)
```

事件格式(标准 SSE):

```
event: node:start
data: {"node_id":"N4","node_name":"Round 0 Blind First-Vote","started_at":"2026-05-23T03:14:15.000Z"}

event: persona:vote
data: {"round":0,"persona_id":"per_finance","attitude":"oppose","confidence":0.84,"reason_preview":"ROI..."}

event: error
data: {"code":"LLM_TIMEOUT","message":"…","recoverable":true}

event: done
data: {"total_duration_ms":67234}
```

完整事件类型见 §6。客户端用 `EventSource` 监听,断线后重连用 `Last-Event-ID` 头恢复(LangGraph checkpoint 保证幂等)。

### 1.4 HTTP 方法语义

| 方法 | 用途 | 幂等 | 备注 |
|---|---|---|---|
| GET | 读 | ✅ | 永不修改数据 |
| POST | 创建 / 触发不可幂等动作 | ❌ | `/api/analyze` 启动新推理 |
| PATCH | 局部更新 | ✅ | 用 If-Match ETag 防并发覆盖(P12 权重调整) |
| DELETE | 软删除 | ✅ | 真删走管理员后台,P0 不暴露 |

### 1.5 速率限制(P0 Demo)

| 端点 | 限制 | 理由 |
|---|---|---|
| `POST /api/analyze` | 2 req/min/IP | 单次 ~24 LLM 调用,防滥用 |
| `POST /api/reproducibility-check` | 1 req/min/IP | 等效 6 RPM Anthropic |
| `POST /api/evidence/search` (embedding) | 10 req/min/IP | 防 Demo URL 被刷 |
| `GET /api/proposals`, `GET /api/audit-logs` 等查询 | 60 req/min/IP | 通用 |
| 其余 PATCH / POST | 30 req/min/IP | |

实现:**Upstash Redis(`@upstash/redis` + `@upstash/ratelimit`)**的令牌桶,超限返回 `429 RATE_LIMIT_EXCEEDED` + `Retry-After` 头。
**v2.3 GAN-B 修**:`@vercel/kv` 已于 2024-12 下线,新项目无法创建 Vercel KV 实例,**统一改用 Upstash Redis(Vercel Marketplace 集成)**。

### 1.6 请求 / 响应大小

- 请求体上限:`1 MB`(提案文本 5000 字 ≈ 30 KB,绰绰有余)
- 响应体上限:`5 MB`(decision_report 全量 ≈ 200 KB,留足余量)
- 文件上传(P02 .md/.txt):上限 `1 MB`,大于则 `413 PAYLOAD_TOO_LARGE`

### 1.7 字符集与本地化

- 内部存储:UTF-8
- `user_message` 字段:简体中文(P0 单一语言)
- 错误码 `code`:大写 SCREAMING_SNAKE_CASE 英文(机器消费)

### 1.8 红线 — API 设计禁止项

| 禁止 | 应该 |
|---|---|
| 用 emoji 表达态度 / 状态 | 用枚举字符串(`"support"` / `"oppose"`),前端渲染时映射 Lucide icon |
| 端点返回 LLM 原始字符串无 Schema | 全部用 Zod `streamObject` 强约束,Schema 失败 LangGraph 自动重试 |
| `allowProviderRetention` | 用 `zeroDataRetention: true`(已锁) |
| 把 3 次复现串行在单 Route Handler | 客户端并发 3 次独立 `/api/analyze` |
| 把 LLM 输出直接渲染 | 必须经 Zod 校验 + `citations.min(1)` 才算有效 |

---

## 2. 数据模型(11 张表)

### 2.1 通用约定

每张表都有:
- `id: uuid` 主键,Postgres `gen_random_uuid()` 默认
- `created_at: timestamptz` 默认 `now()`
- `updated_at: timestamptz`(可写表才有)
- `schema_version: integer default 1`(便于未来迁移)
- 软删除字段 `deleted_at: timestamptz | null`(仅 `proposals` 表)

### 2.2 表清单总览

```
┌─ 平台层(系统配置 / 共享数据) ────────────────────┐
│ 1. personas               7 角色,默认值锁定 + 用户可编辑       │
│ 2. internal_objectives    L1 公司目标库,5 条 P0 fixture       │
│ 3. evidence_sources       证据源注册表                          │
│ 4. evidence_cards         证据卡片(含 embedding,P0 全内存)    │
└──────────────────────────────────────────────────┘
┌─ 业务层(提案 / 推理 / 决议) ──────────────────────┐
│ 5. proposals              提案主表(含 decision_type / L1)     │
│ 6. analysis_versions      单次推理快照(immutable append-only) │
│ 7. decisions              决议(AAR 模板,immutable)            │
└──────────────────────────────────────────────────┘
┌─ 运行时层(中间状态 / 审计) ────────────────────────┐
│ 8. hitl_audit             HITL 接管审计(LangGraph 4 张 checkpoint 表由 PostgresSaver 自管,不在 Drizzle)│
│ 9. audit_logs             审计日志(永不删,SHA-256 hash)       │
│10. reproducibility_runs   稳定性测试结果                        │
│11. provider_events        LLM 降级事件流(P07 面板 1)            │
└──────────────────────────────────────────────────┘
```

### 2.3 实体详细 Schema

> 下面用 Drizzle ORM TypeScript 表达(可直接落到 `lib/db/schema.ts`)。Zod 表达版在 §4。

#### 2.3.1 personas

> 来源:P05 角色工坊,P02 角色选择,methodology.md L3 Stakeholder Mapping

```typescript
// lib/db/schema/personas.ts
import { pgTable, uuid, text, jsonb, integer, timestamp, pgEnum } from "drizzle-orm/pg-core";

export const roleTypeEnum = pgEnum("role_type", [
  "operations", "products", "marketing", "finance",
  "brand", "supply_chain", "regional",
]);

export const riskAppetiteEnum = pgEnum("risk_appetite", [
  "conservative", "neutral", "aggressive",
]);

export const personas = pgTable("personas", {
  id: uuid("id").primaryKey().defaultRandom(),
  role_type: roleTypeEnum("role_type").notNull().unique(),  // 7 角色枚举,unique 防重
  name: text("name").notNull(),                              // "运营"
  objective: text("objective").notNull(),                    // 业务目标
  kpis: jsonb("kpis").$type<string[]>().notNull(),           // ["转化率", "ROAS"]
  interest_boundary: text("interest_boundary").notNull(),    // "不超预算 / 不爆库存"
  natural_conflicts: jsonb("natural_conflicts").$type<string[]>().notNull(),
                                                             // ["finance", "supply_chain"]
  decision_catchphrase: text("decision_catchphrase").notNull(),
  risk_appetite: riskAppetiteEnum("risk_appetite").notNull(),
  notes: text("notes").default(""),                          // append-only(决议回写追加)
  is_default: integer("is_default").notNull().default(1),    // 0=自定义新增 / 1=内置默认(v2.3 GAN-A B-A-1 修:原 text 类型与其他表 integer 0/1 风格冲突)
  schema_version: integer("schema_version").notNull().default(1),
  created_at: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updated_at: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});
```

**关系**:
- `personas` × `analysis_versions` 多对多 → 通过 `analysis_versions.persona_votes` JSONB 字段承载(不另建关联表,因为单次推理 ≤ 7 角色,JSONB 性能足够)

**初始化**:7 条 hardcoded 默认值在 `lib/db/seed/personas.ts`,启动时 upsert。

---

#### 2.3.2 internal_objectives(v2 新)

> 来源:P02 L1 ComboBox,methodology.md L1 OKR P0_OBJECTIVES fixture

```typescript
export const internal_objectives = pgTable("internal_objectives", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),                              // "Q3 七夕销售额突破 8 亿"
  description: text("description").notNull(),
  key_results: jsonb("key_results").$type<string[]>().notNull(),
  year: integer("year").notNull(),                           // 2026
  quarter: integer("quarter").notNull(),                     // 3(0=全年)
  owner: text("owner").notNull(),                            // "电商事业部"
  is_active: integer("is_active").notNull().default(1),      // 0/1
  schema_version: integer("schema_version").notNull().default(1),
  created_at: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});
```

**初始化**:5 条 P0 fixture 自 `lib/methodology/p0-objective-fixtures.ts` 启动 upsert。

---

#### 2.3.3 evidence_sources(v2 新)

> 来源:P11 证据库管理,data-strategy.md 4 张 v2 新表

```typescript
export const sourceTypeEnum = pgEnum("source_type", ["internal", "external"]);
export const sourceStatusEnum = pgEnum("source_status", ["active", "pending_v2"]);

export const evidence_sources = pgTable("evidence_sources", {
  id: uuid("id").primaryKey().defaultRandom(),
  source_type: sourceTypeEnum("source_type").notNull(),
  name: text("name").notNull(),                              // "历史决议" / "小红书声量(Fixture)"
  url: text("url"),                                          // 可空(fixture 无 URL)
  owner: text("owner").notNull(),
  status: sourceStatusEnum("status").notNull().default("active"),
  description: text("description"),                          // P11 卡片显示
  schema_version: integer("schema_version").notNull().default(1),
  created_at: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});
```

**初始化**:P0 至少 6 条内部 + 5 条外部 fixture 源,3-4 条 `pending_v2` 占位(展示 V2 路线图)。

---

#### 2.3.4 evidence_cards(v2 新)

> 来源:P11 证据浏览,P04 cell hover citation,P12 § 证据链

```typescript
import { vector } from "drizzle-orm/pg-core";  // V2 用,P0 用 jsonb

export const evidence_cards = pgTable("evidence_cards", {
  id: uuid("id").primaryKey().defaultRandom(),
  source_id: uuid("source_id").notNull().references(() => evidence_sources.id),
  title: text("title").notNull(),
  snippet: text("snippet").notNull(),                        // 前 200 字摘录
  full_content: text("full_content").notNull(),
  // P0:embedding 存内存,但 schema 字段保留以便 V2 切 pgvector 无 migration
  embedding: jsonb("embedding").$type<number[]>(),           // 1536 维(OpenAI text-embedding-3-small 默认),P0 nullable
  tags: jsonb("tags").$type<string[]>().notNull().default([]),
  cited_count: integer("cited_count").notNull().default(0),  // 引用计数,推理时累加
  schema_version: integer("schema_version").notNull().default(1),
  created_at: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

// 索引(P0 不需要,但 V2 切 pgvector 后启用)
// CREATE INDEX evidence_cards_embedding_idx ON evidence_cards USING ivfflat (embedding vector_cosine_ops);
```

**P0 行为**:启动时 `lib/evidence/retriever.ts` 把全表(< 200 条)加载到 `Map<id, EvidenceCard>`,cosine 计算在内存进行(< 5ms)。引用次数(`cited_count`)在推理结束后异步更新,不阻塞主流。

**V2 行为**:切 Neon pgvector,查询走 `ORDER BY embedding <=> $1`(余弦距离),数据库内排序。

---

#### 2.3.5 proposals

> 来源:P02 提案输入(v2 + decision_type + declared_objective_id),P10 列表

```typescript
export const decisionTypeEnum = pgEnum("decision_type", [
  "selection",       // 选品
  "marketing",       // 营销
  "budget",          // 预算
  "operation",       // 经营
  "cross_border",    // 跨境-区域(v2.1 新)
]);

export const proposals = pgTable("proposals", {
  id: uuid("id").primaryKey().defaultRandom(),
  title: text("title").notNull(),                            // 自动从前 30 字截取
  raw_text: text("raw_text").notNull(),                      // 用户原始输入(可能含敏感字段)
  redacted_text: text("redacted_text").notNull(),            // 脱敏后(进 LLM 的版本)
  decision_type: decisionTypeEnum("decision_type").notNull(),
  decision_type_confidence: integer("decision_type_confidence").notNull(),
                                                             // 0-100,AI 识别置信度
  declared_objective_id: uuid("declared_objective_id")
    .notNull()
    .references(() => internal_objectives.id),               // L1 必选
  weight_overrides: jsonb("weight_overrides").$type<Record<string, number>>(),
                                                             // { "finance": 1.4, ... } 可空,用户调整
  selected_persona_ids: jsonb("selected_persona_ids")
    .$type<string[]>()
    .notNull(),                                              // 默认 7 全选,至少 2
  is_demo: integer("is_demo").notNull().default(0),          // 是否来自 P01 Demo Sim
  demo_scenario_id: text("demo_scenario_id"),                // "scenario-1" ~ "scenario-4"
  // v2.3 GAN-A H-A-7 修:显式跟踪"当前主线版本",避免 P04/P12 取版本时歧义
  // 何时更新:
  //   (1) 推理 status 由 running → completed 时,设为该 av_id(若 created_at 比当前 current 更新)
  //   (2) §5.7.7 回滚时,设为新生成的回滚 av_id(回滚是主线动作)
  //   (3) §5.12.2/§5.12.3 用户覆盖结论/权重创建新版本时,设为新 av_id
  //   (4) §5.12.6 fork **不更新**(fork 是探索分支,不动主线)
  // P04/P06/P12 默认读取此 av_id;用户可通过 P07 面板 4 版本列表显式切换查看历史版本
  current_analysis_version_id: uuid("current_analysis_version_id"),
                                                             // FK 不显式声明(循环引用,应用层保证)
  deleted_at: timestamp("deleted_at", { withTimezone: true }),
                                                             // 软删除,90 天后真删
  schema_version: integer("schema_version").notNull().default(1),
  created_at: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updated_at: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});
```

**关系**:`proposals (1) — (N) analysis_versions`

---

#### 2.3.6 analysis_versions(immutable)

> 来源:P03 推理流(产出快照),P04 热力图,P12 决策报告,P10 历史 — **核心表**

```typescript
export const analysisStatusEnum = pgEnum("analysis_status", [
  "running",          // 推理进行中(SSE 流式)
  "paused_hitl",      // HITL 暂停
  "completed",        // 全部完成
  "failed",           // 失败(LangGraph 重试用尽)
  "degraded_offline", // 全部 Provider 失败,只跑了 N1 离线规则
]);

export const analysis_versions = pgTable("analysis_versions", {
  id: uuid("id").primaryKey().defaultRandom(),
  proposal_id: uuid("proposal_id").notNull().references(() => proposals.id),
  version_label: text("version_label").notNull(),            // "v1.0", "v1.1", "v1.3(回滚自 v1.1)"
  rollback_from_id: uuid("rollback_from_id"),                // 若回滚,指向旧版
  status: analysisStatusEnum("status").notNull().default("running"),

  // === 推理参数(用于复现) ===
  temperature: integer("temperature").notNull(),             // 30/40/50(×100,避免 float)
  seed: integer("seed").notNull(),                           // 42/84/126

  // === 9 节点输出快照(append-only,immutable) ===
  // N1 结构化 + 决策类型识别
  structured_claims: jsonb("structured_claims").$type<StructuredClaim[]>(),
  // N2 L1 目标对齐
  l1_alignment_score: integer("l1_alignment_score"),         // 0-100
  l1_alignment_warnings: jsonb("l1_alignment_warnings").$type<string[]>(),
  // N3 L2 证据召回
  recalled_evidence_ids: jsonb("recalled_evidence_ids").$type<string[]>(),
  // N4 Round 0 + N5 Round 1
  round_0_votes: jsonb("round_0_votes").$type<PersonaVote[]>(),
  round_1_votes: jsonb("round_1_votes").$type<PersonaVote[]>(),
  anchoring_flags: jsonb("anchoring_flags").$type<AnchoringFlag[]>(),
  // N6 TWS 评分
  tws_scores_by_claim: jsonb("tws_scores_by_claim").$type<Record<string, number>>(),
  // N7 L4 权重(快照)
  effective_weights: jsonb("effective_weights").$type<Record<string, number>>(),
  // N8 Premortem
  premortem_risks: jsonb("premortem_risks").$type<PremortemRisk[]>(),
  // N9 决策报告
  decision_report: jsonb("decision_report").$type<DecisionReport>(),

  // === 用户可编辑衍生字段(immutable 豁免,v2.3 GAN-A B-A-5 修)===
  // 纯展示用,不影响推理结果,允许 UPDATE(P04 编辑顶部一句话)
  headline_disagreement: text("headline_disagreement"),       // ≤ 50 字

  // === 用户局部覆盖(v2.3 GAN-A B-A-6 修)===
  // 仅 RACI 行动项可改不创新版本(协作字段,频繁改);其他改动(conclusion/weights)走 §5.12.2/§5.12.3 新建版本路径
  // 读取 decision_report 时,如果 decision_report_overrides.action_items 非空,用它覆盖 decision_report.action_items
  decision_report_overrides: jsonb("decision_report_overrides").$type<{
    action_items?: ActionItem[];           // 用户编辑后的 RACI 行动项
  }>(),

  // N8 Premortem 等留作 ai_methodology_ab_compare(v2.3 B-A-3)
  methodology_ab_compare: jsonb("methodology_ab_compare").$type<{
    with_methodology: { top3_disagreements_count: number; citations_count: number };
    without_methodology: { top3_disagreements_count: number; citations_count: number };
    generated_at: string;
  }>(),                                                       // null=未跑;由 §5.7.17 异步触发

  // === 性能 / 降级 metadata ===
  total_duration_ms: integer("total_duration_ms"),
  provider_used: jsonb("provider_used").$type<ProviderEvent[]>(),
                                                             // 每节点用了哪个 Provider
  llm_call_count: integer("llm_call_count"),
  // === Hash(R8 审计) ===
  input_hash: text("input_hash").notNull(),                  // SHA-256 of redacted_text + objective
  output_hash: text("output_hash"),                          // SHA-256 of decision_report(完成后)

  schema_version: integer("schema_version").notNull().default(1),
  created_at: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  completed_at: timestamp("completed_at", { withTimezone: true }),
});
```

**immutable 保证**:数据库层不强制(Postgres 没有原生 immutable),应用层在 service 层禁止 UPDATE(只 INSERT)。回滚 = INSERT 新版 + `rollback_from_id` 指针。

---

#### 2.3.7 decisions(immutable)

> 来源:P09 决议录入(v2 AAR 模板),P10 历史链

```typescript
export const decisionStatusEnum = pgEnum("decision_status", [
  "approved",         // 通过
  "deferred",         // 暂缓
  "rejected",         // 驳回
  "need_more_data",   // 需补数据
]);

export const decisions = pgTable("decisions", {
  id: uuid("id").primaryKey().defaultRandom(),
  proposal_id: uuid("proposal_id").notNull().references(() => proposals.id),
  analysis_version_id: uuid("analysis_version_id")
    .notNull()
    .references(() => analysis_versions.id),
  prev_decision_id: uuid("prev_decision_id"),                // 链式决议
  status: decisionStatusEnum("status").notNull(),
  summary: text("summary").notNull(),                        // 1-2 句决议摘要
  key_changes: jsonb("key_changes").$type<string[]>().notNull(),
                                                             // ["原 X → 现 Y"]
  attendees: jsonb("attendees").$type<string[]>().notNull(),
  meeting_date: timestamp("meeting_date", { withTimezone: true }).notNull(),
  affected_persona_ids: jsonb("affected_persona_ids").$type<string[]>().notNull(),

  // === AAR 模板(v2,4 字段,至少 2 非空) ===
  aar_expected: text("aar_expected"),                        // 预期发生什么
  aar_actual: text("aar_actual"),                            // 实际发生什么
  aar_gap_reason: text("aar_gap_reason"),                    // 差距原因
  aar_next_improvement: text("aar_next_improvement"),        // 下次怎么改

  // === 权重调整建议(AI 生成,用户决定是否采纳) ===
  weight_suggestions: jsonb("weight_suggestions").$type<WeightSuggestion[]>(),
  weight_suggestions_accepted: jsonb("weight_suggestions_accepted").$type<string[]>(),
                                                             // 已采纳的建议 ID
  schema_version: integer("schema_version").notNull().default(1),
  created_at: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});
```

**append-only**:`decisions` 永不修改/删除(审计要求,data-lifecycle.md)。

---

#### 2.3.8 LangGraph checkpoints + HITL audit(双层)

> 来源:P03 暂停按钮,P07 面板 5 HITL 接管,architecture.md `interrupt()`
>
> **v2.3 GAN-B 修(B-B-4)**:原方案"手工 `langgraph_checkpoints` 表 + JSONB state_snapshot"自实现 LangGraph state 持久化,会丢失 LangGraph 0.4 原生的 `interrupt()` / `Command(resume=)` / 历史回放语义。**改为分层方案**:
> - **底层**:LangGraph 官方 `PostgresSaver`(来自 `@langchain/langgraph-checkpoint-postgres`)管理 4 张标准表(`checkpoints` / `checkpoint_blobs` / `checkpoint_writes` / `checkpoint_migrations`),由 `await checkpointer.setup()` 自动 migration。**不由 Drizzle 管理**,Drizzle schema 中**不声明**这 4 张表。
> - **业务层**:本应用维护一张 `hitl_audit` 表,记录"何时谁因何 resume 了哪个 checkpoint",供 P07 面板 5 历史接管记录 + audit_logs 引用。

##### 底层:LangGraph 官方 4 张表(不由 Drizzle 管理)

由 `PostgresSaver.fromConnString(NEON_DATABASE_URL_WS)` 自动创建。**连接走 Neon WebSocket driver**(`@neondatabase/serverless` 的 Pool 模式),与 Drizzle 业务查询的 HTTP driver 并存,详见 §8.2 混合连接配置。

```typescript
// lib/graph/checkpointer.ts
import { PostgresSaver } from "@langchain/langgraph-checkpoint-postgres";
import { Pool } from "@neondatabase/serverless";   // WebSocket driver

const pool = new Pool({ connectionString: process.env.NEON_DATABASE_URL_WS! });
export const checkpointer = new PostgresSaver(pool);
// 首次部署:await checkpointer.setup();  // 创建 checkpoints / checkpoint_blobs / checkpoint_writes / checkpoint_migrations
```

##### 业务层:hitl_audit 表(由 Drizzle 管理)

```typescript
export const hitl_audit = pgTable("hitl_audit", {
  id: uuid("id").primaryKey().defaultRandom(),
  analysis_version_id: uuid("analysis_version_id")
    .notNull()
    .references(() => analysis_versions.id),
  thread_id: text("thread_id").notNull(),                    // LangGraph thread ID(=analysis_version_id 的 string 形式)
  node_id: text("node_id").notNull(),                        // 暂停时的节点(N1~N9)
  state_summary: text("state_summary"),                      // 暂停时点的人类可读摘要(用于 P07 列表)
  paused_at: timestamp("paused_at", { withTimezone: true }).notNull(),
  resumed_at: timestamp("resumed_at", { withTimezone: true }),
  resume_decision: text("resume_decision"),                  // "approve" / "edit" / "reject"
  resume_reason: text("resume_reason"),                      // ≥ 5 字必填(若已 resume)
  edited_state_keys: jsonb("edited_state_keys").$type<string[]>(),
                                                             // edit 时改了哪些 state key(具体内容由 PostgresSaver 持久化)
  auto_approve_at: timestamp("auto_approve_at", { withTimezone: true }),
                                                             // 5 分钟自动批准时间戳(H-A-6),null=人工已 resume
  schema_version: integer("schema_version").notNull().default(1),
  created_at: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});
```

##### Resume 语义

- `POST /api/analyze/:id/pause`(§5.3.2):调 LangGraph 内部 `interrupt()`(PostgresSaver 自动持久化 state)+ 插入 `hitl_audit` 记录 + emit `hitl:pending` SSE 事件
- `POST /api/analyze/:id/resume`(§5.3.3):
  - `approve` → `graph.invoke(Command(resume=originalValue), config)`
  - `edit` → `graph.invoke(Command(resume=editedValue), config)`,把改动 key 写入 `hitl_audit.edited_state_keys`
  - `reject` → 不 resume,直接 `analysis_versions.status="failed"`
  - 三种都 UPDATE `hitl_audit.resumed_at + resume_decision + resume_reason`

##### GC

- PostgresSaver 的 4 张表:推理 `completed` 7 天后,自定义 cron 调 `checkpointer.delete(thread_id)` 清理(LangGraph 不自动 GC)
- `hitl_audit`:**永不删**(审计要求,与 audit_logs 同语义)

---

#### 2.3.9 audit_logs(append-only,永不删)

> 来源:P07 面板 6,security-model.md 三层防护

```typescript
export const auditActionEnum = pgEnum("audit_action", [
  "proposal_create", "proposal_update", "proposal_soft_delete",
  "analysis_start", "analysis_complete", "analysis_failed",
  "hitl_pause", "hitl_approve", "hitl_edit", "hitl_reject",
  "rollback",
  "persona_edit", "persona_reset",
  "decision_create",
  "weight_override",
  "raci_override",                                           // v2.3 B-A-6 新增
  "provider_degrade",
  "reproducibility_run",
  "evidence_search",
]);

export const audit_logs = pgTable("audit_logs", {
  id: uuid("id").primaryKey().defaultRandom(),
  actor: text("actor").notNull().default("anonymous"),       // P0 单租户;V2 OAuth user_id
  action: auditActionEnum("action").notNull(),
  target_type: text("target_type").notNull(),                // "proposal" / "persona" / ...
  target_id: uuid("target_id"),                              // 可空(如 evidence_search)
  input_hash: text("input_hash"),                            // SHA-256
  output_hash: text("output_hash"),                          // SHA-256
  metadata: jsonb("metadata"),                               // 操作详情,根据 action 不同
  user_agent: text("user_agent"),
  ip: text("ip"),
  created_at: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

// 索引(强约束查询效率)
// CREATE INDEX audit_logs_created_idx ON audit_logs (created_at DESC);
// CREATE INDEX audit_logs_target_idx ON audit_logs (target_type, target_id);
```

**永不 DELETE**:即使提案被 90 天后真删,审计日志保留 + `metadata.referenced_proposal_deleted=true` 标记。

---

#### 2.3.10 reproducibility_runs

> 来源:P07 面板 7 稳定性测试,data-strategy.md 4 张 v2 新表

```typescript
export const reproVerdictEnum = pgEnum("repro_verdict", [
  "stable", "partial", "unstable",
]);

export const reproducibility_runs = pgTable("reproducibility_runs", {
  id: uuid("id").primaryKey().defaultRandom(),
  proposal_id: uuid("proposal_id").notNull().references(() => proposals.id),
  run_count: integer("run_count").notNull().default(3),
  // 引用本次复现产生的 3 个 analysis_version(独立保存,不污染原版)
  analysis_version_ids: jsonb("analysis_version_ids")
    .$type<string[]>()
    .notNull(),
  temperatures: jsonb("temperatures").$type<number[]>().notNull(),  // [0.3, 0.4, 0.5]
  seeds: jsonb("seeds").$type<number[]>().notNull(),                // [42, 84, 126]

  // === 一致性指标(3 个) ===
  conclusion_consistency_pct: integer("conclusion_consistency_pct").notNull(), // 0-100
  top3_jaccard: integer("top3_jaccard").notNull(),                  // 0-100(×100 整数)
  evidence_overlap_pct: integer("evidence_overlap_pct").notNull(),  // 0-100

  verdict: reproVerdictEnum("verdict").notNull(),

  total_duration_ms: integer("total_duration_ms").notNull(),
  schema_version: integer("schema_version").notNull().default(1),
  created_at: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});
```

**判定逻辑**(应用层):
```
verdict =
  (conclusion_consistency_pct >= 67 AND top3_jaccard >= 60 AND evidence_overlap_pct >= 70) ? "stable" :
  (conclusion_consistency_pct >= 33) ? "partial" :
  "unstable"
```

---

#### 2.3.11 provider_events

> 来源:P03 Provider 角标,P07 面板 1 降级链

```typescript
export const providerEnum = pgEnum("provider", [
  "opus-4-7",
  "sonnet-4-6",
  "haiku-4-5",
  "offline-rules",
]);

export const degradeReasonEnum = pgEnum("degrade_reason", [
  "timeout",
  "rate_limit",        // 429
  "server_error",      // 5xx
  "quota_exhausted",
  "manual",            // Demo 演示用
  "all_failed",        // 切到离线规则
]);

export const provider_events = pgTable("provider_events", {
  id: uuid("id").primaryKey().defaultRandom(),
  analysis_version_id: uuid("analysis_version_id")
    .references(() => analysis_versions.id),                  // 可空(全局事件)
  from_provider: providerEnum("from_provider").notNull(),
  to_provider: providerEnum("to_provider").notNull(),
  reason: degradeReasonEnum("reason").notNull(),
  node_id: text("node_id"),                                  // N1~N9(可空)
  error_message: text("error_message"),
  recovered_at: timestamp("recovered_at", { withTimezone: true }),
                                                             // null=未恢复
  created_at: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});
```

### 2.4 ER 关系图

```
internal_objectives ─┐
                     │
  evidence_sources ──┤
        ↓ 1:N        │
  evidence_cards     │
                     ↓
                  proposals (1)──┬──N analysis_versions (immutable)
                     │           │           │
                  (soft delete)  │           ├──N hitl_audit (+ LangGraph 4 张外部表)
                                 │           └──N provider_events
                                 │
                                 ├──N reproducibility_runs ──┐
                                 │   (按 proposal 归档)        │
                                 │                            │ JSONB analysis_version_ids[3]
                                 │                            │ (M:N,无 DB 外键,应用层保证完整性)
                                 │                            ↓
                                 │                       analysis_versions (3 个独立 av,
                                 │                       不污染原版,各自有自己的 decision_report)
                                 │
                                 └──N decisions (immutable, AAR)
                                         ↓
                                     personas.notes append

注:reproducibility_runs.analysis_version_ids 是 JSONB 数组(3 个 av_id),无外键约束。
应用层规则:
  (1) 创建 repro_run 前验证 3 个 av_id 均存在且 status="completed"
  (2) av 软删除时不级联(repro_run 保留,UI 显示"原推理已删除")
  (3) finalize 端点(5.7.13)在聚合 metrics 前 re-validate 3 个 av 仍可读

audit_logs ── (永不删,polymorphic 引用全部) ──→ * 上面所有表
```

---

## 3. 认证与权限

### 3.1 P0 阶段(黑客松 Demo,单租户)

> 详见 [permissions.md](../design/04-rules/permissions.md) — **无登录,全部端点对匿名开放**,除以下隐藏:

- **`/judge-view`**(P08)路径在 UI 导航中隐藏,但 SSR 端可访问(不在 API,无需保护)
- **可选**:加 Demo 访问码 — 通过 `?team_code=XXX` 查询串校验,失败 → 401。**默认不启用**,由用户拍板。

### 3.2 V2 阶段(产品化目标,定义但不实现)

| 角色 | 来源 |
|---|---|
| 匿名访客 | 无 session |
| 提案人 | Sign in with Vercel OAuth,创建过 ≥ 1 个 proposal |
| 评审人 | 被分配为 `decision.affected_persona_ids` 的成员 |
| 决策者 | 后台标记为部门 leader |
| 管理员 | 后台特批 |

**权限矩阵**(完整版见 permissions.md):

| 端点 | 匿名 | 提案人 | 评审人 | 决策者 | 管理员 |
|---|---|---|---|---|---|
| `GET /api/scenarios` | ✅ | ✅ | ✅ | ✅ | ✅ |
| `POST /api/proposals` | ❌ | ✅ | ❌ | ✅ | ✅ |
| `GET /api/proposals/:id` | 公开提案 | 自己 + 公开 | 被分配 | 本部门 | 全部 |
| `POST /api/analyze` | ❌ | ✅ | ❌ | ✅ | ✅ |
| `PATCH /api/personas/:id` | ❌ | ❌ | ❌ | ❌ | ✅ |
| `POST /api/decisions` | ❌ | ✅(自己提案) | ❌ | ✅(本部门) | ✅ |
| `POST /api/proposals/:id/rollback` | ❌ | ✅(自己) | ❌ | ✅(本部门) | ✅ |
| `GET /api/audit-logs` | ❌ | ❌ | ❌ | ❌ | ✅ |
| `POST /api/hitl/:id/takeover` | ❌ | ✅(自己) | ❌ | ✅(本部门) | ✅ |

**P0 实现**:`middleware.ts` 中间件检查所有 `/api/*` 路径,若环境变量 `DEMO_TEAM_CODE` 设置则校验 `?team_code=` 或 header `x-team-code`。

---

## 4. 共享 Zod Schema 全集

> 这些 Schema 是 LLM 输出强约束的关键。可直接拷贝到 `lib/schema/` 供 `streamObject` / Route Handler / 前端表单共用。

### 4.1 基础枚举与态度分(全局锁定)

```typescript
// lib/schema/attitude.ts
import { z } from "zod";

export const AttitudeEnum = z.enum([
  "support",      // 支持
  "conditional",  // 谨慎支持
  "insufficient", // 信息不足
  "oppose",       // 反对
]);

export type Attitude = z.infer<typeof AttitudeEnum>;

export const ATTITUDE_SCORE = {
  support: +1.0,
  conditional: +0.5,
  insufficient: 0.0,
  oppose: -1.0,
} as const;

// UI 渲染锁定(禁止 emoji,严格按 ui.md §1.6)
export const ATTITUDE_ICON = {
  support: "CheckCircle2",     // Lucide
  conditional: "CheckCircle",
  insufficient: "HelpCircle",
  oppose: "XCircle",
} as const;

export const ATTITUDE_TOKEN = {
  support: "--success",
  conditional: "--conditional",  // HSL(160 60% 50%)
  insufficient: "--warning",
  oppose: "--destructive",
} as const;
```

### 4.2 角色与决策类型枚举

```typescript
// lib/schema/role.ts
export const RoleEnum = z.enum([
  "operations", "products", "marketing", "finance",
  "brand", "supply_chain", "regional",
]);

export const RoleLabelZh: Record<z.infer<typeof RoleEnum>, string> = {
  operations: "运营",
  products: "商品",
  marketing: "市场",
  finance: "财务",
  brand: "品牌",
  supply_chain: "供应链",
  regional: "区域管理",
};

export const RoleIcon: Record<z.infer<typeof RoleEnum>, string> = {
  operations: "Briefcase",
  products: "Package",
  marketing: "Megaphone",
  finance: "Coins",
  brand: "Sparkles",
  supply_chain: "Truck",
  regional: "Globe",
};

// lib/schema/decision-type.ts
export const DecisionTypeEnum = z.enum([
  "selection",      // 选品
  "marketing",      // 营销
  "budget",         // 预算
  "operation",      // 经营
  "cross_border",   // 跨境-区域
]);

// L4 权重表(methodology.md 已锁)
export const DEFAULT_WEIGHTS: Record<
  z.infer<typeof DecisionTypeEnum>,
  Record<z.infer<typeof RoleEnum>, number>
> = {
  selection:    { operations: 1.2, products: 1.3, marketing: 1.2, finance: 1.2, brand: 1.0, supply_chain: 1.3, regional: 1.0 },
  marketing:    { operations: 1.1, products: 1.0, marketing: 1.5, finance: 1.1, brand: 1.3, supply_chain: 1.0, regional: 0.9 },
  budget:       { operations: 1.0, products: 0.9, marketing: 1.0, finance: 1.6, brand: 0.9, supply_chain: 1.0, regional: 0.9 },
  operation:    { operations: 1.2, products: 1.1, marketing: 1.1, finance: 1.2, brand: 1.0, supply_chain: 1.1, regional: 1.0 },
  cross_border: { operations: 1.0, products: 1.1, marketing: 1.2, finance: 1.1, brand: 1.2, supply_chain: 1.1, regional: 1.5 },
};
```

### 4.3 Citation Schema(L2 证据强制)

```typescript
// lib/schema/citation.ts
export const CitationSchema = z.object({
  source_type: z.enum([
    "proposal_text",     // 来自提案原句
    "internal_doc",      // 内部文档(飞书/历史决议)
    "external_data",     // 外部数据(小红书/行业报告)
    "historical_decision", // 历史决议引用
    "persona_rule",      // 角色规则(KPI / 风险偏好)
  ]),
  source_id: z.string().min(1),         // 必须来自召回集合或 personas
  snippet: z.string().min(10),          // ≥ 10 字
  relevance: z.number().min(0).max(1),
}).strict();

// 每条 claim 必须 ≥ 1 条 citation,LangGraph 重试保证
export const CitationsArraySchema = z.array(CitationSchema).min(1);
```

### 4.4 PersonaVote / Claim / Round 输出

```typescript
// lib/schema/persona-vote.ts
export const StructuredClaimSchema = z.object({
  id: z.string(),                       // "claim_1" ...
  text: z.string().min(5),              // 论点原文
  assumption: z.string().optional(),    // 提案中的假设
  data_gap: z.string().optional(),      // 缺失的数据(若有)
}).strict();

export const PersonaClaimSchema = z.object({
  claim_id: z.string(),                 // 引用 structured_claims
  attitude: AttitudeEnum,
  confidence: z.number().min(0).max(1),
  reason: z.string().min(20),           // 理由 ≥ 20 字(防敷衍)
  citations: CitationsArraySchema,      // ≥ 1 条
  adjust_reason: z.string().optional(), // Round 1 才有,理由 < 30 字 → anchoring 嫌疑
}).strict();

export const PersonaVoteSchema = z.object({
  persona_id: z.string(),
  role: RoleEnum,
  weight: z.number().min(0.5).max(2.0), // L4 实际权重
  claims: z.array(PersonaClaimSchema).min(1),
  round: z.enum(["round_0", "round_1"]),
  duration_ms: z.number().int().min(0),
}).strict();
```

### 4.5 Anchoring Flag

```typescript
export const AnchoringFlagSchema = z.object({
  persona_id: z.string(),
  claim_id: z.string(),
  reason: z.enum([
    "stance_flip_no_reason",  // 立场翻转 + 理由 < 30 字
    "high_cosine_similarity", // 措辞与某 R0 cosine > 0.85
  ]),
  evidence_persona_id: z.string().optional(), // 与哪个 R0 高相似度
  cosine_score: z.number().min(0).max(1).optional(),
}).strict();
```

### 4.6 DisagreementResolution(P12 § 关键分歧强约束)

```typescript
// lib/schema/disagreement.ts
export const DisagreementResolutionSchema = z.object({
  shared_interest: z.string().min(10),       // ≥ 10 字
  objective_criterion: z.string().min(10),   // ≥ 10 字
  next_step: z.string().min(5),              // ≥ 5 字
}).strict();

export const KeyDisagreementSchema = z.object({
  claim_id: z.string(),
  claim_text: z.string(),
  supporting_roles: z.array(RoleEnum),
  opposing_roles: z.array(RoleEnum),
  why_diverge: z.string().min(20),
  resolution: DisagreementResolutionSchema,
}).strict();

// 最多 top 3(P12 § ③)
export const KeyDisagreementsArraySchema = z.array(KeyDisagreementSchema).max(5);
```

### 4.7 PremortemRisk(P12 § ⑤)

```typescript
export const PremortemRiskSchema = z.object({
  risk: z.string().min(15),
  raised_by: z.array(RoleEnum).min(1),
  severity: z.enum(["high", "medium", "low"]),
  scenario: z.string().min(20),         // 具体场景描述
  mitigations: z.array(z.string()).default([]),
}).strict();

// Premortem 输出 ≥ 3 条(P0 必做强制)
export const PremortemArraySchema = z.array(PremortemRiskSchema).min(3);
```

### 4.8 ActionItem RACI(P12 § ⑥)

```typescript
export const ActionItemSchema = z.object({
  id: z.string(),
  action: z.string().min(5).regex(/^[一-龥\w]/, "必须以中文或字母开头"),
  // v2.3 GAN-A H-A-2 修:accountable 必须是单一 RoleEnum,防止 LLM 输出"财务/运营"绕过 RACI 唯一性原则
  responsible: z.array(RoleEnum).min(1),    // R 必须 ≥ 1
  accountable: RoleEnum,                    // A 必须唯一,严格枚举校验,不允许字符串拼接
  consulted: z.array(RoleEnum).default([]),
  informed: z.array(RoleEnum).default([]),
  due_date: z.string().datetime(),
}).strict().refine(
  // A 不能同时出现在 C/I 数组(避免角色重复出现)
  (d) => !d.consulted.includes(d.accountable) && !d.informed.includes(d.accountable),
  { message: "Accountable 角色不能同时出现在 Consulted 或 Informed" }
);

// L4 prompt template 同步约束:
// "Accountable 必须是 7 个角色枚举之一(operations/products/marketing/finance/brand/supply_chain/regional),
//  不允许填写'财务/运营'等组合或'共同负责'等模糊表达"
```

### 4.9 DecisionReport(P12 完整 7 部分)

```typescript
// lib/schema/decision-report.ts
export const DecisionConclusionEnum = z.enum([
  "approved", "deferred", "rejected", "need_more_data",
]);

export const AttitudeDistributionSchema = z.object({
  support: z.number().min(0).max(100),       // 百分比
  conditional: z.number().min(0).max(100),
  insufficient: z.number().min(0).max(100),
  oppose: z.number().min(0).max(100),
}).strict().refine(
  (d) => Math.abs(d.support + d.conditional + d.insufficient + d.oppose - 100) < 0.01,
  { message: "4 档分布百分比必须等于 100" }
);

export const EvidenceChainItemSchema = z.object({
  conclusion: z.string(),
  citations: CitationsArraySchema,
}).strict();

export const DecisionReportSchema = z.object({
  // ① 结论
  conclusion: z.object({
    status: DecisionConclusionEnum,
    summary: z.string().min(10).max(50),    // 一句话 ≤ 50 字(R11 压缩护栏)
    served_objective_id: z.string().uuid(), // L1 引用
    served_objective_name: z.string(),
  }).strict(),

  // ② 评分
  scoring: z.object({
    weighted_total: z.number().min(0).max(100),  // 加权总分
    tws_score: z.number().min(-1).max(1),        // TWS 原值
    attitude_distribution: AttitudeDistributionSchema,
    weights_used: z.record(RoleEnum, z.number().min(0.5).max(2.0)),
    formula_explanation: z.string(),             // hover 显示公式
  }).strict(),

  // ③ 关键分歧 top 3
  key_disagreements: KeyDisagreementsArraySchema,

  // ④ 证据链
  evidence_chain: z.array(EvidenceChainItemSchema),

  // ⑤ 风险(Premortem)
  risks: PremortemArraySchema,

  // ⑥ 建议行动 RACI
  action_items: z.array(ActionItemSchema).min(1),

  // ⑦ 纪要
  minutes: z.object({
    markdown: z.string().min(200).max(500),  // 200-500 字
    headline_disagreement: z.string().max(50), // 一句话核心分歧
    three_sentence_summary: z.array(z.string().max(30)).length(3),
  }).strict(),
}).strict();
```

### 4.10 ProviderEvent(SSE)

```typescript
export const ProviderEventSchema = z.object({
  from: providerEnum,  // "opus-4-7" | ...
  to: providerEnum,
  reason: degradeReasonEnum,
  node_id: z.string().optional(),
  at: z.string().datetime(),
}).strict();
```

### 4.11 ReproducibilityMetrics(P07 面板 7)

```typescript
export const ReproducibilityMetricsSchema = z.object({
  run_count: z.literal(3),
  analysis_version_ids: z.array(z.string().uuid()).length(3),
  temperatures: z.array(z.number()).length(3),
  seeds: z.array(z.number().int()).length(3),

  conclusion_consistency_pct: z.number().min(0).max(100),
  top3_jaccard: z.number().min(0).max(100),
  evidence_overlap_pct: z.number().min(0).max(100),

  verdict: z.enum(["stable", "partial", "unstable"]),
  total_duration_ms: z.number().int().min(0),
}).strict();
```

### 4.12 AAR Schema(P09)

```typescript
// v2.3 GAN-A H-A-3 修:防"无"/"N/A"/空格 等敷衍输入,每字段若填则 trim 后 ≥ 10 字
export const DecisionAarSchema = z.object({
  aar_expected: z.string().min(10).optional(),
  aar_actual: z.string().min(10).optional(),
  aar_gap_reason: z.string().min(10).optional(),
  aar_next_improvement: z.string().min(10).optional(),
}).strict().refine(
  (d) => [d.aar_expected, d.aar_actual, d.aar_gap_reason, d.aar_next_improvement]
    .filter((s) => s && s.trim().length >= 10).length >= 2,
  { message: "AAR 4 字段至少 2 个非空,每个至少 10 字(防敷衍,F12 反方法论形式化)" }
);

export const WeightSuggestionSchema = z.object({
  id: z.string(),
  role: RoleEnum,
  current_weight: z.number(),
  suggested_weight: z.number().min(0.5).max(2.0),
  reason: z.string().min(10),
}).strict();
```

---

## 5. API 端点(按页面分组)

> **规范**:每个端点给出 `Method + Path` / 用途 / 请求 / 响应 / 错误 / 限流。
> **统一**:所有响应都用 §1.2 包装(`{ data }` / `{ error }`),除非显式说明。

---

### 5.1 P01 首页(2 端点)

#### 5.1.1 `GET /api/scenarios` — Demo 场景元数据

**对应 UI**:P01 演示模式开关 → 4 场景下拉

**请求**:无

**响应** `200`:
```json
{
  "data": [
    {
      "scenario_id": "scenario-1",
      "name": "小红书声量 A 款项链",
      "description": "中国/日本主战场,东南亚需谨慎",
      "decision_type": "selection",
      "is_recommended": true,
      "preview_text_first_100": "..."
    },
    { "scenario_id": "scenario-2", "name": "七夕情侣对戒", ... },
    { "scenario_id": "scenario-3", "name": "百万旗舰款", ... },
    { "scenario_id": "scenario-4", "name": "跨境市场新品", ... }
  ]
}
```

**错误**:无(纯静态读)
**限流**:60/min
**实现**:从 `lib/fixtures/scenarios.ts` 读,无 DB 查询

---

#### 5.1.2 `POST /api/scenarios/:scenarioId/load` — 加载场景 fixture

**对应 UI**:P01 选场景 → 一键启动

**请求路径**:`POST /api/scenarios/scenario-2/load`

**请求体**:无

**响应** `201`:
```json
{
  "data": {
    "proposal_id": "prop_xxx",
    "analysis_version_id": "av_xxx",
    "redirect_to": "/analysis/av_xxx?demo=scenario-2"
  }
}
```

**会发生什么**:
1. 从 `lib/fixtures/scenarios/scenario-2.json` 读取(含 raw_text / objective_id / region_view 预设观点)
2. 创建 `proposals` 记录(`is_demo=1`, `demo_scenario_id="scenario-2"`)
3. 创建 `analysis_versions` 记录(`status="running"`)
4. 立即返回 ID,客户端跳 P03 + 触发 `POST /api/analyze` SSE

**错误**:
- `404 SCENARIO_NOT_FOUND`:scenario_id 不在 fixture
- `503 FIXTURE_LOAD_FAILED`:JSON 解析失败

**限流**:10/min

---

### 5.2 P02 提案输入(5 端点)

> **草稿持久化说明(v2.3 GAN-A H-A-1)**:P02 草稿仅存浏览器 `localStorage`(每 10s 自动保存),**P0 阶段不提供云端同步**,跨设备/跨浏览器不可见。Demo 演示前提醒:不要在演示设备清除浏览器数据,同一机器可恢复。V2 路线图加 `/api/proposals/drafts` 云端同步端点。本节因此**无服务端草稿 API**,所有草稿状态都在前端 `lib/draft/local-storage.ts` 管理。

#### 5.2.1 `GET /api/objectives` — L1 公司目标列表

**对应 UI**:P02 ComboBox "本提案服从哪个公司级目标?"

**请求查询**:`?active=true&year=2026&quarter=3`(全部可选)

**响应** `200`:
```json
{
  "data": [
    {
      "id": "obj-2026-q3-qixi",
      "name": "Q3 七夕销售额突破 8 亿",
      "description": "...",
      "key_results": ["七夕周 GMV ≥ 8 亿", "客单价 ≥ ¥4500", "新客占比 ≥ 25%"],
      "year": 2026, "quarter": 3, "owner": "电商事业部",
      "is_active": true
    },
    ... 共 5 条 P0 fixture
  ]
}
```

**限流**:60/min

---

#### 5.2.2 `POST /api/objectives` — 自定义目标(用户选"自定义")

**对应 UI**:P02 ComboBox "+ 自定义目标"

**请求体**:
```json
{
  "name": "Q4 双 11 突破...",
  "description": "...",
  "key_results": ["...", "..."],
  "year": 2026, "quarter": 4, "owner": "..."
}
```

**响应** `201`:`{ "data": { "id": "obj_xxx", ... } }`

**错误**:
- `400 INVALID_INPUT`:Zod 校验失败
- `409 OBJECTIVE_NAME_DUPLICATE`

**限流**:10/min

---

#### 5.2.3 `POST /api/proposals/draft/detect-decision-type` — AI 识别决策类型(在用户停顿 2s 后触发)

**对应 UI**:P02 提案输入区下方"识别为:**选品决策** (置信度 0.91)"

**请求体**:
```json
{
  "raw_text": "本提案建议在七夕大促主推 A 款..."
}
```

**响应** `200`:
```json
{
  "data": {
    "decision_type": "selection",
    "confidence": 91,         // 0-100
    "alternatives": [
      { "type": "marketing", "confidence": 65 },
      { "type": "budget", "confidence": 22 }
    ],
    "detected_sensitive_fields": [
      { "type": "supplier_name", "snippet": "供应商 XX..." },
      { "type": "price_range", "snippet": "¥3000-5000" }
    ]
  }
}
```

**会发生什么**:
- 调 Haiku 4.5(快/便宜),`streamObject` 输出含 decision_type + 敏感字段
- 不写库,纯查询

**错误**:
- `422 PROPOSAL_TOO_SHORT`:文本 < 50 字
- `502 LLM_GATEWAY_DOWN`:降级到正则规则识别(返回 confidence 较低)

**限流**:30/min(防 debounce 失败时刷)

---

#### 5.2.4 `POST /api/proposals` — 创建提案

**对应 UI**:P02 "开始分析"按钮

**请求体**(Zod `CreateProposalSchema`):
```json
{
  "raw_text": "...(50-5000 字)",
  "decision_type": "selection",
  "declared_objective_id": "obj-2026-q3-qixi",
  "selected_persona_ids": ["per_ops","per_prod","per_mkt","per_fin","per_brand","per_supply","per_region"],
  "weight_overrides": { "finance": 1.4 },   // 可空
  "is_demo": false
}
```

**响应** `201`:
```json
{
  "data": {
    "proposal_id": "prop_xxx",
    "title": "本提案建议在七夕大促主推 A 款...",   // 前 30 字截取
    "redacted_text": "本提案建议在七夕大促主推 A 款,与 [供应商_001] 合作,价格 [价格区间_A]..."
  }
}
```

**会发生什么**:
1. 触发 R8 脱敏管线(正则 + LLM 兜底,生成 `redacted_text` + 还原映射表 → 还原表**仅返回响应里**,服务端不存)
2. 创建 `proposals` 记录(`raw_text` + `redacted_text`)
3. 创建 1 个 `audit_logs(action="proposal_create")` 记录
4. 返回 proposal_id

**错误**:
- `400 INVALID_INPUT`:Zod 校验失败
- `422 PROPOSAL_TOO_SHORT/LONG`:50 字 / 5000 字外
- `422 OBJECTIVE_REQUIRED`:declared_objective_id 缺失
- `422 PERSONAS_TOO_FEW`:selected_persona_ids < 2

**限流**:10/min

---

#### 5.2.5 `POST /api/proposals/:id/start-analysis` — 启动 LangGraph 主图

**对应 UI**:`POST /api/proposals` 返回后,客户端立即调此触发推理

**请求路径**:`POST /api/proposals/prop_xxx/start-analysis`

**请求体**:
```json
{
  "temperature": 0.4,    // 默认 0.4,稳定性测试时 0.3/0.4/0.5 三选一
  "seed": 84             // 默认 84
}
```

**响应** `202`(异步启动):
```json
{
  "data": {
    "analysis_version_id": "av_xxx",
    "version_label": "v1.0",
    "sse_url": "/api/analyze?analysis_version_id=av_xxx"
  }
}
```

**会发生什么**:
1. 创建 `analysis_versions(status="running", temperature=40, seed=84)` 记录
2. 把 LangGraph thread_id 关联到 av_xxx
3. **不直接执行 LLM**(避免阻塞响应)
4. 客户端用 EventSource 连 `sse_url` 后,Route Handler 才开始驱动 LangGraph

**错误**:
- `404 PROPOSAL_NOT_FOUND`
- `409 ALREADY_RUNNING`:该 proposal 已有 `status=running` 的 av(防双开)

**限流**:2/min(主 LLM 入口)

---

### 5.3 P03 推理流(4 端点,主流式)

#### 5.3.1 `GET /api/analyze`(SSE)— **主推理流式入口**

**对应 UI**:P03 全部 — 9 节点进度条 + Round 0 7 圆点 + Provider 角标 + Premortem

> **v2.3 GAN-A H-A-4 修**:原方案 `POST /api/analyze`(body 传 av_id)与 §6.2 客户端用 `new EventSource(GET URL)` 互相矛盾(浏览器原生 `EventSource` 仅支持 GET)。**改为 GET + query string**,语义上是"订阅已存在 av 的推理流"更准确;`av_id` 是 UUID(36 字符)放 URL 无长度问题。

**请求**:
```
GET /api/analyze?analysis_version_id=av_xxx
Accept: text/event-stream
```

**响应**:`200 text/event-stream`(maxDuration=300s)

**SSE 事件流**(顺序与 9 节点对齐,详见 §6):

```
event: started
data: {"analysis_version_id":"av_xxx","total_nodes":9}

event: node:start
data: {"node_id":"N1","node_name":"结构化 + 决策类型识别","layer":"L0"}

event: node:partial
data: {"node_id":"N1","partial_text":"已识别 3 个主张..."}

event: node:complete
data: {"node_id":"N1","duration_ms":6234,"summary":{"claims_count":7,"decision_type":"selection"}}

event: node:start
data: {"node_id":"N2","node_name":"L1 目标对齐","layer":"L1"}

event: node:complete
data: {"node_id":"N2","duration_ms":4128,"summary":{"alignment_score":0.82}}

event: l1:warning
data: {"alignment_score":0.42,"message":"该提案可能偏离声明目标"}
(只在 alignment_score < 0.5 时发,前端弹 Dialog)

event: node:start
data: {"node_id":"N3","node_name":"L2 证据召回","layer":"L2"}

event: node:complete
data: {"node_id":"N3","duration_ms":2456,"summary":{"recalled_count":12}}

event: node:start
data: {"node_id":"N4","node_name":"Round 0 Blind First-Vote","layer":"L3","is_parallel":true,"parallel_count":7}

event: persona:start
data: {"round":"round_0","persona_id":"per_ops","role":"operations"}

event: persona:start
data: {"round":"round_0","persona_id":"per_fin","role":"finance"}
... 7 个 persona:start 几乎同时发

event: persona:complete
data: {"round":"round_0","persona_id":"per_fin","role":"finance","attitude":"oppose","confidence":0.84,"reason_preview":"ROI 测算缺失..."}

(7 个 persona:complete 顺序到达,前端 7 圆点逐个变 ✓)

event: node:complete
data: {"node_id":"N4","duration_ms":11456,"summary":{"votes_count":7}}

event: node:start
data: {"node_id":"N5","node_name":"Round 1 二轮调整(伪并发)","layer":"L3","is_parallel":true,"parallel_count":7}

event: persona:complete
data: {"round":"round_1","persona_id":"per_brand","role":"brand","attitude":"conditional","adjust_reason":"看了运营观点后..."}

event: anchoring:detected
data: {"persona_id":"per_brand","claim_id":"claim_3","reason":"stance_flip_no_reason"}

event: node:complete
data: {"node_id":"N5","duration_ms":10234}

event: node:start
data: {"node_id":"N6","node_name":"TWS 轨迹加权评分","layer":"L4"}

event: node:complete
data: {"node_id":"N6","duration_ms":85,"summary":{"tws_score":0.42}}

event: node:start
data: {"node_id":"N7","node_name":"L4 权重加权","layer":"L4"}

event: node:complete
data: {"node_id":"N7","duration_ms":42,"summary":{"weighted_total":76}}

event: node:start
data: {"node_id":"N8","node_name":"Premortem","layer":"safety","is_parallel":true,"parallel_count":7}

event: node:complete
data: {"node_id":"N8","duration_ms":10876,"summary":{"risks_count":5}}

event: node:start
data: {"node_id":"N9","node_name":"决策报告生成","layer":"report"}

event: node:partial
data: {"node_id":"N9","partial_section":"conclusion","preview":"建议主推 A 款..."}

event: node:complete
data: {"node_id":"N9","duration_ms":12345}

event: provider:change
(可在任意节点发,告知降级)
data: {"from":"opus-4-7","to":"sonnet-4-6","reason":"timeout","node_id":"N9"}

event: final:report
data: {"analysis_version_id":"av_xxx","decision_report":{ ... 完整 P12 7 部分 ... }}

event: done
data: {"total_duration_ms":67234,"llm_call_count":24}
```

**HITL 暂停**:用户点 P03 ⏸ → 调 `POST /api/analyze/:id/pause` → 主流发送:
```
event: hitl:pending
data: {"checkpoint_id":"chk_xxx","node_id":"N5","state_summary":"..."}
```
此后流挂起,直到 `POST /api/analyze/:id/resume`。

**错误事件**:
```
event: error
data: {"code":"LLM_TIMEOUT","message":"...","recoverable":true,"node_id":"N4"}
```

**结束语义**:
- `done`:全部成功
- `error` + `recoverable=false`:致命错误,客户端关连接,跳错误页
- `error` + `recoverable=true`:LangGraph 自动重试,继续后续 `node:start`

**会发生什么**:
1. 启动 LangGraph thread(用 `analysis_version_id` 作 `thread_id`)
2. 每节点开始时 emit `node:start` + DB 更新 `analysis_versions.provider_used` 数组
3. 节点完成 → 把节点输出写入 `analysis_versions` 对应 JSONB 字段(immutable 增量填充)
4. 全部完成 → 更新 `status=completed` + `output_hash` + `completed_at`
5. 任何失败 → 进入降级链,emit `provider:change`
6. 全降级失败 → `status=degraded_offline`,跳过 LLM 节点,只返回 N1 离线规则结构化

**错误**(HTTP 层):
- `404 ANALYSIS_VERSION_NOT_FOUND`
- `409 ALREADY_COMPLETED`:已完成的 av 不能重复 SSE(去 5.4.1 查)

**限流**:同 5.2.5(2/min)

**幂等**:断线重连 → 客户端用相同 `analysis_version_id` + `Last-Event-ID` 头,服务端从 LangGraph checkpoint 恢复(LangGraph 内置幂等)

---

#### 5.3.2 `POST /api/analyze/:id/pause` — HITL 暂停

**对应 UI**:P03 ⏸ 按钮 / P07 面板 5 接管入口

**请求路径**:`POST /api/analyze/av_xxx/pause`

**请求体**:无

**响应** `202`:
```json
{
  "data": {
    "checkpoint_id": "chk_xxx",
    "node_id": "N5",
    "state_summary": "Round 1 进行中(3/7 完成)"
  }
}
```

**会发生什么**:
1. 调 LangGraph `interrupt()`(同 thread_id)
2. LangGraph PostgresSaver 自动持久化完整 state(到 `checkpoints`/`checkpoint_blobs` 等外部表)+ 业务层插入 `hitl_audit` 记录(thread_id / node_id / state_summary / auto_approve_at = now + 5min)
3. 在主 SSE 流上 emit `hitl:pending`
4. 创建 `audit_logs(action="hitl_pause")`

**错误**:
- `404 ANALYSIS_VERSION_NOT_FOUND`
- `409 NOT_RUNNING`:status 不是 running

**限流**:10/min

---

#### 5.3.3 `POST /api/analyze/:id/resume` — HITL 恢复

**对应 UI**:P03 HITL 面板 / P07 面板 5

**请求路径**:`POST /api/analyze/av_xxx/resume`

**请求体**:
```json
{
  "checkpoint_id": "chk_xxx",
  "decision": "approve" | "edit" | "reject",
  "reason": "...至少 5 字...",
  "edited_state": { ... }    // decision==="edit" 时必填,部分覆盖 graph state
}
```

**响应** `202`:`{ "data": { "resumed_at": "...", "next_node": "N5" } }`

**会发生什么**:
- `approve`:LangGraph `Command(resume=…)` 用原 state 继续
- `edit`:用 `edited_state` 覆盖部分 state 后 resume
- `reject`:直接标记 `analysis_versions.status="failed"`,不 resume,主 SSE emit `done` + 错误码

**错误**:
- `404 CHECKPOINT_NOT_FOUND`
- `400 RESUME_REASON_TOO_SHORT`:reason < 5 字
- `400 EDITED_STATE_INVALID`

**限流**:10/min

---

#### 5.3.4 `GET /api/analyze/:id/status` — 查询当前状态(回页面恢复)

**对应 UI**:用户离开 P03 后再回,需恢复进度

**请求路径**:`GET /api/analyze/av_xxx/status`

**响应** `200`:
```json
{
  "data": {
    "analysis_version_id": "av_xxx",
    "status": "running",
    "current_node_id": "N5",
    "completed_nodes": ["N1","N2","N3","N4"],
    "duration_so_far_ms": 28456,
    "active_persona_ids": ["per_brand","per_supply","per_region"],
    "has_pending_hitl": false,
    "estimated_remaining_ms": 25000
  }
}
```

**用途**:客户端拿到 status 后,若 running → 重连 SSE;若 completed → 跳 P04/P12;若 paused_hitl → 跳 HITL 面板

**孤儿 av 检测 + HITL 自动批准(v2.3 GAN-A H-A-8 + H-A-6 修)**:

本端点每次被调时,服务端额外检查两件事(轻量,< 10ms):

1. **孤儿 av 清理**:若当前 av `status="running"` 且 `created_at` 超过 5 分钟仍 `structured_claims IS NULL`(即 N1 都没完成,说明启动后客户端从未真正连 SSE),则:
   - 自动 `UPDATE analysis_versions SET status="failed", completed_at=now() WHERE id=...`
   - 写 `audit_logs(action="analysis_failed", metadata.reason="orphan_timeout")`
   - 响应里返回 `status="failed"` + `error_reason="orphan_timeout_no_sse_connect"`
2. **HITL 自动批准**:若该 av `status="paused_hitl"` 且对应 `hitl_audit.auto_approve_at < now()`(即 5 分钟超时未人工接管),则:
   - 调用 LangGraph `Command(resume=originalValue)` 自动恢复
   - `UPDATE hitl_audit SET resumed_at=now(), resume_decision="approve", resume_reason="auto-approve(5min timeout)"`
   - 写 `audit_logs(action="hitl_approve", metadata.actor="system")`
   - 响应里返回更新后的 status(通常变 running)

**为什么用 status 端点驱动而非独立 Cron**:Vercel Cron 最短 1 分钟触发,无法精确响应"刚好 5 分钟"。客户端 P03/P07 页面通常已经在每 3-5 秒轮询 status,触发时机充足。若用户不在页面,推理"卡"在 paused_hitl 也不影响其他 Demo 路径(可在 P10 历史页恢复)。

**限流**:60/min

---

### 5.4 P04 分歧热力图(2 端点)

#### 5.4.1 `GET /api/analysis-versions/:id` — 完整 av 数据

**对应 UI**:P04 主体(矩阵 + 顶部卡片 + 排序按钮 + anchoring 警示)

**请求路径**:`GET /api/analysis-versions/av_xxx`

**请求查询**:`?include=heatmap,citations,tws,anchoring` (默认全包含)

**响应** `200`:
```json
{
  "data": {
    "id": "av_xxx",
    "proposal_id": "prop_xxx",
    "version_label": "v1.0",
    "status": "completed",
    "structured_claims": [
      { "id":"claim_1","text":"主推 A 款","assumption":"...","data_gap":null },
      ...
    ],
    "personas": [
      { "id":"per_ops","role":"operations","weight":1.2,"icon":"Briefcase" },
      ...
    ],
    "matrix": {
      // 7 角色 × N 论点
      "rows": [
        {
          "persona_id": "per_fin",
          "role": "finance",
          "weight": 1.2,
          "cells": [
            {
              "claim_id": "claim_1",
              "attitude": "oppose",
              "confidence": 0.84,
              "reason": "ROI 测算缺失...",
              "citations": [ ...CitationSchema... ],
              "round_0_attitude": "oppose",
              "round_1_attitude": "oppose",
              "anchoring_flag": null
            },
            ...
          ]
        },
        ... 7 行
      ]
    },
    "headline_disagreement": "市场角色坚持 A 款符合品牌调性,但财务认为 ROI 测算缺失关键数据",
    "three_sentence_summary": ["...", "...", "..."],
    "tws_scores_by_claim": { "claim_1": 0.42, "claim_2": -0.15, ... },
    "anchoring_flags": [ ...AnchoringFlagSchema... ],
    "l1_alignment_score": 82,
    "average_confidence": 0.78,
    "low_confidence_count": 2,
    "total_duration_ms": 67234,
    "created_at": "...",
    "completed_at": "..."
  }
}
```

**错误**:
- `404 ANALYSIS_VERSION_NOT_FOUND`
- `409 STILL_RUNNING`:status=running → 提示用 SSE / status 端点

**限流**:60/min

---

#### 5.4.2 `PATCH /api/analysis-versions/:id/headline` — 编辑一句话核心分歧

**对应 UI**:P04 顶部一句话卡片"编辑"按钮

**请求体**:
```json
{
  "headline_disagreement": "...不超过 50 字..."
}
```

**响应** `200`:`{ "data": { "headline_disagreement": "...", "updated_at": "..." } }`

**说明(v2.3 GAN-A B-A-5 修)**:写入 `analysis_versions.headline_disagreement` 顶层列(schema §2.3.6 已显式定义,immutable 豁免字段,纯展示用)。**不写** `decision_report.minutes.headline_disagreement`(后者由 LLM 生成,不被用户编辑覆盖)。前端读取时优先用顶层 `headline_disagreement`,空则 fallback 到 `decision_report.minutes.headline_disagreement`。

**错误**:
- `400 HEADLINE_TOO_LONG`:> 50 字

**限流**:30/min

---

### 5.5 P05 Persona 工坊(4 端点)

#### 5.5.1 `GET /api/personas` — 7 角色列表

**对应 UI**:P05 卡片网格

**请求查询**:`?include_default=true`(默认 true)

**响应** `200`:
```json
{
  "data": [
    {
      "id": "per_ops",
      "role_type": "operations",
      "name": "运营",
      "icon": "Briefcase",
      "objective": "把活动节奏跑通",
      "kpis": ["流量转化率","库存周转","预算 ROI"],
      "interest_boundary": "不超预算 / 不爆库存",
      "natural_conflicts": ["finance","supply_chain"],
      "decision_catchphrase": "这个时间窗口我们的库存够吗?",
      "risk_appetite": "neutral",
      "notes": "...(append-only,显示前 200 字)",
      "is_default": true,
      "updated_at": "..."
    },
    ... 7 条
  ]
}
```

**限流**:60/min

---

#### 5.5.2 `GET /api/personas/:id` — 单角色详情(含完整 notes 历史)

**响应** `200`:同 5.5.1 单条 + 完整 `notes` + `decision_references`(从 P09 决议反查的引用列表)

**限流**:60/min

---

#### 5.5.3 `PATCH /api/personas/:id` — 编辑(P0 单租户允许,V2 限管理员)

**对应 UI**:P05 Drawer 表单提交

**请求体**:
```json
{
  "objective": "新目标...",
  "kpis": ["...","..."],
  "interest_boundary": "...",
  "natural_conflicts": ["finance"],
  "decision_catchphrase": "...",
  "risk_appetite": "conservative"
}
```
(不允许改 `role_type`,因为是 unique key)

**响应** `200`:`{ "data": { ... updated persona ... } }`

**会发生什么**:
1. Zod 校验
2. UPDATE personas(乐观锁:`If-Match` ETag 头,值=`updated_at`)
3. 写 `audit_logs(action="persona_edit")`

**错误**:
- `404 PERSONA_NOT_FOUND`
- `409 VERSION_CONFLICT`:ETag 不匹配(并发编辑)
- `400 INVALID_INPUT`

**限流**:30/min

---

#### 5.5.4 `POST /api/personas/:id/reset` — 重置为默认值

**请求体**:`{ "confirm": true }`(防误触)

**响应** `200`:返回重置后的 persona

**会发生什么**:
1. 从 `lib/db/seed/personas.ts` 读默认值
2. UPDATE 该 persona(除 `notes`/`id` 外全部覆盖)
3. `audit_logs(action="persona_reset")`

**错误**:
- `404 PERSONA_NOT_FOUND`
- `400 NOT_DEFAULT_RESETTABLE`:自定义 persona 不可重置(只能删)

**限流**:10/min

---

### 5.6 P06 讨论框架(3 端点,降级页)

#### 5.6.1 `GET /api/analysis-versions/:id/discussion-frame` — 3 段式

**对应 UI**:P06 主体

**响应** `200`:
```json
{
  "data": {
    "analysis_version_id": "av_xxx",
    "consensus": [
      { "id":"item_1","claim":"...","supporting_roles":["operations","products"],"citations":[ ... ] }
    ],
    "open_questions": [
      { "id":"item_2","question":"...","raised_by":["finance"],"default_owner":"finance","current_owner":"finance" }
    ],
    "data_gaps": [
      { "id":"item_3","gap":"...","needed_by":["finance","supply_chain"],"suggested_source":"ERP 库存数据" }
    ]
  }
}
```

**实现**:从 `decision_report` 派生(取 evidence_chain + key_disagreements + 论点的 data_gap 字段),无独立存储

**限流**:60/min

---

#### 5.6.2 `PATCH /api/analysis-versions/:id/discussion-frame/items/:itemId` — 编辑/Owner 分配

**请求体**:
```json
{
  "owner": "user_zhang",        // 可空
  "edited_text": "..."          // 可空(用户改写论点)
}
```

**响应** `200`

**错误**:`404 ITEM_NOT_FOUND`

**限流**:30/min

---

#### 5.6.3 `GET /api/analysis-versions/:id/export` — 导出(Markdown/PDF)

**请求查询**:`?format=markdown|pdf&scope=discussion_frame|decision_report|both`

**响应** `200`:
- `format=markdown` → `Content-Type: text/markdown`,body 是 md 文本
- `format=pdf` → `Content-Type: application/pdf`,body 是 PDF(用 `@vercel/og` 或 `puppeteer-core` 渲染)

**限流**:10/min(PDF 渲染贵)

---

### 5.7 P07 Safety Center(10 端点,8 面板)

#### 5.7.1 面板 1 — `GET /api/llm/provider-events` — 降级链事件

**请求查询**:`?limit=10&analysis_version_id=av_xxx`(后者可空,空则全局)

**响应** `200`:
```json
{
  "data": {
    "current_provider": "opus-4-7",
    "fallback_chain": ["opus-4-7","sonnet-4-6","haiku-4-5","offline-rules"],
    "events": [
      { "id":"...", "from":"opus-4-7", "to":"sonnet-4-6", "reason":"timeout", "node_id":"N9", "at":"..." },
      ...
    ]
  }
}
```

**限流**:60/min

---

#### 5.7.2 面板 1 — `POST /api/llm/manual-degrade` — Demo 手动降级一档

**请求体**:`{ "reason": "demo_演示降级机制" }`

**响应** `200`:
```json
{
  "data": {
    "from": "opus-4-7",
    "to": "sonnet-4-6",
    "active_for_seconds": 300,   // 自动恢复倒计时
    "recovered_at": null
  }
}
```

**会发生什么**:
1. 在 `lib/llm/gateway.ts` 维护"manual override"状态(Upstash Redis 存,300s TTL)
2. 之后所有 LLM 调用绕过原 provider,直接走 fallback
3. 写 `provider_events(reason="manual")` + `audit_logs(action="provider_degrade")`

**限流**:5/min(防滥用)

---

#### 5.7.3 面板 2 — `GET /api/proposals/:id/redaction-diff` — 脱敏 diff

**响应** `200`:
```json
{
  "data": {
    "proposal_id": "prop_xxx",
    "raw_text": "...原始(含敏感)...",  // ⚠ 仅服务端短时可读,前端拿到后即时丢弃
    "redacted_text": "...脱敏后...",
    "diff_segments": [
      { "start":12,"end":18,"original":"供应商 XX","placeholder":"[供应商_001]","detected_by":"regex" },
      { "start":45,"end":52,"original":"¥3000-5000","placeholder":"[价格区间_A]","detected_by":"llm_haiku" }
    ],
    "restoration_map_token": "rm_xxx"    // 一次性 token,仅供前端 5 分钟内调还原
  }
}
```

**注**:`raw_text` 返回是为了 diff 渲染,**前端必须用后立即从 React state 移除**,不允许 cache / localStorage。`restoration_map_token` 用于 5.7.4 还原(短期)。

**错误**:
- `404 PROPOSAL_NOT_FOUND`
- `403 RAW_TEXT_EXPIRED`:提案 > 7 天,raw_text 已被定时任务清除

**限流**:10/min

---

#### 5.7.4 面板 2 — `POST /api/proposals/:id/restoration-map/download` — 还原映射表下载

**请求体**:`{ "restoration_map_token": "rm_xxx" }`

**响应** `200`:`Content-Type: text/csv`,body 是 CSV 文件(原值 ↔ 占位符)

**注**:**仅本浏览器会话内有效**,token 5 分钟过期。下载文件后服务端立即销毁 token。

**错误**:`403 TOKEN_EXPIRED`

---

#### 5.7.5 面板 3 — `GET /api/analysis-versions/:id/confidence-stats` — 置信度统计

**响应** `200`:
```json
{
  "data": {
    "average_confidence": 0.78,
    "color_band": "yellow",     // <0.6 red / 0.6-0.8 yellow / >0.8 green
    "per_claim": [
      { "claim_id":"claim_1","confidence":0.84,"persona_id":"per_fin","reason":"..." },
      ...
    ],
    "low_confidence_claims": [
      { "claim_id":"claim_3","confidence":0.42,"suggested_action":"建议人工复核" }
    ],
    "overall_banner": null      // 或 "本次推理整体置信度较低,建议补充提案细节"
  }
}
```

**限流**:60/min

---

#### 5.7.6 面板 4 — `GET /api/proposals/:id/versions` — 版本列表

**响应** `200`:
```json
{
  "data": {
    "current_version_id": "av_3",
    "versions": [
      { "id":"av_1","version_label":"v1.0","trigger":"initial","summary":"...","created_at":"..." },
      { "id":"av_2","version_label":"v1.1","trigger":"user_rerun","created_at":"..." },
      { "id":"av_3","version_label":"v1.3(回滚自 v1.1)","trigger":"rollback","rollback_from":"av_2","created_at":"..." }
    ]
  }
}
```

**限流**:60/min

---

#### 5.7.7 面板 4 — `POST /api/proposals/:id/rollback` — 版本回滚

**对应 UI**:P07 面板 4 "回滚到此版"按钮(二次确认后)

**请求体**:
```json
{
  "target_analysis_version_id": "av_1",
  "reason": "回滚理由..."   // ≥ 5 字
}
```

**响应** `201`:
```json
{
  "data": {
    "new_analysis_version_id": "av_4",
    "version_label": "v1.4(回滚自 v1.0)",
    "rollback_from_id": "av_1"
  }
}
```

**会发生什么**:
1. 创建新 `analysis_versions` 记录,**复制** target av 的全部 JSONB 字段
2. 设置 `rollback_from_id = av_1`
3. **更新 `proposals.current_analysis_version_id = new av_id`**(H-A-7,回滚是主线动作)
4. 写 `audit_logs(action="rollback")`
5. **不删原数据**(append-only 保证)

**错误**:
- `404 TARGET_VERSION_NOT_FOUND`
- `400 ROLLBACK_REASON_TOO_SHORT`

**限流**:5/min

---

#### 5.7.8 面板 5 — `GET /api/hitl/pending` — 待接管的暂停推理

**响应** `200`:
```json
{
  "data": {
    "pending_count": 1,
    "items": [
      {
        "checkpoint_id": "chk_xxx",
        "analysis_version_id": "av_xxx",
        "proposal_title": "...",
        "paused_at_node": "N5",
        "paused_at": "...",
        "auto_approve_at": "..."   // 5 分钟后自动批准
      }
    ]
  }
}
```

**限流**:60/min

---

#### 5.7.9 面板 5 — `POST /api/hitl/:checkpointId/takeover` — 接管

**请求体**:同 5.3.3(`{ decision, reason, edited_state? }`)

**响应**:同 5.3.3

**注**:本端点是 5.3.3 的别名(从 P07 进入的入口),实现上指向同一 handler。

---

#### 5.7.10 面板 6 — `GET /api/audit-logs` — 审计日志列表

**请求查询**:`?cursor=…&limit=20&actor=…&action=…&target_id=…&from=…&to=…`

**响应** `200`:
```json
{
  "data": {
    "items": [
      {
        "id": "...",
        "actor": "anonymous",
        "action": "proposal_create",
        "target_type": "proposal",
        "target_id": "prop_xxx",
        "input_hash": "sha256:...",
        "output_hash": "sha256:...",
        "metadata": { "title":"..." },
        "created_at": "..."
      }
    ],
    "next_cursor": "..."
  }
}
```

**限流**:60/min(只读)

---

#### 5.7.11 面板 6 — `GET /api/audit-logs/export` — 导出 CSV

**请求查询**:同 5.7.10 筛选

**响应** `200`:`Content-Type: text/csv`,流式输出

**限流**:5/min

---

#### 5.7.12 面板 7 — `GET /api/reproducibility-check`(SSE 聚合)— 稳定性测试

> **v2.3 GAN-A H-A-4 修**:同 §5.3.1,SSE 端点统一改 GET。客户端发起前先 `POST /api/proposals/:id/reproducibility-runs/start`(下方 5.7.12a 新增)创建 run 记录,然后 `EventSource(GET sse_url)` 订阅。

**两阶段调用**:
1. **第一步(POST 创建 run)** — `POST /api/proposals/:proposal_id/reproducibility-runs/start`(下方 5.7.12a 详述):
   - 请求体可空(默认基于该 proposal 最新 completed av);若指定基线 `{"base_analysis_version_id":"av_xxx"}`
   - 响应:`{ data: { reproducibility_run_id, analysis_version_ids:[3], params:[3], sse_url: "/api/reproducibility-check?rr_id=rr_xxx" } }`
2. **第二步(GET 订阅 SSE)** — `GET /api/reproducibility-check?rr_id=rr_xxx`(本端点)

**响应**:`text/event-stream`

**实现策略(关键!避免单函数 300s)**:
- 此 SSE 端点**本身不调 LLM**,只做协调和指标聚合
- 客户端按第一步返回的 3 个 av_id,**用浏览器 fetch 并发**发起 3 个独立的 `GET /api/analyze?analysis_version_id=av_x` SSE 流(各自计 300s)
- 客户端把 3 个流的进度汇总展示
- 全部完成后客户端 `POST /api/reproducibility-runs/:rr_id/finalize` 提交 3 个 av_id + metrics(§5.7.13)

**SSE 事件**(来自本端点本身,主要用于服务端推送 metrics 增量更新):
```
event: triggered
data: {"reproducibility_run_id":"rr_xxx"}

event: repro:metric_update
data: {"partial_metrics":{"conclusion_consistency_pct":67,"top3_jaccard":null}}
(每个子 av 完成时,客户端调 finalize,服务端推回部分指标)

event: done
data: {"reproducibility_run_id":"rr_xxx","verdict":"stable"}
```

**限流**:1/min(等效 3 RPM Anthropic Sonnet × 21 路并发,Demo 演示场景充足)

---

#### 5.7.12a 面板 7 — `POST /api/proposals/:proposal_id/reproducibility-runs/start` — 创建 run + 预分配 3 个 av_id

**对应 UI**:5.7.12 第一步

**请求体**:
```json
{
  "base_analysis_version_id": "av_xxx"   // 可空,空则用 proposal 最新 completed av 作基线复制 structured_claims
}
```

**响应** `201`:
```json
{
  "data": {
    "reproducibility_run_id": "rr_xxx",
    "analysis_version_ids": ["av_a", "av_b", "av_c"],
    "params": [
      {"temperature": 0.3, "seed": 42},
      {"temperature": 0.4, "seed": 84},
      {"temperature": 0.5, "seed": 126}
    ],
    "sse_url": "/api/reproducibility-check?rr_id=rr_xxx"
  }
}
```

**会发生什么**:
1. 创建 `reproducibility_runs` 占位记录(`run_count=3`, metrics 全为 null,verdict="partial"待 finalize)
2. 预创建 3 个 `analysis_versions` 记录(都引用同一 proposal_id,各自不同 temperature/seed,status=running)
3. 写 `audit_logs(action="reproducibility_run")`

**错误**:`404 PROPOSAL_NOT_FOUND` / `404 BASE_AV_NOT_FOUND` / `429 RATE_LIMIT_EXCEEDED`

**限流**:1/min

**降级**:若 Anthropic 429 → 主 SSE 不影响,各子流自行降级

---

#### 5.7.13 面板 7 — `POST /api/reproducibility-runs/:id/finalize` — 聚合 metrics

**请求体**:
```json
{
  "analysis_version_ids": ["av_a","av_b","av_c"]
}
```

**响应** `200`:`{ "data": { ...ReproducibilityMetricsSchema... } }`

**会发生什么**:
1. 服务端读 3 个 av 的 decision_report
2. 计算:
   - `conclusion_consistency_pct` = (相同 conclusion.status 占比)
   - `top3_jaccard` = 3 个版本 key_disagreements top3 claim_id 集合的 Jaccard 平均
   - `evidence_overlap_pct` = 3 个版本引用的 evidence_card_id 集合交集 / 并集
3. 判 verdict(stable/partial/unstable)
4. UPDATE `reproducibility_runs`

---

#### 5.7.14 面板 7 — `GET /api/reproducibility-runs/:id` — 单次稳定性结果

**响应** `200`:返回 ReproducibilityMetrics + 3 个 av 摘要 + 对比表数据

**限流**:60/min

---

#### 5.7.15 面板 7 — `GET /api/proposals/:id/reproducibility-runs` — 该提案的所有稳定性测试历史

**对应 UI**:P10 历史页"稳定性测试历史" + P07 面板 7 历史区

**响应** `200`:`{ "data": { "items": [ ... ] } }`(分页)

**限流**:60/min

---

#### 5.7.16 面板 8 — `GET /api/analysis-versions/:id/prompts` — Prompt 透明度

**对应 UI**:P07 面板 8 — 展示实际注入的 prompts

**响应** `200`:
```json
{
  "data": {
    "l1_objective_prompt": "...",    // 实际注入的 L1 系统 prompt
    "l3_persona_prompts": {
      "operations": "...",
      "finance": "...",
      ...
    },
    "tws_explanation": "TWS = 0.6 * R0 + 0.4 * R1 ; ATTITUDE_SCORE = ...",
    "premortem_prompt": "...",
    "ab_compare_status": "ready" | "pending" | "not_run",
    "methodology_ab_compare": {
      "with_methodology": { "top3_disagreements_count": 3, "citations_count": 18 },
      "without_methodology": { "top3_disagreements_count": 5, "citations_count": 7 }
    } | null
  }
}
```

**说明(v2.3 GAN-A B-A-3 修)**:`methodology_ab_compare` **不自动触发**(原方案"首次访问异步触发"会让 P07 面板 8 卡 60s,挤压路演 30s 时间窗)。新规则:
- `ab_compare_status="not_run"` → `methodology_ab_compare=null`,前端显示**"点击触发对照分析"按钮**(显式触发,避免误以为面板卡死)
- 用户点按钮 → 调 `POST /api/analysis-versions/:id/prompts/ab-compare`(下方独立端点),响应 `202 Accepted` + 返回 `ab_compare_status="pending"`;前端切到 polling
- 后台异步跑"无方法论"对照推理(用 Haiku 4.5 + 简化 prompt,~20-30s),完成后写入 av JSONB,`ab_compare_status="ready"`
- 路演策略:**Demo 前 30 分钟由演讲者后台预触发一次**,演讲时直接 `ready`,30s 内一屏展示

**限流**:30/min(读取),触发端点 5/min

---

#### 5.7.17 面板 8 — `POST /api/analysis-versions/:id/prompts/ab-compare` — 触发"无方法论"对照分析

**对应 UI**:P07 面板 8 "点击触发对照分析"按钮

**请求体**:无

**响应** `202 Accepted`:
```json
{
  "data": {
    "ab_compare_status": "pending",
    "estimated_ready_at": "..."   // 预计 20-30s
  }
}
```

**会发生什么**:
1. 异步调度一次"无方法论"对照推理(`async/await` 但不阻塞响应,后台 promise)
2. 用 Haiku 4.5 + 简化 prompt(去掉 L1/L3/Premortem 注入,只让 7 角色自由发言)
3. 完成后写入 `analysis_versions.methodology_ab_compare` JSONB 字段
4. 前端轮询 5.7.16 直到 `ab_compare_status="ready"`

**错误**:
- `404 ANALYSIS_VERSION_NOT_FOUND`
- `409 AB_COMPARE_ALREADY_RUNNING`(同一 av 重复触发)
- `409 AB_COMPARE_ALREADY_READY`(已有结果,无需重跑;若想重跑提供 `?force=true`)

**限流**:5/min(后台跑 LLM,防滥用)

---

### 5.8 P08 评审视角对照(无 API)

**纯 SSR**:`app/judge-view/page.tsx` Server Component,数据全部硬编码或读 markdown 文件(`docs/design/02-pages/P08-judge-cheatsheet.md` 静态导入)。**无任何 API 端点**。

**例外**:页面底部"GitHub 仓库"链接、QR 码生成 → 客户端组件 `qrcode.react` 本地生成,无 API。

---

### 5.9 P09 决议录入(3 端点)

#### 5.9.1 `POST /api/decisions` — 录入决议(AAR)

**对应 UI**:P09 表单提交

**请求体**(Zod):
```json
{
  "proposal_id": "prop_xxx",
  "analysis_version_id": "av_xxx",
  "prev_decision_id": null,
  "status": "approved",
  "summary": "...",
  "key_changes": ["原 X → 现 Y", "..."],
  "attendees": ["张三","李四"],
  "meeting_date": "2026-05-23T14:00:00+08:00",
  "affected_persona_ids": ["per_fin","per_supply"],
  "aar_expected": "...",
  "aar_actual": "...",
  "aar_gap_reason": "",
  "aar_next_improvement": "..."
}
```

**Zod 强约束**(`DecisionAarSchema.refine`):4 个 AAR 字段至少 2 个非空

**响应** `201`:
```json
{
  "data": {
    "decision_id": "dec_xxx",
    "weight_suggestions": [
      {
        "id": "ws_1",
        "role": "finance",
        "current_weight": 1.2,
        "suggested_weight": 1.4,
        "reason": "财务预测的 ROI 风险在实际中发生,建议提高权重"
      }
    ]
  }
}
```

**会发生什么**:
1. INSERT decisions(append-only)
2. 给每个 `affected_persona_ids` 的 persona append 一段到 `notes`(格式见 P09 文档)
3. 异步调 LLM 生成 weight_suggestions(基于 AAR 字段对比预测 vs 实际)
4. 写 `audit_logs(action="decision_create")`

**错误**:
- `400 INVALID_INPUT`
- `422 AAR_TOO_FEW_FIELDS`:< 2 个非空或单字段 trim 后 < 10 字
- `404 PROPOSAL_NOT_FOUND` / `ANALYSIS_VERSION_NOT_FOUND`
- `404 PERSONA_NOT_FOUND`
- `404 PREV_DECISION_NOT_FOUND`:prev_decision_id 指向的决议不存在(v2.3 GAN-A H-A-9)
- `400 PREV_DECISION_CROSS_PROPOSAL`:prev_decision_id 属于其他 proposal(链式决议必须同 proposal_id 内)

**会发生什么**(补充 v2.3 GAN-A H-A-9 修):
1. 若 `prev_decision_id` 不为 null,**先校验**:
   - 该决议存在 → 否则 `404 PREV_DECISION_NOT_FOUND`
   - 该决议的 `proposal_id` == 本次请求的 `proposal_id` → 否则 `400 PREV_DECISION_CROSS_PROPOSAL`
   - **不需要防循环**(decisions 是 immutable + append-only,新建决议不可能指向未来的决议,逻辑上不可能成环)

**限流**:10/min

---

#### 5.9.2 `GET /api/proposals/:id/decisions` — 决议历史

**响应** `200`:`{ "data": { "items": [ ... ] } }`(按 created_at 倒序,链式 prev_decision_id)

**限流**:60/min

---

#### 5.9.3 `POST /api/decisions/:id/weight-suggestions/accept` — 采纳权重调整建议

**请求体**:`{ "suggestion_ids": ["ws_1","ws_2"] }`

**响应** `200`:`{ "data": { "accepted": ["ws_1","ws_2"], "updated_default_weights": { "finance": 1.4 } } }`

**会发生什么**:
1. UPDATE `decisions.weight_suggestions_accepted` 数组
2. UPDATE `personas.notes` 追加"权重调整记录"
3. **不修改** L4 默认权重表(仍由 methodology.md 决定),只在该角色 metadata 中标记"用户偏好建议权重"
4. **未来推理**:`lib/consensus/weight-calculator.ts` 优先读 persona-level override,fallback 到默认表

**错误**:`404 SUGGESTION_NOT_FOUND`

**限流**:10/min

---

### 5.10 P10 历史(3 端点)

#### 5.10.1 `GET /api/proposals` — 提案列表(分页 + 筛选)

**对应 UI**:P10 表格

**请求查询**:`?cursor=…&limit=20&status=…&decision_type=…&persona_id=…&from=…&to=…&include_deleted=false`

**响应** `200`:
```json
{
  "data": {
    "items": [
      {
        "id":"prop_xxx",
        "title":"...",
        "decision_type":"selection",
        "current_version_label":"v1.3",
        "current_analysis_version_id":"av_xxx",
        "decision_status":"approved",        // 最新决议状态
        "consensus_band":"green",            // 共识度颜色,派生规则见下
        "participant_personas":["operations","finance",...],
        "created_at":"...",
        "reproducibility_verdict": "stable"  // 最近一次稳定性测试结果(可空)
      }
    ],
    "next_cursor":"..."
  }
}
```

**派生字段计算规则(v2.3 GAN-A H-A-5 修)**:

| 字段 | 来源 |
|---|---|
| `current_version_label` | `analysis_versions.version_label` WHERE `id = proposals.current_analysis_version_id`(详见 H-A-7) |
| `current_analysis_version_id` | `proposals.current_analysis_version_id` 顶层字段(详见 H-A-7) |
| `decision_status` | `decisions.status` ORDER BY `created_at DESC` LIMIT 1 WHERE `proposal_id`(无决议则 null) |
| `consensus_band` | 从 `analysis_versions.decision_report.scoring.weighted_total` 派生:`≥70→green`,`40-69→yellow`,`<40→red`(取 current av) |
| `participant_personas` | `proposals.selected_persona_ids` 的 role_type 数组(JOIN personas) |
| `reproducibility_verdict` | `reproducibility_runs.verdict` ORDER BY `created_at DESC` LIMIT 1 WHERE `proposal_id`(无则 null) |

**实现提示**:用一个 SQL JOIN 查询全部派生字段(用 LATERAL 子查询或 Drizzle relations 一次拿全),避免 N+1。

**限流**:60/min

---

#### 5.10.2 `GET /api/personas/:id/evolution` — Persona 演化时间轴

**响应** `200`:
```json
{
  "data": {
    "persona_id":"per_fin",
    "created_at":"...",
    "events": [
      { "type":"created","at":"...","snapshot":{ ... } },
      { "type":"decision_writeback","at":"...","decision_id":"dec_xxx","appended_note":"..." },
      { "type":"metadata_edit","at":"...","diff":{ "objective": { "from":"...","to":"..." } } },
      { "type":"reset_to_default","at":"..." },
      { "type":"weight_suggestion_accepted","at":"...","suggestion":{ ... } }
    ]
  }
}
```

**限流**:30/min

---

#### 5.10.3 `POST /api/proposals/:id/duplicate` — 复制为新提案

**响应** `201`:`{ "data": { "new_proposal_id": "prop_yyy", "redirect_to":"/proposals/prop_yyy/edit" } }`

**会发生什么**:复制 `raw_text` + `decision_type` + `selected_persona_ids` + `declared_objective_id`,不复制 analysis_versions

**限流**:10/min

---

### 5.11 P11 证据库(5 端点)

#### 5.11.1 `GET /api/evidence/sources` — 证据源列表

**响应** `200`:
```json
{
  "data": {
    "internal": [
      { "id":"src_1","name":"历史决议","status":"active","icon":"CheckCircle2","count":42 },
      { "id":"src_2","name":"Demo Fixture - 七夕情侣对戒","status":"active","icon":"CheckCircle2","count":15 },
      { "id":"src_3","name":"飞书文档","status":"pending_v2","icon":"Clock","count":0 }
    ],
    "external": [
      { "id":"src_4","name":"小红书声量(Fixture)","status":"active","icon":"Globe","count":8 },
      ...
    ]
  }
}
```

**注**:`icon` 字段是 Lucide 名(禁 emoji);`pending_v2` 状态在 UI 渲染时显示"V2 即将支持"

**限流**:60/min

---

#### 5.11.2 `GET /api/evidence/cards` — 证据卡片列表

**请求查询**:`?source_id=src_1&cursor=…&limit=20&sort=relevance|recent&relevance_for_proposal=prop_xxx`

**响应** `200`:
```json
{
  "data": {
    "items": [
      {
        "id":"ec_xxx",
        "source_id":"src_1","source_name":"历史决议",
        "title":"...",
        "snippet":"...(前 200 字)",
        "tags":["产品","市场"],
        "cited_count": 7,
        "relevance_score": 0.87,         // 仅 sort=relevance 时有
        "created_at":"..."
      }
    ],
    "next_cursor":"..."
  }
}
```

**限流**:60/min

---

#### 5.11.3 `GET /api/evidence/cards/:id` — 单卡片完整内容

**响应** `200`:同上 + `full_content`

**限流**:60/min

---

#### 5.11.4 `POST /api/evidence/search` — 关键词 / embedding 搜索

**请求体**:
```json
{
  "query": "ROI 测算",
  "mode": "keyword" | "embedding",
  "top_k": 10,
  "filter": { "source_ids":["src_1","src_2"], "tags":["财务"] }
}
```

**响应** `200`:
```json
{
  "data": {
    "items": [
      { "id":"ec_xxx","title":"...","snippet":"...","similarity":0.87,"source_name":"..." }
    ]
  }
}
```

**实现**:
- `keyword`:Postgres LIKE / pg_trgm,< 200ms
- `embedding`:调 `lib/llm/embedding.ts`(OpenAI/Voyage via AI Gateway)→ in-memory cosine 在 retriever cache 内排序

**错误**:
- `400 QUERY_REQUIRED`
- `502 EMBEDDING_PROVIDER_DOWN`:降级到 keyword(响应 header `X-Search-Mode-Fallback: keyword`)

**限流**:10/min(embedding 模式)/ 30/min(keyword)

---

#### 5.11.5 `GET /api/analysis-versions/:id/cited-evidence` — 本次推理引用统计

**对应 UI**:P11 Tab "本次推理引用了哪些证据"

**响应** `200`:
```json
{
  "data": {
    "top_cited": [
      { "evidence_card_id":"ec_xxx","title":"...","cited_by_personas":["finance","supply_chain"],"count":3 }
    ],
    "suspicious_citations": [
      { "evidence_card_id":"ec_yyy","title":"...","relevance":0.42,"reason":"低于 0.5 阈值" }
    ]
  }
}
```

**限流**:60/min

---

### 5.12 P12 决策报告(6 端点)

#### 5.12.1 `GET /api/analysis-versions/:id/decision-report` — 完整 7 部分

**响应** `200`:
```json
{
  "data": {
    "analysis_version_id":"av_xxx",
    "version_label":"v1.3",
    "report": { ...DecisionReportSchema 完整... }
  }
}
```

**注**:`report` 直接从 `analysis_versions.decision_report` JSONB 读

**限流**:60/min

---

#### 5.12.2 `PATCH /api/analysis-versions/:id/decision-report/conclusion` — 用户覆盖结论

**请求体**:
```json
{
  "status": "approved",
  "summary": "新摘要 ≤ 50 字",
  "reason": "覆盖理由 ≥ 5 字"
}
```

**响应** `200`:`{ "data": { "report": { ... } } }`

**会发生什么**:
1. 因 `analysis_versions` 是 immutable,**不直接 UPDATE av**;而是
2. 创建新 `analysis_versions` 记录(`rollback_from_id=原 av`, version_label="v1.4(用户覆盖结论)")
3. 复制旧 report,仅修改 conclusion 部分
4. 写 audit_logs

**错误**:
- `400 SUMMARY_TOO_LONG`:summary > 50 字
- `400 REASON_TOO_SHORT`

**限流**:10/min

---

#### 5.12.3 `PATCH /api/analysis-versions/:id/decision-report/weights` — 调整权重

**对应 UI**:P12 § ② "调整权重"按钮

**请求体**:
```json
{
  "weight_changes": [
    { "role":"finance","new_weight":1.4,"reason":"提高财务话语权" }
  ]
}
```

**响应** `200`:返回**重算后**的 ② 评分 + 影响的 claim trajectory_scores

**会发生什么**:
1. 同 5.12.2,新建版本(因为权重影响最终分,数据不可改)
2. **重算 TWS**(纯计算,不调 LLM,< 100ms)
3. 重新生成 conclusion + key_disagreements top3(如果分数变化导致排序变)
4. 写 audit_logs(weight_override)

**错误**:
- `400 WEIGHT_OUT_OF_RANGE`:不在 [0.5, 2.0]
- `400 REASON_TOO_SHORT`

**限流**:10/min

---

#### 5.12.4 `PATCH /api/analysis-versions/:id/decision-report/raci/:itemId` — 修改 RACI 行动项

**请求体**:
```json
{
  "action": "新动作",
  "responsible": ["..."],
  "accountable": "...",
  "consulted": ["..."],
  "informed": ["..."],
  "due_date": "..."
}
```

**响应** `200`:同 5.12.1

**注(v2.3 GAN-A B-A-6 修)**:行动项可改但不创新版本(因为 RACI 是协作字段,频繁改新版本太重)。**实现**:写入 `analysis_versions.decision_report_overrides.action_items[]` JSONB 字段(schema §2.3.6 已定义)。**读时合并规则**:`GET /api/analysis-versions/:id/decision-report`(§5.12.1)在返回 `decision_report` 时,**若 `decision_report_overrides.action_items` 非空,用它整体替换 `decision_report.action_items`**(不做行内合并,避免歧义)。审计:每次修改 INSERT 一条 `audit_logs(action="raci_override")`。

**`audit_logs.auditActionEnum` 同步扩展**:在 §2.3.9 的 enum 中追加 `"raci_override"`。

**限流**:30/min

---

#### 5.12.5 `GET /api/analysis-versions/:id/decision-report/export` — 导出

**请求查询**:`?format=pdf|markdown`

**响应**:同 5.6.3 但 scope 锁定 decision_report

**限流**:10/min

---

#### 5.12.6 `POST /api/analysis-versions/:id/fork` — Fork 新版本(基于此报告)

**对应 UI**:P12 底部"生成新版本"按钮

**响应** `201`:`{ "data": { "new_analysis_version_id":"av_yyy", "version_label":"v2.0(fork from v1.3)" } }`

**会发生什么**:
1. 创建新 av,复制 structured_claims + recalled_evidence_ids,**重跑** N4~N9(用相同 proposal + 不同 seed)
2. **不更新 `proposals.current_analysis_version_id`**(H-A-7,fork 是探索分支,主线不变;用户想切换需在 P07 面板 4 显式选)

**限流**:2/min(同 analyze 主入口)

---

### 5.13 共享 / 全局(2 端点)

#### 5.13.1 `POST /api/llm/embedding` — 内部 embedding 服务

**用途**:`lib/evidence/retriever.ts` 内部调用(P11 搜索 / N3 证据召回)。**不直接暴露给前端**,只在 server-side `lib/` 调用。

**请求体**:`{ "texts": ["...", "..."], "model": "text-embedding-3-small" }`

**响应** `200`:`{ "data": { "embeddings": [ [...1536 维...], [...] ] } }`

**实现**:走 AI Gateway 的 embedding 路由,带 ZDR

---

#### 5.13.2 `GET /api/health` — 健康检查

**响应** `200`:
```json
{
  "data": {
    "status": "ok",
    "deps": {
      "neon": "ok",
      "ai_gateway": "ok",
      "vercel_kv": "ok"
    },
    "version": "v2.2.0",
    "deployed_at": "..."
  }
}
```

**限流**:无(Vercel/UptimeRobot 探测)

---

## 6. SSE 协议详细规范

### 6.1 事件类型清单

| event | 触发节点 | data 字段 | 客户端动作 |
|---|---|---|---|
| `started` | 主流开始 | `{analysis_version_id, total_nodes}` | 初始化进度条 |
| `node:start` | 每节点开始 | `{node_id, node_name, layer, is_parallel?, parallel_count?}` | 高亮当前节点 + 显示子标题 |
| `node:partial` | LLM 流式中间输出 | `{node_id, partial_text|partial_section}` | 增量渲染折叠面板 |
| `node:complete` | 每节点完成 | `{node_id, duration_ms, summary}` | 节点变 ✓ + 显示耗时 |
| `persona:start` | Round 0/1 单角色开始 | `{round, persona_id, role}` | 圆点变脉冲 |
| `persona:complete` | Round 0/1 单角色完成 | `{round, persona_id, role, attitude, confidence, reason_preview, adjust_reason?}` | 圆点变 ✓ + 显示态度 |
| `anchoring:detected` | N5 检测 | `{persona_id, claim_id, reason, cosine_score?}` | P04 cell 加 2px 橙边框 |
| `provider:change` | 任意节点降级 | `{from, to, reason, node_id?, error_message?}` | Provider 角标变色 + toast |
| `l1:warning` | N2 alignment<0.5 | `{alignment_score, message}` | 弹 Dialog 确认 |
| `hitl:pending` | `/pause` 触发 | `{checkpoint_id, node_id, state_summary}` | 显示接管面板 |
| `repro:triggered` | 5.7.12 | `{reproducibility_run_id, analysis_version_ids[3], params[3]}` | 客户端并发起 3 个 /api/analyze |
| `repro:metric_update` | 客户端聚合后回填 | `{partial_metrics}` | 实时更新指标 |
| `final:report` | N9 完成 | `{analysis_version_id, decision_report}` | 跳 P04/P12 |
| `error` | 任意时刻 | `{code, message, recoverable, node_id?}` | recoverable 显示 toast / 否则关连接 |
| `done` | 主流结束 | `{total_duration_ms, llm_call_count}` | 关 EventSource |

### 6.2 客户端实现示例(伪代码)

```typescript
// app/(app)/analysis/[id]/use-analysis-stream.ts
export function useAnalysisStream(analysisVersionId: string) {
  const [state, dispatch] = useReducer(reducer, initialState);

  useEffect(() => {
    // v2.3 GAN-B H-B-3 修:P0 阶段匿名访问,无需带 Cookie;withCredentials=true 在跨域 Preview 部署会触发 CORS preflight 失败
    const es = new EventSource(`/api/analyze?analysis_version_id=${analysisVersionId}`);

    es.addEventListener("started", (e) => dispatch({ type: "STARTED", payload: JSON.parse(e.data) }));
    es.addEventListener("node:start", (e) => dispatch({ type: "NODE_START", payload: JSON.parse(e.data) }));
    es.addEventListener("persona:complete", (e) => dispatch({ type: "PERSONA_COMPLETE", payload: JSON.parse(e.data) }));
    es.addEventListener("provider:change", (e) => {
      const d = JSON.parse(e.data);
      toast.warning(`Provider 已切换:${d.from} → ${d.to}(${d.reason})`);
      dispatch({ type: "PROVIDER_CHANGE", payload: d });
    });
    es.addEventListener("final:report", (e) => {
      dispatch({ type: "REPORT_READY", payload: JSON.parse(e.data) });
      router.push(`/analysis/${analysisVersionId}/heatmap`);
    });
    es.addEventListener("done", () => es.close());
    es.addEventListener("error", (e) => {
      // 注意:浏览器内置 onerror 与服务端 emit "error" 同名,区分
      const d = JSON.parse((e as MessageEvent).data ?? "{}");
      if (d.recoverable === false) {
        es.close();
        toast.error(d.user_message);
      }
    });

    return () => es.close();
  }, [analysisVersionId]);

  return state;
}
```

### 6.3 断线重连

- EventSource 内置自动重连(浏览器原生)
- 服务端在 `Last-Event-ID` 头识别已发事件,从 LangGraph checkpoint 恢复(LangGraph 自带幂等)
- 若 av status=completed,服务端直接 emit `final:report` + `done`

---

## 7. LangGraph 9 节点 ↔ API 边界对照

> 这张表是 Phase 5 开发任务拆分的关键依据。每节点的实现文件 / 对应 SSE 事件 / 对应 REST 端点都已锁定。

| 节点 | 实现文件 | LLM 模型 | LLM 调用数 | SSE 事件 | 对应 REST 端点 | 写入的 av JSONB 字段 |
|---|---|---|---|---|---|---|
| **N1 结构化+决策类型** | `lib/graph/nodes/n1-structurize.ts` | Haiku 4.5 | 1 | `node:start/complete` + summary={claims_count, decision_type} | 由 `/api/analyze` 驱动 | `structured_claims` |
| **N2 L1 目标对齐** | `lib/graph/nodes/n2-l1-alignment.ts` | Haiku 4.5 | 1 | `node:start/complete` + `l1:warning`(可空) | 同上 | `l1_alignment_score`, `l1_alignment_warnings` |
| **N3 L2 证据召回** | `lib/graph/nodes/n3-l2-evidence.ts` | embedding(text-embedding-3-small) | 1 + N cosine | `node:start/complete` + summary={recalled_count} | 内部用 `POST /api/llm/embedding` | `recalled_evidence_ids` |
| **N4 Round 0 Blind First-Vote** | `lib/graph/nodes/n4-round0.ts` (Send API 7×) | Sonnet 4.6 | 7(并发) | `node:start` + 7× `persona:start/complete` + `node:complete` | 同上 | `round_0_votes` |
| **N5 Round 1 伪并发 + Anchoring** | `lib/graph/nodes/n5-round1.ts` (Send API 7×) | Sonnet 4.6 | 7(并发) | 同 N4 + `anchoring:detected` 多次 | 同上 | `round_1_votes`, `anchoring_flags` |
| **N6 TWS 轨迹评分** | `lib/consensus/trajectory-weighted-scoring.ts`(纯计算) | 无 | 0 | `node:start/complete` + summary={tws_score} | 同上 | `tws_scores_by_claim` |
| **N7 L4 权重加权** | `lib/consensus/weight-calculator.ts`(纯计算) | 无 | 0 | `node:start/complete` + summary={weighted_total} | 同上 | `effective_weights` |
| **N8 Premortem** | `lib/graph/nodes/n8-premortem.ts` (Send API 7×) | Sonnet 4.6 | 7(并发) | `node:start` + 7× `persona:complete`(category=premortem) + `node:complete` | 同上 | `premortem_risks` |
| **N9 决策报告生成** | `lib/graph/nodes/n9-report.ts` | **Opus 4.7**(质量优先) | 1 | `node:start` + 多次 `node:partial`(逐 section 流式) + `node:complete` + `final:report` | 同上 | `decision_report` |

**关键不变量(v2.3 GAN-B H-B-1 修)**:
- **N1/N2 用 `generateObject`**(短文本,等全量返回即可,~5-8s)
- **N9 必须用 `streamObject`**(原文档误写 generateObject):因 Opus 4.7 报告生成 10-15s,必须流式逐 section 推送 `node:partial` 事件,否则 P03/P12 用户看到的是"进度条停 10s 后突然全满",评审体验差。`streamObject` 配 `partialObjectStream` 增量发 SSE,前端可按 section 渐进渲染。
- N4/N5/N8 用 LangGraph `Send` API 真并发(数组级 fan-out)
- N6/N7 不调 LLM,纯 TS 计算,延迟 < 100ms
- 任何节点失败 → AI Gateway 自动降级(同 Tier 内换模型),AI SDK `maxRetries: 3` 用尽 → 节点标 failed → 整体 status=failed 或部分降级 offline

**N9 streamObject 代码示例**:

```typescript
import { streamObject } from "ai";

const { partialObjectStream } = streamObject({
  ...modelForNode("N9"),
  maxRetries: 3,
  schema: DecisionReportSchema,
  prompt: ...,
});

let lastSection: string | null = null;
for await (const partial of partialObjectStream) {
  // 按 section 增量 emit SSE
  if (partial.conclusion && lastSection !== "conclusion") {
    emit("node:partial", { node_id: "N9", partial_section: "conclusion", preview: partial.conclusion.summary });
    lastSection = "conclusion";
  }
  // ... 其他 6 个 section 同理
}
```

---

## 8. 第三方集成

### 8.1 Vercel AI Gateway(R7)

**配置位置**:`lib/llm/gateway.ts`

```typescript
// lib/llm/gateway.ts
import { gateway } from "@ai-sdk/gateway";
import { generateObject, streamObject } from "ai";

export function modelForNode(node: NodeId): { model: string; providerOptions: any } {
  const modelByNode: Record<NodeId, string> = {
    N1: "anthropic/claude-haiku-4.5",
    N2: "anthropic/claude-haiku-4.5",
    N3: "openai/text-embedding-3-small",
    N4: "anthropic/claude-sonnet-4.6",
    N5: "anthropic/claude-sonnet-4.6",
    N6: null,  // 纯计算
    N7: null,  // 纯计算
    N8: "anthropic/claude-sonnet-4.6",
    N9: "anthropic/claude-opus-4.7",   // 报告生成质量优先
  };

  // 检查 manual override(P07 面板 1 触发)
  const manualOverride = readManualOverride();   // Upstash Redis
  const effective = manualOverride ?? modelByNode[node];

  return {
    model: effective,
    providerOptions: {
      gateway: {
        // 真实 API:zeroDataRetention(已锁,非 allowProviderRetention)
        // ZDR 已隐含 disallowPromptTraining(GAN-B LOW-1),不重复设置
        zeroDataRetention: true,
        // 降级链(2026-02 起 AI Gateway 官方支持 order)
        order: [effective, "anthropic/claude-sonnet-4.6", "anthropic/claude-haiku-4.5"],
      },
    },
  };
}
```

**重试策略(v2.3 GAN-B B-B-5 修)**:`providerOptions.gateway` **不存在 `retry` 字段**(原文档写法是错的)。重试必须在 AI SDK 调用层用 `maxRetries`:

```typescript
// 每次 LLM 调用时显式指定
const result = await generateObject({
  ...modelForNode("N9"),                  // model + providerOptions.gateway
  maxRetries: 3,                          // AI SDK 自动指数退避
  schema: DecisionReportSchema,
  prompt: ...,
});
```

`maxRetries` 触发条件:网络错误 / 5xx / Schema 校验失败(Zod refine)。429 速率限制由 AI Gateway 的 `order` fallback 链处理(自动切下一档 Provider),不计入 `maxRetries`。

**降级链**:Opus 4.7 → Sonnet 4.6 → Haiku 4.5 → 离线规则(本地 if-else)

**降级触发**:
- 5xx → 立即降级
- 429 → 退避 1s 后重试,2 次失败降级
- 超时 30s → 降级
- 配额耗尽(由 Gateway 报告)→ 降级

**降级事件**:每次降级 emit SSE `provider:change` + INSERT `provider_events`

---

### 8.2 Neon Postgres(混合连接,v2.3 GAN-B B-B-4 修)

> **关键**:同时使用两种 driver,各自服务不同场景。**HTTP driver** 用于 Drizzle 业务查询(单条非交互式,Serverless 友好);**WebSocket driver** 用于 LangGraph `PostgresSaver`(需要交互式事务 + 多条顺序查询,HTTP driver 不支持)。

**业务查询(Drizzle + HTTP driver)** — `lib/db/index.ts`:

```typescript
import { neon } from "@neondatabase/serverless";       // HTTP fetch-based
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "./schema";

export const db = drizzle(neon(process.env.NEON_DATABASE_URL!), { schema });
```

**LangGraph checkpoint(PostgresSaver + WebSocket driver)** — `lib/graph/checkpointer.ts`:

```typescript
import { PostgresSaver } from "@langchain/langgraph-checkpoint-postgres";
import { Pool } from "@neondatabase/serverless";       // WebSocket Pool

const pool = new Pool({ connectionString: process.env.NEON_DATABASE_URL_WS! });
export const checkpointer = new PostgresSaver(pool);
```

**环境变量**:
- `NEON_DATABASE_URL` — `postgresql://...?sslmode=require`(HTTP 模式默认)
- `NEON_DATABASE_URL_WS` — 同一连接串,WebSocket 由 `Pool` 自动协商(Neon 同 endpoint 同时支持两种协议)
- 注:实际可共用一个 env var,这里拆为两个是为了语义明确 + 未来读写分离时可独立切换

**为什么不能统一用 HTTP**:LangGraph PostgresSaver 内部需要 `BEGIN`/`COMMIT` 事务和 prepared statement 复用,Neon HTTP driver 仅支持单条非交互式查询,会直接报错。

**为什么不能统一用 WebSocket**:Vercel Fluid Compute 函数生命周期短(冷启动 + 单请求结束即释放),WebSocket 长连接对 Drizzle 业务查询是浪费,且 Neon 单实例并发 Pool 连接数有限,业务查询走 HTTP fetch 更经济。

**连接池**:HTTP driver 自动复用 fetch keep-alive;WebSocket Pool 默认 maxConnections=10,LangGraph 单次推理用 1 个,稳定性测试 3 并发用 3 个,Demo 场景充足。

**迁移**:Drizzle Kit `pnpm drizzle-kit generate` + `pnpm drizzle-kit migrate`

**索引**(关键 — Phase 5 必须创建):
```sql
CREATE INDEX proposals_created_idx ON proposals (created_at DESC) WHERE deleted_at IS NULL;
CREATE INDEX analysis_versions_proposal_idx ON analysis_versions (proposal_id, created_at DESC);
CREATE INDEX decisions_proposal_idx ON decisions (proposal_id, created_at DESC);
CREATE INDEX audit_logs_created_idx ON audit_logs (created_at DESC);
CREATE INDEX audit_logs_target_idx ON audit_logs (target_type, target_id);
CREATE INDEX hitl_audit_av_idx ON hitl_audit (analysis_version_id, paused_at DESC);
CREATE INDEX hitl_audit_pending_idx ON hitl_audit (auto_approve_at) WHERE resumed_at IS NULL;
-- LangGraph 4 张表的索引由 PostgresSaver.setup() 自动创建,无需手工管理
CREATE INDEX reproducibility_runs_proposal_idx ON reproducibility_runs (proposal_id, created_at DESC);
CREATE INDEX provider_events_av_idx ON provider_events (analysis_version_id, created_at DESC);
-- V2:CREATE INDEX evidence_cards_embedding_idx ON evidence_cards USING ivfflat (embedding vector_cosine_ops);
```

---

### 8.3 Anthropic 限流应对

| 风险 | 应对 |
|---|---|
| Sonnet 4.6 RPM 配额耗尽(同时 21 路并发:R0+R1+Premortem 各 7) | AI Gateway fallback Sonnet → Haiku;Demo 前 30 分钟预热 |
| 稳定性测试 ×3 同时 = 同时 63 路并发 → 几乎必触发 429 | **3 次客户端并发 + 各自独立 fallback 链 + Demo 用预录视频** |
| Opus 4.7 节点 9 偶发超时 | AI Gateway 配 timeout=60s,失败降到 Sonnet 4.6(质量降但不挂) |
| 429 重试雪崩 | 指数退避 1s/2s/4s,3 次失败立即降级,不继续重试 |

**预算估算**(单次推理,v2.3 GAN-B H-B-4 修:Opus 4.7 真实价格 $25/M 不是 $75/M):
- **Sonnet 4.6**:21 calls × ~3000 tokens 输出 = 63k tokens × $15/M = **$0.95**(其中 N4/N5/N8 各 7 并发)
- **Haiku 4.5**:2 calls × ~2000 tokens 输出 = 4k tokens × $4/M = **$0.02**(N1/N2)
- **Opus 4.7**:1 call × ~5000 tokens 输出 = 5k tokens × **$25/M output** = **$0.125**(N9 报告)
- **Embedding**:1 call × ~1000 tokens × $0.02/M = 可忽略
- **单次完整推理 ≈ $1.10**(原误估 $1.5,差额来自 Opus 4.7 价格修正)
- **稳定性测试 ×3 ≈ $3.3/次**(允许 Demo 演示数十次)

**价格依据**:[Anthropic Models Overview](https://platform.claude.com/docs/en/about-claude/models/overview) — Claude Opus 4.7 input $5/M, output $25/M(不是早期 Opus 4.1 的 $15/$75)。

---

### 8.4 OpenAI Embedding(R3 / R12)

**模型**:`text-embedding-3-small`(默认 1536 维,$0.02/M tokens — 比 Voyage 便宜)

**用途**:
- N3 证据召回(每次 1 call)
- P11 embedding 搜索(用户主动触发,10 RPM 限流)

**走 AI Gateway**:配置同 8.1,统一 ZDR

**维度说明(v2.3 GAN-B 修)**:
- OpenAI `text-embedding-3-small` **默认输出 1536 维**;支持 `dimensions` 参数压缩,**最小 512 维**(384 不被支持)
- P0 阶段采用默认 1536 维(不传 `dimensions`),`evidence_cards.embedding` JSONB 字段存 1536-d float 数组(< 200 条 ≈ 1.2MB 内存,无压力)
- V2 切 Neon pgvector 时,列类型 `vector(1536)`,无需重新生成 embedding
- 若日后想节省成本/内存,可改为 `dimensions: 512` 压缩(精度损失 < 5%,需同步重新生成所有 evidence_cards.embedding)

---

### 8.5 Upstash Redis(限流 / Provider 状态)

> **v2.3 GAN-B 修**:`@vercel/kv` 与 Vercel KV 服务 2024-12 已下线,新项目无法创建。**统一改用 Upstash Redis**(原 Vercel KV 底层即 Upstash,迁移路径平滑)。

**用途**:
- `POST /api/llm/manual-degrade` 的 300s TTL 状态(Redis SET with EX)
- 所有端点的令牌桶限流(`@upstash/ratelimit` slidingWindow)
- HITL 5 分钟自动批准的时间戳记录(GET `hitl:{checkpoint_id}:auto_approve_at`,由 status 端点轮询触发自动 resume — 详见 §5.3.4)

**配置**:Vercel Marketplace → Upstash for Redis,环境变量 `UPSTASH_REDIS_REST_URL` + `UPSTASH_REDIS_REST_TOKEN`(注意:**不是** `KV_REST_API_URL`)

```typescript
// lib/redis.ts
import { Redis } from "@upstash/redis";

export const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});
```

---

### 8.6 第三方依赖矩阵

| 服务 | 用途 | 失败影响 | 降级方案 |
|---|---|---|---|
| Vercel AI Gateway | 全部 LLM | 全部推理停 | 离线规则模式(只跑 N1 结构化) |
| Anthropic | Opus / Sonnet / Haiku | Gateway 降级到其他 Provider | Gateway 自动 |
| OpenAI | Embedding | N3 证据召回降级到 keyword | LIKE 检索 |
| Neon Postgres | 全部持久化 | 写入失败 → 草稿本地存 | localStorage 兜底 |
| Upstash Redis | 限流 / 状态 | 限流失效 → 进程内存令牌桶兜底(见 §10) | **不放行**,内存计数器降级(防 Demo 雪崩,GAN-B H-B-5 修)|
| Sentry(可选) | 错误上报 | 错误无法上报 | console.error 兜底 |

---

## 9. 错误响应规范

### 9.1 完整错误码表

| code | HTTP | user_message(zh-CN) | 何时发生 | recoverable |
|---|---|---|---|---|
| `INVALID_INPUT` | 400 | 输入有误,请检查后重试 | Zod 校验失败 | true |
| `SCHEMA_VALIDATION_FAILED` | 400 | AI 输出格式不符,系统已重试 | LLM 输出过 LangGraph 重试上限 | false |
| `PROPOSAL_TOO_SHORT` | 422 | 提案过短,至少 50 字 | < 50 字 | true |
| `PROPOSAL_TOO_LONG` | 422 | 提案过长,请精简到 5000 字内 | > 5000 字 | true |
| `OBJECTIVE_REQUIRED` | 422 | 请先选择本提案对应的公司级目标 | declared_objective_id 缺失 | true |
| `PERSONAS_TOO_FEW` | 422 | 至少需要 2 个角色才能产生分歧分析 | selected_persona_ids < 2 | true |
| `AAR_TOO_FEW_FIELDS` | 422 | AAR 4 个字段至少填 2 个,每个至少 10 字 | < 2 个非空 或 单字段 trim 后 < 10 字 | true |
| `WEIGHT_OUT_OF_RANGE` | 400 | 权重必须在 0.5 - 2.0 之间 | weight 越界 | true |
| `REASON_TOO_SHORT` | 400 | 请输入至少 5 字理由 | reason < 5 字 | true |
| `RESUME_REASON_TOO_SHORT` | 400 | HITL 决策需留至少 5 字说明 | resume reason < 5 字 | true |
| `HEADLINE_TOO_LONG` | 400 | 一句话核心分歧不超过 50 字 | headline > 50 字 | true |
| `SUMMARY_TOO_LONG` | 400 | 一句话总结不超过 50 字 | summary > 50 字 | true |
| `NOT_FOUND` | 404 | 资源不存在 | 通用 404 | false |
| `PROPOSAL_NOT_FOUND` | 404 | 该提案不存在 | | false |
| `ANALYSIS_VERSION_NOT_FOUND` | 404 | 该推理版本不存在 | | false |
| `PERSONA_NOT_FOUND` | 404 | 该角色不存在 | | false |
| `CHECKPOINT_NOT_FOUND` | 404 | 该 HITL 接管点不存在 | | false |
| `SCENARIO_NOT_FOUND` | 404 | 该 Demo 场景不存在 | | false |
| `EVIDENCE_NOT_FOUND` | 404 | 该证据不存在 | | false |
| `TARGET_VERSION_NOT_FOUND` | 404 | 回滚目标版本不存在 | | false |
| `ITEM_NOT_FOUND` | 404 | 该条目不存在 | | false |
| `SUGGESTION_NOT_FOUND` | 404 | 该建议不存在 | | false |
| `PREV_DECISION_NOT_FOUND` | 404 | 上一条决议不存在 | v2.3 H-A-9 | false |
| `PREV_DECISION_CROSS_PROPOSAL` | 400 | 链式决议必须在同一提案内 | v2.3 H-A-9 | false |
| `AB_COMPARE_ALREADY_RUNNING` | 409 | 对照分析正在进行,请稍后查看结果 | v2.3 B-A-3 | true |
| `AB_COMPARE_ALREADY_READY` | 409 | 对照分析已有结果(传 ?force=true 可重跑)| v2.3 B-A-3 | true |
| `BASE_AV_NOT_FOUND` | 404 | 基线推理版本不存在 | v2.3 H-A-4(5.7.12a)| false |
| `ORPHAN_TIMEOUT` | 410 | 推理启动超 5 分钟仍未连接,已自动失败 | v2.3 H-A-8(status 端点自动触发)| false |
| `VERSION_CONFLICT` | 409 | 内容已被他人修改,请刷新后重试 | ETag mismatch | true |
| `ALREADY_RUNNING` | 409 | 该提案正在分析中,请稍后 | duplicate analyze | true |
| `ALREADY_COMPLETED` | 409 | 分析已完成,请直接查看结果 | duplicate SSE on completed | false |
| `NOT_RUNNING` | 409 | 分析未在运行中,无法暂停 | pause on non-running | false |
| `STILL_RUNNING` | 409 | 分析仍在进行中,请等待完成 | get heatmap on running | true |
| `OBJECTIVE_NAME_DUPLICATE` | 409 | 该目标名称已存在 | | true |
| `RATE_LIMIT_EXCEEDED` | 429 | 操作过于频繁,请稍后重试 | 限流命中 | true(看 Retry-After) |
| `PAYLOAD_TOO_LARGE` | 413 | 内容超过 1 MB 限制 | body/file > 1MB | true |
| `QUERY_REQUIRED` | 400 | 请输入搜索关键词 | empty query | true |
| `TOKEN_EXPIRED` | 403 | 操作已过期,请重新发起 | restoration_map token 过期 | true |
| `RAW_TEXT_EXPIRED` | 403 | 原始内容已过期(7 天前),无法显示脱敏 diff | proposal > 7d | false |
| `FIXTURE_LOAD_FAILED` | 503 | Demo 场景加载失败 | fixture JSON 解析失败 | true |
| `LLM_GATEWAY_DOWN` | 502 | AI 服务暂时不可用,已尝试备用 | AI Gateway 502 | true |
| `LLM_TIMEOUT` | 504 | AI 响应超时,正在重试 | 单 LLM call 超时 | true |
| `ALL_PROVIDERS_DEGRADED` | 503 | 全部 AI 模型不可用,已切换离线规则模式 | 降级链耗尽 | false |
| `EMBEDDING_PROVIDER_DOWN` | 502 | 向量检索不可用,已降级为关键词搜索 | OpenAI embedding 502 | true |
| `DATABASE_DOWN` | 503 | 保存失败,内容已暂存浏览器,联网后会自动同步 | Neon 不可用 | true |
| `INTERNAL_ERROR` | 500 | 出了点意外,我们已记录,请稍后重试 | 未分类 5xx | true |
| `FORBIDDEN` | 403 | 你没权限查看此内容 | V2 权限不足 | false |

### 9.2 错误响应范例

```http
HTTP/1.1 422 Unprocessable Entity
Content-Type: application/json
X-Request-ID: req_abc123

{
  "error": {
    "code": "PROPOSAL_TOO_SHORT",
    "message": "raw_text length is 23, minimum is 50",
    "user_message": "提案过短,至少 50 字",
    "field": "raw_text",
    "recoverable": true
  },
  "request_id": "req_abc123"
}
```

```http
HTTP/1.1 429 Too Many Requests
Content-Type: application/json
Retry-After: 45

{
  "error": {
    "code": "RATE_LIMIT_EXCEEDED",
    "message": "Rate limit 2/min exceeded",
    "user_message": "操作过于频繁,请 45 秒后重试",
    "recoverable": true
  },
  "request_id": "req_xyz789"
}
```

---

## 10. 限流策略表

| 端点 | RPM/IP | 理由 |
|---|---|---|
| `POST /api/analyze` | 2 | 主推理,单次 ~24 LLM 调用 ($1.5),防滥用 |
| `POST /api/reproducibility-check` | 1 | 等效 6 RPM Anthropic(3 倍 21 路并发) |
| `POST /api/analysis-versions/:id/fork` | 2 | 同 analyze |
| `POST /api/scenarios/:id/load` | 10 | Demo 入口,允许多次切换 |
| `POST /api/proposals` | 10 | 创建提案 |
| `POST /api/proposals/draft/detect-decision-type` | 30 | 输入 debounce 防滥用 |
| `POST /api/evidence/search` (embedding 模式) | 10 | embedding 贵 |
| `POST /api/evidence/search` (keyword 模式) | 30 | LIKE 便宜 |
| `POST /api/decisions` | 10 | 决议录入低频 |
| `POST /api/llm/manual-degrade` | 5 | Demo 演示用 |
| `POST /api/proposals/:id/rollback` | 5 | 谨慎 |
| `POST /api/analyze/:id/pause` / `/resume` / `/hitl/:id/takeover` | 10 | HITL 操作 |
| 其余 PATCH | 30 | 通用 |
| 全部 GET 列表/详情 | 60 | 高频读 |
| `GET /api/health` | ∞ | 无限制 |

**实现**:`@upstash/ratelimit` + Upstash Redis(令牌桶)+ **内存兜底**(GAN-B H-B-5 修,防 Redis 失效时 Demo 被刷)

```typescript
// middleware.ts(Edge 运行)
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

const ratelimits = {
  analyze: new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(2, "1 m"), prefix: "rl:analyze" }),
  // ...
};

// 内存兜底(Redis 失效时降级,而非放行 — H-B-5)
const inMemoryFallback = new Map<string, { count: number; resetAt: number }>();
function checkInMemory(key: string, max: number, windowMs: number): boolean {
  const now = Date.now();
  const entry = inMemoryFallback.get(key);
  if (!entry || entry.resetAt < now) {
    inMemoryFallback.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }
  if (entry.count >= max) return false;
  entry.count++;
  return true;
}

export async function middleware(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for") ?? "anonymous";
  const limit = pickLimitForPath(req.nextUrl.pathname);
  if (!limit) return NextResponse.next();

  try {
    const { success, reset } = await limit.rl.limit(ip);
    if (!success) {
      return NextResponse.json(
        { error: { code: "RATE_LIMIT_EXCEEDED", ... } },
        { status: 429, headers: { "Retry-After": String(Math.ceil((reset - Date.now()) / 1000)) } }
      );
    }
  } catch (e) {
    // Redis 失效,降级到进程内存(单实例准确,跨实例可能略松)
    const ok = checkInMemory(`${limit.path}:${ip}`, limit.max, limit.windowMs);
    if (!ok) {
      return NextResponse.json(
        { error: { code: "RATE_LIMIT_EXCEEDED", user_message: "操作过于频繁(降级限流),请稍后" } },
        { status: 429, headers: { "Retry-After": "60" } }
      );
    }
  }
  return NextResponse.next();
}
```

---

## 11. 完整性自检

### 11.1 12 页 ↔ API 端点覆盖矩阵

| 页面 | 主要 API 端点 | 覆盖率 |
|---|---|---|
| P01 首页 | 5.1.1, 5.1.2 + (5.10.1 最近 3) | ✅ |
| P02 提案输入 | 5.2.1, 5.2.2, 5.2.3, 5.2.4, 5.2.5 | ✅ |
| P03 推理流 | 5.3.1(SSE), 5.3.2, 5.3.3, 5.3.4 | ✅ |
| P04 分歧热力图 | 5.4.1, 5.4.2 | ✅ |
| P05 Persona 工坊 | 5.5.1, 5.5.2, 5.5.3, 5.5.4 | ✅ |
| P06 讨论框架 | 5.6.1, 5.6.2, 5.6.3 | ✅ |
| P07 Safety Center 7 面板 | 5.7.1~5.7.16(16 端点) | ✅ |
| P08 评审视角对照 | (SSR 无 API) | ✅ |
| P09 决议录入 | 5.9.1, 5.9.2, 5.9.3 | ✅ |
| P10 历史 | 5.10.1, 5.10.2, 5.10.3 | ✅ |
| P11 证据库 | 5.11.1~5.11.5 | ✅ |
| P12 决策报告 | 5.12.1~5.12.6 | ✅ |
| 共享/全局 | 5.13.1(内部), 5.13.2 | ✅ |

**结论**:**12 页 100% 覆盖**,P08 显式标记为无 API(纯 SSR),非孤儿。

### 11.2 9 节点 ↔ 端点映射验证

| LangGraph 节点 | 是否在 §7 表中 | 写入字段是否在 §2.3.6 av schema | SSE 事件是否在 §6.1 |
|---|---|---|---|
| N1 | ✅ | ✅ structured_claims | ✅ |
| N2 | ✅ | ✅ l1_alignment_* | ✅(含 l1:warning) |
| N3 | ✅ | ✅ recalled_evidence_ids | ✅ |
| N4 | ✅ | ✅ round_0_votes | ✅(7× persona:complete) |
| N5 | ✅ | ✅ round_1_votes + anchoring_flags | ✅(anchoring:detected) |
| N6 | ✅ | ✅ tws_scores_by_claim | ✅ |
| N7 | ✅ | ✅ effective_weights | ✅ |
| N8 | ✅ | ✅ premortem_risks | ✅ |
| N9 | ✅ | ✅ decision_report | ✅(final:report) |

**结论**:9 节点全部有 schema 字段 + 实现文件 + SSE 事件,无遗漏。

### 11.3 11 张表 ↔ 端点引用

| 表 | 哪些端点读 | 哪些端点写 |
|---|---|---|
| personas | 5.5.1, 5.5.2, 5.10.2, 5.3.1(注入 prompt) | 5.5.3, 5.5.4, 5.9.1(append notes) |
| internal_objectives | 5.2.1, 5.3.1(注入 prompt), 5.12.1 | 5.2.2 |
| evidence_sources | 5.11.1 | (启动 seed) |
| evidence_cards | 5.11.2, 5.11.3, 5.11.4, 5.11.5, 5.3.1(N3) | (启动 seed), 5.3.1(cited_count++) |
| proposals | 5.10.1, 5.10.3, 5.4.1, 5.7.3, 5.7.6, 5.7.15 | 5.1.2, 5.2.4, 5.7.7(rollback 新版的 proposal_id) |
| analysis_versions | 5.3.4, 5.4.1, 5.5.2, 5.6.1, 5.7.6, 5.11.5, 5.12.1, 5.12.5, 5.13.1 | 5.2.5, 5.3.1(增量), 5.7.7, 5.12.2, 5.12.3, 5.12.6 |
| decisions | 5.9.2 | 5.9.1 |
| hitl_audit | 5.3.4, 5.7.8 | 5.3.2, 5.3.3(LangGraph 4 张 checkpoint 表由 PostgresSaver 自管,不在 Drizzle schema)|
| audit_logs | 5.7.10, 5.7.11 | 几乎所有 POST/PATCH/DELETE |
| reproducibility_runs | 5.7.14, 5.7.15 | 5.7.12(预创建), 5.7.13(finalize) |
| provider_events | 5.7.1 | 5.3.1(降级时), 5.7.2 |

**结论**:11 张表均被读/写引用,无孤表。

### 11.4 v2.2 红线自查(对照 [consistency-check.md](../pipeline/consistency-check.md))

| 红线 | 检查项 | 本文档状态 |
|---|---|---|
| #1 Free-MAD 残留 | grep "Free-MAD" → 0 | ✅(全部用 TWS) |
| #2 sqlite-vec 误用 | grep "sqlite-vec" → 0(除废弃声明) | ✅(P0 in-memory JSON / V2 pgvector) |
| #3 80% 稳定复现 | grep "80%" 稳定上下文 → 0 | ✅(全部 67%) |
| #4 emoji 状态符 | grep "🟢🟡🔴⚫⏳⛔" → 0 | ✅(全部 Lucide 名称) |
| #5 Premortem 可选 | grep "Premortem.*可选" → 0 | ✅(N8 强制,Schema `min(3)`) |
| #6 6 角色 | grep "6 角色" Persona → 0 | ✅(7 角色 RoleEnum) |
| #7 4 步进度条 | grep "4 步.*进度" → 0 | ✅(9 节点) |
| #8 3 色态度 | grep "三色" 态度上下文 → 0 | ✅(4 档 AttitudeEnum) |
| #9 10+ 方法论 | grep "10\+ 方法论" → 0 | ✅(本文档无此表述) |
| #10 allowProviderRetention | grep "allowProviderRetention" → 0 | ✅(`zeroDataRetention: true`) |
| Schema #11 | citations.min(1) | ✅(§4.3 CitationsArraySchema.min(1)) |
| Schema #12 | DisagreementResolution 3 字段 | ✅(§4.6 shared_interest + objective_criterion + next_step) |
| Schema #13 | ActionItem.accountable 唯一必填 | ✅(§4.8 `z.string().min(1)`) |

**结论**:13/13 红线全过。

### 11.5 API 设计完整性清单

- [x] UI 文档的每个页面都有对应的 API 端点(§11.1)
- [x] 每个端点都有对应的 UI 页面/操作(§5 每端点都标注"对应 UI")
- [x] 所有端点都定义了错误响应(§9 完整码表 + 每端点错误列表)
- [x] 数据模型覆盖了所有 UI 展示的字段(§2.3 vs §11.3)
- [x] 列表端点都有分页(§5.7.10, §5.10.1, §5.11.2 等用 cursor)
- [x] 认证和权限都定义了(§3)
- [x] 响应格式统一(§1.2 `{ data }` / `{ error }`)
- [x] SSE 协议详细规范(§6)
- [x] 9 节点 ↔ 端点边界(§7)
- [x] 第三方集成 + 降级(§8)
- [x] 限流策略表(§10)
- [x] v2.2 红线零命中(§11.4)

---

## 12. 实施清单(衔接 Phase 5)

Phase 5 Planning 将基于本文档拆出以下任务:

### 12.1 数据层(Drizzle Migrations)

- T1.1 `lib/db/schema/personas.ts` + seed(7 条默认)
- T1.2 `lib/db/schema/internal-objectives.ts` + seed(5 条 P0 fixture)
- T1.3 `lib/db/schema/evidence-sources.ts` + `evidence-cards.ts` + seed(各 6-10 条)
- T1.4 `lib/db/schema/proposals.ts` + soft delete trigger
- T1.5 `lib/db/schema/analysis-versions.ts` + immutable enforcement
- T1.6 `lib/db/schema/decisions.ts` + AAR fields
- T1.7 `lib/db/schema/audit-logs.ts` + indexes
- T1.8 `lib/db/schema/hitl-audit.ts`(业务审计表)+ `lib/graph/checkpointer.ts`(LangGraph PostgresSaver 初始化 + setup + GC cron 清理已 completed 7 天前的 thread)
- T1.9 `lib/db/schema/reproducibility-runs.ts`
- T1.10 `lib/db/schema/provider-events.ts`
- T1.11 Drizzle migration + Neon 部署

### 12.2 LLM 层(AI Gateway)

- T2.1 `lib/llm/gateway.ts`(modelForNode + ZDR + fallback)
- T2.2 `lib/llm/embedding.ts`(text-embedding-3-small)
- T2.3 Manual override(Upstash Redis 300s TTL)
- T2.4 ProviderEvent 写入 + SSE emit

### 12.3 LangGraph 9 节点

- T3.1~T3.9 N1~N9 各节点实现(见 §7 文件路径)
- T3.10 `consensus-graph.ts` 主图组装 + `interrupt()` checkpointer
- T3.11 `lib/consensus/trajectory-weighted-scoring.ts`
- T3.12 `lib/consensus/anchoring-detector.ts`
- T3.13 `lib/consensus/weight-calculator.ts`
- T3.14 `lib/methodology/*`(L1-L4 + Premortem + AAR templates)
- T3.15 `lib/evidence/retriever.ts`(in-memory cosine,P0)

### 12.4 Route Handlers(按页面分批)

- T4.1 P01 端点(2)
- T4.2 P02 端点(5)
- T4.3 P03 端点(4,含 SSE)+ `/api/analyze` 是最重的
- T4.4 P04 端点(2)
- T4.5 P05 端点(4)
- T4.6 P06 端点(3)
- T4.7 P07 端点(16,8 面板)
- T4.8 P09 端点(3)
- T4.9 P10 端点(3)
- T4.10 P11 端点(5)
- T4.11 P12 端点(6)
- T4.12 共享端点(2)
- T4.13 `middleware.ts` 限流 + Demo team code(可选)
- T4.14 Zod schema lib(§4 全部)

### 12.5 部署

- T5.1 `vercel.ts` maxDuration 配置(/api/analyze + /api/reproducibility-check = 300s)
- T5.2 Upstash Redis 接入(Vercel Marketplace,**不是** Vercel KV)
- T5.3 Neon 接入
- T5.4 AI Gateway 接入 + Anthropic / OpenAI key
- T5.5 Sentry(可选)
- T5.6 GitHub Actions / Vercel CI

---

## 附录 A:Phase 4 输出自检结论

| 项 | 评估 | 备注 |
|---|---|---|
| 12 页 1:1 映射 | ✅ | P08 显式 SSR 无 API |
| 9 节点全锁 | ✅ | 每节点有文件 + JSONB 字段 + SSE 事件 |
| 11 张表 schema 完整 | ✅ | 含 v2 新 4 张表 + R8 hash + immutable 标注 |
| Zod schema 强约束 | ✅ | citations.min(1) / DisagreementResolution 3 字段 / RACI accountable 必填 / AAR ≥ 2 字段 |
| ZDR API 正确 | ✅ | `zeroDataRetention: true`(已修复 v2.1 GAN-B) |
| 稳定性测试不串行 | ✅ | §5.7.12 客户端并发 3 次独立 SSE,各 300s |
| Premortem P0 必做 | ✅ | N8 强制,Schema `min(3)` |
| 4 档态度全锁 | ✅ | §4.1 ATTITUDE_SCORE + ATTITUDE_ICON + ATTITUDE_TOKEN |
| 7 角色全锁 | ✅ | §4.2 RoleEnum + RoleIcon(Briefcase ... Globe) |
| 5 决策类型 + 动态权重 | ✅ | §4.2 DEFAULT_WEIGHTS 5 × 7 矩阵 |
| 红线 6(禁 emoji) | ✅ | API 全部用枚举字符串,前端渲染时映射 Lucide |
| 限流策略 | ✅ | §10 端点 × 限流值表 |
| 错误响应规范 | ✅ | §9 完整码表 41 条 |

**Phase 4 完成,Phase 5 无阻塞。**

---

## 附录 B:与 Phase 1-3 文档的引用清单

- [docs/design/01-product/definition.md](../design/01-product/definition.md) — 产品定位
- [docs/design/01-product/product-direction-v2.md](../design/01-product/product-direction-v2.md) — v2 方向
- [docs/design/01-product/personas.md](../design/01-product/personas.md) — 7 角色
- [docs/design/02-pages/00-map.md](../design/02-pages/00-map.md) — 12 页清单
- [docs/design/02-pages/P01-home.md](../design/02-pages/P01-home.md) ~ [P12-decision-report.md](../design/02-pages/P12-decision-report.md) — 每页详情
- [docs/design/03-tech-direction/architecture.md](../design/03-tech-direction/architecture.md) — 9 节点 LangGraph
- [docs/design/03-tech-direction/consensus-algorithm.md](../design/03-tech-direction/consensus-algorithm.md) — TWS 算法 + Premortem
- [docs/design/03-tech-direction/methodology.md](../design/03-tech-direction/methodology.md) — L1-L4 + AAR templates + 权重表
- [docs/design/03-tech-direction/data-strategy.md](../design/03-tech-direction/data-strategy.md) — 11 张表方向
- [docs/design/03-tech-direction/security-model.md](../design/03-tech-direction/security-model.md) — ZDR + 脱敏
- [docs/design/03-tech-direction/deployment.md](../design/03-tech-direction/deployment.md) — Vercel + Neon
- [docs/design/03-tech-direction/oss-scan.md](../design/03-tech-direction/oss-scan.md) — R1~R15 选型
- [docs/design/04-rules/permissions.md](../design/04-rules/permissions.md) — 权限矩阵
- [docs/design/04-rules/data-lifecycle.md](../design/04-rules/data-lifecycle.md) — 数据生命周期
- [docs/design/04-rules/error-handling.md](../design/04-rules/error-handling.md) — 错误处理
- [docs/plans/2026-05-23-collab-agent-ideation.md](2026-05-23-collab-agent-ideation.md) — Phase 1
- [docs/plans/2026-05-23-collab-agent-ui.md](2026-05-23-collab-agent-ui.md) — Phase 3
- [docs/pipeline/consistency-check.md](../pipeline/consistency-check.md) — v2.2 红线扫描

---

**版本**:Phase 4 v1.0 (2026-05-23)
**下一步**:Phase 5 — Planning(基于本文档 + UI 文档 + 设计文档生成可执行 task plan,推荐先做 Plan GAN 审查再开发)
