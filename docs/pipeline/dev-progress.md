# Phase 6 开发进度

> 正常 autodev 模式(subagent-driven-development),每 task implementer + controller 客观复验。
> 更新时间:2026-05-23

## ✅ 已完成(7 task,全部 commit + push)

| Task | 内容 | 验证 | commit |
|---|---|---|---|
| P0.1 | Next.js 15 脚手架 + 锁定依赖 + Tailwind 4.3 | tsc 0 + build 4/4 静态页 | 1df7f2a |
| P0.2 | vercel.ts(@vercel/config)+ .env.example + check-env | check-env 双向退出码 + 红线 0 | 22fc178 |
| P2.1 | 12 个 Zod schema | 28 测试 | a7696c3 |
| P1.1 | 11 张 Drizzle schema + migration SQL | 10 测试 + db:generate 11 表 | 1d673f3 |
| P3.1 | lib/consensus(TWS w0=0.6/w1=0.4 + Anchoring + Weight) | 18 测试 | b7506a3 |
| P3.2 | lib/methodology(5 P0 方法论 + L2 + P0_OBJECTIVES) | 12 测试 | 0422145 |
| P3.3 | lib/evidence(in-memory cosine retriever + citation-builder) | 7 测试 | 1d6af91 |

**全量测试:75/75 PASS · tsc 0 错 · 红线 emoji 0**

## ⚠️ 待处理的关键发现(P4 前必须解决)

1. **`lib/db/index.ts` import 即崩**(P3.3 发现):`neon(process.env.NEON_DATABASE_URL ?? "placeholder")` 在模块 import 时即校验连接串,占位串被拒。**P4 节点 import db 会崩**。
   - **修法**:改懒初始化 — `export const db = ...` 改为 `let _db; export function getDb() { _db ??= drizzle(neon(env)); return _db; }`,或用 Proxy 延迟。在 P4.0 前的小修 task 处理。
2. **`buildCitations` 的 persona_rule 约定**(P3.3 发现):`persona_rule` 类型 citation 的 source_id 来自 personas 而非召回集。P4 节点接入时,调用方须把 persona id 一并放进 recalledIds,否则被误判幻觉。

## ⏳ 剩余 env 无关 task(可继续,无需等 env)

- **P4.0** GraphState 类型(纯 TS)
- **P4.1-9** 9 节点代码 + vi.mock LLM 单测(mock 不依赖真 env)
- **P4.10** 主图组装 + **P4.11** SSE emitter
- **P0.5** middleware + ratelimit 内存兜底单测
- **P6.0** 共享 UI 组件(AttitudeIcon/RoleIcon/Lucide + scan:emoji 脚本)
- **P7.2** 红线扫描 PowerShell 脚本(25 条)

## ⛔ env 依赖 task(等用户配 .env.local — 见 user-blockers.md)

- P0.3 数据连接验证 / P0.4 AI Gateway / P1.1-migrate / P1.2-seed / P1.3 LangGraph setup
- P4.spike(LangGraph 真跑验证)/ P5.* 全部端点集成测试 / P6.A-F 页面 E2E / P7.* / P8.*

## 用户 env 配置状态

用户确认会配。配好 `.env.local`(5 个 env)后告知,即可解锁 ~55 个 env 依赖 task。
