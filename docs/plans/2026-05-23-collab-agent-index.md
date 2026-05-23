# 议见 YiJian — 项目索引(开发者地图)

> **一句话**:企业 AI 共识形成系统,把业务提案拆成"角色 × 事实 × 分歧 × 权重 × 证据链",输出可复现可解释决策报告。
> **当前 Phase**:5.5(Plan + Index/Rules 已就绪,待 Plan GAN 审查后进 Phase 6)
> **技术栈**:Next.js 15 · LangGraph.js 0.4 · AI SDK v5.0 · AI Gateway · Drizzle/Neon · Upstash Redis · TS 5.7 strict · pnpm 10

## 文档地图(找信息去哪)

| 想知道 | 去哪看 |
|---|---|
| 产品做什么 / 给谁 / 不做什么 | [docs/design/01-product/definition.md](../design/01-product/definition.md) |
| 7 角色 Persona + 用户画像 | [docs/design/01-product/personas.md](../design/01-product/personas.md) |
| v2 升级核心 + 评审 6 维度映射 | [docs/design/01-product/product-direction-v2.md](../design/01-product/product-direction-v2.md) |
| 12 页清单 + 跳转关系图 | [docs/design/02-pages/00-map.md](../design/02-pages/00-map.md) |
| 单页面详情(功能/行为/规矩) | [docs/design/02-pages/P{01..12}-*.md](../design/02-pages/) |
| 9 节点 LangGraph 主图架构 | [docs/design/03-tech-direction/architecture.md](../design/03-tech-direction/architecture.md) |
| TWS 算法 + Premortem + 性能预算 | [docs/design/03-tech-direction/consensus-algorithm.md](../design/03-tech-direction/consensus-algorithm.md) |
| L1-L4 + AAR templates + 权重表 | [docs/design/03-tech-direction/methodology.md](../design/03-tech-direction/methodology.md) |
| 11 张表 + 数据生命周期 + PostgresSaver | [docs/design/03-tech-direction/data-strategy.md](../design/03-tech-direction/data-strategy.md) |
| ZDR + 脱敏 + 审计 | [docs/design/03-tech-direction/security-model.md](../design/03-tech-direction/security-model.md) |
| Vercel + Neon + maxDuration | [docs/design/03-tech-direction/deployment.md](../design/03-tech-direction/deployment.md) |
| R1-R15 开源选型(复用 vs 自研) | [docs/design/03-tech-direction/oss-scan.md](../design/03-tech-direction/oss-scan.md) |
| 权限矩阵 / 数据生命周期 / 错误分类 | [docs/design/04-rules/](../design/04-rules/) |
| ❓ 待用户拍板清单 | [docs/design/README.md](../design/README.md) |
| MVP 13 features + 评分映射 | [ideation.md](2026-05-23-collab-agent-ideation.md) |
| 视觉规范 + Lucide 锁定表(§1.6) | [ui.md](2026-05-23-collab-agent-ui.md) |
| 57 端点契约 / 11 表 Drizzle schema / 12 Zod schema | [api.md](2026-05-23-collab-agent-api.md) |
| 单个端点详细规格 | api.md §5.{A-G} + §5.{n}.{m} |
| SSE 协议(14 事件类型) | api.md §6 |
| LangGraph 9 节点 ↔ 端点对照 | api.md §7 |
| 错误码 41 条全表 | api.md §9.1 |
| 限流策略(端点 × 配额) | api.md §10 |
| ~80 task 实施计划(P0-P8) | [plan.md](2026-05-23-collab-agent-plan.md) |
| 25 条红线 + grep 扫描脚本 | [docs/pipeline/consistency-check.md](../pipeline/consistency-check.md) |
| 编码约束 / 命名锁定 / 测试纪律 | [rules.md](2026-05-23-collab-agent-rules.md)(始终加载) |

## 关键 schema / 锚点(精确定位)

| 概念 | 定义在 |
|---|---|
| `AttitudeEnum` + `ATTITUDE_SCORE`(4 档) | api.md §4.1 |
| `RoleEnum`(7 角色)+ `RoleIcon` Lucide 锁定 | api.md §4.2 / ui.md §1.6 |
| `DecisionTypeEnum`(5 类型)+ `DEFAULT_WEIGHTS` 5×7 | api.md §4.2 / methodology.md L4 |
| `CitationsArraySchema.min(1)` | api.md §4.3 |
| `DisagreementResolutionSchema`(3 字段长度强约束) | api.md §4.6 |
| `PremortemArraySchema.min(3)` | api.md §4.7 |
| `ActionItemSchema`(accountable RoleEnum 单值) | api.md §4.8 |
| `DecisionReportSchema`(7 部分) | api.md §4.9 |
| `DecisionAarSchema`(refine trim≥10 字 ≥2 非空) | api.md §4.12 |
| TWS 算法(w0=0.6,w1=0.4) | consensus-algorithm.md §对策 2 |
| Anchoring 检测(立场翻转 / cosine>0.85) | consensus-algorithm.md §对策 1 |
| LangGraph 9 节点 + 实现文件 | api.md §7 |
| 11 张表 Drizzle TS schema | api.md §2.3.{1..11} |
| Demo 4 场景区域管理差异化观点 | docs/design/02-pages/P01-home.md §Demo Sim |

## 25 条红线(只列禁词,详情走 consistency-check.md)

`Free-MAD` · `sqlite-vec` · `80%`(稳定复现) · emoji 状态符 · `Premortem.*可选` · `6 角色` · `4 步进度条` · `三色`(态度) · `10\+ 方法论` · `allowProviderRetention` · `claude-haiku-4-5-20251001` · `@vercel/kv` · `384 维` · `AsyncPostgresSaver` · `providerOptions.gateway.retry` · `X-Accel-Buffering` · `$75/M`(Opus) · citations.min(1) · DisagreementResolution 3 字段 · `accountable: RoleEnum` 单值 · AAR min(10) · `headline_disagreement` 顶层 · `decision_report_overrides` 顶层 · `current_analysis_version_id` 顶层 · `hitl_audit.auto_approve_at`

## 核心约束(5 条,完整定义见 rules.md)

1. 模型 ID 点号格式 / Upstash 包名 / 1536 维 embedding(技术真实性)
2. N9 必须 streamObject(防 SSE 卡顿)
3. 前端 JSX 0 emoji,只用 lucide-react
4. Schema 强约束 5 项(citation/DisagreementResolution/RACI/AAR/Premortem)
5. 每 task TDD + commit + 红线扫描通过才算 done
