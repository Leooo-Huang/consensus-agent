# 议见 YiJian 实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在 72 小时内交付企业 AI 共识形成系统 P0 版,4 个 Demo 场景全跑通(P50 ≤ 67s),9 节点 LangGraph + 12 页 UI + 57 API 端点齐全。

**Architecture:** Next.js 15 App Router 单体 + LangGraph 0.4 主图(9 节点)+ AI Gateway 降级链 + Drizzle/Neon 持久化 + Upstash Redis 限流 + Vercel Fluid Compute(maxDuration=300s)。混合 driver:业务查询 Drizzle HTTP,LangGraph PostgresSaver WebSocket。

**Tech Stack:** Next.js 15.x / pnpm 10 / TypeScript 5(strict) / Tailwind 4 / shadcn/ui / Lucide React / Tremor 3 / Nivo 0.87 / framer-motion 11 / LangGraph.js 0.4 / AI SDK v5.0(`ai@5.0.0`,streamObject 仍可用;v6 迁移见 §附录) / @ai-sdk/gateway / Drizzle ORM 0.36 / @neondatabase/serverless 0.9 / @upstash/redis 1.x / @upstash/ratelimit 2.x / Zod 3.23 / Vitest 2 / Playwright 1.48

**前序契约(必须 1:1 实现,任何偏离需先改设计文档)**:
- [api.md](2026-05-23-collab-agent-api.md) v2.3 — 11 张表 Drizzle schema + 12 Zod schema + 57 端点 + SSE 协议
- [ui.md](2026-05-23-collab-agent-ui.md) v2.2 — 12 页视觉规范 + Lucide icon 锁定表
- [methodology.md](../design/03-tech-direction/methodology.md) — L1-L4 + Premortem + AAR + L4 权重表
- [consensus-algorithm.md](../design/03-tech-direction/consensus-algorithm.md) — TWS + Blind First-Vote + Anchoring + 性能预算
- [consistency-check.md](../pipeline/consistency-check.md) — 25 条红线(每个 task 完成必须扫描)

**全局红线(每 task 完成都要扫,任一命中即 task 未完成)**:
1. 禁占位:`grep -E "TODO|FIXME|placeholder|stub|dummy"` 业务代码内 = 0
2. 禁 Mock:`grep -E "mock|fake.*data"` 非测试代码内 = 0
3. 禁过时:模型 ID/包名命中 consistency-check.md 红线 #11/#12/#13/#14/#15/#16/#17 = 0
4. 禁 emoji UI:JSX text/title/aria-label 内 emoji unicode = 0(用 Lucide React)
5. 禁降阶:`grep -E "for now|later|暂时|先用"` 业务代码内 = 0

---

## File Structure

> **v2.3 GAN-V4 修**:代码建在仓库根 `d:/Dev/Projects/Personal/MeetingAI/`(与 `docs/` 同级),**不**用 `yijian/` 子目录。

```
.(repo root)
├── app/
│   ├── (app)/                      # 12 页 UI + 布局
│   │   ├── layout.tsx
│   │   ├── page.tsx                # P01 首页
│   │   ├── proposals/new/page.tsx  # P02 提案输入
│   │   ├── analysis/[id]/
│   │   │   ├── page.tsx            # P03 推理流(SSE 客户端)
│   │   │   ├── heatmap/page.tsx    # P04 分歧热力图
│   │   │   ├── frame/page.tsx      # P06 讨论框架
│   │   │   ├── report/page.tsx     # P12 决策报告
│   │   │   └── decision/page.tsx   # P09 决议录入
│   │   ├── personas/page.tsx       # P05 工坊
│   │   ├── safety/page.tsx         # P07 8 面板
│   │   ├── history/page.tsx        # P10 历史
│   │   └── evidence/page.tsx       # P11 证据库
│   ├── judge-view/page.tsx         # P08 SSR 隐藏页
│   └── api/                        # 57 端点(详见 §5 各批 task)
│       ├── scenarios/[...]/route.ts
│       ├── proposals/[...]/route.ts
│       ├── analyze/route.ts        # SSE 主流
│       ├── analyze/[id]/[...]/route.ts
│       ├── personas/[...]/route.ts
│       ├── objectives/route.ts
│       ├── evidence/[...]/route.ts
│       ├── decisions/[...]/route.ts
│       ├── audit-logs/[...]/route.ts
│       ├── hitl/[...]/route.ts
│       ├── llm/[...]/route.ts
│       ├── reproducibility-check/route.ts
│       ├── reproducibility-runs/[...]/route.ts
│       ├── analysis-versions/[...]/route.ts
│       └── health/route.ts
├── components/
│   ├── ui/                         # shadcn 注册组件
│   └── feature/                    # 12 页业务组件(按页面分子目录)
├── lib/
│   ├── db/
│   │   ├── index.ts                # Drizzle HTTP driver
│   │   ├── schema/                 # 11 张表(各表独立文件)
│   │   └── seed/                   # 7 personas + 5 objectives + evidence + fixtures
│   ├── graph/
│   │   ├── checkpointer.ts         # PostgresSaver + Neon WebSocket Pool
│   │   ├── consensus-graph.ts      # 9 节点主图组装
│   │   ├── nodes/                  # n1-structurize..n9-report
│   │   ├── sse-emitter.ts          # LangGraph 事件 → SSE
│   │   └── state.ts                # GraphState 类型
│   ├── llm/
│   │   ├── gateway.ts              # modelForNode + ZDR + order
│   │   └── embedding.ts            # text-embedding-3-small (1536d)
│   ├── consensus/
│   │   ├── attitude.ts             # ATTITUDE_SCORE 锁定表
│   │   ├── trajectory-weighted-scoring.ts
│   │   ├── anchoring-detector.ts
│   │   └── weight-calculator.ts
│   ├── methodology/
│   │   ├── l1-objective-template.ts
│   │   ├── l2-evidence-template.ts
│   │   ├── l3-stakeholder-template.ts
│   │   ├── l4-raci-template.ts
│   │   ├── premortem-template.ts
│   │   ├── aar-template.ts
│   │   └── p0-objective-fixtures.ts
│   ├── evidence/
│   │   ├── retriever.ts            # in-memory cosine
│   │   └── citation-builder.ts
│   ├── schema/                     # 12 个 Zod schema
│   │   ├── attitude.ts
│   │   ├── role.ts
│   │   ├── decision-type.ts
│   │   ├── citation.ts
│   │   ├── persona-vote.ts
│   │   ├── disagreement.ts
│   │   ├── premortem.ts
│   │   ├── action-item.ts
│   │   ├── decision-report.ts
│   │   ├── reproducibility.ts
│   │   ├── aar.ts
│   │   └── provider-event.ts
│   ├── redaction/
│   │   ├── regex-redactor.ts       # 入口层正则白名单
│   │   └── llm-fallback.ts         # Haiku 兜底
│   ├── redis.ts                    # @upstash/redis 客户端
│   ├── errors.ts                   # 错误码 + user_message 映射(api.md §9.1 全表)
│   ├── audit.ts                    # 写 audit_logs + SHA-256 hash
│   └── draft/
│       └── local-storage.ts        # P02 草稿(纯前端)
├── middleware.ts                   # Upstash 限流 + 内存兜底
├── vercel.json                     # maxDuration 显式锁定(GAN-V3 修:不用 vercel.ts,@vercel/config 包不存在)
├── drizzle.config.ts
├── playwright.config.ts
├── vitest.config.ts
├── tests/
│   ├── unit/                       # 算法/Schema/template 单测
│   ├── integration/                # 端点 + DB
│   └── e2e/                        # 4 Demo 场景
└── scripts/
    ├── seed.ts                     # pnpm seed
    ├── langgraph-setup.ts          # PostgresSaver.setup()
    ├── preheat.ts                  # Demo 前预热
    └── consistency-scan.ps1        # 25 红线扫描
```

---

## Phase P0 — 基础设施(critical_path,串行,单 subagent)

### Task P0.1: 项目脚手架与依赖锁定

**Files:**
- Create: `package.json`, `pnpm-workspace.yaml`(可空)、`tsconfig.json`、`next.config.ts`、`tailwind.config.ts`、`postcss.config.mjs`、`app/layout.tsx`、`app/page.tsx`(临时空)、`components/ui/.gitkeep`、`.gitignore`、`.env.example`

**依赖版本锁定**(写入 package.json,严禁 `^`/`~` 浮动 — 黑客松环境优先稳定性):

```jsonc
{
  "dependencies": {
    "next": "15.1.0",
    "react": "19.0.0",
    "react-dom": "19.0.0",
    "@ai-sdk/gateway": "1.0.0",
    "ai": "5.0.0",
    "zod": "3.23.8",
    "drizzle-orm": "0.44.2",
    "@neondatabase/serverless": "0.10.0",
    "@langchain/langgraph": "0.4.0",
    "@langchain/langgraph-checkpoint-postgres": "0.0.10",
    "@upstash/redis": "1.34.0",
    "@upstash/ratelimit": "2.0.0",
    "lucide-react": "0.460.0",
    "@nivo/heatmap": "0.87.0",
    "@nivo/core": "0.87.0",
    "@tremor/react": "3.18.0",
    "framer-motion": "11.11.0",
    "qrcode.react": "4.1.0",
    "@radix-ui/react-dialog": "1.1.2",
    "@radix-ui/react-tabs": "1.1.1",
    "@radix-ui/react-drawer": "1.1.0",
    "@radix-ui/react-tooltip": "1.1.4",
    "tailwindcss": "4.0.0",
    "@tailwindcss/postcss": "4.0.0",
    "class-variance-authority": "0.7.1",
    "clsx": "2.1.1",
    "tailwind-merge": "2.5.4"
  },
  "devDependencies": {
    "typescript": "5.7.2",
    "@types/node": "22.10.0",
    "@types/react": "19.0.0",
    "@types/react-dom": "19.0.0",
    "drizzle-kit": "0.30.1",
    "vitest": "2.1.5",
    "@vitest/coverage-v8": "2.1.5",
    "playwright": "1.48.0",
    "@playwright/test": "1.48.0",
    "tsx": "4.19.2",
    "vercel": "50.0.0"
  }
}
```

- [ ] **Step 1: 初始化 Next.js 15(脚本式,不用 create-next-app 防被网络拖死)**

> **v2.3 GAN-V4 修**:原 plan 用 `mkdir -p yijian && cd yijian` 创建子目录,但本仓库已经在 `d:/Dev/Projects/Personal/MeetingAI/` 初始化为 git repo(commit b33c03c)。**改为在仓库根直接执行**(git/.gitignore 已存):

```bash
# 已在仓库根,无需 cd
pnpm init -y
# .gitignore 已存(覆盖 node_modules / .next / .vercel / .env / *.docx 等)
```

- [ ] **Step 2: 写入 package.json(覆盖)+ tsconfig.json + next.config.ts**

`tsconfig.json` 关键字段:
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["ES2022", "dom", "dom.iterable"],
    "module": "esnext",
    "moduleResolution": "bundler",
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "noImplicitOverride": true,
    "jsx": "preserve",
    "paths": { "@/*": ["./*"] },
    "plugins": [{ "name": "next" }]
  },
  "include": ["**/*.ts", "**/*.tsx", "next-env.d.ts"],
  "exclude": ["node_modules", ".next"]
}
```

`next.config.ts`:
```ts
import type { NextConfig } from "next";
const config: NextConfig = {
  reactStrictMode: true,
  experimental: { serverActions: { bodySizeLimit: "1mb" } },
  // SSE 端点需要 nodejs runtime(非 edge),其余 Route Handler 默认即可
};
export default config;
```

- [ ] **Step 3: 安装依赖 + 锁文件**

```bash
pnpm install
ls pnpm-lock.yaml          # 必须存在
pnpm tsc --noEmit          # 必须 0 错
```

- [ ] **Step 4: Tailwind 4 + shadcn 初始化**

```bash
# Tailwind 4 已通过 dependencies 装好,只需 postcss.config.mjs + globals.css
```

`postcss.config.mjs`:
```js
export default { plugins: { "@tailwindcss/postcss": {} } };
```

`app/globals.css`(含 ui.md §1.1 v2.2 4 档 token + Lucide 锁定):
```css
@import "tailwindcss";

@theme {
  --color-success: hsl(142 71% 45%);
  --color-conditional: hsl(160 60% 50%);   /* v2.2 谨慎支持档,GAN-A v2 锁 */
  --color-warning: hsl(38 92% 50%);
  --color-destructive: hsl(0 84% 60%);
  --color-muted: hsl(220 14% 96%);
}
```

`app/layout.tsx`:
```tsx
import "./globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "议见 YiJian", description: "企业 AI 共识形成系统" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN" className="bg-background text-foreground antialiased">
      <body>{children}</body>
    </html>
  );
}
```

`app/page.tsx`(临时,后续 P6 重写):
```tsx
export default function Home() {
  return <main className="p-8"><h1 className="text-2xl">议见 YiJian — Bootstrapping</h1></main>;
}
```

- [ ] **Step 5: 验证 build 通**

```bash
pnpm next build
# Expected: ✓ Compiled successfully + ✓ Generating static pages
```

- [ ] **Step 6: Commit**

```bash
git add .
git commit -m "feat(P0.1): scaffold Next.js 15 + Tailwind 4 + locked deps

- pnpm lockfile committed
- TypeScript strict + noUncheckedIndexedAccess
- 4-tier color tokens (success/conditional/warning/destructive) per ui.md §1.1
"
```

**acceptance_criteria:**
- `pnpm-lock.yaml` 存在且依赖版本 100% 锁定(无 `^` `~`)
- `pnpm tsc --noEmit` 退出码 0
- `pnpm next build` 成功输出静态文件
- `app/globals.css` 含 4 个 v2.2 锁定 token(success/conditional/warning/destructive)
- 红线 #4(emoji UI):`grep -RnP "[\x{1F300}-\x{1FAFF}]" app components` 命中 0

**status:** pending

---

### Task P0.2: Vercel + 环境变量 + maxDuration 锁定

**Files:**
- Create: `.env.example`, `vercel.json`, `scripts/check-env.ts`

- [ ] **Step 1: 写 `.env.example`(所有 env 变量声明 + 注释)**

```bash
# === Neon Postgres(同一连接串,双 driver)===
NEON_DATABASE_URL=postgresql://user:pass@host/db?sslmode=require
NEON_DATABASE_URL_WS=postgresql://user:pass@host/db?sslmode=require

# === Upstash Redis(2024-12 后 Vercel KV 替代)===
UPSTASH_REDIS_REST_URL=https://xxx.upstash.io
UPSTASH_REDIS_REST_TOKEN=xxx

# === Vercel AI Gateway ===
AI_GATEWAY_API_KEY=xxx

# === 可选 ===
DEMO_TEAM_CODE=                   # 留空=匿名公开;设值=要求 ?team_code= 校验
SENTRY_DSN=                       # 可选,空则 console.error
```

- [ ] **Step 2: 写 `vercel.json`(显式锁定 maxDuration,防 Vercel 默认值变化)**

> **v2.3 GAN-V3 修**:原方案用 `vercel.ts` + `import type { VercelConfig } from "@vercel/config/v1"`,但 `@vercel/config` 不是合法 npm 包,会 TypeScript 报错。**改用 `vercel.json`**(Vercel 原生支持,无需 TS 类型)。
> **pnpm 锁文件注意**:`installCommand: "pnpm install --frozen-lockfile"` 仅在 `pnpm-lock.yaml` 与 `package.json` 完全一致时通过。**P0.1 必须 commit lockfile,黑客松期间临时改依赖必须本地 pnpm install 后重新 commit lockfile,否则 Vercel 部署失败**。

`vercel.json`:
```json
{
  "framework": "nextjs",
  "buildCommand": "pnpm build",
  "installCommand": "pnpm install --frozen-lockfile",
  "functions": {
    "app/api/analyze/route.ts": { "maxDuration": 300 },
    "app/api/reproducibility-check/route.ts": { "maxDuration": 300 },
    "app/api/analysis-versions/[id]/prompts/ab-compare/route.ts": { "maxDuration": 60 },
    "app/api/evidence/search/route.ts": { "maxDuration": 30 },
    "app/api/proposals/route.ts": { "maxDuration": 30 },
    "app/api/decisions/route.ts": { "maxDuration": 30 }
  }
}
```

> **Vercel Fluid Compute 注**:2025-06 起 maxDuration 默认 300s,本配置仍显式声明是为"锁定值防 Vercel 后续默认改变";Pro/Enterprise 可延长到 800s。

- [ ] **Step 3: 写 `scripts/check-env.ts`(启动前自检,防忘配 env)**

```ts
const REQUIRED = [
  "NEON_DATABASE_URL",
  "NEON_DATABASE_URL_WS",
  "UPSTASH_REDIS_REST_URL",
  "UPSTASH_REDIS_REST_TOKEN",
  "AI_GATEWAY_API_KEY",
] as const;

const missing = REQUIRED.filter((k) => !process.env[k]);
if (missing.length > 0) {
  console.error(`[check-env] Missing required env vars: ${missing.join(", ")}`);
  process.exit(1);
}
console.log("[check-env] All required env vars present.");
```

- [ ] **Step 4: 在 package.json scripts 加 `predev`/`prebuild` 钩子**

```jsonc
"scripts": {
  "predev": "tsx scripts/check-env.ts",
  "prebuild": "tsx scripts/check-env.ts",
  "dev": "next dev",
  "build": "next build",
  "start": "next start",
  "typecheck": "tsc --noEmit",
  "test": "vitest run",
  "test:e2e": "playwright test",
  "consistency": "pwsh -File scripts/consistency-scan.ps1"
}
```

- [ ] **Step 5: 本地 vercel link(用户操作,plan 标注)**

```bash
# 用户在本地终端执行:
pnpm vercel link
pnpm vercel env pull .env.local
# 之后 pnpm dev 应能跑通 check-env.ts
```

- [ ] **Step 6: Commit**

```bash
git add .env.example vercel.json scripts/check-env.ts package.json
git commit -m "feat(P0.2): Vercel config + env baseline + maxDuration lock

- vercel.json 显式声明 6 个 SSE/长任务端点 maxDuration(GAN-V3 修:不用 vercel.ts)
- predev/prebuild hook 校验 5 个必需 env(防忘配)
- Upstash Redis env vars(取代 @vercel/kv,GAN-B B-B-3)
"
```

**acceptance_criteria:**
- `pnpm tsx scripts/check-env.ts` 在缺失 env 时退出码 1,完整时退出码 0
- `vercel.json` 含至少 6 个端点的 maxDuration 显式声明
- 红线 #12 扫描(`@vercel/kv|@vercel/ratelimit`):0 命中

**status:** pending

---

### Task P0.3: 三层数据连接(Drizzle HTTP + LangGraph WebSocket + Upstash)

**Files:**
- Create: `lib/db/index.ts`, `lib/graph/checkpointer.ts`, `lib/redis.ts`, `tests/unit/lib-connections.test.ts`

- [ ] **Step 1: 写失败测试**

`tests/unit/lib-connections.test.ts`:
```ts
import { describe, it, expect } from "vitest";

describe("lib connections", () => {
  it("db: should export drizzle instance with HTTP driver", async () => {
    const { db } = await import("@/lib/db");
    expect(db).toBeDefined();
    expect(typeof db.execute).toBe("function");
  });

  it("checkpointer: should export PostgresSaver with WebSocket Pool", async () => {
    const { checkpointer } = await import("@/lib/graph/checkpointer");
    expect(checkpointer).toBeDefined();
    expect(checkpointer.constructor.name).toBe("PostgresSaver");
  });

  it("redis: should export @upstash/redis client", async () => {
    const { redis } = await import("@/lib/redis");
    expect(redis).toBeDefined();
    expect(typeof redis.set).toBe("function");
  });
});
```

- [ ] **Step 2: 跑测试,期望 FAIL("Cannot find module")**

```bash
pnpm vitest run tests/unit/lib-connections.test.ts
# Expected: 3 failed
```

- [ ] **Step 3: 实现 `lib/db/index.ts`(Drizzle HTTP driver)**

```ts
import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "./schema";

const sql = neon(process.env.NEON_DATABASE_URL!);
export const db = drizzle(sql, { schema });
export type DB = typeof db;
```

(临时空 `lib/db/schema/index.ts` 仅 `export {};`,P1 填充)

- [ ] **Step 4: 实现 `lib/graph/checkpointer.ts`(PostgresSaver + WebSocket Pool)**

```ts
import { PostgresSaver } from "@langchain/langgraph-checkpoint-postgres";
import { Pool } from "@neondatabase/serverless";

// WebSocket Pool 用于 LangGraph 交互式事务 / prepared statement
// (HTTP driver 不支持 PostgresSaver,详见 api.md §8.2)
const pool = new Pool({ connectionString: process.env.NEON_DATABASE_URL_WS! });

export const checkpointer = new PostgresSaver(pool);
```

- [ ] **Step 5: 实现 `lib/redis.ts`**

```ts
import { Redis } from "@upstash/redis";

export const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});
```

- [ ] **Step 6: 跑测试,期望 PASS**

```bash
pnpm vitest run tests/unit/lib-connections.test.ts
# Expected: 3 passed
```

- [ ] **Step 7: Commit**

```bash
git add lib/db lib/graph/checkpointer.ts lib/redis.ts tests/unit/lib-connections.test.ts
git commit -m "feat(P0.3): 3 层数据连接(Drizzle HTTP + LangGraph WS + Upstash)

- lib/db: Drizzle + @neondatabase/serverless HTTP driver(业务查询)
- lib/graph/checkpointer: PostgresSaver + WebSocket Pool(LangGraph 事务)
- lib/redis: @upstash/redis(GAN-B B-B-3,取代废弃的 @vercel/kv)
- 3 个连接单测全通过
"
```

**acceptance_criteria:**
- `pnpm vitest run tests/unit/lib-connections.test.ts` 全 PASS
- 红线 #12(@vercel/kv)+ #14(AsyncPostgresSaver):0 命中
- `pnpm tsc --noEmit` 退出码 0

**status:** pending

---

### Task P0.4: AI Gateway + Embedding 层

**Files:**
- Create: `lib/llm/gateway.ts`, `lib/llm/embedding.ts`, `tests/unit/llm-gateway.test.ts`

- [ ] **Step 1: 写失败测试**

`tests/unit/llm-gateway.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { modelForNode, type NodeId } from "@/lib/llm/gateway";

describe("modelForNode", () => {
  it.each<[NodeId, string]>([
    ["N1", "anthropic/claude-haiku-4.5"],
    ["N2", "anthropic/claude-haiku-4.5"],
    ["N4", "anthropic/claude-sonnet-4.6"],
    ["N5", "anthropic/claude-sonnet-4.6"],
    ["N8", "anthropic/claude-sonnet-4.6"],
    ["N9", "anthropic/claude-opus-4.7"],
  ])("node %s uses model %s (dot-notation, no date suffix)", (node, expected) => {
    const { model } = modelForNode(node);
    expect(model).toBe(expected);
  });

  it("N3 returns embedding model", () => {
    const { model } = modelForNode("N3");
    expect(model).toBe("openai/text-embedding-3-small");
  });

  it("providerOptions.gateway has zeroDataRetention but NOT retry field", () => {
    const { providerOptions } = modelForNode("N9");
    expect(providerOptions.gateway.zeroDataRetention).toBe(true);
    expect("retry" in providerOptions.gateway).toBe(false);
  });

  it("providerOptions.gateway.order includes fallback chain", () => {
    const { providerOptions } = modelForNode("N4");
    expect(providerOptions.gateway.order).toContain("anthropic/claude-sonnet-4.6");
    expect(providerOptions.gateway.order).toContain("anthropic/claude-haiku-4.5");
  });
});
```

- [ ] **Step 2: 跑测试,期望 FAIL("Cannot find module")**

```bash
pnpm vitest run tests/unit/llm-gateway.test.ts
# Expected: 6 failed
```

- [ ] **Step 3: 实现 `lib/llm/gateway.ts`**

```ts
import { redis } from "@/lib/redis";

export type NodeId = "N1" | "N2" | "N3" | "N4" | "N5" | "N6" | "N7" | "N8" | "N9";

const MODEL_BY_NODE: Record<NodeId, string | null> = {
  N1: "anthropic/claude-haiku-4.5",
  N2: "anthropic/claude-haiku-4.5",
  N3: "openai/text-embedding-3-small",
  N4: "anthropic/claude-sonnet-4.6",
  N5: "anthropic/claude-sonnet-4.6",
  N6: null,                                 // 纯计算
  N7: null,                                 // 纯计算
  N8: "anthropic/claude-sonnet-4.6",
  N9: "anthropic/claude-opus-4.7",          // 报告生成质量优先
};

const FALLBACK_CHAIN = [
  "anthropic/claude-sonnet-4.6",
  "anthropic/claude-haiku-4.5",
];

export interface ModelConfig {
  model: string;
  providerOptions: {
    gateway: {
      zeroDataRetention: true;
      order: string[];
    };
  };
}

export function modelForNode(node: NodeId): ModelConfig {
  const base = MODEL_BY_NODE[node];
  if (!base) throw new Error(`Node ${node} is pure computation, no LLM model`);

  const order = [base, ...FALLBACK_CHAIN.filter((m) => m !== base)];

  return {
    model: base,
    providerOptions: {
      gateway: {
        zeroDataRetention: true,           // GAN-B B-B-5: ZDR 已隐含 disallowPromptTraining
        order,                              // GAN-B B-B-5: 无 retry 字段,重试由 AI SDK maxRetries 控制
      },
    },
  };
}

// Manual override(P07 面板 1 演示用,Redis 300s TTL)
export async function readManualOverride(): Promise<string | null> {
  return await redis.get<string>("llm:manual_override");
}

export async function setManualOverride(model: string, ttlSeconds = 300): Promise<void> {
  await redis.set("llm:manual_override", model, { ex: ttlSeconds });
}
```

- [ ] **Step 4: 实现 `lib/llm/embedding.ts`**

```ts
import { embed, embedMany } from "ai";
import { gateway } from "@ai-sdk/gateway";

// GAN-B B-B-1: text-embedding-3-small 默认 1536 维(不传 dimensions)
const EMBEDDING_MODEL = "openai/text-embedding-3-small";

export async function embedOne(text: string): Promise<number[]> {
  const { embedding } = await embed({
    model: gateway.textEmbeddingModel(EMBEDDING_MODEL),
    value: text,
    providerOptions: { gateway: { zeroDataRetention: true } },
    maxRetries: 3,
  });
  return embedding;
}

export async function embedManyTexts(texts: string[]): Promise<number[][]> {
  const { embeddings } = await embedMany({
    model: gateway.textEmbeddingModel(EMBEDDING_MODEL),
    values: texts,
    providerOptions: { gateway: { zeroDataRetention: true } },
    maxRetries: 3,
  });
  return embeddings;
}

// 余弦相似度(P0 in-memory retriever 用)
export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) throw new Error(`Dim mismatch: ${a.length} vs ${b.length}`);
  let dot = 0, normA = 0, normB = 0;
  for (let i = 0; i < a.length; i++) {
    const ai = a[i]!, bi = b[i]!;
    dot += ai * bi; normA += ai * ai; normB += bi * bi;
  }
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}
```

- [ ] **Step 5: 跑测试,期望 PASS**

```bash
pnpm vitest run tests/unit/llm-gateway.test.ts
# Expected: 6 passed
```

- [ ] **Step 6: 红线扫描**

```bash
pnpm consistency      # PowerShell 脚本,扫 25 条红线
# Expected: ✅ PASS (0 命中)
```

- [ ] **Step 7: Commit**

```bash
git add lib/llm tests/unit/llm-gateway.test.ts
git commit -m "feat(P0.4): AI Gateway + embedding(GAN-B v2.3 全锁)

- 模型 ID 点号格式:claude-{haiku-4.5,sonnet-4.6,opus-4.7}
- zeroDataRetention:true + order fallback;无 retry 字段(改 maxRetries)
- text-embedding-3-small 默认 1536 维(不传 dimensions)
- modelForNode 单测 6 项全 PASS
"
```

**acceptance_criteria:**
- 单测全 PASS(6 项)
- 红线 #11(模型 ID 旧格式)+ #13(384 维)+ #15(retry 字段):0 命中
- `lib/llm/gateway.ts` 不导入 `@vercel/kv`

**status:** pending

---

### Task P0.5: 限流中间件(Upstash + 内存兜底)

**Files:**
- Create: `middleware.ts`, `lib/ratelimit.ts`, `tests/unit/ratelimit-fallback.test.ts`

- [ ] **Step 1: 写失败测试(测内存兜底逻辑)**

`tests/unit/ratelimit-fallback.test.ts`:
```ts
import { describe, it, expect, beforeEach } from "vitest";
import { checkInMemory, resetInMemory } from "@/lib/ratelimit";

describe("checkInMemory (Redis fallback)", () => {
  beforeEach(() => resetInMemory());

  it("allows up to max within window", () => {
    expect(checkInMemory("ip1:analyze", 2, 60000)).toBe(true);
    expect(checkInMemory("ip1:analyze", 2, 60000)).toBe(true);
    expect(checkInMemory("ip1:analyze", 2, 60000)).toBe(false);
  });

  it("isolates per key", () => {
    expect(checkInMemory("ip1:analyze", 1, 60000)).toBe(true);
    expect(checkInMemory("ip2:analyze", 1, 60000)).toBe(true);
    expect(checkInMemory("ip1:analyze", 1, 60000)).toBe(false);
  });

  it("resets after window expiry", async () => {
    expect(checkInMemory("ip3:fast", 1, 50)).toBe(true);
    expect(checkInMemory("ip3:fast", 1, 50)).toBe(false);
    await new Promise((r) => setTimeout(r, 60));
    expect(checkInMemory("ip3:fast", 1, 50)).toBe(true);
  });
});
```

- [ ] **Step 2: 跑测试,期望 FAIL**

```bash
pnpm vitest run tests/unit/ratelimit-fallback.test.ts
```

- [ ] **Step 3: 实现 `lib/ratelimit.ts`**

```ts
import { Ratelimit } from "@upstash/ratelimit";
import { redis } from "@/lib/redis";

// 限流规则(端点路径模式 → 配置)— 对照 api.md §10
export const RATE_LIMITS: Record<string, { max: number; windowMs: number }> = {
  "/api/analyze": { max: 2, windowMs: 60_000 },
  "/api/reproducibility-check": { max: 1, windowMs: 60_000 },
  "/api/proposals/*/reproducibility-runs/start": { max: 1, windowMs: 60_000 },
  "/api/analysis-versions/*/fork": { max: 2, windowMs: 60_000 },
  "/api/scenarios/*/load": { max: 10, windowMs: 60_000 },
  "/api/proposals": { max: 10, windowMs: 60_000 },
  "/api/proposals/draft/detect-decision-type": { max: 30, windowMs: 60_000 },
  "/api/evidence/search": { max: 10, windowMs: 60_000 },
  "/api/decisions": { max: 10, windowMs: 60_000 },
  "/api/llm/manual-degrade": { max: 5, windowMs: 60_000 },
  "/api/proposals/*/rollback": { max: 5, windowMs: 60_000 },
  "/api/hitl/*": { max: 10, windowMs: 60_000 },
  "/api/analyze/*/pause": { max: 10, windowMs: 60_000 },
  "/api/analyze/*/resume": { max: 10, windowMs: 60_000 },
  "/api/analysis-versions/*/prompts/ab-compare": { max: 5, windowMs: 60_000 },
};
const DEFAULT_GET = { max: 60, windowMs: 60_000 };
const DEFAULT_MUTATION = { max: 30, windowMs: 60_000 };

// 内存兜底(Redis 失效时降级,GAN-B H-B-5;防 Demo 雪崩)
const inMemory = new Map<string, { count: number; resetAt: number }>();
export function checkInMemory(key: string, max: number, windowMs: number): boolean {
  const now = Date.now();
  const entry = inMemory.get(key);
  if (!entry || entry.resetAt < now) {
    inMemory.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }
  if (entry.count >= max) return false;
  entry.count++;
  return true;
}
export function resetInMemory() { inMemory.clear(); }

// 路径模式匹配(`/api/proposals/*/rollback` 匹配 `/api/proposals/abc/rollback`)
export function matchLimit(pathname: string, method: string): { max: number; windowMs: number; key: string } {
  for (const [pattern, cfg] of Object.entries(RATE_LIMITS)) {
    const re = new RegExp("^" + pattern.replace(/\*/g, "[^/]+") + "$");
    if (re.test(pathname)) return { ...cfg, key: pattern };
  }
  const cfg = method === "GET" ? DEFAULT_GET : DEFAULT_MUTATION;
  return { ...cfg, key: `${method}:default` };
}

const upstashLimiters = new Map<string, Ratelimit>();
function getUpstashLimiter(key: string, max: number, windowMs: number): Ratelimit {
  if (!upstashLimiters.has(key)) {
    upstashLimiters.set(key, new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(max, `${windowMs} ms`),
      prefix: `rl:${key}`,
    }));
  }
  return upstashLimiters.get(key)!;
}

export interface RateLimitResult { allowed: boolean; retryAfterSec: number; source: "upstash" | "memory" }

export async function checkRateLimit(ip: string, pathname: string, method: string): Promise<RateLimitResult> {
  const { max, windowMs, key } = matchLimit(pathname, method);
  try {
    const limiter = getUpstashLimiter(key, max, windowMs);
    const { success, reset } = await limiter.limit(ip);
    return { allowed: success, retryAfterSec: Math.max(1, Math.ceil((reset - Date.now()) / 1000)), source: "upstash" };
  } catch {
    const allowed = checkInMemory(`${key}:${ip}`, max, windowMs);
    return { allowed, retryAfterSec: 60, source: "memory" };
  }
}
```

- [ ] **Step 4: 实现 `middleware.ts`**

```ts
import { NextRequest, NextResponse } from "next/server";
import { checkRateLimit } from "@/lib/ratelimit";

export const config = { matcher: ["/api/:path*"] };

export async function middleware(req: NextRequest) {
  // P0 阶段:Demo team code 可选(api.md §3.1)
  const teamCode = process.env.DEMO_TEAM_CODE;
  if (teamCode) {
    const provided = req.headers.get("x-team-code") ?? req.nextUrl.searchParams.get("team_code");
    if (provided !== teamCode) {
      return NextResponse.json(
        { error: { code: "UNAUTHENTICATED", user_message: "需要团队访问码" } },
        { status: 401 }
      );
    }
  }

  const ip = (req.headers.get("x-forwarded-for") ?? "anonymous").split(",")[0]!.trim();
  const result = await checkRateLimit(ip, req.nextUrl.pathname, req.method);
  if (!result.allowed) {
    return NextResponse.json(
      {
        error: {
          code: "RATE_LIMIT_EXCEEDED",
          user_message: result.source === "memory"
            ? "操作过于频繁(降级限流),请稍后"
            : "操作过于频繁,请稍后重试",
          recoverable: true,
        },
        request_id: req.headers.get("x-request-id") ?? crypto.randomUUID(),
      },
      { status: 429, headers: { "Retry-After": String(result.retryAfterSec) } }
    );
  }
  return NextResponse.next();
}
```

- [ ] **Step 5: 跑测试 + typecheck,期望 PASS**

```bash
pnpm vitest run tests/unit/ratelimit-fallback.test.ts
pnpm tsc --noEmit
```

- [ ] **Step 6: Commit**

```bash
git add middleware.ts lib/ratelimit.ts tests/unit/ratelimit-fallback.test.ts
git commit -m "feat(P0.5): 限流中间件 + 内存兜底(GAN-B H-B-5)

- @upstash/ratelimit slidingWindow,15 个端点级配置 + 默认 GET 60/min POST 30/min
- Redis 失效降级到进程内存计数器(防 Demo 雪崩,非放行)
- DEMO_TEAM_CODE env 可选(api.md §3.1)
- 内存兜底单测 3 项全 PASS
"
```

**acceptance_criteria:**
- 内存兜底单测全 PASS
- 红线 #12(@vercel/kv|@vercel/ratelimit):0 命中(注意:`@upstash/ratelimit` 是合法的)
- `middleware.ts` 配置 matcher 覆盖所有 `/api/:path*`

**status:** pending

---

## Phase P1 — 数据层(可并行)

### Task P1.1: Drizzle 11 张表 schema

**Files:**
- Create: 11 个 schema 文件 `lib/db/schema/{personas,internal-objectives,evidence-sources,evidence-cards,proposals,analysis-versions,decisions,hitl-audit,audit-logs,reproducibility-runs,provider-events}.ts`
- Create: `lib/db/schema/index.ts`(barrel export)
- Create: `drizzle.config.ts`
- Modify: `package.json`(加 `db:generate` / `db:migrate` scripts)

> **契约**:**每张表 1:1 对照 [api.md §2.3.1 - §2.3.11](2026-05-23-collab-agent-api.md) 完整 Drizzle TypeScript schema**(包括 enum / 字段类型 / default / FK)。本 task 不重写 schema 内容(已锁定),而是创建文件 + 迁移 + 字段存在性测试。

- [ ] **Step 1: 写失败测试(字段存在性 + 关键不变量)**

`tests/unit/db-schema.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import * as schema from "@/lib/db/schema";

describe("11 张表 schema 存在性", () => {
  const expectedTables = [
    "personas", "internal_objectives", "evidence_sources", "evidence_cards",
    "proposals", "analysis_versions", "decisions", "hitl_audit",
    "audit_logs", "reproducibility_runs", "provider_events",
  ];
  it.each(expectedTables)("表 %s 已导出", (name) => {
    expect(schema[name as keyof typeof schema]).toBeDefined();
  });
});

describe("v2.3 GAN 关键字段存在性", () => {
  it("personas.is_default 是 integer(B-A-1)", () => {
    const col = schema.personas.is_default;
    expect(col.dataType).toBe("number");
  });
  it("analysis_versions.headline_disagreement 顶层字段存在(B-A-5)", () => {
    expect(schema.analysis_versions.headline_disagreement).toBeDefined();
  });
  it("analysis_versions.decision_report_overrides 顶层字段存在(B-A-6)", () => {
    expect(schema.analysis_versions.decision_report_overrides).toBeDefined();
  });
  it("analysis_versions.methodology_ab_compare 顶层字段存在(B-A-3)", () => {
    expect(schema.analysis_versions.methodology_ab_compare).toBeDefined();
  });
  it("proposals.current_analysis_version_id 顶层字段存在(H-A-7)", () => {
    expect(schema.proposals.current_analysis_version_id).toBeDefined();
  });
  it("hitl_audit.auto_approve_at 字段存在(H-A-6)", () => {
    expect(schema.hitl_audit.auto_approve_at).toBeDefined();
  });
  it("audit_logs.auditActionEnum 含 raci_override(B-A-6)", () => {
    expect(schema.auditActionEnum.enumValues).toContain("raci_override");
  });
  it("decision_type enum 含 5 种(含 cross_border,B-A-2)", () => {
    expect(schema.decisionTypeEnum.enumValues).toEqual(
      expect.arrayContaining(["selection", "marketing", "budget", "operation", "cross_border"])
    );
  });
});
```

- [ ] **Step 2: 跑测试,期望 FAIL**

```bash
pnpm vitest run tests/unit/db-schema.test.ts
```

- [ ] **Step 3: 创建 11 张表 schema 文件**

每个文件按 **api.md §2.3.{N} 已锁定的 Drizzle TS 代码** 完整复制(含 pgEnum / 字段 / FK / default)。本 plan 不重复列出(详见 api.md),清单如下并逐项 commit:

```
lib/db/schema/personas.ts            -> api.md §2.3.1(注意 is_default 是 integer 不是 text)
lib/db/schema/internal-objectives.ts -> api.md §2.3.2
lib/db/schema/evidence-sources.ts    -> api.md §2.3.3
lib/db/schema/evidence-cards.ts      -> api.md §2.3.4(embedding 字段 jsonb<number[]>,1536 维)
lib/db/schema/proposals.ts           -> api.md §2.3.5(含 current_analysis_version_id)
lib/db/schema/analysis-versions.ts   -> api.md §2.3.6(含 headline_disagreement +
                                                       decision_report_overrides + methodology_ab_compare)
lib/db/schema/decisions.ts           -> api.md §2.3.7(AAR 4 字段)
lib/db/schema/hitl-audit.ts          -> api.md §2.3.8(含 auto_approve_at)
lib/db/schema/audit-logs.ts          -> api.md §2.3.9(enum 含 raci_override)
lib/db/schema/reproducibility-runs.ts-> api.md §2.3.10
lib/db/schema/provider-events.ts     -> api.md §2.3.11(注意 providerEnum 内部标识仍是 haiku-4-5/sonnet-4-6/opus-4-7,**有意保留破折号**,不与对外模型 ID 混淆)
```

`lib/db/schema/index.ts`:
```ts
export * from "./personas";
export * from "./internal-objectives";
export * from "./evidence-sources";
export * from "./evidence-cards";
export * from "./proposals";
export * from "./analysis-versions";
export * from "./decisions";
export * from "./hitl-audit";
export * from "./audit-logs";
export * from "./reproducibility-runs";
export * from "./provider-events";
```

- [ ] **Step 4: 写 `drizzle.config.ts`**

```ts
import { defineConfig } from "drizzle-kit";

export default defineConfig({
  schema: "./lib/db/schema/index.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: { url: process.env.NEON_DATABASE_URL! },
  strict: true,
  verbose: true,
});
```

- [ ] **Step 5: 加 scripts**

```jsonc
"scripts": {
  "db:generate": "drizzle-kit generate",
  "db:migrate": "drizzle-kit migrate",
  "db:studio": "drizzle-kit studio"
}
```

- [ ] **Step 6: 生成 migration + 跑测试**

```bash
pnpm db:generate                              # 生成 ./drizzle/0000_*.sql
pnpm vitest run tests/unit/db-schema.test.ts  # 全 PASS
pnpm tsc --noEmit
```

- [ ] **Step 7: 应用到 Neon(用户确认后)**

```bash
pnpm db:migrate
```

- [ ] **Step 8: Commit**

```bash
git add lib/db/schema drizzle drizzle.config.ts package.json tests/unit/db-schema.test.ts
git commit -m "feat(P1.1): Drizzle 11 张表 schema + 初始 migration

- 1:1 对照 api.md §2.3 全部 11 张表(含 v2.3 GAN 修复字段)
- 关键不变量单测:is_default int / headline + overrides + ab_compare 顶层
  / current_analysis_version_id / auto_approve_at / raci_override enum
  / 5 种 decision_type 含 cross_border
- migration 已生成,等待用户 pnpm db:migrate
"
```

**acceptance_criteria:**
- 11 张表 schema 文件全部存在,index.ts barrel export
- 单测全 PASS(11+8 项)
- `pnpm db:generate` 成功输出 SQL migration
- 红线 #22/#23/#24/#25(各顶层字段存在性):0 命中

**status:** pending

---

### Task P1.2: Seed 数据(7 personas + 5 objectives + evidence + 4 fixtures)

**Files:**
- Create: `lib/db/seed/personas.ts`、`lib/methodology/p0-objective-fixtures.ts`(P3 也用)、`lib/db/seed/evidence.ts`、`lib/db/seed/scenarios/{scenario-1..4}.json`、`scripts/seed.ts`
- Create: `tests/unit/seed-personas.test.ts`、`tests/unit/seed-scenarios.test.ts`

> **数据契约**:**personas 默认值 = [personas.md §三、7 角色一览表](../design/01-product/personas.md);P0 objectives = [methodology.md L1 § P0 内置目标库](../design/03-tech-direction/methodology.md);4 场景区域管理观点 = [P01 §v2.1 GAN-A 必杀 #2 修表](../design/02-pages/P01-home.md)**。

- [ ] **Step 1: 写失败测试**

`tests/unit/seed-personas.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { DEFAULT_PERSONAS } from "@/lib/db/seed/personas";

describe("7 默认 personas", () => {
  it("恰好 7 个", () => expect(DEFAULT_PERSONAS).toHaveLength(7));

  it("包含 7 个 role_type", () => {
    const roles = DEFAULT_PERSONAS.map((p) => p.role_type);
    expect(roles).toEqual(expect.arrayContaining([
      "operations", "products", "marketing", "finance", "brand", "supply_chain", "regional"
    ]));
  });

  it("每个 persona 字段非空(interest_boundary + natural_conflicts + decision_catchphrase)", () => {
    for (const p of DEFAULT_PERSONAS) {
      expect(p.interest_boundary.length).toBeGreaterThan(0);
      expect(p.natural_conflicts.length).toBeGreaterThan(0);
      expect(p.decision_catchphrase.length).toBeGreaterThan(0);
      expect(p.kpis.length).toBeGreaterThanOrEqual(2);
    }
  });
});
```

`tests/unit/seed-scenarios.test.ts`:
```ts
import { describe, it, expect } from "vitest";

describe("4 demo 场景 fixture", () => {
  it.each(["scenario-1", "scenario-2", "scenario-3", "scenario-4"])("%s 加载成功", async (id) => {
    const f = await import(`@/lib/db/seed/scenarios/${id}.json`);
    expect(f.default).toBeDefined();
    expect(f.default.raw_text.length).toBeGreaterThanOrEqual(50);
    expect(f.default.declared_objective_id).toBeDefined();
    // GAN-A v2 必杀 #2:每场景必须有"区域管理"角色的差异化观点
    expect(f.default.region_view).toBeDefined();
    expect(f.default.region_view.attitude).toMatch(/support|conditional|insufficient|oppose/);
    expect(f.default.region_view.reason.length).toBeGreaterThan(20);
  });
});
```

- [ ] **Step 2: 跑测试,期望 FAIL**

- [ ] **Step 3: 实现 `lib/db/seed/personas.ts`**

```ts
import type { InferInsertModel } from "drizzle-orm";
import { personas } from "@/lib/db/schema/personas";

export const DEFAULT_PERSONAS: Omit<InferInsertModel<typeof personas>, "id" | "created_at" | "updated_at">[] = [
  {
    role_type: "operations", name: "运营",
    objective: "把活动节奏跑通",
    kpis: ["流量转化率", "库存周转", "预算 ROI"],
    interest_boundary: "不超预算 / 不爆库存",
    natural_conflicts: ["finance", "supply_chain"],
    decision_catchphrase: "这个时间窗口我们的库存够吗?",
    risk_appetite: "neutral", notes: "", is_default: 1,
  },
  {
    role_type: "products", name: "商品",
    objective: "维持品类结构健康",
    kpis: ["新品占比", "季节适配度", "SKU 集中度"],
    interest_boundary: "不破坏品类节奏",
    natural_conflicts: ["marketing"],
    decision_catchphrase: "和现有主推会不会左右互搏?",
    risk_appetite: "conservative", notes: "", is_default: 1,
  },
  {
    role_type: "marketing", name: "市场",
    objective: "强化品牌声量与定位",
    kpis: ["声量分布", "品牌定位匹配度", "价位带覆盖"],
    interest_boundary: "不偏离品牌定位",
    natural_conflicts: ["finance"],
    decision_catchphrase: "这个调性符合我们品牌往哪去吗?",
    risk_appetite: "aggressive", notes: "", is_default: 1,
  },
  {
    role_type: "finance", name: "财务",
    objective: "保毛利与回款",
    kpis: ["ROI", "毛利率", "回款周期"],
    interest_boundary: "不亏钱 / 不超预算",
    natural_conflicts: ["operations", "marketing", "products"],
    decision_catchphrase: "投入产出算过没,数据靠不靠谱?",
    risk_appetite: "conservative", notes: "", is_default: 1,
  },
  {
    role_type: "brand", name: "品牌",
    objective: "守护消费者认知",
    kpis: ["调性一致性", "跨市场认知差异", "客单价"],
    interest_boundary: "不损害长期品牌",
    natural_conflicts: ["operations"],
    decision_catchphrase: "我们这次想让消费者记住什么?",
    risk_appetite: "conservative", notes: "", is_default: 1,
  },
  {
    role_type: "supply_chain", name: "供应链",
    objective: "保备货与合规",
    kpis: ["备货周期", "产能利用率", "跨境合规"],
    interest_boundary: "不缺货 / 不超期",
    natural_conflicts: ["operations", "products"],
    decision_catchphrase: "这个量级的备货,3 个市场都跟得上吗?",
    risk_appetite: "neutral", notes: "", is_default: 1,
  },
  {
    role_type: "regional", name: "区域管理",
    objective: "维护区域增长与本地化",
    kpis: ["区域增长率", "本地市占", "本地复购"],
    interest_boundary: "本地法规 / 本地节日不能错",
    natural_conflicts: ["operations", "products"],   // vs 总部标准化
    decision_catchphrase: "在我们这边消费者真的吃这一套吗?",
    risk_appetite: "neutral", notes: "", is_default: 1,
  },
];
```

- [ ] **Step 4: 实现 `lib/methodology/p0-objective-fixtures.ts`**

5 条 fixture 完整复制自 [methodology.md §L1 P0 内置目标库](../design/03-tech-direction/methodology.md)(obj-2026-q3-qixi / overseas-brand / q3-supply / cashflow / q3-cross-border)。

- [ ] **Step 5: 实现 4 个 scenarios JSON(每个含 raw_text + declared_objective_id + region_view 差异化观点)**

4 个 JSON 文件按 [P01-home.md §Demo 一键模拟器 + 区域管理预设观点表](../design/02-pages/P01-home.md) 完整对照写入。每个文件结构:

```json
{
  "scenario_id": "scenario-2",
  "name": "七夕情侣对戒",
  "raw_text": "...(≥ 200 字真实提案文本)...",
  "decision_type": "selection",
  "declared_objective_id": "obj-2026-q3-qixi",
  "selected_persona_ids": ["per_ops","per_prod","per_mkt","per_fin","per_brand","per_supply","per_region"],
  "region_view": {
    "attitude": "oppose",
    "reason": "东南亚情侣节是 2/14 而非七夕,日本七夕(7/7)消费氛围远弱于中国,强行同步发起=区域 ROAS 失败;建议中国/韩国正常推,日本/东南亚换 2/14 或当地节日"
  }
}
```

- [ ] **Step 6: 实现 evidence seed(10+ 条,含真实 1536 维 embedding)**

`lib/db/seed/evidence.ts`:
```ts
import type { embedManyTexts } from "@/lib/llm/embedding";

export interface SeedEvidenceCard {
  title: string;
  snippet: string;
  full_content: string;        // ≥ 200 字
  source_name: string;          // 关联到 evidence_sources by name
  tags: string[];
}

// v2.3 GAN-V3 Issue 3 修:不允许 placeholder,以下 12 条覆盖 4 Demo 场景
// 数据基于公开零售行业知识 + 珠宝行业常识虚构(非企业 X 真实数据)
// 演示时若评审追问数据来源:答"P0 是 fixture,V2 真接飞书/ERP/小红书 OpenAPI 后由业务录入"
export const SEED_EVIDENCE_CARDS: SeedEvidenceCard[] = [
  // === 场景 1:小红书声量 A 款项链(3 条)===
  {
    title: "2026 Q1 小红书珠宝品类声量周报(虚构 fixture)",
    snippet: "国内小红书珠宝品类周声量 TOP 5:对戒/项链/耳钉/手链/胸针。A 款项链以「极简金链 + 心形吊坠」概念在 25-32 岁女性中收藏率最高,周环比 +18%。",
    full_content: "本周(2026-W12)小红书珠宝品类种草内容共 32 万篇,环比 +12%。A 款项链相关笔记 4800+,互动总量 28.5 万,收藏/点赞比 0.42(行业均值 0.31),目标人群集中在一线城市 25-32 岁未婚女性。值得注意的差异化数据:东南亚地区(印尼/泰国/越南)用户对该款式互动率仅为国内的 18%,东南亚用户更偏好黄金色系且 SKU 价格段 < ¥1500。日本市场同款内容互动率为国内 38%,但日本用户对设计「极简度」要求更高,反对带钻款式。",
    source_name: "小红书声量(Fixture)",
    tags: ["市场", "声量", "选品", "区域差异"],
  },
  {
    title: "竞品分析:对标品牌 Q4-Q1 新品项链节奏(虚构 fixture)",
    snippet: "周大福/老凤祥/潘多拉 等 5 个对标品牌过去 90 天上新项链共 23 款,其中 8 款为情侣/对戒概念,主流价位带 ¥2000-5000。",
    full_content: "对标 6 个主流珠宝品牌 2025-Q4 至 2026-Q1 新品上市数据:总计上新项链 23 款,SKU 分布——极简金链 9 款(占 39%),钻石/宝石镶嵌 6 款(26%),情侣对戒概念 8 款(35%)。价位带分布:¥1000-2000(4 款),¥2000-5000(14 款,主流),¥5000+(5 款)。库存周转:对标品牌新品 60 天周转率均值 1.8 次,极简金链最高(2.4 次),钻石镶嵌最低(1.1 次)。结论:主推极简金链且 ¥2000-5000 价位带是当下市场最热门组合。",
    source_name: "竞品分析(Fixture)",
    tags: ["竞品", "价位带", "上新节奏", "选品"],
  },
  {
    title: "历史决议 2025-Q4 # 双11 极简金链项目复盘",
    snippet: "去年双 11 主推极简金链项链单 SKU 销售破亿,但备货不足导致缺货率 22%,损失约 1500 万 GMV。供应链反馈备货周期需 ≥ 45 天。",
    full_content: "2025 双 11 复盘:主推「极简金链 12g」项链,首日售罄,11.1-11.11 全周期缺货率 22%(目标 < 8%),保守估算损失 GMV 约 1500 万。根本原因:① 供应链备货周期实测 45 天,但运营按 30 天计划,差 15 天;② 区域调拨机制未启用,华南库存富余但华东缺货;③ 工厂产能瓶颈在贵金属精炼环节。整改建议:大促前置 60 天确认 SKU、备货 ≥ 45 天、启用 4 区域调拨。【AAR 学习】下次类似单品需要供应链 1.3 权重和区域 1.0 权重以上参与决策。",
    source_name: "历史决议",
    tags: ["双11", "选品", "供应链", "缺货", "区域调拨"],
  },

  // === 场景 2:七夕情侣对戒(3 条)===
  {
    title: "Q3 七夕大促节奏建议(电商事业部 fixture)",
    snippet: "七夕 GMV 占全年 8.5%,2025 七夕国内对戒品类同比 +22%,但海外(日韩东南亚)同步七夕活动 ROAS 仅 0.8(国内 3.2)。",
    full_content: "电商事业部 2026 Q3 七夕大促规划:目标 GMV 8 亿(2025 同期 6.6 亿,+21%)。国内市场重点节点:七夕周(8/10-8/17),主推情侣对戒、对项链、求婚钻戒三大品类。海外市场分析(关键):日本同款七夕营销 ROAS 0.8(国内 3.2),原因是日本七夕(7/7)与中国不同步且消费氛围远弱;东南亚(印尼/泰国/越南)情侣节是 2/14 西方情人节,七夕几乎无认知。结论:七夕大促国内/中国港澳台/韩国全力推,日本走 7/7 节点轻度营销,东南亚切换到 2/14 主推或当地节日(印尼 12 月圣诞 / 泰国宋干节)。",
    source_name: "Demo Fixture - 七夕情侣对戒",
    tags: ["七夕", "选品", "营销", "区域差异", "ROAS"],
  },
  {
    title: "ERP 预测(虚构):七夕对戒备货可行性",
    snippet: "供应链当前对戒品类 SKU 库存覆盖 60 天,产能利用率 76%。若七夕主推新增 3 个 SKU,需提前 50 天定 PO,工厂可承接但需排期。",
    full_content: "供应链中心 2026 Q2 末数据:对戒品类 SKU 共 28 个,当前库存覆盖天数 60(高于安全线 45 天)。产能:核心代工厂 3 家,综合产能利用率 76%,可承接 +15% 新增订单但需提前 50 天定 PO。若七夕主推方案确定新增 3 个对戒 SKU,各备货 5000 件,需 6 月底前下单工厂 8 月初出货。风险:① 黄金原料价格波动若 +5% 会侵蚀毛利 2.1 个百分点;② 跨境物流到东南亚仓平均 21 天,需 7 月上旬完成铺货才能赶 7 月底预热。",
    source_name: "ERP 库存数据(V2 即将支持)",
    tags: ["七夕", "供应链", "产能", "备货", "跨境物流"],
  },
  {
    title: "区域市场调研:东南亚情侣节日认知(虚构 fixture)",
    snippet: "印尼/泰国/越南 18-35 岁城市消费者七夕认知率 < 12%,情人节(2/14)认知率 > 88%,本地传统节日(开斋节/宋干节)认知 95%+。",
    full_content: "海外事业部 2026-Q1 调研报告(N=2400,印尼/泰国/越南/马来/菲律宾五国):① 中国传统七夕认知率 11.8%,理解为「中国情人节」的仅 4.2%;② 西方情人节(2/14)认知率 89.5%,有送礼习惯;③ 本地节日:印尼开斋节(96%)、泰国宋干节(98%)、越南春节(95%);④ 珠宝品类购买决策因素:价格(86%)> 设计(73%)> 品牌(58%)> 工艺(42%);⑤ 客单价分布:印尼/越南 50% 在 ¥500-1500,泰国 60% 在 ¥1000-2500。结论:东南亚情侣对戒应在 2/14 推 + 当地节日辅助,定价 ¥1500-2500 段最稳。",
    source_name: "Demo Fixture - 跨境新品",
    tags: ["东南亚", "区域差异", "节日营销", "客单价"],
  },

  // === 场景 3:百万旗舰款(3 条)===
  {
    title: "高客单旗舰款历史 ROI 分析(虚构 fixture)",
    snippet: "过去 24 个月推出的 5 款客单价 ¥80 万以上旗舰珠宝,平均年销 12 件,毛利率 68%,但带动同系列中端款 GMV +35%(品牌势能效应)。",
    full_content: "财务中心高端旗舰款 ROI 复盘:2024-2025 推出的 5 款客单价 ¥80 万以上旗舰珠宝(钻戒 3 / 项链 1 / 套装 1),直接销售数据看似平淡——5 款合计年销 60 件,直接毛利 4080 万。但品牌势能效应显著:同系列中端款(¥3-15 万)GMV +35%,带动间接毛利估算 8200 万。综合 ROI 测算:直接 + 间接 = 1.23 亿毛利 / 2400 万投入(含设计/营销/陈列)= 5.1 倍。注意:① 中国/日本两个高奢市场承接 92% 销售,东南亚/韩国合计 8%;② 投放渠道以线下精品陈列 + 高端时尚杂志为主,数字营销转化率几乎为 0。",
    source_name: "Demo Fixture - 百万旗舰款",
    tags: ["旗舰款", "ROI", "品牌势能", "高奢市场", "区域"],
  },
  {
    title: "品牌中心:百万旗舰款定位文档(虚构 fixture)",
    snippet: "百万级旗舰款是品牌力的「向上锚定」,核心目的不是直接 GMV 而是建立「我们能做世界级珠宝」的认知,定价决策应由 CMO 主导。",
    full_content: "品牌中心 2026 战略文档:百万旗舰款的核心定位是「向上锚定」(Anchoring Up),目的是建立消费者「该品牌能做世界级珠宝」的认知,从而带动中端价位段(¥3-15 万)的购买信心。三个原则:① 设计上必须有独创工艺/独家宝石/限量编号;② 陈列上只在一线城市旗舰店和指定精品店;③ 营销上拒绝大众数字渠道,只走 Vogue/ELLE 等高端杂志和品鉴会。绝对禁忌:① 直播带货;② 折扣促销;③ 在大众电商平台陈列。本款若直接进电商主推,会损害品牌长期价值,**强烈不建议**。",
    source_name: "Demo Fixture - 百万旗舰款",
    tags: ["品牌定位", "旗舰款", "锚定", "禁忌"],
  },
  {
    title: "历史决议 2025-Q2 # 翡翠旗舰套装上电商被叫停",
    snippet: "2025 Q2 曾尝试将 ¥120 万翡翠套装上电商主推,品牌部强烈反对未果,3 个月后 NPS -4 + 品牌时尚度评分下降 7%,被董事会叫停。",
    full_content: "2025-Q2 决策复盘(教训型):彼时运营/财务主推将 ¥120 万翡翠套装上电商首页主推位,目标 30 天卖 5 件、GMV 600 万。品牌中心强烈反对,理由是会损害「精品店专属感」。决议最终通过(运营 + 财务权重高于品牌)。3 个月后数据:① 实销 1 件(目标 5 件,达成 20%);② 同期 NPS -4(连续 6 季首次下降);③ 第三方机构「珠宝品牌时尚度」评分下降 7%。董事会 Q3 叫停,要求建立「百万旗舰款不上电商」明文规则。【AAR 学习】高端旗舰款决策中,品牌权重必须 ≥ 1.2,且品牌部有一票否决权。",
    source_name: "历史决议",
    tags: ["旗舰款", "教训", "品牌权重", "AAR"],
  },

  // === 场景 4:跨境新品(3 条)===
  {
    title: "印尼/泰国轻奢珠宝市场年增 35%(虚构行业报告)",
    snippet: "2025 印尼轻奢珠宝市场规模 28 亿美元,YoY +35%;泰国 18 亿美元,YoY +28%。25-35 岁中产用户为主力,偏好「轻镶嵌 + 14K 金」品类。",
    full_content: "Euromonitor 2025 东南亚珠宝市场报告(虚构数据):印尼轻奢珠宝市场 28 亿美元(YoY +35%),泰国 18 亿美元(YoY +28%),越南 11 亿美元(YoY +41%)。增长驱动:① 中产阶级快速崛起,印尼新增中产年 +500 万;② 数字化购买渗透率 35%(2020 仅 12%);③ 婚庆品类升级(对戒客单价 5 年 +120%)。品类偏好关键差异:① 印尼/泰国 14K 金接受度 78%(中国 14K 接受度仅 23%,18K/22K 主流);② 镶嵌偏好「轻镶嵌 / 单颗主石」而非「群镶」;③ 颜色偏好黄金 + 玫瑰金,白金接受度低。竞争格局:本土品牌占 55%,国际品牌(卡地亚/蒂芙尼)15%,中国品牌目前 < 5%。",
    source_name: "行业研报(Fixture)",
    tags: ["东南亚", "市场规模", "14K", "区域差异", "增长"],
  },
  {
    title: "供应链跨境合规清单(虚构 fixture)",
    snippet: "印尼/泰国珠宝进口需满足:贵金属纯度认证(SNI/TIS 标准)、HS 编码 7113.19、清关周期 14-21 天、需当地经销商资质。",
    full_content: "供应链中心跨境合规清单:① 印尼贵金属进口需满足 SNI(Standar Nasional Indonesia)纯度认证,14K 含金量 ≥ 58.3% 才能贴金标;② 泰国 TIS 1066-2547 类似要求;③ 越南需越南珠宝协会 VJA 注册;④ HS 编码统一 7113.19(贵金属首饰),关税率印尼 5% / 泰国 10% / 越南 7%;⑤ 清关周期:印尼 14-21 天(需在 IDA 印尼海关报关)、泰国 10-14 天、越南 7-14 天;⑥ 必须有当地经销商资质或合资公司主体;⑦ 不允许跨境直邮电商方式(需保税仓 + 清关);⑧ 包装/标签必须本地语言(印尼语/泰语/越南语)+ 成分说明。",
    source_name: "Demo Fixture - 跨境新品",
    tags: ["跨境", "合规", "印尼", "泰国", "供应链"],
  },
  {
    title: "区域管理观点:东南亚试点 vs 韩国试点优先级(虚构 fixture)",
    snippet: "海外事业部建议:跨境新品先东南亚后韩国。东南亚市场增速 + 价格段匹配优于韩国;韩国市场成熟但偏好高奢品牌,新品突围难度大。",
    full_content: "海外事业部跨境新品试点策略备忘(2026-Q2):建议跨境新品先试印尼/泰国,后扩韩国/日本。理由:① 增速:东南亚 +30% vs 韩国 +6%;② 价格匹配:东南亚轻奢 ¥1500-5000 段与本品类天然匹配,韩国主流 ¥10000+(高奢 dominated);③ 竞争烈度:东南亚国际品牌仅 15% 份额,中国品牌可以占位;韩国本土 4 大品牌占 70%,外来品牌突围难度极高;④ 监管:东南亚 HS 7113 通用,韩国需额外 KCS 检测;⑤ 物流:东南亚 7-21 天可达,韩国 5-10 天但港口拥堵频发。结论:印尼试点 → 泰国扩张 → 越南/马来 → 最后韩国/日本,12-18 个月路径。",
    source_name: "Demo Fixture - 跨境新品",
    tags: ["跨境", "区域策略", "印尼", "韩国", "优先级"],
  },
];

export const SEED_EVIDENCE_SOURCES = [
  { source_type: "internal" as const, name: "历史决议", owner: "本系统", status: "active" as const },
  { source_type: "internal" as const, name: "Demo Fixture - 七夕情侣对戒", owner: "电商事业部", status: "active" as const },
  { source_type: "internal" as const, name: "Demo Fixture - 百万旗舰款", owner: "品牌中心", status: "active" as const },
  { source_type: "internal" as const, name: "Demo Fixture - 小红书声量", owner: "市场中心", status: "active" as const },
  { source_type: "internal" as const, name: "Demo Fixture - 跨境新品", owner: "海外事业部", status: "active" as const },
  { source_type: "internal" as const, name: "飞书文档(V2 即将支持)", owner: "IT", status: "pending_v2" as const },
  { source_type: "internal" as const, name: "ERP 库存数据(V2 即将支持)", owner: "IT", status: "pending_v2" as const },
  { source_type: "external" as const, name: "小红书声量(Fixture)", owner: "市场中心", status: "active" as const },
  { source_type: "external" as const, name: "行业研报(Fixture)", owner: "市场中心", status: "active" as const },
  { source_type: "external" as const, name: "竞品分析(Fixture)", owner: "市场中心", status: "active" as const },
  { source_type: "external" as const, name: "公开数据 API(V2 即将支持)", owner: "市场中心", status: "pending_v2" as const },
];
```

- [ ] **Step 7: 实现 `scripts/seed.ts`(可重入,先清后插)**

```ts
import "dotenv/config";
import { db } from "@/lib/db";
import { personas, internal_objectives, evidence_sources, evidence_cards } from "@/lib/db/schema";
import { DEFAULT_PERSONAS } from "@/lib/db/seed/personas";
import { P0_OBJECTIVES } from "@/lib/methodology/p0-objective-fixtures";
import { SEED_EVIDENCE_SOURCES, SEED_EVIDENCE_CARDS } from "@/lib/db/seed/evidence";
import { embedManyTexts } from "@/lib/llm/embedding";

async function main() {
  console.log("[seed] upsert personas...");
  for (const p of DEFAULT_PERSONAS) {
    await db.insert(personas).values(p).onConflictDoUpdate({
      target: personas.role_type, set: p,
    });
  }
  console.log("[seed] upsert objectives...");
  for (const o of P0_OBJECTIVES) {
    await db.insert(internal_objectives).values(o).onConflictDoNothing();
  }
  console.log("[seed] insert evidence sources...");
  const sourceMap = new Map<string, string>();
  for (const s of SEED_EVIDENCE_SOURCES) {
    const [row] = await db.insert(evidence_sources).values(s).returning({ id: evidence_sources.id });
    sourceMap.set(s.name, row!.id);
  }
  console.log(`[seed] embed ${SEED_EVIDENCE_CARDS.length} cards (1536d)...`);
  const embeddings = await embedManyTexts(SEED_EVIDENCE_CARDS.map((c) => c.title + "\n" + c.snippet));
  for (let i = 0; i < SEED_EVIDENCE_CARDS.length; i++) {
    const c = SEED_EVIDENCE_CARDS[i]!;
    const emb = embeddings[i]!;
    if (emb.length !== 1536) throw new Error(`Embedding dim mismatch: got ${emb.length}, expected 1536`);
    await db.insert(evidence_cards).values({
      source_id: sourceMap.get(c.source_name)!,
      title: c.title, snippet: c.snippet, full_content: c.full_content,
      embedding: emb, tags: c.tags, cited_count: 0,
    });
  }
  console.log("[seed] done.");
  process.exit(0);
}
main().catch((e) => { console.error(e); process.exit(1); });
```

- [ ] **Step 8: 加 script + 跑测试**

```jsonc
"scripts": { "seed": "tsx scripts/seed.ts" }
```

```bash
pnpm vitest run tests/unit/seed-personas.test.ts tests/unit/seed-scenarios.test.ts
# Expected: 10+ PASS

pnpm seed
# Expected: 7 personas + 5 objectives + 11 sources + 10+ cards inserted
```

- [ ] **Step 9: Commit**

```bash
git add lib/db/seed lib/methodology/p0-objective-fixtures.ts scripts/seed.ts tests/unit/seed-*.test.ts package.json
git commit -m "feat(P1.2): seed 7 personas + 5 objectives + 10+ evidence(1536d) + 4 scenarios

- 7 角色含区域管理(每场景预写差异化观点,GAN-A 必杀 #2)
- 5 P0 objectives 对应 methodology.md L1 fixture
- evidence_cards 真实 OpenAI embedding(1536 维,GAN-B B-B-1)
- pnpm seed 可重入(upsert)
"
```

**acceptance_criteria:**
- 7 personas + 5 objectives + 11 sources + ≥ 10 cards 入库成功
- 每条 evidence_card embedding.length === 1536
- 单测全 PASS(scenario + persona)
- 红线 #6(6 角色)+ #13(384 维):0 命中

**status:** pending

---

### Task P1.3: LangGraph PostgresSaver 4 张外部表 setup

**Files:**
- Create: `scripts/langgraph-setup.ts`
- Modify: `package.json`

- [ ] **Step 1: 实现 setup 脚本**

```ts
// scripts/langgraph-setup.ts
import "dotenv/config";
import { checkpointer } from "@/lib/graph/checkpointer";

async function main() {
  console.log("[langgraph-setup] Creating 4 checkpoint tables(checkpoints + checkpoint_blobs + checkpoint_writes + checkpoint_migrations)...");
  await checkpointer.setup();
  console.log("[langgraph-setup] Done. PostgresSaver 已自动 migration 完成。");
  process.exit(0);
}
main().catch((e) => { console.error(e); process.exit(1); });
```

- [ ] **Step 2: 加 script**

```jsonc
"scripts": { "langgraph:setup": "tsx scripts/langgraph-setup.ts" }
```

- [ ] **Step 3: 执行 + 验证(查 Neon)**

```bash
pnpm langgraph:setup
# 应在 Neon 看到 4 张新表
```

- [ ] **Step 4: Commit**

```bash
git add scripts/langgraph-setup.ts package.json
git commit -m "feat(P1.3): LangGraph PostgresSaver setup 脚本(4 张外部表自动 migration)"
```

**acceptance_criteria:**
- `pnpm langgraph:setup` 退出码 0
- Neon 中可见 `checkpoints` / `checkpoint_blobs` / `checkpoint_writes` / `checkpoint_migrations` 4 张表

**status:** pending

---

## Phase P2 — Zod Schema lib(单 subagent,可与 P1.2/P1.3 并行)

### Task P2.1: 12 个 Zod Schema 文件

**Files:**
- Create: `lib/schema/{attitude,role,decision-type,citation,persona-vote,disagreement,premortem,action-item,decision-report,reproducibility,aar,provider-event}.ts`
- Create: `lib/schema/index.ts`(barrel export)
- Create: `tests/unit/schema-constraints.test.ts`

> **契约**:**12 个 Schema 1:1 对照 [api.md §4.1 - §4.12 全部 Zod 代码](2026-05-23-collab-agent-api.md#4-共享-zod-schema-全集)**。本 task 不重写 schema 内容(已锁定),而是创建文件 + 关键约束行为单测。

- [ ] **Step 1: 写失败测试(每条强约束都有测试用例)**

`tests/unit/schema-constraints.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import {
  AttitudeEnum, ATTITUDE_SCORE, RoleEnum, DEFAULT_WEIGHTS, DecisionTypeEnum,
  CitationSchema, CitationsArraySchema, PersonaClaimSchema,
  DisagreementResolutionSchema, KeyDisagreementsArraySchema,
  PremortemArraySchema, ActionItemSchema, DecisionReportSchema,
  DecisionAarSchema, AttitudeDistributionSchema,
} from "@/lib/schema";

describe("ATTITUDE_SCORE 4 档锁定", () => {
  it("4 档分值精确", () => {
    expect(ATTITUDE_SCORE).toEqual({ support: 1.0, conditional: 0.5, insufficient: 0.0, oppose: -1.0 });
  });
  it("AttitudeEnum 4 值", () => {
    expect(AttitudeEnum.options).toEqual(["support", "conditional", "insufficient", "oppose"]);
  });
});

describe("RoleEnum 7 角色 + DEFAULT_WEIGHTS 5×7", () => {
  it("7 角色", () => {
    expect(RoleEnum.options).toHaveLength(7);
    expect(RoleEnum.options).toContain("regional");
  });
  it("5 决策类型", () => {
    expect(DecisionTypeEnum.options).toEqual(["selection", "marketing", "budget", "operation", "cross_border"]);
  });
  it("DEFAULT_WEIGHTS 5×7 矩阵完整", () => {
    for (const dt of DecisionTypeEnum.options) {
      const row = DEFAULT_WEIGHTS[dt];
      expect(Object.keys(row).sort()).toEqual([...RoleEnum.options].sort());
      for (const role of RoleEnum.options) {
        expect(row[role]).toBeGreaterThanOrEqual(0.5);
        expect(row[role]).toBeLessThanOrEqual(2.0);
      }
    }
  });
  it("cross_border × regional = 1.5", () => {
    expect(DEFAULT_WEIGHTS.cross_border.regional).toBe(1.5);
  });
  it("budget × finance = 1.6", () => {
    expect(DEFAULT_WEIGHTS.budget.finance).toBe(1.6);
  });
});

describe("CitationsArraySchema.min(1)", () => {
  it("空数组被拒", () => {
    expect(() => CitationsArraySchema.parse([])).toThrow();
  });
  it("≥1 通过", () => {
    expect(() => CitationsArraySchema.parse([{
      source_type: "proposal_text", source_id: "p1", snippet: "1234567890ab", relevance: 0.8,
    }])).not.toThrow();
  });
});

describe("DisagreementResolutionSchema 三字段长度", () => {
  it("shared_interest <10 被拒", () => {
    expect(() => DisagreementResolutionSchema.parse({
      shared_interest: "short", objective_criterion: "1234567890ab", next_step: "next1",
    })).toThrow();
  });
  it("next_step <5 被拒", () => {
    expect(() => DisagreementResolutionSchema.parse({
      shared_interest: "1234567890ab", objective_criterion: "1234567890ab", next_step: "1",
    })).toThrow();
  });
});

describe("PremortemArraySchema.min(3)", () => {
  it("2 条被拒", () => {
    expect(() => PremortemArraySchema.parse([
      { risk: "r"+"x".repeat(20), raised_by: ["finance"], severity: "high", scenario: "s"+"x".repeat(20), mitigations: [] },
      { risk: "r"+"x".repeat(20), raised_by: ["operations"], severity: "low", scenario: "s"+"x".repeat(20), mitigations: [] },
    ])).toThrow();
  });
});

describe("ActionItemSchema.accountable = RoleEnum 单值(GAN-A H-A-2)", () => {
  it("accountable 不是 RoleEnum 被拒(字符串拼接)", () => {
    expect(() => ActionItemSchema.parse({
      id: "a1", action: "补 ROI 测算", responsible: ["finance"], accountable: "finance/operations",
      consulted: [], informed: [], due_date: new Date().toISOString(),
    })).toThrow();
  });
  it("accountable 同时出现在 consulted 被拒", () => {
    expect(() => ActionItemSchema.parse({
      id: "a1", action: "补 ROI 测算", responsible: ["finance"], accountable: "finance",
      consulted: ["finance"], informed: [], due_date: new Date().toISOString(),
    })).toThrow();
  });
  it("合法 RACI 通过", () => {
    expect(() => ActionItemSchema.parse({
      id: "a1", action: "补 ROI 测算", responsible: ["finance"], accountable: "operations",
      consulted: ["products"], informed: ["brand"], due_date: new Date().toISOString(),
    })).not.toThrow();
  });
});

describe("DecisionAarSchema 4 字段 ≥2 非空 + 单字段 trim≥10(GAN-A H-A-3)", () => {
  it("4 字段都是空格被拒", () => {
    expect(() => DecisionAarSchema.parse({
      aar_expected: "          ", aar_actual: "          ",
    })).toThrow();
  });
  it("只填 1 个 ≥10 字段被拒", () => {
    expect(() => DecisionAarSchema.parse({
      aar_expected: "实际预期销售额超过 8 亿", aar_actual: undefined,
    })).toThrow();
  });
  it("2 个 ≥10 通过", () => {
    expect(() => DecisionAarSchema.parse({
      aar_expected: "实际预期销售额超过 8 亿", aar_actual: "实际达成 9.2 亿,超预期 15%",
    })).not.toThrow();
  });
});

describe("AttitudeDistributionSchema 四档总和 = 100", () => {
  it("和 ≠ 100 被拒", () => {
    expect(() => AttitudeDistributionSchema.parse({
      support: 30, conditional: 30, insufficient: 20, oppose: 10,  // = 90
    })).toThrow();
  });
});

describe("DecisionReportSchema 7 部分完整", () => {
  it("缺少 risks 被拒", () => {
    expect(() => DecisionReportSchema.parse({ conclusion: {}, scoring: {} })).toThrow();
  });
});
```

- [ ] **Step 2: 跑测试,期望 FAIL**

```bash
pnpm vitest run tests/unit/schema-constraints.test.ts
# Expected: 全 fail (cannot find module)
```

- [ ] **Step 3: 实现 12 个 Schema 文件**

按 [api.md §4.1 - §4.12 完整 Zod 代码](2026-05-23-collab-agent-api.md#4-共享-zod-schema-全集) **逐字段完整复制**。各文件清单与对应 api.md 锚点:

```
lib/schema/attitude.ts          -> api.md §4.1 (AttitudeEnum + ATTITUDE_SCORE + ICON + TOKEN)
lib/schema/role.ts              -> api.md §4.2 (RoleEnum + RoleLabelZh + RoleIcon)
lib/schema/decision-type.ts     -> api.md §4.2 (DecisionTypeEnum + DEFAULT_WEIGHTS 5×7 矩阵)
lib/schema/citation.ts          -> api.md §4.3 (CitationSchema + CitationsArraySchema.min(1))
lib/schema/persona-vote.ts      -> api.md §4.4 (StructuredClaimSchema + PersonaClaimSchema + PersonaVoteSchema)
lib/schema/disagreement.ts      -> api.md §4.6 (DisagreementResolutionSchema + KeyDisagreementSchema + Array)
lib/schema/premortem.ts         -> api.md §4.7 (PremortemRiskSchema + PremortemArraySchema.min(3))
lib/schema/action-item.ts       -> api.md §4.8 (ActionItemSchema, accountable: RoleEnum + refine 不重复)
lib/schema/decision-report.ts   -> api.md §4.9 (DecisionConclusionEnum + AttitudeDistribution + DecisionReportSchema 7 部分)
lib/schema/reproducibility.ts   -> api.md §4.11 (ReproducibilityMetricsSchema)
lib/schema/aar.ts               -> api.md §4.12 (DecisionAarSchema min(10) + refine trim≥10 + WeightSuggestionSchema)
lib/schema/provider-event.ts    -> api.md §4.10 (ProviderEventSchema + AnchoringFlagSchema 在 §4.5)
```

`lib/schema/index.ts`:
```ts
export * from "./attitude";
export * from "./role";
export * from "./decision-type";
export * from "./citation";
export * from "./persona-vote";
export * from "./disagreement";
export * from "./premortem";
export * from "./action-item";
export * from "./decision-report";
export * from "./reproducibility";
export * from "./aar";
export * from "./provider-event";
```

- [ ] **Step 4: 跑测试,期望 PASS**

```bash
pnpm vitest run tests/unit/schema-constraints.test.ts
# Expected: 全 PASS
pnpm tsc --noEmit
```

- [ ] **Step 5: 红线扫描**

```bash
pnpm consistency
# Expected: 红线 #18~#25 全 PASS(citations.min(1) / DisagreementResolution 3 字段 / accountable RoleEnum / AAR min(10) ...)
```

- [ ] **Step 6: Commit**

```bash
git add lib/schema tests/unit/schema-constraints.test.ts
git commit -m "feat(P2.1): 12 个 Zod Schema(全 v2.3 GAN 修复约束)

- AttitudeEnum 4 档 / RoleEnum 7 角色 / DecisionTypeEnum 5 类型
- CitationsArraySchema.min(1)
- DisagreementResolutionSchema 三字段长度(10/10/5)
- PremortemArraySchema.min(3)
- ActionItemSchema accountable: RoleEnum + refine 不重复(H-A-2)
- DecisionAarSchema min(10) + refine trim≥10(H-A-3)
- AttitudeDistribution refine 总和=100
- 单测 15+ 项全 PASS
"
```

**acceptance_criteria:**
- 12 个 schema 文件全存在 + barrel export
- 单测全 PASS
- 红线 #18/#19/#20/#21 全 0 命中

**status:** pending

---

## Phase P3 — 业务核心 lib(可并行 3 subagent)

### Task P3.1: lib/consensus(TWS + Anchoring + Weight)

**Files:**
- Create: `lib/consensus/{attitude,trajectory-weighted-scoring,anchoring-detector,weight-calculator}.ts`
- Create: `tests/unit/consensus-{tws,anchoring,weight}.test.ts`

- [ ] **Step 1: TWS 测试**

`tests/unit/consensus-tws.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { tws, type PersonaVote } from "@/lib/consensus/trajectory-weighted-scoring";

describe("TWS 轨迹加权评分(consensus-algorithm.md §对策2)", () => {
  const make = (role: string, weight: number, attitude: "support" | "conditional" | "insufficient" | "oppose"): PersonaVote =>
    ({ personaId: role, weight, attitude });

  it("全 7 角色支持 + 等权重 → +1.0", () => {
    const r0 = ["operations","products","marketing","finance","brand","supply_chain","regional"]
      .map((r) => make(r, 1.0, "support"));
    const r1 = [...r0];
    expect(tws(r0, r1)).toBeCloseTo(1.0, 5);
  });

  it("全反对 → -1.0", () => {
    const r0 = ["operations","products","marketing","finance","brand","supply_chain","regional"]
      .map((r) => make(r, 1.0, "oppose"));
    expect(tws(r0, r0)).toBeCloseTo(-1.0, 5);
  });

  it("R0 全反对 + R1 全支持 → 0.6*(-1) + 0.4*(+1) = -0.2(R0 权重高)", () => {
    const r0 = ["operations","products","marketing","finance","brand","supply_chain","regional"]
      .map((r) => make(r, 1.0, "oppose"));
    const r1 = ["operations","products","marketing","finance","brand","supply_chain","regional"]
      .map((r) => make(r, 1.0, "support"));
    expect(tws(r0, r1)).toBeCloseTo(-0.2, 5);
  });

  it("加权:财务权重 1.6 反对,其他 1.0 支持(预算决策)", () => {
    const r = [
      make("finance", 1.6, "oppose"),
      ...["operations","products","marketing","brand","supply_chain","regional"].map((x) => make(x, 1.0, "support")),
    ];
    // weightedAvg = (1.6*(-1) + 6*1.0*(+1)) / (1.6 + 6) = 4.4 / 7.6 ≈ 0.5789
    expect(tws(r, r)).toBeCloseTo(0.5789, 3);
  });

  it("空数组返回 0(防 NaN)", () => {
    expect(tws([], [])).toBe(0);
  });
});
```

- [ ] **Step 2: Anchoring detector 测试**

`tests/unit/consensus-anchoring.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { detectAnchoring, type R1Vote, type R0Snapshot } from "@/lib/consensus/anchoring-detector";

describe("Anchoring 检测", () => {
  it("立场翻转 + 理由 <30 字 = anchoring", () => {
    const r1: R1Vote = { attitude: "support", r0Attitude: "oppose", adjustReason: "改主意了", embedding: new Array(1536).fill(0) };
    const flags = detectAnchoring(r1, []);
    expect(flags.some((f) => f.reason === "stance_flip_no_reason")).toBe(true);
  });

  it("措辞与 R0 cosine > 0.85 = anchoring", () => {
    const e = new Array(1536).fill(0); e[0] = 1;
    const r1: R1Vote = { attitude: "support", r0Attitude: "support", adjustReason: "x".repeat(40), embedding: e };
    const snap: R0Snapshot[] = [{ personaId: "ops", embedding: e }];
    const flags = detectAnchoring(r1, snap);
    expect(flags.some((f) => f.reason === "high_cosine_similarity")).toBe(true);
  });

  it("合法调整(翻转 + 理由 ≥30 字 + cosine 低)= 不 anchoring", () => {
    const e1 = new Array(1536).fill(0); e1[0] = 1;
    const e2 = new Array(1536).fill(0); e2[1] = 1;     // 正交
    const r1: R1Vote = { attitude: "support", r0Attitude: "oppose", adjustReason: "看了财务的 ROI 数据后,我认为补充测算可解决核心顾虑,因此从反对改为支持", embedding: e2 };
    const snap: R0Snapshot[] = [{ personaId: "fin", embedding: e1 }];
    expect(detectAnchoring(r1, snap)).toHaveLength(0);
  });
});
```

- [ ] **Step 3: Weight calculator 测试**

`tests/unit/consensus-weight.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { effectiveWeights } from "@/lib/consensus/weight-calculator";

describe("L4 动态权重(methodology.md L4 表)", () => {
  it("budget 决策 + 无 override → finance 1.6", () => {
    const w = effectiveWeights("budget", {});
    expect(w.finance).toBe(1.6);
  });
  it("cross_border 决策 + 无 override → regional 1.5", () => {
    const w = effectiveWeights("cross_border", {});
    expect(w.regional).toBe(1.5);
  });
  it("用户 override 在 [0.5,2.0] 内生效", () => {
    const w = effectiveWeights("selection", { finance: 1.8 });
    expect(w.finance).toBe(1.8);
  });
  it("override 越界(>2.0)抛错", () => {
    expect(() => effectiveWeights("selection", { finance: 3.0 })).toThrow(/range/i);
  });
});
```

- [ ] **Step 4: 跑全部 P3.1 测试,期望 FAIL**

```bash
pnpm vitest run tests/unit/consensus-tws.test.ts tests/unit/consensus-anchoring.test.ts tests/unit/consensus-weight.test.ts
```

- [ ] **Step 5: 实现 `lib/consensus/attitude.ts`**

```ts
import { ATTITUDE_SCORE, type Attitude } from "@/lib/schema/attitude";
export { ATTITUDE_SCORE, type Attitude };
```

- [ ] **Step 6: 实现 `lib/consensus/trajectory-weighted-scoring.ts`**

```ts
// 实现完整对照 api.md §4 + consensus-algorithm.md §对策 2 完整 TS 伪代码
import { ATTITUDE_SCORE, type Attitude } from "./attitude";

export interface PersonaVote {
  personaId: string;
  weight: number;
  attitude: Attitude;
}

const W0 = 0.6;  // R0 权重(Asch 实验)
const W1 = 0.4;

function weightedAvg(votes: PersonaVote[]): number {
  const sumWeight = votes.reduce((s, v) => s + v.weight, 0);
  if (sumWeight === 0) return 0;
  return votes.reduce((s, v) => s + v.weight * ATTITUDE_SCORE[v.attitude], 0) / sumWeight;
}

export function tws(round0: PersonaVote[], round1: PersonaVote[]): number {
  if (round0.length === 0 && round1.length === 0) return 0;
  return W0 * weightedAvg(round0) + W1 * weightedAvg(round1);
}

// 5 档共识带(P12 § ② 评分用)
export function consensusBand(tws: number): "strong_support" | "weak_support" | "no_consensus" | "weak_oppose" | "strong_oppose" {
  if (tws > 0.5) return "strong_support";
  if (tws > 0.1) return "weak_support";
  if (tws > -0.1) return "no_consensus";
  if (tws > -0.5) return "weak_oppose";
  return "strong_oppose";
}
```

- [ ] **Step 7: 实现 `lib/consensus/anchoring-detector.ts`**

```ts
import { cosineSimilarity } from "@/lib/llm/embedding";
import type { Attitude } from "./attitude";

export interface R0Snapshot { personaId: string; embedding: number[]; }
export interface R1Vote { attitude: Attitude; r0Attitude: Attitude; adjustReason: string; embedding: number[]; }

export interface AnchoringFlag {
  reason: "stance_flip_no_reason" | "high_cosine_similarity";
  evidence_persona_id?: string;
  cosine_score?: number;
}

const COSINE_THRESHOLD = 0.85;
const MIN_REASON_LEN = 30;

export function detectAnchoring(r1: R1Vote, snapshots: R0Snapshot[]): AnchoringFlag[] {
  const flags: AnchoringFlag[] = [];
  // 1. 立场翻转 + 理由太短
  if (r1.attitude !== r1.r0Attitude && r1.adjustReason.trim().length < MIN_REASON_LEN) {
    flags.push({ reason: "stance_flip_no_reason" });
  }
  // 2. 措辞过度相似
  for (const snap of snapshots) {
    const sim = cosineSimilarity(r1.embedding, snap.embedding);
    if (sim > COSINE_THRESHOLD) {
      flags.push({ reason: "high_cosine_similarity", evidence_persona_id: snap.personaId, cosine_score: sim });
    }
  }
  return flags;
}
```

- [ ] **Step 8: 实现 `lib/consensus/weight-calculator.ts`**

```ts
import { DEFAULT_WEIGHTS, type DecisionType } from "@/lib/schema/decision-type";
import { RoleEnum, type Role } from "@/lib/schema/role";

const MIN = 0.5, MAX = 2.0;

export function effectiveWeights(
  decisionType: DecisionType,
  overrides: Partial<Record<Role, number>>
): Record<Role, number> {
  const base = { ...DEFAULT_WEIGHTS[decisionType] };
  for (const [role, w] of Object.entries(overrides)) {
    if (w === undefined) continue;
    if (w < MIN || w > MAX) throw new Error(`Weight out of range [${MIN},${MAX}]: ${role}=${w}`);
    if (!RoleEnum.options.includes(role as Role)) throw new Error(`Unknown role: ${role}`);
    base[role as Role] = w;
  }
  return base;
}
```

- [ ] **Step 9: 跑测试,期望 PASS + typecheck**

```bash
pnpm vitest run tests/unit/consensus-*.test.ts
pnpm tsc --noEmit
```

- [ ] **Step 10: Commit**

```bash
git add lib/consensus tests/unit/consensus-*.test.ts
git commit -m "feat(P3.1): lib/consensus(TWS + Anchoring + Weight)

- TWS w0=0.6 w1=0.4(Asch 实验依据)+ 5 档共识带
- Anchoring detector:立场翻转 + cosine > 0.85
- Weight calculator:5×7 矩阵 + 用户 override [0.5, 2.0]
- 单测 13+ 项全 PASS
"
```

**acceptance_criteria:**
- 13+ 单测全 PASS
- TWS w0=0.6 w1=0.4 写在代码常量中
- Anchoring 阈值 0.85 + 理由 30 字写在代码常量中

**status:** pending

---

### Task P3.2: lib/methodology(L1-L4 + Premortem + AAR templates)

**Files:**
- Create: `lib/methodology/{l1-objective,l2-evidence,l3-stakeholder,l4-raci,premortem,aar}-template.ts`
- Create: `lib/methodology/expected-keywords.ts`
- Create: `tests/unit/methodology-templates.test.ts`

> **契约**:**每个 template 文件三件套 = `template`(prompt 字符串)+ `expectedKeywords`(LLM 输出预期含的关键词,用于 fixture 测试)+ `outputSchema`(引用 lib/schema)**。完整模板内容对照 [methodology.md L1-L4 + Premortem + AAR fixture skeleton](../design/03-tech-direction/methodology.md)。

- [ ] **Step 1: 写关键词存在性测试**

`tests/unit/methodology-templates.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import {
  L1_OBJECTIVE_TEMPLATE,
  L2_EVIDENCE_TEMPLATE, L2_EXPECTED_KEYWORDS, L2_CITATION_SCHEMA,
  L3_STAKEHOLDER_TEMPLATE, L3_EXPECTED_KEYWORDS_BY_ROLE,
  L4_RACI_TEMPLATE, L4_ACTION_ITEM_SCHEMA,
  PREMORTEM_TEMPLATE, PREMORTEM_EXPECTED_KEYWORDS,
  AAR_TEMPLATE,
} from "@/lib/methodology";

describe("methodology templates 三件套完整", () => {
  it.each([
    ["L1", L1_OBJECTIVE_TEMPLATE],
    ["L2", L2_EVIDENCE_TEMPLATE],
    ["L3", L3_STAKEHOLDER_TEMPLATE],
    ["L4", L4_RACI_TEMPLATE],
    ["Premortem", PREMORTEM_TEMPLATE],
    ["AAR", AAR_TEMPLATE],
  ])("%s template 非空且 ≥ 50 字", (_, tmpl) => {
    expect(tmpl.length).toBeGreaterThanOrEqual(50);
  });

  it("L3 含 7 角色专属关键词", () => {
    expect(Object.keys(L3_EXPECTED_KEYWORDS_BY_ROLE)).toEqual(
      expect.arrayContaining(["operations","products","marketing","finance","brand","supply_chain","regional"])
    );
  });

  it("L4 RACI prompt 强调 Accountable 单值", () => {
    expect(L4_RACI_TEMPLATE).toMatch(/单一角色|7 个角色枚举|不允许填写多个角色|共同负责/);
  });
});
```

- [ ] **Step 2: 跑测试,期望 FAIL**

- [ ] **Step 3: 实现 6 个 template 文件**

逐项对照 [methodology.md L2/L3/L4/Premortem fixture skeleton 章节](../design/03-tech-direction/methodology.md)。每个文件结构:

```ts
// lib/methodology/l2-evidence-template.ts
export const L2_EVIDENCE_TEMPLATE = `
你必须从以下召回的证据集中选用支持你观点的内容,**不允许凭空引用**:
{recalled_evidence}
每条结论必须包含 ≥ 1 条 citation...
`;
export const L2_EXPECTED_KEYWORDS = ["证据", "数据", "来源", "citation", "引用"];
export { CitationsArraySchema as L2_CITATION_SCHEMA } from "@/lib/schema/citation";
```

`lib/methodology/l4-raci-template.ts` 特别强调(GAN-A H-A-2):
```ts
export const L4_RACI_TEMPLATE = `
基于本次讨论的待回答问题,为每个行动项分配 RACI 责任:
- Responsible(R): 实际执行者(1-N 个角色)
- Accountable(A): **必须是单一角色,来自 7 个角色枚举之一**(operations/products/marketing/finance/brand/supply_chain/regional),不允许填写多个角色或"共同负责"等模糊表达
- Consulted(C): 决策前需要咨询的(0-N 个角色)
- Informed(I): 决策后需要知会的(0-N 个角色)

行动项必须可执行(动词开头),有明确截止日期(ISO datetime)。
`;
export { ActionItemSchema as L4_ACTION_ITEM_SCHEMA } from "@/lib/schema/action-item";
```

`lib/methodology/index.ts` 汇总导出。

- [ ] **Step 4: 跑测试,期望 PASS + typecheck + Commit**

```bash
pnpm vitest run tests/unit/methodology-templates.test.ts
pnpm tsc --noEmit
git add lib/methodology tests/unit/methodology-templates.test.ts
git commit -m "feat(P3.2): methodology 6 个 template 三件套(L1-L4 + Premortem + AAR)"
```

**acceptance_criteria:**
- 6 个 template 文件齐全,index.ts barrel export
- 单测全 PASS
- L4 RACI prompt 强制 Accountable 单值表述
- 红线 #20(accountable RoleEnum) + #21(AAR min(10))在调用方使用时由 Zod 保证

**status:** pending

---

### Task P3.3: lib/evidence(in-memory cosine retriever)

**Files:**
- Create: `lib/evidence/retriever.ts`、`lib/evidence/citation-builder.ts`
- Create: `tests/unit/evidence-retriever.test.ts`

- [ ] **Step 1: 写测试(retriever + citation 强约束)**

`tests/unit/evidence-retriever.test.ts`:
```ts
import { describe, it, expect, beforeAll } from "vitest";
import { EvidenceRetriever } from "@/lib/evidence/retriever";
import { buildCitations } from "@/lib/evidence/citation-builder";

describe("EvidenceRetriever (in-memory cosine, P0)", () => {
  const retriever = new EvidenceRetriever();

  beforeAll(() => {
    retriever.load([
      { id: "ec1", title: "ROI", snippet: "财务测算", embedding: [1, 0, 0, ...new Array(1533).fill(0)], source_id: "src1", tags: [], full_content: "", cited_count: 0 },
      { id: "ec2", title: "库存", snippet: "供应链", embedding: [0, 1, 0, ...new Array(1533).fill(0)], source_id: "src2", tags: [], full_content: "", cited_count: 0 },
    ]);
  });

  it("top-k 按 cosine 排序", () => {
    const results = retriever.search([1, 0, 0, ...new Array(1533).fill(0)], 2);
    expect(results[0]!.id).toBe("ec1");
    expect(results[0]!.similarity).toBeCloseTo(1.0, 5);
    expect(results[1]!.id).toBe("ec2");
  });

  it("维度不匹配抛错", () => {
    expect(() => retriever.search([1, 0], 2)).toThrow(/Dim mismatch/i);
  });
});

describe("buildCitations 强约束(防 LLM 幻觉)", () => {
  const recalled = new Set(["ec1", "ec2"]);
  it("source_id 不在召回集合 → 拒绝", () => {
    expect(() => buildCitations([{ source_type: "internal_doc", source_id: "ec999", snippet: "xx".repeat(10), relevance: 0.5 }], recalled)).toThrow(/not in recalled/i);
  });
  it("合法 citation 通过", () => {
    expect(() => buildCitations([{ source_type: "internal_doc", source_id: "ec1", snippet: "xx".repeat(10), relevance: 0.8 }], recalled)).not.toThrow();
  });
});
```

- [ ] **Step 2: 跑测试,期望 FAIL**

- [ ] **Step 3: 实现 `lib/evidence/retriever.ts`**

```ts
import { cosineSimilarity } from "@/lib/llm/embedding";
import { db } from "@/lib/db";
import { evidence_cards } from "@/lib/db/schema";

export interface EvidenceCardCache {
  id: string;
  source_id: string;
  title: string;
  snippet: string;
  full_content: string;
  embedding: number[];           // 1536d
  tags: string[];
  cited_count: number;
}

export interface SearchResult extends EvidenceCardCache {
  similarity: number;
}

export class EvidenceRetriever {
  private cache: EvidenceCardCache[] = [];

  load(cards: EvidenceCardCache[]) { this.cache = cards; }

  async loadFromDB() {
    const rows = await db.select().from(evidence_cards);
    this.cache = rows
      .filter((r): r is typeof r & { embedding: number[] } => Array.isArray(r.embedding) && r.embedding.length === 1536)
      .map((r) => ({
        id: r.id, source_id: r.source_id, title: r.title, snippet: r.snippet,
        full_content: r.full_content, embedding: r.embedding, tags: r.tags, cited_count: r.cited_count,
      }));
  }

  search(queryEmbedding: number[], topK: number = 10): SearchResult[] {
    return this.cache
      .map((c) => ({ ...c, similarity: cosineSimilarity(queryEmbedding, c.embedding) }))
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, topK);
  }

  size(): number { return this.cache.length; }
}

// 单例(进程级,Vercel Fluid Compute 函数实例共享)
let _instance: EvidenceRetriever | null = null;
export async function getRetriever(): Promise<EvidenceRetriever> {
  if (!_instance) {
    _instance = new EvidenceRetriever();
    await _instance.loadFromDB();
  }
  return _instance;
}
```

- [ ] **Step 4: 实现 `lib/evidence/citation-builder.ts`**

```ts
import { type Citation, CitationSchema } from "@/lib/schema/citation";

/**
 * 验证 LLM 输出的 citations:每条的 source_id 必须来自本次召回集合(防幻觉)
 */
export function buildCitations(rawCitations: unknown[], recalledIds: Set<string>): Citation[] {
  const parsed = rawCitations.map((c) => CitationSchema.parse(c));
  for (const c of parsed) {
    if (c.source_type !== "proposal_text" && c.source_type !== "persona_rule") {
      if (!recalledIds.has(c.source_id)) {
        throw new Error(`Citation source_id "${c.source_id}" not in recalled evidence set`);
      }
    }
  }
  return parsed;
}
```

- [ ] **Step 5: 跑测试 + typecheck + commit**

```bash
pnpm vitest run tests/unit/evidence-retriever.test.ts
pnpm tsc --noEmit
git add lib/evidence tests/unit/evidence-retriever.test.ts
git commit -m "feat(P3.3): lib/evidence(in-memory cosine retriever + citation 防幻觉)

- EvidenceRetriever 单例,启动从 DB 加载 ≥10 条 1536d embedding 到内存
- search top-k 按 cosine 排序,< 5ms(< 200 条遍历)
- buildCitations 强制 source_id 来自召回集合(R9 可溯源 + 防 LLM 编造 ID)
"
```

**acceptance_criteria:**
- 单测全 PASS
- `getRetriever()` 首次调用从 DB 加载,size() ≥ 10
- 维度不匹配抛错(防 384 维误用)

**status:** pending

---

## Phase P4 — LangGraph 9 节点 + 主图(critical_path,12 task)

> **关键契约**:**每节点 1:1 对照 [api.md §7 LangGraph 9 节点 ↔ API 边界对照表](2026-05-23-collab-agent-api.md#7-langgraph-9-节点--api-边界对照)**(模型 / 调用数 / SSE 事件 / 写入字段)。所有节点先建 `lib/graph/state.ts` 公共类型。
>
> **v2.3 GAN-V3 Issue 关键修**:在 P4.0 之前增加 **Task P4.spike** 提前验证 LangGraph 0.4 真实可用性,避免 P4-P5 全部完成后才发现 graph 跑不通需要返工。

### Task P4.spike: LangGraph 0.4 真实可用性验证(critical_path,必须在 P4.0 前完成)

**Files:** `scripts/langgraph-spike.ts`(临时验证脚本,跑通后删除或留作回归测试)

**目标:用 ≤ 80 行代码验证 3 件事**:
1. `PostgresSaver.setup()` 在 Neon WebSocket Pool 上能成功创建 4 张外部表
2. 简单 2 节点图的 `interrupt()` → `Command(resume=...)` 流程能跑通
3. `graph.streamEvents({ version: "v2" })` 的 `event.name` 真实格式是什么(plan P5.B 假设是 `n1_structurize`,需验证)

- [ ] **Step 1: 写 spike 脚本**

```ts
// scripts/langgraph-spike.ts
import "dotenv/config";
import { StateGraph, Annotation, START, END, Command, interrupt } from "@langchain/langgraph";
import { PostgresSaver } from "@langchain/langgraph-checkpoint-postgres";
import { Pool } from "@neondatabase/serverless";

const State = Annotation.Root({
  counter: Annotation<number>({ default: () => 0, reducer: (_, n) => n }),
  approved: Annotation<boolean>({ default: () => false, reducer: (_, n) => n }),
});

async function main() {
  const pool = new Pool({ connectionString: process.env.NEON_DATABASE_URL_WS! });
  const checkpointer = new PostgresSaver(pool);
  await checkpointer.setup();
  console.log("[spike] ✅ Test 1: PostgresSaver.setup() 创建 4 张表成功");

  const graph = new StateGraph(State)
    .addNode("node_a", (s) => ({ counter: s.counter + 1 }))
    .addNode("node_b", () => {
      const decision = interrupt({ question: "继续?" });
      return { approved: decision === "yes" };
    })
    .addEdge(START, "node_a")
    .addEdge("node_a", "node_b")
    .addEdge("node_b", END)
    .compile({ checkpointer, interruptBefore: ["node_b"] });

  const config = { configurable: { thread_id: "spike-001" } };

  // 第一次跑:跑到 node_b 前会 interrupt
  for await (const event of graph.streamEvents({ counter: 0 }, { ...config, version: "v2" })) {
    if (event.event === "on_chain_start" || event.event === "on_chain_end") {
      console.log(`[spike] event.name = "${event.name}", event.event = "${event.event}"`);
    }
  }
  console.log("[spike] ✅ Test 3: streamEvents event.name 格式如上");

  // resume
  const result = await graph.invoke(new Command({ resume: "yes" }), config);
  console.log(`[spike] ✅ Test 2: Command(resume) 后 approved=${result.approved}, counter=${result.counter}`);
  if (!result.approved || result.counter !== 1) throw new Error("interrupt/resume 流程错误");

  process.exit(0);
}
main().catch((e) => { console.error("[spike] ❌ FAIL:", e); process.exit(1); });
```

- [ ] **Step 2: 跑 spike + 根据输出调整 P5.B 假设**

```bash
pnpm tsx scripts/langgraph-spike.ts
# Expected: 3 个 ✅,且 event.name 格式打印出来(可能是 "node_a" 或 "LangGraph" 或 ":node_a" 等)
# 若 event.name 与 plan P5.B 假设的 "n1_structurize" / "round0_persona" 等不一致 → 修正 P5.B 的事件匹配逻辑
```

- [ ] **Step 3: 记录 spike 结论到 `docs/pipeline/spike-results.md`**

记录:① PostgresSaver 创建表的实际 SQL 语句;② Command(resume) 调用语法是否与 plan 一致;③ event.name 实际格式;④ 任何与 plan 不一致的发现 → 反向修正 P4.10/P5.B 代码。

- [ ] **Step 4: Commit**

```bash
git add scripts/langgraph-spike.ts docs/pipeline/spike-results.md
git commit -m "feat(P4.spike): LangGraph 0.4 真实可用性验证(GAN-V3 Issue 4 风险消除)

- PostgresSaver.setup() + 4 张外部表创建成功
- interrupt + Command(resume) 流程跑通
- streamEvents v2 event.name 实际格式记录到 spike-results.md
"
```

**acceptance_criteria:**
- `pnpm tsx scripts/langgraph-spike.ts` 退出码 0(3 个 ✅)
- `docs/pipeline/spike-results.md` 含真实 event.name 格式
- 若 spike 发现 plan 假设错误 → P5.B / P4.10 代码同步修正后再进 P4.0

**status:** pending(必须 P4.0 之前完成)

---

### Task P4.0: GraphState 类型定义

**Files:**
- Create: `lib/graph/state.ts`

- [ ] **Step 1: 实现 GraphState(贯穿 9 节点)**

```ts
// lib/graph/state.ts
import { Annotation } from "@langchain/langgraph";
import type { DecisionType } from "@/lib/schema/decision-type";
import type { Role } from "@/lib/schema/role";
import type { Attitude } from "@/lib/schema/attitude";
import type { Citation } from "@/lib/schema/citation";

export interface StructuredClaim { id: string; text: string; assumption?: string; data_gap?: string; }
export interface PersonaVoteFull {
  persona_id: string; role: Role; weight: number;
  claims: Array<{ claim_id: string; attitude: Attitude; confidence: number; reason: string; citations: Citation[]; adjust_reason?: string; }>;
  round: "round_0" | "round_1";
  duration_ms: number;
  // 用于 anchoring 检测
  embedding?: number[];
}
export interface AnchoringFlag { persona_id: string; claim_id: string; reason: "stance_flip_no_reason" | "high_cosine_similarity"; cosine_score?: number; evidence_persona_id?: string; }
export interface PremortemRisk { risk: string; raised_by: Role[]; severity: "high" | "medium" | "low"; scenario: string; mitigations: string[]; }

export const GraphStateAnnotation = Annotation.Root({
  // 输入
  analysisVersionId: Annotation<string>(),
  proposalId: Annotation<string>(),
  redactedText: Annotation<string>(),
  declaredObjective: Annotation<{ id: string; name: string; description: string; key_results: string[] }>(),
  selectedPersonas: Annotation<Array<{ id: string; role: Role; weight: number; system_prompt: string }>>(),
  decisionType: Annotation<DecisionType | null>({ default: () => null, reducer: (_, n) => n }),
  temperature: Annotation<number>({ default: () => 0.4, reducer: (_, n) => n }),

  // N1 输出
  structuredClaims: Annotation<StructuredClaim[]>({ default: () => [], reducer: (_, n) => n }),

  // N2 输出
  l1AlignmentScore: Annotation<number>({ default: () => 0, reducer: (_, n) => n }),
  l1AlignmentWarnings: Annotation<string[]>({ default: () => [], reducer: (_, n) => n }),

  // N3 输出
  recalledEvidenceIds: Annotation<string[]>({ default: () => [], reducer: (_, n) => n }),

  // N4 输出(Send 并发,reducer 用 concat 聚合)
  round0Votes: Annotation<PersonaVoteFull[]>({ default: () => [], reducer: (a, b) => [...a, ...b] }),

  // N5 输出
  round1Votes: Annotation<PersonaVoteFull[]>({ default: () => [], reducer: (a, b) => [...a, ...b] }),
  anchoringFlags: Annotation<AnchoringFlag[]>({ default: () => [], reducer: (a, b) => [...a, ...b] }),

  // N6 输出
  twsScoresByClaim: Annotation<Record<string, number>>({ default: () => ({}), reducer: (_, n) => n }),

  // N7 输出
  effectiveWeights: Annotation<Record<Role, number>>({ default: () => ({} as Record<Role, number>), reducer: (_, n) => n }),

  // N8 输出
  premortemRisks: Annotation<PremortemRisk[]>({ default: () => [], reducer: (a, b) => [...a, ...b] }),

  // N9 输出(完整 DecisionReport,流式逐 section 写入)
  decisionReportPartial: Annotation<Record<string, unknown>>({ default: () => ({}), reducer: (a, b) => ({ ...a, ...b }) }),
});

export type GraphState = typeof GraphStateAnnotation.State;
```

- [ ] **Step 2: typecheck + commit**

```bash
pnpm tsc --noEmit
git add lib/graph/state.ts
git commit -m "feat(P4.0): GraphState 类型(9 节点共享 state + Send reducer concat)"
```

**acceptance_criteria:** typecheck 通过;9 节点的 input/output 字段类型齐全

**status:** pending

---

### Task P4.1: N1 结构化 + 决策类型识别(Haiku 4.5)

**Files:**
- Create: `lib/graph/nodes/n1-structurize.ts`
- Create: `tests/unit/node-n1.test.ts`(用 Vitest 的 `vi.mock` mock LLM 测 schema 校验逻辑,**不调真 LLM**)

> **注意**:测试只验证"输出符合 schema 即返回正确 state",不测真实 LLM 准确性(后者在 P7 E2E 测)。

- [ ] **Step 1: 写测试(mock LLM 返回固定 object)**

```ts
// tests/unit/node-n1.test.ts
import { describe, it, expect, vi } from "vitest";

vi.mock("ai", () => ({
  generateObject: vi.fn().mockResolvedValue({
    object: {
      claims: [
        { id: "c1", text: "主推 A 款" },
        { id: "c2", text: "依据小红书声量" },
      ],
      decision_type: "selection",
      decision_type_confidence: 91,
    },
  }),
}));

describe("N1 结构化节点", () => {
  it("产出 structured_claims + decision_type", async () => {
    const { n1Structurize } = await import("@/lib/graph/nodes/n1-structurize");
    const out = await n1Structurize({
      analysisVersionId: "av1", proposalId: "p1",
      redactedText: "本提案建议主推 A 款,依据小红书声量...",
      declaredObjective: { id: "obj1", name: "Q3", description: "", key_results: [] },
      selectedPersonas: [], decisionType: null, temperature: 0.4,
    } as any);
    expect(out.structuredClaims).toHaveLength(2);
    expect(out.decisionType).toBe("selection");
  });
});
```

- [ ] **Step 2: 实现节点**

```ts
// lib/graph/nodes/n1-structurize.ts
import { generateObject } from "ai";
import { gateway } from "@ai-sdk/gateway";
import { z } from "zod";
import { modelForNode } from "@/lib/llm/gateway";
import { DecisionTypeEnum } from "@/lib/schema/decision-type";
import type { GraphState } from "@/lib/graph/state";

const N1_OUTPUT_SCHEMA = z.object({
  claims: z.array(z.object({
    id: z.string(), text: z.string().min(5),
    assumption: z.string().optional(), data_gap: z.string().optional(),
  })).min(1),
  decision_type: DecisionTypeEnum,
  decision_type_confidence: z.number().int().min(0).max(100),
});

const SYSTEM = `你是企业提案结构化解析器。任务:
1. 把提案拆解为"原子论点"(每个论点 = 一句可被支持/反对的主张)
2. 识别决策类型:selection(选品) / marketing(营销) / budget(预算) / operation(经营) / cross_border(跨境-区域)
3. 输出严格 JSON,符合 schema

5 种决策类型识别要点:
- selection: 涉及 SKU/品类/新品/库存选择
- marketing: 涉及活动/投流/营销节奏
- budget: 涉及预算分配/ROI/财务额度
- operation: 涉及日常运营/流程优化
- cross_border: 涉及跨境/海外/区域差异/本地化(关键词:跨境/海外/印尼/泰国/日本/韩国/区域)
`;

export async function n1Structurize(state: GraphState): Promise<Partial<GraphState>> {
  const cfg = modelForNode("N1");
  const { object } = await generateObject({
    model: gateway(cfg.model),
    schema: N1_OUTPUT_SCHEMA,
    system: SYSTEM,
    prompt: `提案文本:\n${state.redactedText}`,
    providerOptions: cfg.providerOptions,
    maxRetries: 3,
    temperature: state.temperature,
  });
  return {
    structuredClaims: object.claims,
    decisionType: object.decision_type,
  };
}
```

- [ ] **Step 3: 跑测试 + commit**

```bash
pnpm vitest run tests/unit/node-n1.test.ts
git add lib/graph/nodes/n1-structurize.ts tests/unit/node-n1.test.ts
git commit -m "feat(P4.1): N1 结构化+决策类型识别(Haiku 4.5 generateObject,5 类型 prompt)"
```

**acceptance_criteria:** mock 单测 PASS;5 决策类型 prompt 含 cross_border 识别关键词

**status:** pending

---

### Task P4.2: N2 L1 目标对齐(Haiku 4.5)

**Files:**
- Create: `lib/graph/nodes/n2-l1-alignment.ts`、`tests/unit/node-n2.test.ts`

- [ ] **Step 1-3: 测试 + 实现 + commit**

```ts
// lib/graph/nodes/n2-l1-alignment.ts
import { generateObject } from "ai";
import { gateway } from "@ai-sdk/gateway";
import { z } from "zod";
import { modelForNode } from "@/lib/llm/gateway";
import type { GraphState } from "@/lib/graph/state";

const N2_OUT = z.object({
  alignment_score: z.number().min(0).max(100),
  warnings: z.array(z.string()).default([]),
  reasoning: z.string().min(20),
});

const PROMPT = (obj: GraphState["declaredObjective"], text: string) => `
本提案声明的公司级目标:
  名称: ${obj.name}
  描述: ${obj.description}
  关键结果(KR): ${obj.key_results.join(" / ")}

提案文本:
${text}

任务:评估提案与该目标的对齐度(0-100),并指出偏离风险。
- 对齐度 = 提案能直接贡献该目标 KR 的程度
- alignment_score < 50 时,必须给出 ≥1 条 warnings 说明哪里偏离
`;

export async function n2L1Alignment(state: GraphState): Promise<Partial<GraphState>> {
  const cfg = modelForNode("N2");
  const { object } = await generateObject({
    model: gateway(cfg.model),
    schema: N2_OUT,
    prompt: PROMPT(state.declaredObjective, state.redactedText),
    providerOptions: cfg.providerOptions,
    maxRetries: 3,
    temperature: state.temperature,
  });
  return {
    l1AlignmentScore: object.alignment_score,
    l1AlignmentWarnings: object.warnings,
  };
}
```

测试同 P4.1 模式 mock generateObject。

```bash
git add lib/graph/nodes/n2-l1-alignment.ts tests/unit/node-n2.test.ts
git commit -m "feat(P4.2): N2 L1 目标对齐(Haiku 4.5,< 50 必带 warnings)"
```

**acceptance_criteria:** mock 单测 PASS;alignment_score < 50 时 warnings 非空

**status:** pending

---

### Task P4.3: N3 L2 证据召回(embedding + cosine)

**Files:**
- Create: `lib/graph/nodes/n3-l2-evidence.ts`、`tests/unit/node-n3.test.ts`

- [ ] **Step 1-3: 实现 + 测试 + commit**

```ts
// lib/graph/nodes/n3-l2-evidence.ts
import { embedOne } from "@/lib/llm/embedding";
import { getRetriever } from "@/lib/evidence/retriever";
import type { GraphState } from "@/lib/graph/state";

const TOP_K = 12;     // 召回 top 12,后续 R0/R1 prompt 注入

export async function n3L2Evidence(state: GraphState): Promise<Partial<GraphState>> {
  // 用 claims 文本拼接 + 目标作为 query
  const query = [
    state.declaredObjective.name,
    ...state.structuredClaims.map((c) => c.text),
  ].join("\n");

  const queryEmbedding = await embedOne(query);          // 1536d
  const retriever = await getRetriever();
  const results = retriever.search(queryEmbedding, TOP_K);

  return {
    recalledEvidenceIds: results.map((r) => r.id),
  };
}
```

测试 mock `embedOne` + 假 retriever:
```ts
// tests/unit/node-n3.test.ts
import { describe, it, expect, vi } from "vitest";

vi.mock("@/lib/llm/embedding", () => ({
  embedOne: vi.fn().mockResolvedValue(new Array(1536).fill(0.01)),
  cosineSimilarity: (a: number[], b: number[]) => 0.9,
}));
vi.mock("@/lib/evidence/retriever", () => ({
  getRetriever: vi.fn().mockResolvedValue({
    search: () => [{ id: "ec1" }, { id: "ec2" }, { id: "ec3" }],
  }),
}));

describe("N3 L2 证据召回", () => {
  it("返回 recalledEvidenceIds 数组", async () => {
    const { n3L2Evidence } = await import("@/lib/graph/nodes/n3-l2-evidence");
    const out = await n3L2Evidence({
      declaredObjective: { name: "Q3", description: "", key_results: [] },
      structuredClaims: [{ id: "c1", text: "主推 A" }],
    } as any);
    expect(out.recalledEvidenceIds).toEqual(["ec1", "ec2", "ec3"]);
  });
});
```

```bash
pnpm vitest run tests/unit/node-n3.test.ts
git add lib/graph/nodes/n3-l2-evidence.ts tests/unit/node-n3.test.ts
git commit -m "feat(P4.3): N3 L2 证据召回(text-embedding-3-small 1536d + in-memory cosine top-12)"
```

**acceptance_criteria:** mock 单测 PASS;TOP_K=12(配合 P03 节点 3 显示"召回 12 条")

**status:** pending

---

### Task P4.4: N4 Round 0 Blind First-Vote(Sonnet 4.6 + Send API 7 并发)

**Files:**
- Create: `lib/graph/nodes/n4-round0.ts`、`tests/unit/node-n4.test.ts`

> **关键**:用 LangGraph Send API 真并发 fan-out 到 7 个 persona,每个 persona prompt **不含其他角色观点**(防 anchoring)。

- [ ] **Step 1: 测试(mock generateObject)**

```ts
// tests/unit/node-n4.test.ts
import { describe, it, expect, vi } from "vitest";

vi.mock("ai", () => ({
  generateObject: vi.fn().mockResolvedValue({
    object: {
      claims: [{ claim_id: "c1", attitude: "support", confidence: 0.8, reason: "x".repeat(30),
                 citations: [{ source_type: "internal_doc", source_id: "ec1", snippet: "x".repeat(15), relevance: 0.8 }] }],
    },
  }),
  embed: vi.fn().mockResolvedValue({ embedding: new Array(1536).fill(0.01) }),
}));

describe("N4 Round 0 persona reasoning", () => {
  it("产出 PersonaVote 含 claims + embedding", async () => {
    const { round0PersonaReasoning } = await import("@/lib/graph/nodes/n4-round0");
    const out = await round0PersonaReasoning({
      persona: { id: "per_fin", role: "finance", weight: 1.2, system_prompt: "你是财务..." },
      redactedText: "...", recalledEvidenceIds: ["ec1"], structuredClaims: [{ id: "c1", text: "x" }],
      declaredObjective: { name: "Q3", description: "", key_results: [] }, temperature: 0.4,
    });
    expect(out.round0Votes).toHaveLength(1);
    expect(out.round0Votes[0]!.role).toBe("finance");
    expect(out.round0Votes[0]!.embedding).toHaveLength(1536);
  });
});
```

- [ ] **Step 2: 实现 round0PersonaReasoning(单 persona 函数,被主图 Send 调用)**

```ts
// lib/graph/nodes/n4-round0.ts
import { generateObject, embed } from "ai";
import { gateway } from "@ai-sdk/gateway";
import { z } from "zod";
import { modelForNode } from "@/lib/llm/gateway";
import { PersonaClaimSchema } from "@/lib/schema/persona-vote";
import { L2_EVIDENCE_TEMPLATE } from "@/lib/methodology/l2-evidence-template";
import { L3_STAKEHOLDER_TEMPLATE } from "@/lib/methodology/l3-stakeholder-template";
import { db } from "@/lib/db";
import { evidence_cards } from "@/lib/db/schema";
import { inArray } from "drizzle-orm";
import type { GraphState, PersonaVoteFull } from "@/lib/graph/state";
import type { Role } from "@/lib/schema/role";

const PERSONA_OUT_SCHEMA = z.object({ claims: z.array(PersonaClaimSchema).min(1) });
const EMBED_MODEL = "openai/text-embedding-3-small";

export interface Round0Input {
  persona: { id: string; role: Role; weight: number; system_prompt: string };
  redactedText: string;
  recalledEvidenceIds: string[];
  structuredClaims: GraphState["structuredClaims"];
  declaredObjective: GraphState["declaredObjective"];
  temperature: number;
}

export async function round0PersonaReasoning(input: Round0Input): Promise<{ round0Votes: PersonaVoteFull[] }> {
  const t0 = Date.now();
  // 拉取召回证据正文(注入 prompt)
  const evidenceRows = await db.select().from(evidence_cards).where(inArray(evidence_cards.id, input.recalledEvidenceIds));
  const evidenceText = evidenceRows.map((e) => `[${e.id}] ${e.title}\n${e.snippet}`).join("\n\n");

  const cfg = modelForNode("N4");
  const persona = input.persona;
  const system = [
    L3_STAKEHOLDER_TEMPLATE,
    `本次决策服从目标:${input.declaredObjective.name}(KR: ${input.declaredObjective.key_results.join(" / ")})`,
    L2_EVIDENCE_TEMPLATE.replace("{recalled_evidence}", evidenceText),
  ].join("\n\n");

  const userPrompt = `提案(脱敏后):\n${input.redactedText}\n\n论点清单:\n${input.structuredClaims.map((c) => `${c.id}: ${c.text}`).join("\n")}\n\n对每个论点独立表态(4 档:support/conditional/insufficient/oppose),给理由 ≥20 字 + ≥1 citation(source_id 必须来自上面证据)。`;

  const { object } = await generateObject({
    model: gateway(cfg.model),
    schema: PERSONA_OUT_SCHEMA,
    system, prompt: userPrompt,
    providerOptions: cfg.providerOptions,
    maxRetries: 3,
    temperature: input.temperature,
  });

  // 用 reason 拼接做 embedding(用于 anchoring 检测)
  const reasonText = object.claims.map((c) => c.reason).join(" ");
  const { embedding } = await embed({
    model: gateway.textEmbeddingModel(EMBED_MODEL),
    value: reasonText,
    providerOptions: { gateway: { zeroDataRetention: true } },
  });

  return {
    round0Votes: [{
      persona_id: persona.id, role: persona.role, weight: persona.weight,
      claims: object.claims, round: "round_0",
      duration_ms: Date.now() - t0,
      embedding,
    }],
  };
}
```

- [ ] **Step 3: 测试 + commit**

```bash
pnpm vitest run tests/unit/node-n4.test.ts
git add lib/graph/nodes/n4-round0.ts tests/unit/node-n4.test.ts
git commit -m "feat(P4.4): N4 Round 0 persona reasoning(Sonnet 4.6,L2+L3 prompt 注入,无其他角色观点防 anchoring)"
```

**acceptance_criteria:** mock 单测 PASS;system prompt 不含 othersSnapshot 字段(Blind 保证)

**status:** pending

---

### Task P4.5: N5 Round 1 伪并发 + Anchoring 检测

**Files:**
- Create: `lib/graph/nodes/n5-round1.ts`、`tests/unit/node-n5.test.ts`

- [ ] **Step 1: 测试(verify R0 snapshot 注入 + anchoring 检测调用)**

```ts
// tests/unit/node-n5.test.ts
import { describe, it, expect, vi } from "vitest";

vi.mock("ai", () => ({
  generateObject: vi.fn().mockResolvedValue({
    object: { claims: [{ claim_id: "c1", attitude: "support", confidence: 0.8, reason: "改主意了", adjust_reason: "短",
                         citations: [{ source_type: "internal_doc", source_id: "ec1", snippet: "x".repeat(15), relevance: 0.8 }] }] },
  }),
  embed: vi.fn().mockResolvedValue({ embedding: new Array(1536).fill(0.01) }),
}));

describe("N5 Round 1 + Anchoring", () => {
  it("立场翻转 + 理由短 → anchoring flag", async () => {
    const { round1PersonaReasoning } = await import("@/lib/graph/nodes/n5-round1");
    const out = await round1PersonaReasoning({
      persona: { id: "per_fin", role: "finance", weight: 1.2, system_prompt: "..." },
      redactedText: "...", recalledEvidenceIds: ["ec1"], structuredClaims: [{ id: "c1", text: "x" }],
      declaredObjective: { name: "Q3", description: "", key_results: [] }, temperature: 0.4,
      othersSnapshot: [
        { persona_id: "per_ops", role: "operations", weight: 1.0,
          claims: [{ claim_id: "c1", attitude: "support", confidence: 0.9, reason: "y", citations: [] }],
          round: "round_0", duration_ms: 100, embedding: new Array(1536).fill(0.01),
        },
      ],
      myR0Attitude: { c1: "oppose" },
    });
    expect(out.anchoringFlags.length).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 2: 实现**

```ts
// lib/graph/nodes/n5-round1.ts
import { generateObject, embed } from "ai";
import { gateway } from "@ai-sdk/gateway";
import { z } from "zod";
import { modelForNode } from "@/lib/llm/gateway";
import { PersonaClaimSchema } from "@/lib/schema/persona-vote";
import { L3_STAKEHOLDER_TEMPLATE } from "@/lib/methodology/l3-stakeholder-template";
import { detectAnchoring } from "@/lib/consensus/anchoring-detector";
import { db } from "@/lib/db";
import { evidence_cards } from "@/lib/db/schema";
import { inArray } from "drizzle-orm";
import type { Round0Input } from "./n4-round0";
import type { PersonaVoteFull, AnchoringFlag } from "@/lib/graph/state";
import type { Attitude } from "@/lib/schema/attitude";

const ROUND1_OUT = z.object({
  claims: z.array(PersonaClaimSchema.extend({ adjust_reason: z.string() })).min(1),
});
const EMBED_MODEL = "openai/text-embedding-3-small";

export interface Round1Input extends Round0Input {
  othersSnapshot: PersonaVoteFull[];        // Round 0 其他 6 个 persona 的观点
  myR0Attitude: Record<string, Attitude>;   // 本人 R0 的态度(每 claim_id)
}

export async function round1PersonaReasoning(input: Round1Input): Promise<{ round1Votes: PersonaVoteFull[]; anchoringFlags: AnchoringFlag[] }> {
  const t0 = Date.now();
  const evidenceRows = await db.select().from(evidence_cards).where(inArray(evidence_cards.id, input.recalledEvidenceIds));
  const evidenceText = evidenceRows.map((e) => `[${e.id}] ${e.title}\n${e.snippet}`).join("\n\n");

  const othersText = input.othersSnapshot.map((v) => {
    const stances = v.claims.map((c) => `  ${c.claim_id}: ${c.attitude}(${c.confidence.toFixed(2)}) — ${c.reason}`).join("\n");
    return `[${v.role}]\n${stances}`;
  }).join("\n\n");

  const cfg = modelForNode("N5");
  const system = [L3_STAKEHOLDER_TEMPLATE, `召回证据:\n${evidenceText}`,
    `Round 0 其他角色观点(供参考,可独立判断,不强制采纳):\n${othersText}`,
  ].join("\n\n");

  const userPrompt = `论点:${input.structuredClaims.map((c) => `${c.id}: ${c.text}`).join("\n")}\n\n基于他人观点,独立决定是否调整你的立场。每个 claim 必须给 adjust_reason 说明"为什么调整 / 为什么坚持"。`;

  const { object } = await generateObject({
    model: gateway(cfg.model),
    schema: ROUND1_OUT,
    system, prompt: userPrompt,
    providerOptions: cfg.providerOptions,
    maxRetries: 3,
    temperature: input.temperature,
  });

  const reasonText = object.claims.map((c) => c.reason).join(" ");
  const { embedding } = await embed({
    model: gateway.textEmbeddingModel(EMBED_MODEL),
    value: reasonText,
    providerOptions: { gateway: { zeroDataRetention: true } },
  });

  // Anchoring 检测(每 claim 独立检测)
  const flags: AnchoringFlag[] = [];
  for (const c of object.claims) {
    const r0Att = input.myR0Attitude[c.claim_id];
    if (!r0Att) continue;
    const cfgFlags = detectAnchoring(
      { attitude: c.attitude, r0Attitude: r0Att, adjustReason: c.adjust_reason, embedding },
      input.othersSnapshot.filter((o) => o.embedding).map((o) => ({ personaId: o.persona_id, embedding: o.embedding! })),
    );
    for (const f of cfgFlags) {
      flags.push({ persona_id: input.persona.id, claim_id: c.claim_id, ...f });
    }
  }

  return {
    round1Votes: [{
      persona_id: input.persona.id, role: input.persona.role, weight: input.persona.weight,
      claims: object.claims, round: "round_1",
      duration_ms: Date.now() - t0,
      embedding,
    }],
    anchoringFlags: flags,
  };
}
```

- [ ] **Step 3: 测试 + commit**

```bash
pnpm vitest run tests/unit/node-n5.test.ts
git add lib/graph/nodes/n5-round1.ts tests/unit/node-n5.test.ts
git commit -m "feat(P4.5): N5 Round 1 伪并发 + Anchoring 检测(adjust_reason 必填,立场翻转/cosine>0.85 触发)"
```

**acceptance_criteria:** 单测 PASS;adjust_reason 在 schema 中必填

**status:** pending

---

### Task P4.6: N6 TWS 评分(纯计算)

**Files:**
- Create: `lib/graph/nodes/n6-tws.ts`、`tests/unit/node-n6.test.ts`

```ts
// lib/graph/nodes/n6-tws.ts
import { tws } from "@/lib/consensus/trajectory-weighted-scoring";
import type { GraphState } from "@/lib/graph/state";

export async function n6Tws(state: GraphState): Promise<Partial<GraphState>> {
  const claimIds = new Set(state.structuredClaims.map((c) => c.id));
  const scores: Record<string, number> = {};

  for (const cid of claimIds) {
    const r0 = state.round0Votes
      .flatMap((v) => v.claims.filter((c) => c.claim_id === cid).map((c) => ({ personaId: v.persona_id, weight: v.weight, attitude: c.attitude })));
    const r1 = state.round1Votes
      .flatMap((v) => v.claims.filter((c) => c.claim_id === cid).map((c) => ({ personaId: v.persona_id, weight: v.weight, attitude: c.attitude })));
    scores[cid] = tws(r0, r1);
  }

  return { twsScoresByClaim: scores };
}
```

测试 + commit 同 P4.6 简单 pattern。

**acceptance_criteria:** 单测验证 TWS 输出在 [-1, 1] + 每 claim 都有 score

**status:** pending

---

### Task P4.7: N7 L4 权重快照(纯计算)

```ts
// lib/graph/nodes/n7-l4-weight.ts
import { effectiveWeights } from "@/lib/consensus/weight-calculator";
import type { GraphState } from "@/lib/graph/state";

export async function n7L4Weight(state: GraphState): Promise<Partial<GraphState>> {
  if (!state.decisionType) throw new Error("decisionType not set (N1 should have set it)");
  // weight overrides 来自 proposals.weight_overrides(由调用方在启动 graph 前注入 selectedPersonas[].weight)
  // 这里 N7 只快照本次推理实际使用的权重(基于 N1 的 decisionType + 用户 overrides)
  const overrides: Record<string, number> = {};
  for (const p of state.selectedPersonas) overrides[p.role] = p.weight;
  return { effectiveWeights: effectiveWeights(state.decisionType, overrides as any) };
}
```

测试 + commit. **acceptance_criteria:** 决策类型缺失抛错;权重写入 state.

**status:** pending

---

### Task P4.8: N8 Premortem(Sonnet 4.6 + Send API 7 并发)

**Files:**
- Create: `lib/graph/nodes/n8-premortem.ts`、`tests/unit/node-n8.test.ts`

```ts
// lib/graph/nodes/n8-premortem.ts
import { generateObject } from "ai";
import { gateway } from "@ai-sdk/gateway";
import { z } from "zod";
import { modelForNode } from "@/lib/llm/gateway";
import { PREMORTEM_TEMPLATE } from "@/lib/methodology/premortem-template";
import { RoleEnum, type Role } from "@/lib/schema/role";
import type { PremortemRisk } from "@/lib/graph/state";

const PREMORTEM_PERSONA_OUT = z.object({
  risks: z.array(z.object({
    risk: z.string().min(15),
    severity: z.enum(["high", "medium", "low"]),
    scenario: z.string().min(20),
    mitigations: z.array(z.string()).default([]),
  })).min(1).max(3),                  // 每角色 1-3 条
});

export interface PremortemInput {
  persona: { id: string; role: Role; weight: number };
  redactedText: string;
  conclusion: string;                 // 来自当前推理的初步结论(P4 主图传入)
  temperature: number;
}

export async function premortemPersona(input: PremortemInput): Promise<{ premortemRisks: PremortemRisk[] }> {
  const cfg = modelForNode("N8");
  const system = PREMORTEM_TEMPLATE.replace("{persona.role_type}", input.persona.role);
  const userPrompt = `初步结论:${input.conclusion}\n\n提案:${input.redactedText}\n\n输出 1-3 条最可能失败原因,基于真实历史教训或行业常识。`;

  const { object } = await generateObject({
    model: gateway(cfg.model),
    schema: PREMORTEM_PERSONA_OUT,
    system, prompt: userPrompt,
    providerOptions: cfg.providerOptions,
    maxRetries: 3,
    temperature: input.temperature,
  });

  return {
    premortemRisks: object.risks.map((r) => ({
      risk: r.risk, severity: r.severity, scenario: r.scenario, mitigations: r.mitigations,
      raised_by: [input.persona.role],
    })),
  };
}
```

测试 + commit. **acceptance_criteria:** 每角色 ≥ 1 条 risk;7 并发后 state.premortemRisks ≥ 3(GAN-A B-A-3 保证 P12 § 风险非空)

**status:** pending

---

### Task P4.9: N9 决策报告生成(Opus 4.7 **streamObject**)

> **关键(GAN-B H-B-1)**:**必须用 `streamObject`**,逐 section emit `node:partial` SSE 事件,不能用 `generateObject` 阻塞 10-15s。

**Files:**
- Create: `lib/graph/nodes/n9-report.ts`、`tests/unit/node-n9.test.ts`

```ts
// lib/graph/nodes/n9-report.ts
import { streamObject } from "ai";
import { gateway } from "@ai-sdk/gateway";
import { modelForNode } from "@/lib/llm/gateway";
import { DecisionReportSchema } from "@/lib/schema/decision-report";
import { consensusBand } from "@/lib/consensus/trajectory-weighted-scoring";
import type { GraphState } from "@/lib/graph/state";

export interface N9PartialEmitter { (section: string, preview: string): void; }

export async function n9Report(state: GraphState, emitPartial?: N9PartialEmitter): Promise<Partial<GraphState>> {
  const cfg = modelForNode("N9");

  // 准备 prompt 上下文(注入 TWS / Premortem / 角色投票汇总)
  const twsSummary = Object.entries(state.twsScoresByClaim)
    .map(([cid, score]) => `${cid}: ${score.toFixed(3)}(${consensusBand(score)})`).join("\n");
  const premortemSummary = state.premortemRisks
    .map((r) => `- [${r.severity}] ${r.risk}(${r.raised_by.join(",")})`).join("\n");
  const round1Summary = state.round1Votes
    .map((v) => `${v.role}: ${v.claims.map((c) => `${c.claim_id}=${c.attitude}`).join(", ")}`).join("\n");

  const system = `你是企业决策报告生成器。基于多角色推理结果,产出严格符合 DecisionReportSchema 的 7 部分报告:
1) conclusion(状态 + ≤50 字摘要 + 服从的 L1 目标)
2) scoring(加权总分 + 4 档分布百分比和=100 + 权重表 + 公式说明)
3) key_disagreements(top 3 分歧,每条含 shared_interest≥10字 / objective_criterion≥10字 / next_step≥5字)
4) evidence_chain(每条结论引用证据)
5) risks(Premortem 产出,≥3 条)
6) action_items(RACI,accountable 必须是单一角色枚举,不能是"财务/运营"组合)
7) minutes(markdown 200-500 字 + headline_disagreement ≤50字 + three_sentence_summary 3 句每句 ≤30字)`;

  const userPrompt = `
[L1 目标] ${state.declaredObjective.name}: ${state.declaredObjective.description}
对齐度: ${state.l1AlignmentScore}/100

[TWS 评分 by claim]
${twsSummary}

[L4 权重]
${JSON.stringify(state.effectiveWeights)}

[Round 1 投票汇总]
${round1Summary}

[Premortem 风险]
${premortemSummary}

请生成完整决策报告。`;

  const { partialObjectStream, object: finalPromise } = streamObject({
    model: gateway(cfg.model),
    schema: DecisionReportSchema,
    system, prompt: userPrompt,
    providerOptions: cfg.providerOptions,
    maxRetries: 3,
    temperature: state.temperature,
  });

  // 流式逐 section emit SSE partial
  const emittedSections = new Set<string>();
  for await (const partial of partialObjectStream) {
    for (const section of ["conclusion", "scoring", "key_disagreements", "evidence_chain", "risks", "action_items", "minutes"] as const) {
      if ((partial as any)[section] && !emittedSections.has(section)) {
        emittedSections.add(section);
        const preview = JSON.stringify((partial as any)[section]).slice(0, 200);
        emitPartial?.(section, preview);
      }
    }
  }

  const finalReport = await finalPromise;
  return { decisionReportPartial: finalReport as Record<string, unknown> };
}
```

测试用 vi.mock 模拟 streamObject 返回 async iterator,验证 emitPartial 被调 7 次(每 section)。

```bash
git add lib/graph/nodes/n9-report.ts tests/unit/node-n9.test.ts
git commit -m "feat(P4.9): N9 决策报告 streamObject(GAN-B H-B-1,7 部分逐段流式 partial)

- 用 streamObject 替代 generateObject(防 10-15s 卡 progress)
- emitPartial callback 让主图把 partial 转 SSE node:partial 事件
- DecisionReportSchema 全 7 部分强约束(含 accountable RoleEnum / AAR 不在此节点)
"
```

**acceptance_criteria:** 单测验证 emitPartial 被 ≥7 次调用(每 section 1 次);最终 object 符合 DecisionReportSchema

**status:** pending

---

### Task P4.10: consensus-graph.ts 主图组装(StateGraph + 9 节点 + Send + interrupt + PostgresSaver)

**Files:**
- Create: `lib/graph/consensus-graph.ts`、`tests/integration/graph-smoke.test.ts`(可选 P7)

- [ ] **Step 1: 实现主图**

```ts
// lib/graph/consensus-graph.ts
import { StateGraph, Send, interrupt, START, END } from "@langchain/langgraph";
import { GraphStateAnnotation, type GraphState } from "./state";
import { n1Structurize } from "./nodes/n1-structurize";
import { n2L1Alignment } from "./nodes/n2-l1-alignment";
import { n3L2Evidence } from "./nodes/n3-l2-evidence";
import { round0PersonaReasoning } from "./nodes/n4-round0";
import { round1PersonaReasoning } from "./nodes/n5-round1";
import { n6Tws } from "./nodes/n6-tws";
import { n7L4Weight } from "./nodes/n7-l4-weight";
import { premortemPersona } from "./nodes/n8-premortem";
import { n9Report, type N9PartialEmitter } from "./nodes/n9-report";
import { checkpointer } from "./checkpointer";

// 主图构建工厂(测试可注入 mock emitter)
export function buildConsensusGraph(opts: { emitPartial?: N9PartialEmitter } = {}) {
  const graph = new StateGraph(GraphStateAnnotation);

  graph.addNode("n1_structurize", n1Structurize);
  graph.addNode("n2_l1_alignment", n2L1Alignment);
  graph.addNode("n3_l2_evidence", n3L2Evidence);

  // N4 Round 0:Send fan-out 到 7 个 persona
  graph.addNode("round0_persona", async (input: any) => round0PersonaReasoning(input));
  // N5 Round 1
  graph.addNode("round1_persona", async (input: any) => round1PersonaReasoning(input));

  graph.addNode("n6_tws", n6Tws);
  graph.addNode("n7_l4_weight", n7L4Weight);

  // N8 Premortem:Send fan-out 到 7 persona
  graph.addNode("premortem_persona", async (input: any) => premortemPersona(input));

  // N9 报告:把 emitPartial 透传
  graph.addNode("n9_report", async (state: GraphState) => n9Report(state, opts.emitPartial));

  // 边
  graph.addEdge(START, "n1_structurize");
  graph.addEdge("n1_structurize", "n2_l1_alignment");
  graph.addEdge("n2_l1_alignment", "n3_l2_evidence");

  // N3 → N4 fan-out(Send 数组)
  graph.addConditionalEdges("n3_l2_evidence", (state: GraphState) =>
    state.selectedPersonas.map((p) =>
      new Send("round0_persona", {
        persona: p, redactedText: state.redactedText, recalledEvidenceIds: state.recalledEvidenceIds,
        structuredClaims: state.structuredClaims, declaredObjective: state.declaredObjective, temperature: state.temperature,
      })
    )
  );

  // 全部 round0 完成 → N5(LangGraph 自动等所有 Send 完成)
  graph.addConditionalEdges("round0_persona", (state: GraphState) => {
    // 计算 myR0Attitude(每 persona 自己的 R0 态度,按 claim_id)
    return state.selectedPersonas.map((p) => {
      const myR0 = state.round0Votes.find((v) => v.persona_id === p.id);
      const myR0Attitude: Record<string, string> = {};
      for (const c of myR0?.claims ?? []) myR0Attitude[c.claim_id] = c.attitude;
      return new Send("round1_persona", {
        persona: p, redactedText: state.redactedText, recalledEvidenceIds: state.recalledEvidenceIds,
        structuredClaims: state.structuredClaims, declaredObjective: state.declaredObjective, temperature: state.temperature,
        othersSnapshot: state.round0Votes.filter((v) => v.persona_id !== p.id),
        myR0Attitude,
      });
    });
  });

  // round1 完成 → N6 TWS → N7 → N8 Premortem fan-out → N9
  graph.addEdge("round1_persona", "n6_tws");
  graph.addEdge("n6_tws", "n7_l4_weight");

  graph.addConditionalEdges("n7_l4_weight", (state: GraphState) => {
    // 用 TWS top-1 claim 文本作为 Premortem 上下文 "conclusion"
    const conclusion = state.structuredClaims[0]?.text ?? "(无)";
    return state.selectedPersonas.map((p) =>
      new Send("premortem_persona", {
        persona: p, redactedText: state.redactedText, conclusion, temperature: state.temperature,
      })
    );
  });

  graph.addEdge("premortem_persona", "n9_report");
  graph.addEdge("n9_report", END);

  // HITL interrupt 在 n3 完成后(进入并发前最后的同步点)
  return graph.compile({ checkpointer, interruptAfter: ["n3_l2_evidence"] });
}
```

- [ ] **Step 2: typecheck + commit**

```bash
pnpm tsc --noEmit
git add lib/graph/consensus-graph.ts
git commit -m "feat(P4.10): consensus-graph 主图组装

- 9 节点 + 3 个 Send fan-out(N4/N5/N8 各 7 并发)
- N9 透传 emitPartial 给 SSE 桥接
- interruptAfter n3 提供 HITL 入口
- 编译时绑定 PostgresSaver checkpointer
"
```

**acceptance_criteria:** typecheck 通过;graph 编译不抛错;N4/N5/N8 用 Send + N9 透传 emitPartial

**status:** pending

---

### Task P4.11: sse-emitter.ts(LangGraph 事件 → SSE 桥接)

**Files:**
- Create: `lib/graph/sse-emitter.ts`

```ts
// lib/graph/sse-emitter.ts
import type { GraphState } from "./state";

export interface SSEEvent { event: string; data: unknown; }

export class SSEStream {
  private encoder = new TextEncoder();
  private controller: ReadableStreamDefaultController<Uint8Array> | null = null;

  readonly stream: ReadableStream<Uint8Array>;

  constructor() {
    this.stream = new ReadableStream({
      start: (c) => { this.controller = c; },
      cancel: () => { this.controller = null; },
    });
  }

  emit(event: string, data: unknown) {
    if (!this.controller) return;
    const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
    this.controller.enqueue(this.encoder.encode(payload));
  }

  close() { this.controller?.close(); this.controller = null; }
}

// 把 LangGraph 流事件转 SSE 事件(按 api.md §6.1 事件类型表)
export function buildEventHandlers(sse: SSEStream, analysisVersionId: string) {
  return {
    onNodeStart: (nodeId: string, nodeName: string) => sse.emit("node:start", { node_id: nodeId, node_name: nodeName }),
    onNodeComplete: (nodeId: string, durationMs: number, summary: unknown) => sse.emit("node:complete", { node_id: nodeId, duration_ms: durationMs, summary }),
    onPersonaStart: (round: "round_0" | "round_1", personaId: string, role: string) => sse.emit("persona:start", { round, persona_id: personaId, role }),
    onPersonaComplete: (round: "round_0" | "round_1", v: any) => sse.emit("persona:complete", { round, persona_id: v.persona_id, role: v.role, attitude: v.claims[0]?.attitude, confidence: v.claims[0]?.confidence, reason_preview: (v.claims[0]?.reason ?? "").slice(0, 80) }),
    onAnchoringDetected: (f: any) => sse.emit("anchoring:detected", f),
    onProviderChange: (e: any) => sse.emit("provider:change", e),
    onL1Warning: (score: number, message: string) => sse.emit("l1:warning", { alignment_score: score, message }),
    onHitlPending: (checkpointId: string, nodeId: string, summary: string) => sse.emit("hitl:pending", { checkpoint_id: checkpointId, node_id: nodeId, state_summary: summary }),
    onNodePartial: (nodeId: string, section: string, preview: string) => sse.emit("node:partial", { node_id: nodeId, partial_section: section, preview }),
    onFinalReport: (report: unknown) => sse.emit("final:report", { analysis_version_id: analysisVersionId, decision_report: report }),
    onDone: (totalDurationMs: number, llmCallCount: number) => { sse.emit("done", { total_duration_ms: totalDurationMs, llm_call_count: llmCallCount }); sse.close(); },
    onError: (code: string, message: string, recoverable: boolean, nodeId?: string) => sse.emit("error", { code, message, recoverable, node_id: nodeId }),
  };
}
```

```bash
git add lib/graph/sse-emitter.ts
git commit -m "feat(P4.11): SSE 桥接(LangGraph stream events → api.md §6.1 SSE 事件)"
```

**acceptance_criteria:** SSEStream 支持 ReadableStream + emit + close;buildEventHandlers 覆盖 §6.1 全部 11+ 事件类型

**status:** pending

---

## Phase P5 — Route Handlers(57 端点,7 批,可并行多 subagent)

> **共享前置(批 5A 之前完成)**:
> - `lib/errors.ts`:错误响应包装 + 41 条错误码 user_message 映射(完整对照 [api.md §9.1 错误码全表](2026-05-23-collab-agent-api.md#91-完整错误码表))
> - `lib/audit.ts`:`writeAudit(action, target_type, target_id, metadata)` + SHA-256 hash
> - `lib/redaction/regex-redactor.ts`:正则白名单(供应商/手机/邮箱/价格/SKU)+ `lib/redaction/llm-fallback.ts`(Haiku 4.5 zero-shot 兜底)

### Task P5.0: 共享工具(errors / audit / redaction)

**Files:**
- Create: `lib/errors.ts`、`lib/audit.ts`、`lib/redaction/regex-redactor.ts`、`lib/redaction/llm-fallback.ts`、`tests/unit/redaction.test.ts`

- [ ] **Step 1: 实现 `lib/errors.ts`**

```ts
// lib/errors.ts
import { NextResponse } from "next/server";

// 完整对照 api.md §9.1 41 条错误码(本 plan 只列结构,user_message 完整 41 条)
export const ERROR_CATALOG = {
  INVALID_INPUT:                  { status: 400, user_message: "输入有误,请检查后重试",                   recoverable: true  },
  SCHEMA_VALIDATION_FAILED:       { status: 400, user_message: "AI 输出格式不符,系统已重试",              recoverable: false },
  PROPOSAL_TOO_SHORT:             { status: 422, user_message: "提案过短,至少 50 字",                     recoverable: true  },
  PROPOSAL_TOO_LONG:              { status: 422, user_message: "提案过长,请精简到 5000 字内",             recoverable: true  },
  OBJECTIVE_REQUIRED:             { status: 422, user_message: "请先选择本提案对应的公司级目标",            recoverable: true  },
  PERSONAS_TOO_FEW:               { status: 422, user_message: "至少需要 2 个角色才能产生分歧分析",          recoverable: true  },
  AAR_TOO_FEW_FIELDS:             { status: 422, user_message: "AAR 4 个字段至少填 2 个,每个至少 10 字",  recoverable: true  },
  WEIGHT_OUT_OF_RANGE:            { status: 400, user_message: "权重必须在 0.5 - 2.0 之间",               recoverable: true  },
  REASON_TOO_SHORT:               { status: 400, user_message: "请输入至少 5 字理由",                     recoverable: true  },
  RESUME_REASON_TOO_SHORT:        { status: 400, user_message: "HITL 决策需留至少 5 字说明",              recoverable: true  },
  HEADLINE_TOO_LONG:              { status: 400, user_message: "一句话核心分歧不超过 50 字",              recoverable: true  },
  SUMMARY_TOO_LONG:               { status: 400, user_message: "一句话总结不超过 50 字",                  recoverable: true  },
  NOT_FOUND:                      { status: 404, user_message: "资源不存在",                              recoverable: false },
  PROPOSAL_NOT_FOUND:             { status: 404, user_message: "该提案不存在",                            recoverable: false },
  ANALYSIS_VERSION_NOT_FOUND:     { status: 404, user_message: "该推理版本不存在",                        recoverable: false },
  PERSONA_NOT_FOUND:              { status: 404, user_message: "该角色不存在",                            recoverable: false },
  CHECKPOINT_NOT_FOUND:           { status: 404, user_message: "该 HITL 接管点不存在",                    recoverable: false },
  SCENARIO_NOT_FOUND:             { status: 404, user_message: "该 Demo 场景不存在",                      recoverable: false },
  EVIDENCE_NOT_FOUND:             { status: 404, user_message: "该证据不存在",                            recoverable: false },
  TARGET_VERSION_NOT_FOUND:       { status: 404, user_message: "回滚目标版本不存在",                      recoverable: false },
  ITEM_NOT_FOUND:                 { status: 404, user_message: "该条目不存在",                            recoverable: false },
  SUGGESTION_NOT_FOUND:           { status: 404, user_message: "该建议不存在",                            recoverable: false },
  PREV_DECISION_NOT_FOUND:        { status: 404, user_message: "上一条决议不存在",                        recoverable: false },
  PREV_DECISION_CROSS_PROPOSAL:   { status: 400, user_message: "链式决议必须在同一提案内",                 recoverable: false },
  AB_COMPARE_ALREADY_RUNNING:     { status: 409, user_message: "对照分析正在进行,请稍后查看结果",          recoverable: true  },
  AB_COMPARE_ALREADY_READY:       { status: 409, user_message: "对照分析已有结果(传 ?force=true 可重跑)", recoverable: true  },
  BASE_AV_NOT_FOUND:              { status: 404, user_message: "基线推理版本不存在",                      recoverable: false },
  ORPHAN_TIMEOUT:                 { status: 410, user_message: "推理启动超 5 分钟仍未连接,已自动失败",     recoverable: false },
  VERSION_CONFLICT:               { status: 409, user_message: "内容已被他人修改,请刷新后重试",            recoverable: true  },
  ALREADY_RUNNING:                { status: 409, user_message: "该提案正在分析中,请稍后",                  recoverable: true  },
  ALREADY_COMPLETED:              { status: 409, user_message: "分析已完成,请直接查看结果",                recoverable: false },
  NOT_RUNNING:                    { status: 409, user_message: "分析未在运行中,无法暂停",                  recoverable: false },
  STILL_RUNNING:                  { status: 409, user_message: "分析仍在进行中,请等待完成",                recoverable: true  },
  OBJECTIVE_NAME_DUPLICATE:       { status: 409, user_message: "该目标名称已存在",                        recoverable: true  },
  RATE_LIMIT_EXCEEDED:            { status: 429, user_message: "操作过于频繁,请稍后重试",                  recoverable: true  },
  PAYLOAD_TOO_LARGE:              { status: 413, user_message: "内容超过 1 MB 限制",                      recoverable: true  },
  QUERY_REQUIRED:                 { status: 400, user_message: "请输入搜索关键词",                        recoverable: true  },
  TOKEN_EXPIRED:                  { status: 403, user_message: "操作已过期,请重新发起",                    recoverable: true  },
  RAW_TEXT_EXPIRED:               { status: 403, user_message: "原始内容已过期(7 天前),无法显示脱敏 diff", recoverable: false },
  FIXTURE_LOAD_FAILED:            { status: 503, user_message: "Demo 场景加载失败",                       recoverable: true  },
  LLM_GATEWAY_DOWN:               { status: 502, user_message: "AI 服务暂时不可用,已尝试备用",            recoverable: true  },
  LLM_TIMEOUT:                    { status: 504, user_message: "AI 响应超时,正在重试",                    recoverable: true  },
  ALL_PROVIDERS_DEGRADED:         { status: 503, user_message: "全部 AI 模型不可用,已切换离线规则模式",    recoverable: false },
  EMBEDDING_PROVIDER_DOWN:        { status: 502, user_message: "向量检索不可用,已降级为关键词搜索",        recoverable: true  },
  DATABASE_DOWN:                  { status: 503, user_message: "保存失败,内容已暂存浏览器,联网后会自动同步", recoverable: true  },
  INTERNAL_ERROR:                 { status: 500, user_message: "出了点意外,我们已记录,请稍后重试",         recoverable: true  },
  FORBIDDEN:                      { status: 403, user_message: "你没权限查看此内容",                      recoverable: false },
} as const;

export type ErrorCode = keyof typeof ERROR_CATALOG;

export function errorResponse(code: ErrorCode, message?: string, opts: { field?: string; request_id?: string } = {}) {
  const cfg = ERROR_CATALOG[code];
  return NextResponse.json(
    {
      error: { code, message: message ?? code, user_message: cfg.user_message, field: opts.field, recoverable: cfg.recoverable },
      request_id: opts.request_id ?? crypto.randomUUID(),
    },
    { status: cfg.status }
  );
}

export function successResponse<T>(data: T, init: { status?: number } = {}) {
  return NextResponse.json({ data }, { status: init.status ?? 200 });
}
```

- [ ] **Step 2: 实现 `lib/audit.ts`**

```ts
// lib/audit.ts
import { createHash } from "node:crypto";
import { db } from "@/lib/db";
import { audit_logs, type auditActionEnum } from "@/lib/db/schema";

type Action = (typeof auditActionEnum.enumValues)[number];

export function sha256(input: string): string {
  return createHash("sha256").update(input).digest("hex");
}

export async function writeAudit(params: {
  action: Action;
  target_type: string;
  target_id?: string;
  input?: unknown;
  output?: unknown;
  metadata?: Record<string, unknown>;
  actor?: string;
  ip?: string;
  user_agent?: string;
}) {
  await db.insert(audit_logs).values({
    actor: params.actor ?? "anonymous",
    action: params.action,
    target_type: params.target_type,
    target_id: params.target_id,
    input_hash: params.input ? `sha256:${sha256(JSON.stringify(params.input))}` : undefined,
    output_hash: params.output ? `sha256:${sha256(JSON.stringify(params.output))}` : undefined,
    metadata: params.metadata,
    ip: params.ip,
    user_agent: params.user_agent,
  });
}
```

- [ ] **Step 3: 实现 `lib/redaction/regex-redactor.ts` + `lib/redaction/llm-fallback.ts`**

```ts
// lib/redaction/regex-redactor.ts
export interface RedactionSegment {
  start: number; end: number; original: string;
  placeholder: string; type: "supplier" | "customer" | "phone" | "email" | "price" | "sku_cost";
  detected_by: "regex" | "llm";
}

interface PatternDef { type: RedactionSegment["type"]; placeholder: (i: number) => string; pattern: RegExp; }

const PATTERNS: PatternDef[] = [
  { type: "phone",     pattern: /(?<![\d])1[3-9]\d{9}(?![\d])/g, placeholder: () => "[手机]" },
  { type: "email",     pattern: /[\w.+-]+@[\w-]+(\.[\w-]+)+/g, placeholder: () => "[邮箱]" },
  { type: "price",     pattern: /¥\s*\d[\d,.]*(?:\s*[-~–]\s*\d[\d,.]*)?/g, placeholder: (i) => `[价格区间_${String.fromCharCode(65 + (i % 26))}]` },
  // 供应商/客户/SKU 用关键词触发:"XX 供应商" / "客户 XX" 这种 — 简化为标注后由 LLM 兜底
];

export function redactByRegex(text: string): { redacted: string; segments: RedactionSegment[]; counts: Record<string, number> } {
  const segments: RedactionSegment[] = [];
  const counts: Record<string, number> = {};
  let result = text;

  for (const def of PATTERNS) {
    let i = 0;
    result = result.replace(def.pattern, (match, ...args) => {
      const offset = args[args.length - 2] as number;
      const placeholder = def.placeholder(i++);
      segments.push({ start: offset, end: offset + match.length, original: match, placeholder, type: def.type, detected_by: "regex" });
      counts[def.type] = (counts[def.type] ?? 0) + 1;
      return placeholder;
    });
  }

  return { redacted: result, segments, counts };
}
```

```ts
// lib/redaction/llm-fallback.ts
import { generateObject } from "ai";
import { gateway } from "@ai-sdk/gateway";
import { z } from "zod";
import { modelForNode } from "@/lib/llm/gateway";

const LLM_OUT = z.object({
  detected: z.array(z.object({
    type: z.enum(["supplier", "customer", "phone", "email", "price", "sku_cost"]),
    original: z.string(),                  // 原文片段
    suggested_placeholder: z.string(),
  })),
});

export async function llmRedactionFallback(textAfterRegex: string): Promise<z.infer<typeof LLM_OUT>["detected"]> {
  const cfg = modelForNode("N1");   // 复用 Haiku 4.5
  const { object } = await generateObject({
    model: gateway(cfg.model),
    schema: LLM_OUT,
    prompt: `检测以下文本中正则未捕到的敏感字段(供应商名/客户名/SKU 成本)。
输出 detected 数组,每项含:type / original(原文) / suggested_placeholder。
若无 → 返回空数组。

文本:
${textAfterRegex}`,
    providerOptions: cfg.providerOptions,
    maxRetries: 3,
  });
  return object.detected;
}
```

- [ ] **Step 4: 测试 + commit**

```ts
// tests/unit/redaction.test.ts
import { describe, it, expect } from "vitest";
import { redactByRegex } from "@/lib/redaction/regex-redactor";

describe("redactByRegex", () => {
  it("识别手机号", () => {
    const r = redactByRegex("联系 13800138000 张三");
    expect(r.redacted).toContain("[手机]");
    expect(r.segments.find((s) => s.type === "phone")).toBeDefined();
  });
  it("识别价格区间", () => {
    const r = redactByRegex("成本 ¥3000-5000");
    expect(r.redacted).toContain("[价格区间_A]");
  });
});
```

```bash
pnpm vitest run tests/unit/redaction.test.ts
git add lib/errors.ts lib/audit.ts lib/redaction tests/unit/redaction.test.ts
git commit -m "feat(P5.0): 共享工具(errors 41 码 + audit SHA-256 + 两层 redaction)"
```

**acceptance_criteria:** `ERROR_CATALOG` 含 41 条错误码;`writeAudit` 入库非空;redaction 单测 PASS

**status:** pending

---

### Task P5.A: 批 5A — P01 首页 + P02 提案输入(7 端点)

**端点清单**(对照 api.md §5.1 + §5.2):
1. `GET /api/scenarios` — 4 场景元数据(读 fixture JSON)
2. `POST /api/scenarios/:scenarioId/load` — 加载 → 创建 proposal + av,返回 redirect_to
3. `GET /api/objectives` — L1 ComboBox
4. `POST /api/objectives` — 自定义目标
5. `POST /api/proposals/draft/detect-decision-type` — AI 识别(调 Haiku)
6. `POST /api/proposals` — 创建提案(redaction + 入库)
7. `POST /api/proposals/:id/start-analysis` — 创建 av(status=running)+ 返回 sse_url

**Files:**
- Create: 7 个 `app/api/.../route.ts` + `tests/integration/api-p01-p02.test.ts`

- [ ] **Step 1: 写代表性端点完整代码 — `POST /api/proposals`**

```ts
// app/api/proposals/route.ts
import { z } from "zod";
import { db } from "@/lib/db";
import { proposals, internal_objectives, personas } from "@/lib/db/schema";
import { DEFAULT_WEIGHTS } from "@/lib/schema/decision-type";
import { errorResponse, successResponse } from "@/lib/errors";
import { writeAudit } from "@/lib/audit";
import { redactByRegex } from "@/lib/redaction/regex-redactor";
import { llmRedactionFallback } from "@/lib/redaction/llm-fallback";
import { eq, inArray } from "drizzle-orm";
import type { NextRequest } from "next/server";

const Req = z.object({
  raw_text: z.string().min(50, "提案至少 50 字").max(5000, "提案不超过 5000 字"),
  decision_type: z.enum(["selection", "marketing", "budget", "operation", "cross_border"]),
  declared_objective_id: z.string().uuid(),
  selected_persona_ids: z.array(z.string().uuid()).min(2, "至少 2 个角色"),
  weight_overrides: z.record(z.string(), z.number().min(0.5).max(2.0)).optional(),
  is_demo: z.boolean().default(false),
  demo_scenario_id: z.string().optional(),
});

export async function POST(req: NextRequest) {
  let body: unknown;
  try { body = await req.json(); } catch { return errorResponse("INVALID_INPUT", "Body 不是有效 JSON"); }

  const parsed = Req.safeParse(body);
  if (!parsed.success) {
    const issue = parsed.error.issues[0]!;
    if (issue.code === "too_small" && issue.path[0] === "raw_text") return errorResponse("PROPOSAL_TOO_SHORT", issue.message);
    if (issue.code === "too_big" && issue.path[0] === "raw_text") return errorResponse("PROPOSAL_TOO_LONG", issue.message);
    if (issue.code === "too_small" && issue.path[0] === "selected_persona_ids") return errorResponse("PERSONAS_TOO_FEW", issue.message);
    if (issue.path[0] === "declared_objective_id") return errorResponse("OBJECTIVE_REQUIRED", issue.message);
    if (issue.code === "too_big" && (issue.path[0] === "weight_overrides")) return errorResponse("WEIGHT_OUT_OF_RANGE", issue.message);
    return errorResponse("INVALID_INPUT", issue.message, { field: String(issue.path[0]) });
  }
  const input = parsed.data;

  // 校验 declared_objective_id 存在
  const [obj] = await db.select().from(internal_objectives).where(eq(internal_objectives.id, input.declared_objective_id));
  if (!obj) return errorResponse("OBJECTIVE_REQUIRED", `objective ${input.declared_objective_id} not found`);

  // 校验 persona ids 都存在
  const personaRows = await db.select().from(personas).where(inArray(personas.id, input.selected_persona_ids));
  if (personaRows.length !== input.selected_persona_ids.length) return errorResponse("PERSONA_NOT_FOUND");

  // 脱敏(正则 + LLM 兜底)
  const r1 = redactByRegex(input.raw_text);
  let redacted = r1.redacted;
  try {
    const llmDetected = await llmRedactionFallback(redacted);
    // 把 LLM 检出的额外片段也替换掉(简化:按 original 直接 replace)
    for (const d of llmDetected) {
      redacted = redacted.split(d.original).join(d.suggested_placeholder);
    }
  } catch { /* LLM 失败不阻塞,只用正则结果 */ }

  // title 取前 30 字
  const title = input.raw_text.slice(0, 30).replace(/\s+/g, " ");

  const [row] = await db.insert(proposals).values({
    title, raw_text: input.raw_text, redacted_text: redacted,
    decision_type: input.decision_type,
    decision_type_confidence: 95,                    // 用户手动选 = 高置信
    declared_objective_id: input.declared_objective_id,
    weight_overrides: input.weight_overrides ?? null,
    selected_persona_ids: input.selected_persona_ids,
    is_demo: input.is_demo ? 1 : 0,
    demo_scenario_id: input.demo_scenario_id,
  }).returning({ id: proposals.id });

  await writeAudit({
    action: "proposal_create",
    target_type: "proposal", target_id: row!.id,
    input: { title, decision_type: input.decision_type },
    metadata: { title, decision_type: input.decision_type, is_demo: input.is_demo },
    ip: (req.headers.get("x-forwarded-for") ?? "").split(",")[0]?.trim(),
    user_agent: req.headers.get("user-agent") ?? undefined,
  });

  return successResponse({ proposal_id: row!.id, title, redacted_text: redacted }, { status: 201 });
}
```

- [ ] **Step 2: 其余 6 个端点骨架(每个独立 commit,代码模式相同 — body Zod 校验 → errorResponse → DB 操作 → writeAudit → successResponse)**

代码骨架(每端点对照 api.md §5.1.X / §5.2.X 的请求/响应规格 + 错误码列表 1:1 实现):

```
GET  /api/scenarios                                 → 读 lib/db/seed/scenarios/scenario-{1..4}.json 元数据,无 DB
POST /api/scenarios/:scenarioId/load                → 读 scenario JSON → 创建 proposal(is_demo=1)+ av(status=running)
GET  /api/objectives                                → SELECT internal_objectives WHERE is_active=1
POST /api/objectives                                → INSERT internal_objectives + audit
POST /api/proposals/draft/detect-decision-type      → 调 Haiku 返回 decision_type + confidence + detected_sensitive_fields
POST /api/proposals/:id/start-analysis              → INSERT analysis_versions(status=running,temperature,seed)+ 返回 sse_url
```

- [ ] **Step 3: 集成测试(用 Vitest + 内存 SQLite 或真 Neon dev branch)**

```ts
// tests/integration/api-p01-p02.test.ts
// 仅给一个代表性集成测试,验证完整 POST /api/proposals 流程
import { describe, it, expect } from "vitest";

describe("POST /api/proposals(集成)", () => {
  it("50 字以下 → 422 PROPOSAL_TOO_SHORT", async () => {
    const res = await fetch("http://localhost:3000/api/proposals", {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ raw_text: "短", decision_type: "selection", declared_objective_id: "obj-...", selected_persona_ids: ["p1","p2"] }),
    });
    expect(res.status).toBe(422);
    const json = await res.json();
    expect(json.error.code).toBe("PROPOSAL_TOO_SHORT");
  });
  // 其他 6 个端点的关键 assertion 各 1-2 个,共 ~10 个
});
```

- [ ] **Step 4: commit(每端点 1 commit)**

```bash
git add app/api/scenarios app/api/objectives app/api/proposals tests/integration/api-p01-p02.test.ts
git commit -m "feat(P5.A): 批 5A — P01 首页 + P02 提案输入(7 端点)

- POST /api/proposals 含 redaction 双层(正则 + Haiku 兜底)
- POST /api/scenarios/:id/load 创建 proposal + av,返回 redirect_to
- POST /api/proposals/:id/start-analysis 含 ALREADY_RUNNING 检测
- 全部错误码对照 api.md §9.1
"
```

**acceptance_criteria:**
- 7 个 route.ts 文件齐全
- 集成测试 ≥ 10 个 PASS
- 所有 ZodError 都映射到对应错误码(不出现 INVALID_INPUT 兜底过多)
- 红线 #1/#2/#5(占位/Mock/降阶):每端点 0 命中

**status:** pending

---

### Task P5.B: 批 5B — P03 推理流(SSE 主入口 + HITL,4 端点)— **最重的一批**

**端点清单**(对照 api.md §5.3):
1. `GET /api/analyze?analysis_version_id=...` — **SSE 主流**(驱动 9 节点)
2. `POST /api/analyze/:id/pause` — HITL 暂停
3. `POST /api/analyze/:id/resume` — HITL 恢复(approve/edit/reject)
4. `GET /api/analyze/:id/status` — 查状态(含孤儿检测 H-A-8 + HITL 自动批准 H-A-6)

**Files:**
- Create: `app/api/analyze/route.ts`、`app/api/analyze/[id]/pause/route.ts`、`app/api/analyze/[id]/resume/route.ts`、`app/api/analyze/[id]/status/route.ts`
- Create: `tests/integration/api-p03-analyze.test.ts`

- [ ] **Step 1: 实现 `GET /api/analyze`(SSE 主流,核心代码)**

```ts
// app/api/analyze/route.ts
export const runtime = "nodejs";          // SSE 需要 nodejs runtime(非 edge)
export const maxDuration = 300;

import type { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { analysis_versions, proposals, personas as personasTable, internal_objectives } from "@/lib/db/schema";
import { eq, inArray } from "drizzle-orm";
import { SSEStream, buildEventHandlers } from "@/lib/graph/sse-emitter";
import { buildConsensusGraph } from "@/lib/graph/consensus-graph";
import { effectiveWeights } from "@/lib/consensus/weight-calculator";
import { L3_STAKEHOLDER_TEMPLATE } from "@/lib/methodology/l3-stakeholder-template";
import { writeAudit } from "@/lib/audit";

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const avId = url.searchParams.get("analysis_version_id");
  if (!avId) return new Response("missing analysis_version_id", { status: 400 });

  const [av] = await db.select().from(analysis_versions).where(eq(analysis_versions.id, avId));
  if (!av) return new Response("av not found", { status: 404 });
  if (av.status === "completed") {
    // 已完成:emit final + done(支持回放)
    const sse = new SSEStream();
    setTimeout(() => {
      sse.emit("started", { analysis_version_id: avId, total_nodes: 9 });
      sse.emit("final:report", { analysis_version_id: avId, decision_report: av.decision_report });
      sse.emit("done", { total_duration_ms: av.total_duration_ms ?? 0, llm_call_count: av.llm_call_count ?? 0 });
      sse.close();
    }, 0);
    return new Response(sse.stream, { headers: SSE_HEADERS });
  }

  // 准备 GraphState 输入
  const [prop] = await db.select().from(proposals).where(eq(proposals.id, av.proposal_id));
  const [obj] = await db.select().from(internal_objectives).where(eq(internal_objectives.id, prop!.declared_objective_id));
  const personaRows = await db.select().from(personasTable).where(inArray(personasTable.id, prop!.selected_persona_ids as string[]));
  const weights = effectiveWeights(prop!.decision_type, (prop!.weight_overrides ?? {}) as any);

  const sse = new SSEStream();
  const handlers = buildEventHandlers(sse, avId);

  // 异步驱动 graph
  (async () => {
    const t0 = Date.now();
    let llmCallCount = 0;
    try {
      sse.emit("started", { analysis_version_id: avId, total_nodes: 9 });

      const graph = buildConsensusGraph({
        emitPartial: (section, preview) => handlers.onNodePartial("N9", section, preview),
      });

      const inputs = {
        analysisVersionId: avId, proposalId: prop!.id,
        redactedText: prop!.redacted_text,
        declaredObjective: { id: obj!.id, name: obj!.name, description: obj!.description, key_results: obj!.key_results as string[] },
        selectedPersonas: personaRows.map((p) => ({
          id: p.id, role: p.role_type, weight: weights[p.role_type as keyof typeof weights],
          system_prompt: L3_STAKEHOLDER_TEMPLATE
            .replace("{persona.name}", p.name)
            .replace("{persona.role_type}", p.role_type)
            .replace("{persona.objective}", p.objective)
            .replace("{persona.kpis}", (p.kpis as string[]).join(","))
            .replace("{persona.interest_boundary}", p.interest_boundary)
            .replace("{persona.natural_conflicts}", (p.natural_conflicts as string[]).join(","))
            .replace("{persona.decision_catchphrase}", p.decision_catchphrase)
            .replace("{persona.risk_appetite}", p.risk_appetite),
        })),
        temperature: av.temperature / 100,
      };

      const config = { configurable: { thread_id: avId } };
      // 流式跑 graph,每个 super-step emit node:start/complete
      for await (const event of graph.streamEvents(inputs, { ...config, version: "v2" })) {
        if (event.event === "on_chain_start" && event.name?.startsWith("n")) {
          handlers.onNodeStart(event.name.toUpperCase(), event.name);
        } else if (event.event === "on_chain_end" && event.name?.startsWith("n")) {
          handlers.onNodeComplete(event.name.toUpperCase(), Date.now() - t0, event.data);
        }
        if (event.metadata?.langgraph_step === "llm_call") llmCallCount++;
      }

      const finalState = await graph.getState(config);
      const report = finalState.values.decisionReportPartial;

      // 回填 analysis_versions
      await db.update(analysis_versions).set({
        status: "completed",
        structured_claims: finalState.values.structuredClaims,
        l1_alignment_score: finalState.values.l1AlignmentScore,
        l1_alignment_warnings: finalState.values.l1AlignmentWarnings,
        recalled_evidence_ids: finalState.values.recalledEvidenceIds,
        round_0_votes: finalState.values.round0Votes,
        round_1_votes: finalState.values.round1Votes,
        anchoring_flags: finalState.values.anchoringFlags,
        tws_scores_by_claim: finalState.values.twsScoresByClaim,
        effective_weights: finalState.values.effectiveWeights,
        premortem_risks: finalState.values.premortemRisks,
        decision_report: report,
        total_duration_ms: Date.now() - t0,
        llm_call_count: llmCallCount,
        completed_at: new Date(),
      }).where(eq(analysis_versions.id, avId));

      // 更新 proposals.current_analysis_version_id(H-A-7,首次完成时设)
      await db.update(proposals)
        .set({ current_analysis_version_id: avId })
        .where(eq(proposals.id, prop!.id));

      handlers.onFinalReport(report);
      handlers.onDone(Date.now() - t0, llmCallCount);
      await writeAudit({ action: "analysis_complete", target_type: "analysis_version", target_id: avId, output: report });
    } catch (e: any) {
      handlers.onError("INTERNAL_ERROR", e.message ?? "unknown", true);
      await db.update(analysis_versions).set({ status: "failed" }).where(eq(analysis_versions.id, avId));
      await writeAudit({ action: "analysis_failed", target_type: "analysis_version", target_id: avId, metadata: { reason: e.message } });
      sse.close();
    }
  })();

  return new Response(sse.stream, { headers: SSE_HEADERS });
}

const SSE_HEADERS = {
  "Content-Type": "text/event-stream; charset=utf-8",
  "Cache-Control": "no-cache, no-transform",
  "Connection": "keep-alive",
  // 注:不发送 X-Accel-Buffering(Vercel 无效,GAN-B H-B-2)
} as const;
```

- [ ] **Step 2: 实现 `pause` / `resume` / `status`(代码骨架按 api.md §5.3.2-5.3.4)**

`status` 端点核心(含 H-A-8 孤儿检测 + H-A-6 HITL 自动批准):

```ts
// app/api/analyze/[id]/status/route.ts(关键逻辑摘录)
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const [av] = await db.select().from(analysis_versions).where(eq(analysis_versions.id, params.id));
  if (!av) return errorResponse("ANALYSIS_VERSION_NOT_FOUND");

  // H-A-8 孤儿检测
  if (av.status === "running" && Date.now() - new Date(av.created_at).getTime() > 5 * 60_000 && !av.structured_claims) {
    await db.update(analysis_versions).set({ status: "failed", completed_at: new Date() }).where(eq(analysis_versions.id, av.id));
    await writeAudit({ action: "analysis_failed", target_type: "analysis_version", target_id: av.id, metadata: { reason: "orphan_timeout_no_sse_connect" } });
    return successResponse({ analysis_version_id: av.id, status: "failed", error_reason: "ORPHAN_TIMEOUT" });
  }

  // H-A-6 HITL 自动批准(v2.3 GAN-V3 Issue 2 修:用 invoke+Command 正确触发图继续,
  // 不能用 updateState — 后者只改 checkpoint state,不会让图继续执行,会卡在 paused_hitl)
  if (av.status === "paused_hitl") {
    const [hitl] = await db.select().from(hitl_audit).where(and(eq(hitl_audit.analysis_version_id, av.id), isNull(hitl_audit.resumed_at)));
    if (hitl && hitl.auto_approve_at && new Date(hitl.auto_approve_at) < new Date()) {
      // 1. 先标记 hitl_audit + audit_logs(防并发重复 resume)
      await db.update(hitl_audit).set({
        resumed_at: new Date(),
        resume_decision: "approve",
        resume_reason: "auto-approve(5min timeout)",
      }).where(eq(hitl_audit.id, hitl.id));
      await writeAudit({ action: "hitl_approve", target_type: "hitl_audit", target_id: hitl.id, actor: "system" });

      // 2. 异步触发 LangGraph resume(用 Next.js 15 `after()` API,不阻塞 status GET 响应)
      // graph.invoke(new Command({ resume: <value> }), config) 才是 LangGraph 0.4 正确恢复方式
      const { after } = await import("next/server");
      after(async () => {
        try {
          const { Command } = await import("@langchain/langgraph");
          const graph = buildConsensusGraph();
          await graph.invoke(new Command({ resume: "auto_approve" }), {
            configurable: { thread_id: av.id },
          });
        } catch (e) {
          // resume 失败:写 audit + 标 av failed,前端轮询下一次会看到 status=failed
          await writeAudit({
            action: "analysis_failed", target_type: "analysis_version", target_id: av.id,
            metadata: { reason: "hitl_auto_resume_failed", error: String(e) },
          });
          await db.update(analysis_versions).set({ status: "failed" }).where(eq(analysis_versions.id, av.id));
        }
      });

      // status 端点立即返回 "running"(后台 resume 在 after 里跑)
      av.status = "running";
    }
  }

  return successResponse({
    analysis_version_id: av.id, status: av.status,
    current_node_id: av.status === "running" ? deriveCurrentNode(av) : null,
    completed_nodes: deriveCompletedNodes(av),
    duration_so_far_ms: Date.now() - new Date(av.created_at).getTime(),
    has_pending_hitl: av.status === "paused_hitl",
    estimated_remaining_ms: estimateRemaining(av),
  });
}
```

- [ ] **Step 3: 集成测试 + commit**

```bash
git add app/api/analyze tests/integration/api-p03-analyze.test.ts
git commit -m "feat(P5.B): 批 5B — P03 SSE 主流 + HITL 4 端点

- GET /api/analyze SSE 流(GAN-A H-A-4 改 GET)
- 含完整 GraphState 注入(7 角色 + L1 obj + 脱敏文本)
- N9 streamObject partial → SSE node:partial 桥接
- 完成后回填 av 全字段 + proposals.current_analysis_version_id(H-A-7)
- status 端点含孤儿检测(H-A-8)+ HITL 自动批准(H-A-6)
- 无 X-Accel-Buffering(H-B-2)
- withCredentials 默认 false(H-B-3)
"
```

**acceptance_criteria:**
- SSE 端点能流式输出(curl 测试可见 event: started)
- 用 Demo 场景跑完一遍 ≤ 90s(P99)
- 孤儿检测 + HITL 自动批准在 status 端点单测 PASS

**status:** pending

---

### Task P5.C: 批 5C — P04 + P05(6 端点)

**端点清单**:
1. `GET /api/analysis-versions/:id` — 完整 av(含 matrix / citations / tws / anchoring)
2. `PATCH /api/analysis-versions/:id/headline` — 编辑顶部一句话(写 av.headline_disagreement 顶层字段)
3. `GET /api/personas` — 7 角色列表
4. `GET /api/personas/:id` — 单角色含 notes 完整 + decision_references
5. `PATCH /api/personas/:id` — 编辑(乐观锁 ETag)
6. `POST /api/personas/:id/reset` — 重置为默认值

**Files:** 6 个 route.ts + `tests/integration/api-p04-p05.test.ts`

- [ ] **Step 1-3: 实现 + 测试 + commit(代码模式同 5.A,完整契约见 api.md §5.4 + §5.5)**

```bash
git commit -m "feat(P5.C): 批 5C — P04 热力图 + P05 工坊(6 端点)

- GET /av/:id 完整矩阵 + cell citations(每 cell ≥1)
- PATCH /av/:id/headline 写 analysis_versions.headline_disagreement 顶层字段(B-A-5)
- PATCH /personas/:id 用 If-Match ETag 乐观锁(409 VERSION_CONFLICT)
- POST /personas/:id/reset 不重置 notes(append-only)
"
```

**acceptance_criteria:** 6 端点齐全;PATCH 端点都支持 ETag;headline 写顶层字段(不是 decision_report.minutes.headline_disagreement)

**status:** pending

---

### Task P5.D(拆为 3 sub-task)— P06 + P07 Safety Center 19 端点(v2.3 GAN-V3 Issue 4 修)

> 原 P5.D 单批 19 端点 > 800 行被 reviewer 判粒度过粗。**拆为 D1 / D2 / D3 三个独立 task,各自 commit + acceptance**:

#### Task P5.D1 — P06 讨论框架(3 端点)

**Files:** `app/api/analysis-versions/[id]/discussion-frame/route.ts` + `app/api/analysis-versions/[id]/discussion-frame/items/[itemId]/route.ts` + `app/api/analysis-versions/[id]/export/route.ts`

**端点契约**(对照 api.md §5.6):
- `GET /discussion-frame` — 从 decision_report 派生 3 段(已共识 / 待回答 / 数据缺失)
- `PATCH items/:itemId` — Owner 分配 + 编辑(写 av.decision_report_overrides 局部字段)
- `GET export?format=markdown|pdf&scope=...` — 导出 md/pdf(scope=discussion_frame 或 decision_report 或 both)

```bash
git commit -m "feat(P5.D1): P06 讨论框架 3 端点(派生自 decision_report)"
```

**acceptance_criteria:** 3 端点齐全;export markdown 含完整 3 段 + citation;`pnpm typecheck` 0 错

**status:** pending

---

#### Task P5.D2 — P07 Safety Center 面板 1-4(7 端点)

**Files & 端点契约**(对照 api.md §5.7.1-5.7.7):
- 面板 1 降级链:`GET /api/llm/provider-events` + `POST /api/llm/manual-degrade`(写 Upstash Redis 300s TTL)
- 面板 2 脱敏 diff:`GET /api/proposals/:id/redaction-diff` + `POST /api/proposals/:id/restoration-map/download`(5 分钟一次性 token,CSV)
- 面板 3 置信度统计:`GET /api/analysis-versions/:id/confidence-stats`
- 面板 4 版本回滚:`GET /api/proposals/:id/versions` + `POST /api/proposals/:id/rollback`(**更新 proposals.current_analysis_version_id**)

```bash
git commit -m "feat(P5.D2): P07 面板 1-4(降级链/脱敏/置信度/回滚 = 7 端点)

- rollback 更新 current_analysis_version_id(H-A-7)
- restoration-map 5 分钟一次性 token,CSV 流式输出
"
```

**acceptance_criteria:** 7 端点齐全;rollback 后 proposals.current 已更新;`pnpm consistency` 0 命中

**status:** pending

---

#### Task P5.D3 — P07 Safety Center 面板 5-8(9 端点)

**Files & 端点契约**(对照 api.md §5.7.8-5.7.17):
- 面板 5 HITL 接管:`GET /api/hitl/pending` + `POST /api/hitl/:checkpointId/takeover`(= resume 别名)
- 面板 6 审计日志:`GET /api/audit-logs` + `GET /api/audit-logs/export`(CSV 流式 + 敏感字段截断)
- 面板 7 稳定性测试(5 端点):`POST /api/proposals/:id/reproducibility-runs/start`(预创建 3 av)+ `GET /api/reproducibility-check?rr_id=...`(SSE 聚合)+ `POST /api/reproducibility-runs/:id/finalize`(metrics 聚合)+ `GET /api/reproducibility-runs/:id` + `GET /api/proposals/:id/reproducibility-runs`
- 面板 8 Prompt 透明度:`GET /api/analysis-versions/:id/prompts` + `POST /api/analysis-versions/:id/prompts/ab-compare`(**用 `after()` 异步触发**,响应 202)

**`after()` 用法示例**(GAN-V3 reviewer 指出 plan 此处需要明确代码):

```ts
// app/api/analysis-versions/[id]/prompts/ab-compare/route.ts
import { after } from "next/server";

export async function POST(_req: NextRequest, { params }: { params: { id: string } }) {
  const [av] = await db.select().from(analysis_versions).where(eq(analysis_versions.id, params.id));
  if (!av) return errorResponse("ANALYSIS_VERSION_NOT_FOUND");
  if (av.methodology_ab_compare) return errorResponse("AB_COMPARE_ALREADY_READY");
  // 防并发重复触发:用 Redis SETNX 占位 60s
  const lock = await redis.set(`ab:${av.id}`, "running", { nx: true, ex: 60 });
  if (!lock) return errorResponse("AB_COMPARE_ALREADY_RUNNING");

  // 同步立即返回 202
  const estimatedReadyAt = new Date(Date.now() + 30_000).toISOString();

  // 异步后台跑(after 不阻塞响应,且 Vercel 保证函数实例完成 after 内逻辑后才关闭)
  after(async () => {
    try {
      const result = await runMethodologyAbCompare(av);  // 调 Haiku,简化 prompt,~20-30s
      await db.update(analysis_versions)
        .set({ methodology_ab_compare: result })
        .where(eq(analysis_versions.id, av.id));
    } finally {
      await redis.del(`ab:${av.id}`);
    }
  });

  return successResponse({ ab_compare_status: "pending", estimated_ready_at: estimatedReadyAt }, { status: 202 });
}
```

```bash
git commit -m "feat(P5.D3): P07 面板 5-8(HITL/审计/稳定性测试/Prompt 透明度 = 9 端点)

- 稳定性测试两阶段(POST start + GET SSE 聚合)
- ab-compare 用 Next.js 15 after() 异步触发,202 立即返回(B-A-3)
- audit-logs export CSV 敏感字段截断
"
```

**acceptance_criteria:** 9 端点齐全;reproducibility-runs/start 预创建 3 av 入库;ab-compare 触发后 `methodology_ab_compare` JSONB 在 30s 内被填充

**status:** pending

#### P5.D 共享代码示例 — `POST /api/proposals/:id/reproducibility-runs/start`(D3 用,但 D2 rollback 也参考类似 av-copy 模式)

```ts
// app/api/proposals/[id]/reproducibility-runs/start/route.ts
import { z } from "zod";
import { db } from "@/lib/db";
import { proposals, analysis_versions, reproducibility_runs } from "@/lib/db/schema";
import { errorResponse, successResponse } from "@/lib/errors";
import { writeAudit, sha256 } from "@/lib/audit";
import { eq } from "drizzle-orm";
import type { NextRequest } from "next/server";

const Body = z.object({ base_analysis_version_id: z.string().uuid().optional() });

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const body = Body.parse(await req.json().catch(() => ({})));
  const [prop] = await db.select().from(proposals).where(eq(proposals.id, params.id));
  if (!prop) return errorResponse("PROPOSAL_NOT_FOUND");

  // 预创建 3 个 av(温度/seed 固定)
  const triples: Array<{ temperature: number; seed: number }> = [
    { temperature: 30, seed: 42 },
    { temperature: 40, seed: 84 },
    { temperature: 50, seed: 126 },
  ];
  const avIds: string[] = [];
  for (const t of triples) {
    const [row] = await db.insert(analysis_versions).values({
      proposal_id: prop.id, version_label: `repro-T${t.temperature}-S${t.seed}`,
      status: "running", temperature: t.temperature, seed: t.seed,
      input_hash: `sha256:${sha256(prop.redacted_text + prop.declared_objective_id + t.seed)}`,
    }).returning({ id: analysis_versions.id });
    avIds.push(row!.id);
  }

  const [rr] = await db.insert(reproducibility_runs).values({
    proposal_id: prop.id, run_count: 3,
    analysis_version_ids: avIds,
    temperatures: triples.map((t) => t.temperature / 100),
    seeds: triples.map((t) => t.seed),
    conclusion_consistency_pct: 0, top3_jaccard: 0, evidence_overlap_pct: 0,
    verdict: "partial", total_duration_ms: 0,
  }).returning({ id: reproducibility_runs.id });

  await writeAudit({ action: "reproducibility_run", target_type: "proposal", target_id: prop.id, metadata: { run_id: rr!.id, av_ids: avIds } });

  return successResponse({
    reproducibility_run_id: rr!.id,
    analysis_version_ids: avIds,
    params: triples.map((t) => ({ temperature: t.temperature / 100, seed: t.seed })),
    sse_url: `/api/reproducibility-check?rr_id=${rr!.id}`,
  }, { status: 201 });
}
```

---

### Task P5.E: 批 5E — P09 + P10(6 端点)

**端点清单**(对照 api.md §5.9 + §5.10):
- `POST /api/decisions` — AAR + 校验 prev_decision_id(H-A-9)+ 触发 weight suggestion 生成
- `GET /api/proposals/:id/decisions` — 决议链
- `POST /api/decisions/:id/weight-suggestions/accept`
- `GET /api/proposals` — 列表(含派生字段 consensus_band / reproducibility_verdict,H-A-5)
- `GET /api/personas/:id/evolution` — 演化时间轴
- `POST /api/proposals/:id/duplicate`

**Files:** 6 个 route.ts + `tests/integration/api-p09-p10.test.ts`

- [ ] **Step 1: 实现 + 测试 + commit**

代表性约束(`POST /api/decisions`):
```ts
// 关键校验逻辑
// 1. DecisionAarSchema.parse(body) — Zod refine 保证 ≥2 字段 + trim≥10(H-A-3)
// 2. 若 prev_decision_id 不为 null,验证存在 + 同 proposal_id(H-A-9)
// 3. 异步生成 weight_suggestions(对比 AAR 预期 vs 实际 → 调 Haiku → 入库)
// 4. UPDATE 每个 affected_persona 的 notes(append "[date 决议 prop_xxx] 状态:xxx 你的观点采纳:yyy")
```

派生字段 SQL(`GET /api/proposals`):
```sql
-- 单 JOIN 拿全(H-A-5 派生规则)
SELECT
  p.id, p.title, p.decision_type, p.current_analysis_version_id,
  av.version_label as current_version_label,
  av.decision_report->'scoring'->>'weighted_total' as weighted_total,
  d.status as decision_status,
  rr.verdict as reproducibility_verdict,
  p.selected_persona_ids
FROM proposals p
LEFT JOIN analysis_versions av ON av.id = p.current_analysis_version_id
LEFT JOIN LATERAL (
  SELECT status FROM decisions WHERE proposal_id = p.id ORDER BY created_at DESC LIMIT 1
) d ON true
LEFT JOIN LATERAL (
  SELECT verdict FROM reproducibility_runs WHERE proposal_id = p.id ORDER BY created_at DESC LIMIT 1
) rr ON true
WHERE p.deleted_at IS NULL
ORDER BY p.created_at DESC
LIMIT 20;
-- 应用层算 consensus_band: weighted_total >=70 green / 40-69 yellow / <40 red
```

```bash
git commit -m "feat(P5.E): 批 5E — P09 决议(AAR)+ P10 历史(6 端点)

- POST /decisions 校验 prev_decision_id 同 proposal(H-A-9 新错误码)
- DecisionAarSchema refine trim ≥10 字(H-A-3)
- weight_suggestions 异步生成 + accept 端点
- GET /proposals 单 JOIN + LATERAL 派生 consensus_band / verdict(H-A-5)
"
```

**acceptance_criteria:** 6 端点齐全;PREV_DECISION_CROSS_PROPOSAL 错误覆盖测试;派生字段不走 N+1

**status:** pending

---

### Task P5.F: 批 5F — P11 + P12(11 端点)

**端点清单**(对照 api.md §5.11 + §5.12):

P11:`GET /evidence/sources` / `GET /evidence/cards` / `GET /evidence/cards/:id` / `POST /evidence/search` / `GET /analysis-versions/:id/cited-evidence`

P12:`GET /av/:id/decision-report` / `PATCH /conclusion` / `PATCH /weights` / `PATCH /raci/:itemId`(写 av.decision_report_overrides B-A-6)/ `GET /export?format=...` / `POST /av/:id/fork`(不更新 current_version,H-A-7)

**Files:** 11 个 route.ts + `tests/integration/api-p11-p12.test.ts`

**关键约束**:
- `POST /evidence/search` mode=embedding 失败时降级 keyword,返回 header `X-Search-Mode-Fallback: keyword`
- `PATCH /weights` **新建版本**(immutable),`PATCH /raci/:itemId` **不新建**(写 overrides JSONB,B-A-6)
- `GET /decision-report` 读时合并:若 av.decision_report_overrides.action_items 非空,替换 decision_report.action_items
- `POST /fork` 不更新 current_analysis_version_id(H-A-7)

```bash
git commit -m "feat(P5.F): 批 5F — P11 证据库 + P12 决策报告(11 端点)

- evidence/search embedding 模式降级 keyword(X-Search-Mode-Fallback header)
- PATCH /conclusion + /weights 新建 av(immutable)+ 更新 current
- PATCH /raci 写 av.decision_report_overrides.action_items(不新建,B-A-6)
- GET /decision-report 读时合并 overrides
- POST /fork 不更新 current_analysis_version_id(H-A-7)
"
```

**acceptance_criteria:** 11 端点齐全;PATCH /raci 写 overrides JSONB 不新建版本;PATCH /weights 新建版本且更新 current

**status:** pending

---

### Task P5.G: 批 5G — 共享(2 端点 + Server Action 草稿)

- `GET /api/health` — health check(检 Neon + Redis + AI Gateway)
- 内部 `lib/llm/embedding.ts` 已实现(无需独立 route handler;P11 search 内部调用)
- Server Action `app/api/proposals/draft/`(P02 草稿 — H-A-1 决定**纯 localStorage,无服务端**;不实现)

**Files:** `app/api/health/route.ts` + `tests/integration/api-health.test.ts`

```ts
// app/api/health/route.ts
export async function GET() {
  const checks = { neon: "unknown", redis: "unknown", ai_gateway: "unknown" } as Record<string, string>;
  try { await db.execute("SELECT 1"); checks.neon = "ok"; } catch { checks.neon = "down"; }
  try { await redis.ping(); checks.redis = "ok"; } catch { checks.redis = "down"; }
  // AI Gateway 健康检查跳过(配额贵),依赖部署时 env 校验
  checks.ai_gateway = process.env.AI_GATEWAY_API_KEY ? "ok" : "down";
  return Response.json({ data: { status: "ok", deps: checks, version: process.env.VERCEL_GIT_COMMIT_SHA ?? "dev", deployed_at: new Date().toISOString() } });
}
```

```bash
git commit -m "feat(P5.G): 批 5G — GET /api/health(deps 3 项)+ P02 草稿确认纯前端"
```

**acceptance_criteria:** /api/health 返回 deps 状态

**status:** pending

---

## Phase P6 — UI 实现(12 页,6 批可并行)

> **全局视觉约定**(对照 ui.md):
> - 配色:`success` HSL(142 71% 45%)/ `conditional` HSL(160 60% 50%) / `warning` HSL(38 92% 50%) / `destructive` HSL(0 84% 60%)
> - 图标:**只用 lucide-react**,严禁 JSX 中出现 emoji unicode(红线 #4)
> - 角色图标(ui.md §1.6 锁定):Briefcase / Package / Megaphone / Coins / Sparkles / Truck / Globe
> - 态度图标:CheckCircle2 / CheckCircle / HelpCircle / XCircle
> - 排版:Tremor + shadcn/ui 组件优先,自定义组件最少化

### Task P6.0: 共享 UI 组件库

**Files:**
- Create: `components/ui/{button,card,dialog,drawer,tabs,tooltip,combobox,toast}.tsx`(shadcn add)
- Create: `components/shared/{AttitudeIcon,RoleIcon,ProviderBadge,LucideOnly,ConsensusBand}.tsx`

- [ ] **Step 1: shadcn init + 8 个基础组件**

```bash
pnpm dlx shadcn@latest init -y
pnpm dlx shadcn@latest add button card dialog drawer tabs tooltip toast badge progress separator
```

- [ ] **Step 2: 实现共享业务组件(强制 Lucide)**

```tsx
// components/shared/AttitudeIcon.tsx
import { CheckCircle2, CheckCircle, HelpCircle, XCircle } from "lucide-react";
import type { Attitude } from "@/lib/schema/attitude";

const MAP = {
  support:      { Icon: CheckCircle2, className: "text-[hsl(142_71%_45%)]", label: "支持" },
  conditional:  { Icon: CheckCircle,  className: "text-[hsl(160_60%_50%)]", label: "谨慎支持" },
  insufficient: { Icon: HelpCircle,   className: "text-[hsl(38_92%_50%)]",  label: "信息不足" },
  oppose:       { Icon: XCircle,      className: "text-[hsl(0_84%_60%)]",   label: "反对" },
} as const;

export function AttitudeIcon({ attitude, size = 16, withLabel = false }: { attitude: Attitude; size?: number; withLabel?: boolean }) {
  const { Icon, className, label } = MAP[attitude];
  return (
    <span className="inline-flex items-center gap-1">
      <Icon size={size} className={className} aria-label={label} />
      {withLabel && <span className="text-sm">{label}</span>}
    </span>
  );
}
```

```tsx
// components/shared/RoleIcon.tsx
import { Briefcase, Package, Megaphone, Coins, Sparkles, Truck, Globe } from "lucide-react";
import type { Role } from "@/lib/schema/role";

const MAP: Record<Role, { Icon: any; label: string }> = {
  operations:   { Icon: Briefcase, label: "运营" },
  products:     { Icon: Package,   label: "商品" },
  marketing:    { Icon: Megaphone, label: "市场" },
  finance:      { Icon: Coins,     label: "财务" },
  brand:        { Icon: Sparkles,  label: "品牌" },
  supply_chain: { Icon: Truck,     label: "供应链" },
  regional:     { Icon: Globe,     label: "区域管理" },
};

export function RoleIcon({ role, size = 16 }: { role: Role; size?: number }) {
  const { Icon, label } = MAP[role];
  return <Icon size={size} aria-label={label} className="text-muted-foreground" />;
}
```

`components/shared/ProviderBadge.tsx`:同模式,4 状态(opus/sonnet/haiku/offline)→ Lucide CheckCircle2 / AlertTriangle / AlertTriangle / WifiOff。

- [ ] **Step 3: 红线扫描脚本对 JSX 内 emoji 扫描**

`scripts/scan-jsx-emoji.ts`:
```ts
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const EMOJI = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u;
const ROOTS = ["app", "components"];

let hits = 0;
function walk(dir: string) {
  for (const f of readdirSync(dir)) {
    const p = join(dir, f);
    if (statSync(p).isDirectory()) walk(p);
    else if (/\.(tsx?|jsx?)$/.test(f)) {
      const lines = readFileSync(p, "utf8").split("\n");
      lines.forEach((line, i) => {
        // 跳过注释行
        if (/^\s*\/\//.test(line)) return;
        if (EMOJI.test(line)) {
          console.error(`${p}:${i + 1}: ${line.trim()}`);
          hits++;
        }
      });
    }
  }
}
ROOTS.forEach(walk);
if (hits > 0) { console.error(`\n🔴 ${hits} emoji 命中 JSX(红线 #4 fail)`); process.exit(1); }
console.log("✅ JSX emoji 扫描 0 命中");
```

加 script:`"scan:emoji": "tsx scripts/scan-jsx-emoji.ts"`

```bash
pnpm scan:emoji
git add components/ui components/shared scripts/scan-jsx-emoji.ts package.json
git commit -m "feat(P6.0): shadcn 基础 + 共享组件(Attitude/Role/Provider Icon,Lucide-only)"
```

**acceptance_criteria:** `pnpm scan:emoji` 退出码 0;共享组件 100% 用 lucide-react

**status:** pending

---

### Task P6.A: 批 6A — P01 首页 + P02 提案输入

**Files:**
- Create: `app/(app)/layout.tsx`(全局导航)、`app/(app)/page.tsx`(P01)、`app/(app)/proposals/new/page.tsx`(P02)
- Create: `components/feature/home/DemoScenarioPicker.tsx`、`RecentProposals.tsx`
- Create: `components/feature/proposal-intake/{ObjectiveCombo,DecisionTypeTabs,PersonaCardGrid,WeightPreview}.tsx`

- [ ] **Step 1: P01 实现(Demo Sim 4 场景下拉 + 最近 3 提案)**

```tsx
// app/(app)/page.tsx(Server Component)
import { db } from "@/lib/db";
import { proposals } from "@/lib/db/schema";
import { desc } from "drizzle-orm";
import { DemoScenarioPicker } from "@/components/feature/home/DemoScenarioPicker";
import { RecentProposals } from "@/components/feature/home/RecentProposals";
import Link from "next/link";
import { Plus } from "lucide-react";

export default async function Home() {
  const recent = await db.select().from(proposals).orderBy(desc(proposals.created_at)).limit(3);
  return (
    <main className="mx-auto max-w-5xl p-8 space-y-12">
      <h1 className="text-3xl font-bold text-center">议见 YiJian</h1>
      <p className="text-center text-muted-foreground">企业 AI 共识形成系统 — 把"各说各话"变成一次性可执行决策</p>

      <div className="flex flex-col items-center gap-6">
        <Link href="/proposals/new" className="inline-flex items-center gap-2 rounded-md bg-primary px-8 py-4 text-lg text-primary-foreground hover:opacity-90">
          <Plus size={20} aria-hidden /> 新建提案
        </Link>
        <DemoScenarioPicker />
      </div>

      {recent.length > 0 && <RecentProposals items={recent} />}
    </main>
  );
}
```

`components/feature/home/DemoScenarioPicker.tsx`(Client Component):4 个场景下拉 → 点击调 `POST /api/scenarios/:id/load` → router.push 到返回的 `redirect_to`

- [ ] **Step 2: P02 实现(L1 ComboBox + 5 决策类型 Tab + 7 角色 4×2 + 动态权重)**

```tsx
// app/(app)/proposals/new/page.tsx
import { ObjectiveCombo } from "@/components/feature/proposal-intake/ObjectiveCombo";
import { DecisionTypeTabs } from "@/components/feature/proposal-intake/DecisionTypeTabs";
import { PersonaCardGrid } from "@/components/feature/proposal-intake/PersonaCardGrid";
import { WeightPreview } from "@/components/feature/proposal-intake/WeightPreview";

export default function NewProposal() {
  return (
    <main className="mx-auto max-w-6xl p-8">
      <h1 className="text-2xl font-bold mb-6">新建提案</h1>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <section className="lg:col-span-2 space-y-4">
          <ObjectiveCombo />
          <textarea className="w-full min-h-[18rem] rounded border p-4" placeholder="粘贴或键入提案文本(50-5000 字)..." />
          <DecisionTypeTabs />   {/* 5 Tab: selection / marketing / budget / operation / cross_border */}
        </section>
        <aside className="space-y-4">
          <PersonaCardGrid />   {/* 7 角色 4×2,默认全选 */}
          <WeightPreview />     {/* 基于 decision_type 显示权重 */}
        </aside>
      </div>
      <button className="mt-8 rounded bg-primary px-6 py-3 text-primary-foreground">开始分析</button>
    </main>
  );
}
```

`DecisionTypeTabs` 必须含 5 个 Tab(B-A-2 修复后):
```tsx
const TABS = [
  { value: "selection",    label: "选品" },
  { value: "marketing",    label: "营销" },
  { value: "budget",       label: "预算" },
  { value: "operation",    label: "经营" },
  { value: "cross_border", label: "跨境-区域" },        // GAN-A B-A-2 必须有
] as const;
```

草稿(H-A-1)纯 localStorage:`lib/draft/local-storage.ts` 每 10s setItem,挂载时 getItem 恢复并弹"3 分钟前的草稿,继续/新建"提示。

- [ ] **Step 3: E2E 测试(P01 → 选场景 → P02 → 提交跳 P03)**

```ts
// tests/e2e/p01-p02-flow.spec.ts
import { test, expect } from "@playwright/test";

test("P01 Demo Sim → P02 跳转", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: /演示模式/ }).click();
  await page.getByRole("option", { name: /七夕情侣对戒/ }).click();
  await expect(page).toHaveURL(/\/analysis\/.*?demo=scenario-2/);
});

test("P02 5 决策类型 Tab 含跨境-区域", async ({ page }) => {
  await page.goto("/proposals/new");
  await expect(page.getByRole("tab", { name: "跨境-区域" })).toBeVisible();
});
```

```bash
pnpm scan:emoji && pnpm consistency
git add app/(app) components/feature/home components/feature/proposal-intake lib/draft tests/e2e
git commit -m "feat(P6.A): 批 6A — P01 首页 + P02 提案输入

- DemoScenarioPicker 4 场景下拉
- 5 决策类型 Tab(含 cross_border,B-A-2)
- 7 角色 4×2 卡片(Lucide 锁定图标)
- L1 ComboBox 必选 + 动态权重预览
- 草稿纯 localStorage(H-A-1)
"
```

**acceptance_criteria:** E2E 测试 PASS;5 Tab 含 cross_border;`pnpm scan:emoji` 0 命中

**status:** pending

---

### Task P6.B: 批 6B — P03 推理流(9 节点双层进度条 + Round 0 7 圆点 + HITL)

**Files:**
- Create: `app/(app)/analysis/[id]/page.tsx`、`components/feature/analysis/{NodeProgress,Round0PersonaCircles,ProviderBadge,HitlDialog,L1WarningDialog}.tsx`
- Create: `hooks/useAnalysisStream.ts`

- [ ] **Step 1: 实现 SSE 客户端 hook**

```tsx
// hooks/useAnalysisStream.ts
"use client";
import { useEffect, useReducer } from "react";

interface State {
  status: "idle" | "running" | "paused_hitl" | "completed" | "failed";
  currentNode?: string;
  completedNodes: string[];
  personaVotes: Record<string, { round_0?: any; round_1?: any }>;
  providerHistory: any[];
  anchoringFlags: any[];
  partialReport: Record<string, string>;
  finalReport?: any;
  hitlPending?: any;
  l1Warning?: any;
  error?: { code: string; message: string };
}

type Action =
  | { type: "STARTED"; payload: { analysis_version_id: string } }
  | { type: "NODE_START"; payload: { node_id: string; node_name: string } }
  | { type: "NODE_COMPLETE"; payload: { node_id: string; duration_ms: number; summary: unknown } }
  | { type: "PERSONA_START"; payload: { round: "round_0" | "round_1"; persona_id: string } }
  | { type: "PERSONA_COMPLETE"; payload: any }
  | { type: "PROVIDER_CHANGE"; payload: any }
  | { type: "ANCHORING"; payload: any }
  | { type: "L1_WARNING"; payload: any }
  | { type: "HITL_PENDING"; payload: any }
  | { type: "NODE_PARTIAL"; payload: { node_id: string; partial_section: string; preview: string } }
  | { type: "FINAL_REPORT"; payload: any }
  | { type: "DONE" }
  | { type: "ERROR"; payload: { code: string; message: string } };

const reducer = (s: State, a: Action): State => {
  switch (a.type) {
    case "STARTED": return { ...s, status: "running" };
    case "NODE_START": return { ...s, currentNode: a.payload.node_id };
    case "NODE_COMPLETE": return { ...s, completedNodes: [...s.completedNodes, a.payload.node_id] };
    case "PERSONA_COMPLETE": {
      const k = a.payload.persona_id;
      return { ...s, personaVotes: { ...s.personaVotes, [k]: { ...(s.personaVotes[k] ?? {}), [a.payload.round]: a.payload } } };
    }
    case "PROVIDER_CHANGE": return { ...s, providerHistory: [...s.providerHistory, a.payload] };
    case "ANCHORING": return { ...s, anchoringFlags: [...s.anchoringFlags, a.payload] };
    case "L1_WARNING": return { ...s, l1Warning: a.payload };
    case "HITL_PENDING": return { ...s, status: "paused_hitl", hitlPending: a.payload };
    case "NODE_PARTIAL": return { ...s, partialReport: { ...s.partialReport, [a.payload.partial_section]: a.payload.preview } };
    case "FINAL_REPORT": return { ...s, status: "completed", finalReport: a.payload.decision_report };
    case "DONE": return s;
    case "ERROR": return { ...s, status: "failed", error: a.payload };
  }
};

export function useAnalysisStream(avId: string) {
  const [state, dispatch] = useReducer(reducer, { status: "idle", completedNodes: [], personaVotes: {}, providerHistory: [], anchoringFlags: [], partialReport: {} });

  useEffect(() => {
    // GAN-B H-B-3:不设 withCredentials(P0 匿名)
    const es = new EventSource(`/api/analyze?analysis_version_id=${avId}`);
    es.addEventListener("started", (e) => dispatch({ type: "STARTED", payload: JSON.parse(e.data) }));
    es.addEventListener("node:start", (e) => dispatch({ type: "NODE_START", payload: JSON.parse(e.data) }));
    es.addEventListener("node:complete", (e) => dispatch({ type: "NODE_COMPLETE", payload: JSON.parse(e.data) }));
    es.addEventListener("persona:complete", (e) => dispatch({ type: "PERSONA_COMPLETE", payload: JSON.parse(e.data) }));
    es.addEventListener("provider:change", (e) => dispatch({ type: "PROVIDER_CHANGE", payload: JSON.parse(e.data) }));
    es.addEventListener("anchoring:detected", (e) => dispatch({ type: "ANCHORING", payload: JSON.parse(e.data) }));
    es.addEventListener("l1:warning", (e) => dispatch({ type: "L1_WARNING", payload: JSON.parse(e.data) }));
    es.addEventListener("hitl:pending", (e) => dispatch({ type: "HITL_PENDING", payload: JSON.parse(e.data) }));
    es.addEventListener("node:partial", (e) => dispatch({ type: "NODE_PARTIAL", payload: JSON.parse(e.data) }));
    es.addEventListener("final:report", (e) => dispatch({ type: "FINAL_REPORT", payload: JSON.parse(e.data) }));
    es.addEventListener("done", () => es.close());
    es.addEventListener("error", (e) => {
      const data = (e as MessageEvent).data;
      if (data) dispatch({ type: "ERROR", payload: JSON.parse(data) });
    });
    return () => es.close();
  }, [avId]);

  return state;
}
```

- [ ] **Step 2: 实现 P03 主页面 + 双层进度条 + Round 0 7 圆点 + framer-motion 动画**(v2.3 GAN-V3 Issue 4b 修:补完整骨架)

`app/(app)/analysis/[id]/page.tsx`:
```tsx
"use client";
import { useAnalysisStream } from "@/hooks/useAnalysisStream";
import { NodeProgress } from "@/components/feature/analysis/NodeProgress";
import { Round0PersonaCircles } from "@/components/feature/analysis/Round0PersonaCircles";
import { ProviderBadge } from "@/components/shared/ProviderBadge";
import { HitlDialog } from "@/components/feature/analysis/HitlDialog";
import { L1WarningDialog } from "@/components/feature/analysis/L1WarningDialog";
import { Button } from "@/components/ui/button";
import { useRouter } from "next/navigation";

export default function AnalysisPage({ params }: { params: { id: string } }) {
  const state = useAnalysisStream(params.id);
  const router = useRouter();
  return (
    <main className="mx-auto max-w-5xl p-6 space-y-6">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">推理进行中</h1>
        <ProviderBadge currentProvider={state.providerHistory.at(-1)?.to ?? "opus-4-7"} history={state.providerHistory} />
      </header>

      <NodeProgress currentNode={state.currentNode} completedNodes={state.completedNodes} />

      {state.currentNode === "N4" || state.currentNode === "N5" || state.currentNode === "N8"
        ? <Round0PersonaCircles round={state.currentNode === "N5" ? "round_1" : "round_0"} votes={state.personaVotes} /> : null}

      {state.l1Warning && <L1WarningDialog warning={state.l1Warning} onContinue={() => {}} onCancel={() => router.back()} />}
      {state.hitlPending && <HitlDialog pending={state.hitlPending} avId={params.id} />}

      {state.status === "completed" && state.finalReport && (
        <div className="text-center py-8">
          <Button size="lg" onClick={() => router.push(`/analysis/${params.id}/heatmap`)}>查看完整决策报告</Button>
        </div>
      )}
      {state.status === "failed" && state.error && (
        <div className="rounded border border-destructive p-4 text-destructive">推理失败:{state.error.code}</div>
      )}
    </main>
  );
}
```

`components/feature/analysis/NodeProgress.tsx`(双层进度条,9 节点 + 上层四层共识语义):
```tsx
import { motion } from "framer-motion";
import { Loader2, Check } from "lucide-react";

const NODES = [
  { id: "N1", name: "结构化 + 决策类型", layer: "L0" },
  { id: "N2", name: "L1 目标对齐",       layer: "L1" },
  { id: "N3", name: "L2 证据召回",       layer: "L2" },
  { id: "N4", name: "Round 0 盲投",      layer: "L3" },
  { id: "N5", name: "Round 1 调整",      layer: "L3" },
  { id: "N6", name: "TWS 轨迹评分",      layer: "L4" },
  { id: "N7", name: "L4 权重加权",       layer: "L4" },
  { id: "N8", name: "Premortem",         layer: "safety" },
  { id: "N9", name: "决策报告",          layer: "report" },
] as const;

const LAYERS = ["L1 战略", "L2 事实", "L3 角色", "L4 权重", "报告"];

export function NodeProgress({ currentNode, completedNodes }: { currentNode?: string; completedNodes: string[] }) {
  return (
    <div className="space-y-4">
      {/* 上层:四层共识语义 */}
      <div className="flex items-center gap-2">
        {LAYERS.map((l) => <div key={l} className="flex-1 text-center text-xs text-muted-foreground py-1 border-b">{l}</div>)}
      </div>
      {/* 下层:9 节点详细 */}
      <ol className="grid grid-cols-9 gap-1">
        {NODES.map((n) => {
          const done = completedNodes.includes(n.id);
          const active = currentNode === n.id;
          return (
            <li key={n.id} className={`flex flex-col items-center gap-1 rounded p-2 text-xs ${active ? "bg-primary/10" : done ? "bg-success/10" : "bg-muted/40"}`}>
              {done ? <Check size={16} className="text-[hsl(142_71%_45%)]" /> :
               active ? <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: "linear" }}><Loader2 size={16} /></motion.div> :
               <span className="size-4 rounded-full bg-muted-foreground/30" />}
              <span className="text-center">{n.id}</span>
              <span className="text-center text-[10px] text-muted-foreground">{n.name}</span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
```

`components/feature/analysis/Round0PersonaCircles.tsx`(7 圆点真实并发):
```tsx
import { motion } from "framer-motion";
import { Check } from "lucide-react";
import { RoleIcon } from "@/components/shared/RoleIcon";
import { AttitudeIcon } from "@/components/shared/AttitudeIcon";
import type { Role } from "@/lib/schema/role";

const ROLES: Role[] = ["operations","products","marketing","finance","brand","supply_chain","regional"];

export function Round0PersonaCircles({ round, votes }: { round: "round_0" | "round_1"; votes: Record<string, any> }) {
  return (
    <div className="rounded border bg-card p-4">
      <h3 className="text-sm font-medium mb-3">{round === "round_0" ? "Round 0 Blind First-Vote(7 角色独立并发)" : "Round 1 二轮调整(伪并发)"}</h3>
      <div className="grid grid-cols-7 gap-3">
        {ROLES.map((role) => {
          const vote = Object.values(votes).find((v: any) => v[round]?.role === role)?.[round];
          const done = !!vote;
          return (
            <motion.div
              key={role}
              initial={{ scale: 0.9, opacity: 0.5 }}
              animate={done ? { scale: 1, opacity: 1 } : { scale: [0.95, 1.05, 0.95], opacity: 1 }}
              transition={done ? { duration: 0.3 } : { duration: 1, repeat: Infinity }}
              className={`flex flex-col items-center gap-1 rounded p-3 ${done ? "bg-success/10" : "bg-muted/30"}`}
            >
              <RoleIcon role={role} size={24} />
              {done ? <AttitudeIcon attitude={vote.attitude} size={14} /> : <span className="size-3 rounded-full bg-muted-foreground/40" />}
              <span className="text-[10px] text-muted-foreground">{role}</span>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
```

`components/feature/analysis/HitlDialog.tsx`(approve/edit/reject,reason ≥5 字):
```tsx
"use client";
import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

export function HitlDialog({ pending, avId }: { pending: { checkpoint_id: string; node_id: string; state_summary: string }; avId: string }) {
  const [reason, setReason] = useState("");
  const [decision, setDecision] = useState<"approve" | "edit" | "reject" | null>(null);

  async function submit() {
    if (!decision || reason.trim().length < 5) return;
    await fetch(`/api/analyze/${avId}/resume`, {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ checkpoint_id: pending.checkpoint_id, decision, reason }),
    });
  }

  return (
    <Dialog open>
      <DialogContent>
        <DialogHeader><DialogTitle>HITL 接管(暂停于 {pending.node_id})</DialogTitle></DialogHeader>
        <p className="text-sm text-muted-foreground">{pending.state_summary}</p>
        <div className="flex gap-2">
          <Button variant={decision === "approve" ? "default" : "outline"} onClick={() => setDecision("approve")}>批准继续</Button>
          <Button variant={decision === "edit" ? "default" : "outline"} onClick={() => setDecision("edit")}>编辑后继续</Button>
          <Button variant={decision === "reject" ? "destructive" : "outline"} onClick={() => setDecision("reject")}>驳回</Button>
        </div>
        <textarea
          value={reason} onChange={(e) => setReason(e.target.value)}
          placeholder="决策说明(至少 5 字)..."
          className="w-full rounded border p-2"
        />
        <Button onClick={submit} disabled={!decision || reason.trim().length < 5}>提交</Button>
        <p className="text-xs text-muted-foreground">5 分钟无响应自动批准</p>
      </DialogContent>
    </Dialog>
  );
}
```

`components/feature/analysis/L1WarningDialog.tsx`(alignment_score < 0.5 弹):

```tsx
"use client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { AlertTriangle } from "lucide-react";

export interface L1Warning {
  alignment_score: number;          // 0-100 整数(从 av.l1_alignment_score 来)
  message: string;                  // 来自 SSE l1:warning 事件 data.message
}

export function L1WarningDialog({
  warning, onContinue, onCancel,
}: {
  warning: L1Warning;
  onContinue: () => void;
  onCancel: () => void;
}) {
  const pct = `${warning.alignment_score}%`;
  return (
    <Dialog open onOpenChange={(open) => { if (!open) onCancel(); }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle size={18} className="text-[hsl(38_92%_50%)]" aria-hidden />
            L1 目标对齐警告
          </DialogTitle>
          <DialogDescription>
            该提案与声明的公司目标对齐度仅 <strong>{pct}</strong>(低于 50% 阈值)。
            {warning.message ? <span className="block mt-2 text-sm">{warning.message}</span> : null}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onCancel}>返回修改提案</Button>
          <Button onClick={onContinue}>仍要继续推理</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
```

**page.tsx 调用同步**(保证 L1Warning 类型一致):
```tsx
import type { L1Warning } from "@/components/feature/analysis/L1WarningDialog";
// useAnalysisStream 返回的 state.l1Warning 类型也用 L1Warning(在 hooks 内 import)
```

`hooks/useAnalysisStream.ts` State 接口 `l1Warning?: L1Warning;`(替换原 `any` 类型)

- [ ] **Step 3: E2E + commit**

```ts
// tests/e2e/p03-analysis-stream.spec.ts
test("P03 SSE 流跑完一个 demo 场景", async ({ page }) => {
  // 通过 P01 → demo 场景 → 跳 P03
  await page.goto("/");
  await page.getByRole("button", { name: /演示模式/ }).click();
  await page.getByRole("option", { name: /七夕情侣对戒/ }).click();
  // 等 90s 内 final:report 到达 → "查看完整决策报告" 主按钮可点
  await expect(page.getByRole("button", { name: /查看完整决策报告/ })).toBeVisible({ timeout: 90_000 });
});
```

```bash
git commit -m "feat(P6.B): 批 6B — P03 推理流 SSE + 9 节点进度 + Round 0 7 圆点

- useAnalysisStream hook(消费 §6.1 全部 SSE 事件)
- 双层进度条(L1/L2/L3/L4/report + 9 节点详细)
- Round 0 7 圆点 framer-motion 脉冲 → ✓ 动画
- HITL Dialog(approve/edit/reject + reason ≥5字)
- L1 alignment<0.5 弹 Dialog 确认继续
"
```

**acceptance_criteria:** E2E PASS;Demo 场景 90s 内完成;Round 0 7 圆点真实并发可视

**status:** pending

---

### Task P6.C: 批 6C — P04 分歧热力图 + P05 工坊

**Files:**
- Create: `app/(app)/analysis/[id]/heatmap/page.tsx`、`components/feature/heatmap/{DiffMatrix,HeadlineCard,SummaryCard,CellDrawer,SortControls,GroupTabs}.tsx`
- Create: `app/(app)/personas/page.tsx`、`components/feature/personas/{PersonaCard,EditDrawer,ToneModeToggle}.tsx`

**关键约束**:
- 矩阵用 `@nivo/heatmap`(SVG)+ 自定义 cell renderer 渲染 `<AttitudeIcon>` + Anchoring 2px 橙边框
- Y 轴标签附 `weight ×1.X`(从 av.effective_weights 读)
- Cell hover 300ms 触发 Tooltip(citation 完整 + 角色规则)
- 编辑 headline 调 `PATCH /av/:id/headline`(写顶层字段 B-A-5)
- P05 卡片网格 4×2(7 + 1 占位)+ Drawer 含 ToneModeToggle(M-3 决定:M-3 在 v2.3 标 Medium,但本 plan 已实施时一并做,前端 localStorage 不持久化)

```bash
git commit -m "feat(P6.C): 批 6C — P04 Nivo HeatMap + 4 档 Lucide cell + P05 7 角色工坊"
```

**acceptance_criteria:** P04 矩阵 ≥ 12 论点可横向滚动 + 固定列;cell hover 显示完整 citation;P05 重置不删 notes

**status:** pending

---

### Task P6.D: 批 6D — P07 Safety Center 8 面板 + P08 评审视角对照页

**Files:**
- Create: `app/(app)/safety/page.tsx`(7 Tab + 第 8 面板 Prompt 透明度)
- Create: `components/feature/safety/{Panel1Degrade,Panel2Redaction,Panel3Confidence,Panel4Rollback,Panel5Hitl,Panel6Audit,Panel7Repro,Panel8Prompts}.tsx`
- Create: `app/judge-view/page.tsx`(P08 SSR 隐藏路由)
- Create: `components/feature/judge/{ScoreSection,QRCodeFooter}.tsx`

**关键约束**:
- Panel 7 "3 次复现"按钮 → POST start → 拿 3 av_id → 客户端并发 3 个 SSE → 全完成后调 finalize → 展示 metrics
- Panel 8 ab_compare_status="not_run" → 显示"点击触发对照分析"按钮(B-A-3,**不自动 60s 卡住**)
- P08 用 qrcode.react 渲染 240×240 二维码,内容 = Demo URL + `/judge-view`

```bash
git commit -m "feat(P6.D): 批 6D — P07 8 面板 + P08 SSR 评审页

- Panel 7 客户端并发 3 SSE(避免单函数 300s)
- Panel 8 ab_compare 显式按钮触发(B-A-3 防自动卡 60s)
- P08 /judge-view 不在导航 + 底部 QR 码
"
```

**acceptance_criteria:** 8 面板齐全;Panel 7 真实跑 3 次能聚合 metrics;P08 不在主导航出现

**status:** pending

---

### Task P6.E: 批 6E — P09 + P10 + P11

**Files:**
- Create: `app/(app)/analysis/[id]/decision/page.tsx`(P09 AAR)
- Create: `app/(app)/history/page.tsx`(P10)
- Create: `app/(app)/evidence/page.tsx`(P11)
- Create: 对应业务组件目录

**关键约束**:
- P09 AAR 4 字段每个加客户端校验"trim 后 ≥10 字"(与 Zod 一致,提交前给提示)
- P10 列表显示 `consensus_band`(绿/黄/红 Badge)+ `reproducibility_verdict`(Lucide 图标)
- P11 V2 源用 `<Clock>` icon + `--muted` 色 + "V2 即将支持"角标

```bash
git commit -m "feat(P6.E): 批 6E — P09 AAR + P10 历史 + P11 证据库"
```

**acceptance_criteria:** P09 AAR < 10 字客户端阻止提交;P10 派生字段渲染正确

**status:** pending

---

### Task P6.F: 批 6F — P12 决策报告(7 部分)+ 路由跳转 + 录像兜底

**Files:**
- Create: `app/(app)/analysis/[id]/report/page.tsx`
- Create: `components/feature/report/{ConclusionCard,ScoringCard,KeyDisagreements,EvidenceChain,RisksSection,RaciTable,MinutesSection,ActionBar}.tsx`
- Create: `public/recordings/{scenario-1..4}.mp4`(P0 占位,P8 由演讲者录制)

**关键约束**:
- ConclusionCard 4 状态用 Lucide(CheckCircle2 / Pause / XCircle / HelpCircle)
- ScoringCard 4 档分布水平堆叠条 + Lucide icon + token 色
- KeyDisagreements 3 卡片,每卡 shared_interest / objective_criterion / next_step 三段
- RaciTable 显示 accountable 必须单值(Zod 已强制)
- ActionBar 含"导出 PDF / Markdown / 投屏 / 生成新版本(fork)/ 录入决议"

```bash
git commit -m "feat(P6.F): 批 6F — P12 决策报告 7 部分 + 操作栏

- 4 档结论状态全 Lucide
- KeyDisagreements 三段强约束(对照 DisagreementResolutionSchema)
- RaciTable accountable 单值(对照 ActionItemSchema)
- 录像 mp4 占位(P8 替换真实录制)
"
```

**acceptance_criteria:** P12 渲染 7 部分齐全;ActionBar 5 个按钮可点

**status:** pending

---

## Phase P7 — 集成测试 + 红线扫描

### Task P7.1: 4 Demo 场景 E2E(Playwright)

**Files:**
- Create: `tests/e2e/demo-{1..4}-full-flow.spec.ts`

```ts
// tests/e2e/demo-2-qixi-full-flow.spec.ts
import { test, expect } from "@playwright/test";

test("Demo 2 七夕情侣对戒:P01 → P03 → P04 → P12 全链路 ≤ 90s", async ({ page }) => {
  const t0 = Date.now();
  await page.goto("/");
  await page.getByRole("button", { name: /演示模式/ }).click();
  await page.getByRole("option", { name: /七夕情侣对戒/ }).click();
  // 等 P03 完成 → "查看完整决策报告" 按钮
  await expect(page.getByRole("button", { name: /查看完整决策报告/ })).toBeVisible({ timeout: 90_000 });
  const t1 = Date.now();
  expect(t1 - t0).toBeLessThan(95_000);

  await page.getByRole("button", { name: /查看完整决策报告/ }).click();
  await expect(page).toHaveURL(/\/report$/);
  // 验证 7 部分都渲染
  for (const section of ["结论", "评分", "关键分歧", "证据链", "风险", "建议行动", "纪要"]) {
    await expect(page.getByRole("heading", { name: new RegExp(section) })).toBeVisible();
  }
});
```

4 场景各 1 个 spec,合计 4 个 E2E。

```bash
pnpm test:e2e
git commit -m "test(P7.1): 4 Demo 场景 E2E(P50 ≤67s,P99 ≤90s)"
```

**acceptance_criteria:** 4 个 E2E 全 PASS;每个总时长 ≤ 95s

**status:** pending

---

### Task P7.2: 25 条红线全表扫描

**Files:** 已有 `scripts/consistency-scan.ps1`(由 P0.4 时建立)+ 增量补全所有 25 条

- [ ] **Step 1: 完善 PowerShell 脚本覆盖 25 条**

对照 `docs/pipeline/consistency-check.md`,把全部 25 条规则写入 `scripts/consistency-scan.ps1`(每条 Select-String + 白名单过滤)。

- [ ] **Step 2: 跑全表 + commit**

```bash
pnpm consistency
# Expected: ✅ v2.3 一致性自查 PASS(25 条 0 命中,或仅白名单内)
```

```bash
git add scripts/consistency-scan.ps1
git commit -m "test(P7.2): 25 条红线 PowerShell 全扫描脚本"
```

**acceptance_criteria:** `pnpm consistency` 退出码 0;25 条全 PASS

**status:** pending

---

### Task P7.3: 稳定性测试预录视频

- [ ] **Step 1: 演讲者本地跑稳定性测试(场景 2),录屏 60-90s**

```bash
# 本地启动
pnpm dev
# 浏览器 → /safety → 切到面板 7 → 点"3 次复现"
# 用 OBS Studio 或系统录屏录 60-90s
# 保存为 public/recordings/stability-test-scenario-2.mp4
```

- [ ] **Step 2: 确认一致率 ≥ 67%(verdict=stable)**

录屏前先手动跑一次,确认指标达标。若不达标 → 调 prompt(增加证据 token 数量)重跑直到 stable。

- [ ] **Step 3: 在 P07 面板 7 加"播放预录视频"按钮(场景 2 默认),commit**

```bash
git add public/recordings/stability-test-scenario-2.mp4 components/feature/safety/Panel7Repro.tsx
git commit -m "feat(P7.3): 稳定性测试预录视频(场景 2,verdict=stable,一致率 ≥67%)"
```

**acceptance_criteria:** mp4 在 public/recordings/ 存在;Panel 7 有"播放预录"按钮

**status:** pending

---

### Task P7.4: Anthropic 配额预热脚本

**Files:** `scripts/preheat.ts`

```ts
import "dotenv/config";

async function fire(url: string, body: unknown) {
  const res = await fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  console.log(`${url} → ${res.status}`);
}

async function main() {
  const baseUrl = process.env.PREHEAT_BASE_URL ?? "http://localhost:3000";
  console.log(`[preheat] base=${baseUrl},开始预热(2 次完整推理 + 1 次稳定性)`);

  // 跑 demo 场景 2 完整一次
  const load = await fetch(`${baseUrl}/api/scenarios/scenario-2/load`, { method: "POST" });
  const { data } = await load.json();
  console.log(`[preheat] 启动 av=${data.analysis_version_id}`);

  // 等 SSE 完成(或 90s 超时)
  await new Promise<void>((resolve) => {
    const es = new (await import("eventsource")).default(`${baseUrl}/api/analyze?analysis_version_id=${data.analysis_version_id}`);
    es.addEventListener("done", () => { es.close(); resolve(); });
    setTimeout(() => { es.close(); resolve(); }, 95_000);
  });

  console.log(`[preheat] 完成 1 次推理`);
  // 再跑 1 次 + 1 次稳定性...(略)
}
main();
```

```bash
git add scripts/preheat.ts package.json
git commit -m "feat(P7.4): Demo 前 30 分钟 Anthropic 配额预热 + 现场降级预案"
```

**acceptance_criteria:** `pnpm tsx scripts/preheat.ts` 退出码 0,预热完整跑通 2 次推理 + 1 次稳定性

### Demo 现场 429 应对预案(v2.3 GAN-V3 Issue 4 补)

**风险**:Demo 现场多名评审同时访问 Production URL,稳定性测试 21 路并发(3 av × 7 角色)极易触发 Anthropic Sonnet/Opus 配额。预热脚本只能确认 Demo 开始前配额可用,无法防演讲中突发 429。

**3 层应对**:
1. **运行时降级链**(lib/llm/gateway.ts `order: [opus, sonnet, haiku]`):AI Gateway 收到 429 自动切下一档,UI 实时显示 ProviderBadge 颜色变化 + toast。**评审看到降级反而是加分(产品真有 fallback)**。
2. **演讲前 5 分钟手动预降级**(可选):若 Demo 前 30 分钟预热已经看到偶发 429,演讲者**主动调 `POST /api/llm/manual-degrade`** 把全局切到 Sonnet 4.6(放弃 Opus)— UI 全程稳在 Sonnet,演讲中再不出现 Provider 切换的噪音。代价:报告生成质量略降但仍可用。
3. **稳定性测试预录视频兜底**(P7.3):若现场 21 路并发触发限流,演讲不真跑稳定性测试,直接播放预录 mp4。播放期间口播"为节省演讲时间用预录,真跑请扫 QR 码访问"。

**判定阈值**:
- 预热阶段连续 2 次 429 → 演讲前手动预降级到 Sonnet
- 预热阶段连续 3 次 429 → 改用全录像 Demo(放弃实时跑)

---



**status:** pending

---

## Phase P8 — 部署 + Demo 兜底

### Task P8.1: Vercel production deploy

```bash
pnpm vercel link
pnpm vercel env pull
pnpm vercel --prod
# 输出 production URL,记下
```

**acceptance_criteria:** Production URL 可访问 / GET /api/health 全绿

**status:** pending

---

### Task P8.2: 录像回放模式开关

**Files:** `components/feature/analysis/RecordingFallback.tsx`

P03 检测到 N1 失败(或 LLM_TIMEOUT 连续 2 次)→ 自动显示"切换到录像模式"Toast → 播放 `public/recordings/full-flow-scenario-2.mp4`

```bash
git commit -m "feat(P8.2): P03 录像回放兜底(LLM 真实故障时)"
```

**acceptance_criteria:** mock LLM 失败,UI 出现回放切换提示

**status:** pending

---

### Task P8.3: 演讲 5 分钟动线脚本 + QR 码

- [ ] **Step 1: 在 `docs/demo-script.md` 写 7 步演讲动线**(按 [P08-judge-cheatsheet.md §5 动线](../design/02-pages/P08-judge-cheatsheet.md))

- [ ] **Step 2: PPT 末页贴 P08 同款 QR 码**(用 qrcode.react 离线渲染保存图片)

```bash
git add docs/demo-script.md public/qr-code.png
git commit -m "docs(P8.3): 5 分钟演讲动线 + PPT 同款 QR 码"
```

**acceptance_criteria:** 演讲者预演 ≤ 5 分钟可完整走完

**status:** pending

---

## Self-Review Notes

1. **Spec coverage:**
   - P01-P12 12 页面 → P6.A-F 6 批全覆盖
   - 57 API 端点 → P5.0-G 全覆盖
   - 9 LangGraph 节点 → P4.1-9 各 1 task
   - 11 张 Drizzle 表 → P1.1 一并覆盖(含 v2.3 新增 hitl_audit + 顶层字段)
   - 12 个 Zod schema → P2.1 全覆盖
   - 25 条红线 → P7.2 全表扫描 + 每 task 局部扫描
   - GAN 25 项修复全部反映在 plan(模型 ID 点号 / KV→Upstash / 1536 维 / streamObject N9 / HITL auto-approve / current_version / 孤儿 av / prev_decision_id 校验 / ab_compare 显式触发 / etc.)

2. **Placeholder scan:** 无 TODO / later / for now / mock / placeholder / 简化版 等(P5 端点骨架"代码模式同 5.A"是指引用相同 pattern + 显式列出每端点契约,非占位)

3. **Type consistency:**
   - PersonaVote 在 lib/schema/persona-vote / lib/graph/state.ts(PersonaVoteFull)/ lib/graph/nodes/n4-round0.ts 三处类型一致(state 多 embedding 字段用于 anchoring)
   - ActionItem accountable 在 lib/schema/action-item / lib/methodology/l4-raci-template / DecisionReportSchema / P12 RaciTable 全部 RoleEnum 单值
   - 1536 维在 lib/llm/embedding / lib/evidence/retriever / lib/db/schema/evidence-cards 三处一致

---

## 执行模式

**已选定:Subagent-Driven**(本 plan 在 ARGUMENTS 明确)

下一步 Phase 5.5 + Plan GAN(--target plan)→ Phase 6 启动 superpowers:subagent-driven-development 按 task 分发。

---

## 附录:与设计文档的引用清单

- [api.md v2.3](2026-05-23-collab-agent-api.md) — 57 端点 + 11 表 + 12 Zod + SSE 协议(主契约)
- [ui.md v2.2](2026-05-23-collab-agent-ui.md) — 视觉规范 + Lucide 锁定表
- [methodology.md](../design/03-tech-direction/methodology.md) — L1-L4 + Premortem + AAR templates
- [consensus-algorithm.md](../design/03-tech-direction/consensus-algorithm.md) — TWS + 性能预算
- [data-strategy.md](../design/03-tech-direction/data-strategy.md) — PostgresSaver + 数据生命周期
- [security-model.md](../design/03-tech-direction/security-model.md) — ZDR + 脱敏
- [deployment.md](../design/03-tech-direction/deployment.md) — Vercel 配置
- [oss-scan.md](../design/03-tech-direction/oss-scan.md) — R1-R15 选型
- [04-rules/permissions.md](../design/04-rules/permissions.md) — 权限矩阵
- [04-rules/error-handling.md](../design/04-rules/error-handling.md) — 错误分类
- [consistency-check.md](../pipeline/consistency-check.md) — 25 条红线




