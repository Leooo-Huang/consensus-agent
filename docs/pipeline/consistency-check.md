# v2.1 一致性自查表(CI 红线扫描)

> **GAN-B v2 必杀 #2 修**:建立 grep 自查表,防止 v2.2 / v2.3 再出"修了一处忘了改另一处"的不一致问题。
>
> **触发时机**:任何文档大改后 + 进 Phase 4 API 设计前 + 进 Phase 6 开发前。

## 自查规则

任意一条 grep 命中即 **fail**,必须修复才能继续下游 Phase。

### 红线短语扫描

| # | 禁词 grep | 期望命中数 | 说明 |
| --- | --- | --- | --- |
| 1 | `Free-MAD` | 0 | v2.1 已全部改名 TWS 轨迹加权评分(自研) |
| 2 | `sqlite-vec` | 0 (除废弃声明外) | v2.1 已改 in-memory JSON(P0)/ Neon pgvector(V2)|
| 3 | `80%` 在稳定复现上下文 | 0 | 全文统一 67% |
| 4 | `🟢\|🟡\|🔴\|⚫\|⏳\|⛔\|⬜\|⚪` | 0 在 UI 状态符上下文 | 全部用 Lucide icon |
| 5 | `Premortem.*可选\|可选.*Premortem` | 0 | v2.1 已硬性 P0 必做,无加快模式 |
| 6 | `6 个角色\|6 角色\|6 卡` 在 Persona 上下文 | 0 | 7 角色(加区域管理) |
| 7 | `4 步进度条\|4 步.*进度` | 0 | 9 节点(8 主 + Premortem) |
| 8 | `三色\|3 色` 在态度上下文 | 0 (除 v1 废弃声明外) | 4 档(支持/谨慎支持/反对/信息不足) |
| 9 | `10\+ 经典方法论\|10\+ 方法论` | 0 | 5 个 P0 + 2 工程方案 + 8 V2 候选 |
| 10 | `allowProviderRetention` | 0 | 真实 API 是 `zeroDataRetention` |
| 11 | `claude-haiku-4-5-20251001\|claude-sonnet-4-6[^.]\|claude-opus-4-7[^.]` | 0 | v2.3 GAN-B B-B-2:AI Gateway 真实格式是 `claude-haiku-4.5` / `claude-sonnet-4.6` / `claude-opus-4.7`(点号,无日期后缀) |
| 12 | `@vercel/kv\|@vercel/ratelimit` | 0 | v2.3 GAN-B B-B-3:Vercel KV 2024-12 下线,改用 `@upstash/redis` / `@upstash/ratelimit` |
| 13 | `384 维` 在 embedding 上下文 | 0 | v2.3 GAN-B B-B-1:OpenAI `text-embedding-3-small` 默认 1536 维,最小可压缩 512 维(384 不被支持) |
| 14 | `AsyncPostgresSaver` | 0 | v2.3 GAN-B B-B-4:正确名称 `PostgresSaver`(来自 `@langchain/langgraph-checkpoint-postgres`),且必须用 Neon WebSocket driver |
| 15 | `providerOptions.gateway.retry` | 0 | v2.3 GAN-B B-B-5:该字段不存在,重试用 AI SDK `maxRetries` |
| 16 | `X-Accel-Buffering` | 0 | v2.3 GAN-B H-B-2:nginx 专用头,Vercel 无效 |
| 17 | `\$75/M\|\$75 /M` 在 Opus 4.7 价格上下文 | 0 | v2.3 GAN-B H-B-4:Opus 4.7 真实价格 input $5/M, output **$25/M** |
| 17a | `AI SDK v6\|"ai": "6` | 0(除历史 ideation/_raw-brainstorm 外) | v2.3 GAN-V3 Issue 1:P0 锁 `ai@5.0.0`(streamObject 可用);v6 已弃用 streamObject/generateObject |
| 17b | `streamText.*Output\.object\|partialOutputStream` | 0 | v2.3 GAN-V3 Issue 1:v5 路径下用 `streamObject` + `partialObjectStream`,不引入 v6 新 API 避免混乱 |
| 17c | `"drizzle-orm": "0\.[12][0-9]\." | 0 | v2.3 GAN-V3 Issue 5:锁 0.44.2 防 pgEnum #2753 bug;`drizzle-kit": "0\.2[0-9]\.` 同样禁(应 0.30.x+)|
| 17d | `vercel\.ts\|@vercel/config` | 0 | v2.3 GAN-V3 修:`@vercel/config` 不是合法包;改用 `vercel.json` |
| 17e | `graph\.updateState.*resume\|updateState.*approve` | 0 | v2.3 GAN-V3 Issue 2:HITL resume 必须 `graph.invoke(new Command({ resume }))`,updateState 不会触发图继续 |

### Schema 字段必填检查

| # | 字段 | 必填位置 | 说明 |
| --- | --- | --- | --- |
| 18 | `citations: z.array(...).min(1)` | 角色 claim schema | 每条结论 ≥ 1 条 citation |
| 19 | `DisagreementResolution.shared_interest/objective_criterion/next_step` | P12 § 关键分歧 | 防 AI 给"建议双方协调"废话 |
| 20 | `ActionItem.accountable: RoleEnum` | RACI 表 | v2.3 GAN-A H-A-2:必须是 RoleEnum 单值,不能是 `z.string().min(1)`(后者无法防"财务/运营"拼接绕过唯一性) |
| 21 | `aar_*.min(10)` + refine trim ≥ 10 | DecisionAarSchema | v2.3 GAN-A H-A-3:防"无"/"N/A"/空格敷衍输入 |
| 22 | `analysis_versions.headline_disagreement` 顶层字段存在 | §2.3.6 | v2.3 GAN-A B-A-5:不能只有 §5.4.2 引用而 schema 缺失 |
| 23 | `analysis_versions.decision_report_overrides` 顶层字段存在 | §2.3.6 | v2.3 GAN-A B-A-6:同上 |
| 24 | `proposals.current_analysis_version_id` 顶层字段存在 | §2.3.5 | v2.3 GAN-A H-A-7:显式跟踪主线版本 |
| 25 | `hitl_audit.auto_approve_at` 字段存在 | §2.3.8 | v2.3 GAN-A H-A-6:status 端点轮询触发 5 分钟自动批准 |

### 一致性矩阵(跨文档)

| 项 | 文档 A | 文档 B | 期望值 |
| --- | --- | --- | --- |
| LangGraph 节点数 | architecture.md | P03 / consensus-algorithm.md / 00-map.md | **9 节点** |
| Persona 数 | personas.md / P02 / P05 / P09 / P10 / P04 | ui.md §1.6 锁定表 | **7 角色** |
| 决策类型数 | methodology.md L4 权重表 | P02 决策类型识别 / product-direction-v2.md | **5 种**(选品/营销/预算/经营/跨境-区域) |
| TWS 命名 | consensus-algorithm.md | architecture.md ASCII / oss-scan.md / ui.md | 全部 `TWS` 或 `trajectory-weighted-scoring`,**禁 `free-mad`** |
| 4 档色系 | ui.md §1.1 | P04 / P12 § 评分 / P07 面板 7 | 支持/谨慎支持(`--conditional`)/反对/信息不足 |
| 证据引擎 P0 实现 | architecture.md / oss-scan.md / P11 / data-strategy.md | — | **in-memory JSON + cosine**(非 sqlite-vec) |
| 稳定复现阈值 | consensus-algorithm.md / definition.md / product-direction-v2.md / ideation.md | — | **67%** |

## 执行方式

### 手动执行(PowerShell)

```powershell
# v2.1 一致性扫描
$violations = @()

# 1. Free-MAD 残留
$r = Select-String -Path "docs/**/*.md" -Pattern "Free-MAD" -SimpleMatch
if ($r) { $violations += "FAIL #1: Free-MAD 残留: $($r.Count) 处" }

# 2. sqlite-vec 残留(排除废弃声明上下文)
$r = Select-String -Path "docs/**/*.md" -Pattern "sqlite-vec" | Where-Object { $_.Line -notmatch "~~|废弃|已改|GAN-B" }
if ($r) { $violations += "FAIL #2: sqlite-vec 未废弃: $($r.Count) 处" }

# 3. emoji 状态符
$r = Select-String -Path "docs/**/*.md" -Pattern "🟢|🟡|🔴|⚫|⏳|⛔|⬜|⚪"
if ($r) { $violations += "FAIL #4: emoji 状态符: $($r.Count) 处 ($(($r | Select-Object -First 3 | ForEach-Object { $_.Path + ':' + $_.LineNumber }) -join ', '))" }

# 4. 10+ 方法论
$r = Select-String -Path "docs/**/*.md" -Pattern "10\+ 经典方法论|10\+ 方法论"
if ($r) { $violations += "FAIL #9: 10+ 方法论 宣传残留: $($r.Count) 处" }

# 5. allowProviderRetention
$r = Select-String -Path "docs/**/*.md" -Pattern "allowProviderRetention"
if ($r) { $violations += "FAIL #10: allowProviderRetention(应为 zeroDataRetention): $($r.Count) 处" }

if ($violations) {
  Write-Host "🔴 v2.1 一致性自查 FAIL`n" -ForegroundColor Red
  $violations | ForEach-Object { Write-Host "  $_" -ForegroundColor Yellow }
  exit 1
} else {
  Write-Host "✅ v2.1 一致性自查 PASS" -ForegroundColor Green
}
```

### 集成到 git pre-commit hook(V2)

```bash
#!/bin/bash
# .git/hooks/pre-commit
pwsh -File docs/pipeline/consistency-check.ps1 || exit 1
```

## 已知例外(白名单)

下列文件中允许出现"禁词",因为是历史留痕 / 废弃声明:

- `docs/design/01-product/product-direction-v2.md` § 10 GAP 总览:可保留旧词作为对照
- `docs/design/03-tech-direction/oss-scan.md` 中带 `~~删除线~~` 的旧方案
- `docs/plans/2026-05-23-collab-agent-ui.md` § 🚨 v1 原版废弃声明 + 整个 v1 原版段落
- `docs/pipeline/update-log.md` § 变更摘要(允许引用旧词描述历史)
- `docs/pipeline/consistency-check.md`(本文件,定义禁词本身)
- `docs/plans/2026-05-23-collab-agent-api.md` 中带 "v2.3 GAN-* 修" 字样的注释行(说明修复来由,自然引用旧字符串作为对照)
- `docs/design/03-tech-direction/data-strategy.md` / `oss-scan.md` 中明示 "AsyncPostgresSaver 名称不准确" 的修复说明行

## 历史扫描结果

### 2026-05-23 v2.1 修复后(GAN-B v2 必杀 #2 触发)

| 规则 | 扫描结果 | 状态 |
| --- | --- | --- |
| #1 Free-MAD | 0 命中 | ✅ |
| #2 sqlite-vec | 仅废弃声明上下文有残留 | ✅ |
| #3 80% 稳定复现 | 0 命中 | ✅ |
| #4 emoji 状态符 | 待扫描确认 | ⏳ |
| #5 Premortem 可选 | 0 命中 | ✅ |
| #6 6 角色 | 0 命中 | ✅ |
| #7 4 步进度条 | 仅 v1 废弃段残留 | ✅ |
| #9 10+ 方法论 | 0 命中(P08/README/v2/ideation 都已改 5 个 P0) | ✅ |
| #10 allowProviderRetention | 0 命中(已改 zeroDataRetention) | ✅ |
