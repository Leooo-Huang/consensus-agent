# 用户必须介入的 Phase 6 阻塞项(sleep 模式自动生成)

> **生成时间**:2026-05-23 Phase 6 sleep 模式启动前
> **检测依据**:实际跑过 `printenv` / `ls .env.local` / `ls package.json` 验证(非凭记忆)
> **CLAUDE.md 合规**:这些是真实"明确外部依赖未提供"(非 self-fulfilling 降阶)

## ⛔ Phase 6 大部分 task 阻塞,需要你做以下事

### 🔴 阻塞项 1:Neon Postgres 创建

**为什么阻塞**:Phase 6 P0.3 / P1.1 migrate / P1.2 seed / P1.3 LangGraph setup / P4.spike / P5/P6/P7 全部测试都依赖 Postgres。

**怎么做**:
1. 打开 [Neon Console](https://console.neon.tech)(或 Vercel Marketplace → Neon)
2. 创建项目 `consensus-agent`,region 选 `aws-us-east-1`(Vercel 默认同区域,延迟低)
3. 复制 `Connection string`(`postgresql://user:pass@host/db?sslmode=require`)
4. Neon Dashboard → Extensions → 启用 `vector`(V2 切 pgvector 用,P0 可选但提前装)
5. 把连接串导出到 env(下方 §阻塞项 4 一并配)

**预计耗时**:5 分钟

---

### 🔴 阻塞项 2:Upstash Redis 创建

**为什么阻塞**:middleware 限流 / Provider manual override 300s TTL / HITL 5 分钟自动批准都依赖 Redis。

**怎么做**:
1. 打开 [Vercel Marketplace → Upstash](https://vercel.com/marketplace/upstash)(或 [Upstash Console](https://console.upstash.com))
2. 创建 Redis 数据库,plan 选 free(10000 req/day,Demo 够)
3. 复制 `UPSTASH_REDIS_REST_URL` + `UPSTASH_REDIS_REST_TOKEN`

**预计耗时**:3 分钟

---

### 🔴 阻塞项 3:Vercel AI Gateway 启用

**为什么阻塞**:所有 LLM 调用(N1-N9)+ embedding 都走 AI Gateway。

**怎么做**:
1. 打开 [Vercel Dashboard → AI Gateway](https://vercel.com/dashboard/ai-gateway)
2. 启用 Gateway(可选用免费 credit 起步)
3. 复制 `AI_GATEWAY_API_KEY`
4. **可选**(推荐):在 Gateway Settings 全局启用 **Zero Data Retention**(ZDR)
5. 确认账户有 Anthropic Claude(Haiku 4.5 / Sonnet 4.6 / Opus 4.7)+ OpenAI(text-embedding-3-small)访问权限

**预计耗时**:5 分钟 + 等审批(若 ZDR 需提交申请)

---

### 🔴 阻塞项 4:写入 `.env.local`

把上面三步拿到的所有 env vars 写入项目根的 `.env.local`(已在 `.gitignore` 内):

```bash
# d:/Dev/Projects/Personal/MeetingAI/.env.local
NEON_DATABASE_URL=postgresql://...
NEON_DATABASE_URL_WS=postgresql://...   # 同上连接串(WebSocket Pool 用,Neon 同 endpoint 双协议)
UPSTASH_REDIS_REST_URL=https://...upstash.io
UPSTASH_REDIS_REST_TOKEN=...
AI_GATEWAY_API_KEY=...
```

**验证**(在仓库根):
```powershell
node -e "require('dotenv').config({path:'.env.local'}); console.log(Object.keys(process.env).filter(k=>['NEON_DATABASE_URL','UPSTASH_REDIS_REST_URL','AI_GATEWAY_API_KEY'].includes(k)).length===3?'✅ env 齐':'❌ 缺')"
```

---

### 🔴 阻塞项 5:`pnpm vercel link` 连接 Vercel project

**为什么**:Vercel 部署 + `vercel env pull` 同步 env 到 local 都依赖 link。

**怎么做**:
```powershell
pnpm vercel link
# 选 Leooo-Huang 账户 → 选 "Link to existing" 或新建 → project name: consensus-agent
pnpm vercel env add NEON_DATABASE_URL production
# (可选)对每个 env var 都加,或在 Vercel Dashboard UI 一次性配
```

**预计耗时**:5 分钟

---

## ✅ Sleep 模式可自动跑的 Task(不需要等你)

以下 task 不依赖外部 env,我会自动跑:

| Task | 内容 | 状态 |
|---|---|---|
| P0.1 | Next.js 15 + pnpm 脚手架 + 依赖锁定 + Tailwind 4 + shadcn init | 待跑 |
| P0.5 中 `lib/ratelimit.ts` 内存兜底单测 | 不需 Redis 也能测 | 待跑 |
| P2.1 | 12 个 Zod schema 文件(纯 TS,单测验证约束) | 待跑 |
| P3.1 | TWS + Anchoring + Weight(纯函数 + Vitest 单测) | 待跑 |
| P3.2 | L1-L4 + Premortem + AAR templates(模板字符串) | 待跑 |
| P3.3 单测部分 | retriever 算法 + buildCitations 不调 LLM 的 schema 校验 | 待跑 |
| P4.0 | GraphState 类型定义(纯 TS) | 待跑 |
| P4.1-9 节点代码 | 实现 + vi.mock generateObject/streamObject 单测 | 待跑(不跑真 LLM) |
| P4.10 主图组装 | typecheck 通过 + 编译不抛错 | 待跑(不跑实际 graph) |
| P4.11 SSE emitter | 纯函数 + 单测 | 待跑 |
| P6.0 | 共享 UI 组件(AttitudeIcon / RoleIcon / Lucide 锁定)+ emoji 扫描脚本 | 待跑 |

**预计 sleep 自动完成**:**约 20-25 个 task**(P0-P4 主体代码 + 前端 P6.0 共享组件)。

## ⏳ 等你配 env 后我才能跑的 Task(剩余约 55 个)

P0.3/0.4(实际 DB 连接)+ P1.1 migrate + P1.2 seed + P1.3 LangGraph setup + P4.spike + P5 全部端点集成测试 + P6 各页面 E2E + P7/P8 部署验证。

## 下一步流程

1. **你**:做完上面 5 个阻塞项 + 在 `.env.local` 写入 env vars
2. **告诉我**"env 配好了" → 我从 P0.3 继续 sleep 模式
3. **或者**:你完成 env 后直接说 "/autodev --resume",流水线自动从断点继续

---

🤖 由 Claude Code AutoDev sleep 模式预启动检查生成
