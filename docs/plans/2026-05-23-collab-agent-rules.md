# 议见 YiJian — 编码规则手册(始终加载)

> 这是 subagent 写代码时 100% 必须遵守的硬性规则。违反 = task 不算 done。
> 详细背景见 [index.md](2026-05-23-collab-agent-index.md) 指向的具体设计文档。

## 1. 红线(违反 = task 失败)

- **禁占位**:无 `TODO`/`FIXME`/`stub`/`dummy`/空函数体/硬编码空值(业务代码)
- **禁 Mock**:非测试代码内无 `mock`/`fake.*data` 替代真实调用
- **禁降阶**:无 `for now`/`later`/`暂时`/`先用`/`简化版`,设计文档怎么写就怎么实现
- **禁过时**:所有依赖版本与 plan P0.1 package.json 一致(锁定版本,无 `^`/`~`)
- **禁前端 emoji**:JSX text/title/aria-label 内 0 emoji unicode,全部用 `lucide-react`(白名单:i18n JSON 值 / 注释 / UGC)

## 2. 命名/包/模型 ID 锁定(GAN-B v2.3,违反即 404 / 包不存在)

| 必须 | 禁止 |
|---|---|
| `anthropic/claude-haiku-4.5` / `claude-sonnet-4.6` / `claude-opus-4.7` | `claude-haiku-4-5-20251001`(日期后缀)|
| `openai/text-embedding-3-small`(默认 1536 维,**不传** dimensions) | 384 维 / `dimensions: 384` |
| `@upstash/redis` + `@upstash/ratelimit` + env `UPSTASH_REDIS_REST_URL` | `@vercel/kv` / `@vercel/ratelimit` / `KV_REST_API_URL` |
| LangGraph `PostgresSaver`(`@langchain/langgraph-checkpoint-postgres`)+ Neon WebSocket `Pool` | `AsyncPostgresSaver` |
| Drizzle 业务查询用 `drizzle-orm/neon-http` HTTP driver | LangGraph 也用 HTTP(事务不支持) |
| `providerOptions.gateway.zeroDataRetention: true` + `order` fallback | `retry` 字段(用 AI SDK `maxRetries: 3`)/ `allowProviderRetention` |
| N9 报告生成 `streamObject` + `partialObjectStream` | `generateObject`(阻塞)/ v6 新 API `streamText({output: Output.object()})`(v5 不引入)|
| `ai@5.0.0`(锁定,streamObject 可用)| `ai@6.x`(v6 已弃用 streamObject;P0 不升级)|
| `drizzle-orm@0.44.2` + `drizzle-kit@0.30.1` | 0.3x 以下(pgEnum #2753 bug)|
| `vercel.json` 配置 maxDuration | `vercel.ts` + `@vercel/config`(包不存在)|
| HITL resume 用 `graph.invoke(new Command({ resume: ... }))` + Next.js 15 `after()` | `graph.updateState(...)`(不会触发图继续,卡 paused_hitl)|
| SSE 客户端 `new EventSource(url)`(不传 withCredentials) | `withCredentials: true`(P0 匿名)|
| SSE response headers 不发 `X-Accel-Buffering` | 发(nginx 专用,Vercel 无效)|

## 3. Schema 强约束(Zod,LangGraph 重试保证;违反等于 LLM 输出被拒)

```ts
CitationsArraySchema.min(1)              // 每条结论 ≥1 引用
DisagreementResolutionSchema             // shared_interest≥10 / objective_criterion≥10 / next_step≥5
ActionItemSchema.accountable: RoleEnum   // 单值枚举,禁字符串拼接"财务/运营",refine 不与 C/I 重复
DecisionAarSchema                        // 每字段 .min(10).optional() + refine trim≥10 字且 ≥2 非空
PremortemArraySchema.min(3)              // 每次推理 ≥3 条风险
AttitudeDistributionSchema               // 4 档百分比和 = 100(refine)
```

L4 prompt 必须明示:"Accountable 必须是 7 个角色枚举之一,不允许填写多个角色或'共同负责'"。

## 4. 数据模型不变量(api.md §2.3 已锁;subagent 不允许偏离)

- `proposals.current_analysis_version_id`:顶层字段。**回滚 / N9 完成**时 UPDATE,**fork 不动**(H-A-7)
- `analysis_versions` 顶层字段(immutable 豁免):`headline_disagreement` / `decision_report_overrides.action_items` / `methodology_ab_compare`
- `hitl_audit.auto_approve_at`:`status` 端点轮询触发 5 分钟自动批准(**不** 用 Vercel Cron)
- `personas.is_default: integer(0/1)`(**不** text)
- `decisionTypeEnum` 含 5 种:`selection/marketing/budget/operation/cross_border`(P02 UI Tab 数 = 5)
- LangGraph 4 张外部表(`checkpoints/checkpoint_blobs/checkpoint_writes/checkpoint_migrations`)由 `PostgresSaver.setup()` 自管,**不在** Drizzle schema

## 5. API 不变量

- 响应包装:成功 `{ data }`,失败 `{ error: { code, message, user_message, recoverable }, request_id }`
- 错误码 41 条:见 api.md §9.1(`lib/errors.ts` 全表导出 `ERROR_CATALOG`)
- 限流:Upstash slidingWindow + 内存兜底(Redis 失效降级,**不放行**)
- 脱敏双层:正则白名单(`lib/redaction/regex-redactor`)+ Haiku LLM 兜底(`lib/redaction/llm-fallback`)
- 还原映射表:5 分钟一次性 token,服务端 `redis.set(... ex: 300)`,**不存原文**
- 稳定性测试两阶段:`POST /reproducibility-runs/start` 拿 3 个 av_id → 客户端并发 3 个 `GET /api/analyze` SSE(各 300s)

## 6. 性能预算(consensus-algorithm.md §5)

| 指标 | 锁定值 |
|---|---|
| 端到端 P50 / P99 | 67s / 90s |
| Vercel maxDuration | 300s(`vercel.ts` 显式 6 个端点)|
| 单节点超时降级阈值 | 30s → AI Gateway fallback |
| 单次推理成本(Sonnet 21 + Haiku 2 + Opus 1) | ≈ $1.10(Opus $25/M output) |
| Embedding 维度 | 1536(text-embedding-3-small 默认)|
| 证据 retriever | in-memory cosine,< 5ms,< 200 条 |

## 7. 测试纪律(每 task done 标准)

- TDD:**先写失败测试 → run 看 FAIL → 实现 → run 看 PASS → commit**(plan 每 task 都有 Step 1-N)
- 每 task 独立 commit,commit message 含 task ID(如 `feat(P4.9): N9 streamObject...`)
- 每 task 完成必须跑:`pnpm typecheck` 0 错 + `pnpm vitest run <该 task 测试>` PASS + `pnpm consistency` 0 命中
- E2E(P7.1)4 Demo 场景每个 ≤ 95s(P99 90s + 缓冲)
- PR/commit 信息禁 `WIP` / `临时` / `回头改`
