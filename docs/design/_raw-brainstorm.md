# 议见(YiJian)— 设计草稿(审计存档)

> 本文件是 Phase 2 brainstorming 的原始草稿,正式设计已拆分到本目录其他文件。
> 保留此文件用于审计 brainstorming 思考过程。

## 能力—组件映射表

| 能力 | 决策 | 主责组件 | 复用方案 |
| --- | --- | --- | --- |
| R1 提案解构 | 复用 | `lib/llm/extract-proposal.ts` | AI SDK `generateObject` + Zod |
| R2 Persona 管理 | 自研 | `lib/db/persona.ts` + `app/personas/*` | Drizzle ORM |
| R3 多 Agent 推理 | 复用 | `lib/graph/perspective-graph.ts` | LangGraph.js 0.4 |
| R4 分歧可视化 | 复用 | `components/diff-heatmap.tsx` | Nivo HeatMap + Tremor |
| R5 议程生成 | 自研 | `lib/llm/agenda.ts` | prompt + AI SDK |
| R6 决议沉淀 | 自研 | `lib/db/decision.ts` | Drizzle |
| R7 LLM 编排 | 复用 | `lib/llm/gateway.ts` | Vercel AI Gateway |
| R8 数据脱敏 | 自研 + LLM 兜底 | `lib/security/redact.ts` | 正则 + Haiku zero-shot |
| R9 可溯源 | 自研(schema) | 强制 schema 字段 | Zod `citation` |
| R10 HITL/回滚 | 复用 | LangGraph `interrupt()` + checkpointer | LangGraph 内建 |
| R11 压缩护栏 | 自研 prompt | system prompt + Zod 校验 | — |

## 架构整体形态

```
┌─────────────────────────────────────────────────────┐
│  Next.js 15 App Router (Vercel Fluid Compute)       │
│  ┌──────────────┐    ┌──────────────────────────┐  │
│  │  UI (React)  │←──→│ Route Handlers (API)      │  │
│  │  shadcn/ui   │    │                           │  │
│  │  Nivo/Tremor │    │  ┌─────────────────────┐  │  │
│  │  framer-motion│   │  │ LangGraph.js 0.4    │  │  │
│  └──────────────┘    │  │ ┌──────┬──────┐    │  │  │
│                       │  │ │ R1   │ R3   │    │  │  │
│                       │  │ │解构  │多角色│    │  │  │
│                       │  │ ├──────┼──────┤    │  │  │
│                       │  │ │ R5   │ R10  │    │  │  │
│                       │  │ │议程  │HITL  │    │  │  │
│                       │  │ └──────┴──────┘    │  │  │
│                       │  └─────────┬───────────┘  │  │
│                       │            │              │  │
│                       │            ↓              │  │
│                       │  ┌─────────────────────┐  │  │
│                       │  │ AI SDK v6 + Gateway │  │  │
│                       │  │ Opus→Sonnet→Haiku   │  │  │
│                       │  │     →offline rules   │  │  │
│                       │  └─────────────────────┘  │  │
│                       └──────────────────────────┘  │
│                                                       │
│  ┌──────────────────────────────────────────────┐   │
│  │ Drizzle ORM ──→ Neon Postgres                │   │
│  │  - persona / proposal / analysis / decision  │   │
│  └──────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────┘
```

## 部署形态

- 主体:Vercel(Next.js + Fluid Compute,300s 默认 timeout 够长链推理)
- 数据库:Neon Postgres(Vercel Marketplace 一键集成)
- LLM:AI Gateway(`anthropic/claude-opus-4-7` 字符串路由)
- 监控:Vercel Logs + 自建审计表

## 关键技术决策

1. **不上 Python LangGraph,用 TS 版** — Next.js 同进程,无跨语言部署成本
2. **不自托管 LLM** — 黑客松场景下 AI Gateway 已足够,且 Provider failover 内建
3. **不用 Yjs 实时协作(P0)** — Phase 1 写在 V2,Yjs 学习成本会挤压 P0 时间
4. **SQLite 备选** — Demo 时若 Neon 网络异常,可降级到 `better-sqlite3`(文件级)

## ❓ 未决产品决策(已汇总到 README.md)

见 `README.md`。
