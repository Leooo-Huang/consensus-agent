# 数据策略

> 数据存哪、怎么版本控制、怎么不丢、敏感数据怎么不泄。

## 数据存在哪

| 数据类型 | 存在哪 | 为什么 |
| --- | --- | --- |
| Persona(角色元数据 + 备注,v2.1 含 interest_boundary + natural_conflicts) | Neon Postgres | 多会话复用,版本可追 |
| Proposal(提案原文 + 元数据,**v2 + decision_type + declared_objective_id**) | Neon Postgres | 历史可查,审计要求 |
| Analysis Version(单次推理产出快照) | Neon Postgres | 版本回滚必需(R10) |
| Decision(决议记录,**v2 + aar_template_data**) | Neon Postgres | append-only 审计要求 |
| Audit Log(审计日志) | Neon Postgres | 不可篡改 + SHA-256 hash |
| LangGraph Checkpoint(推理中间状态) | Neon Postgres(**`PostgresSaver` + WebSocket driver**,4 张表自动 setup;v2.3 GAN-B 修:原 `AsyncPostgresSaver` 名称不准确)| HITL 暂停后必须可恢复;详见 [api.md §2.3.8](../../plans/2026-05-23-collab-agent-api.md) + §8.2 混合连接 |
| **🆕 internal_objectives(公司级目标库,v2)** | **Neon Postgres** | L1 战略对齐,系统级共享 |
| **🆕 evidence_sources(证据源,v2)** | **Neon Postgres** | 注册的内外部数据源 |
| **🆕 evidence_cards(证据卡片,v2)** | **Neon Postgres + embedding 字段** | L2 事实共识基础;V2 上 pgvector |
| **🆕 reproducibility_runs(稳定复现测试结果,v2)** | **Neon Postgres** | 同提案 N 次复现的对比指标 |
| Demo Fixture(4 场景预置数据 + 区域管理差异化观点) | 仓库内 JSON 文件 | 静态资源,启动时一次性加载内存 |
| 证据池索引(P0) | **进程内存(in-memory JSON + cosine)** | < 200 条直接遍历,< 5ms;Vercel Serverless 无持久化(GAN-B Block-3 修) |
| 数据脱敏映射表 | **浏览器内存(不持久化)** | 防泄漏,仅本会话有效 |
| 提案草稿(未提交) | localStorage(浏览器) | 防意外丢失 + 隐私 |
| 演示模式的录像回放(v2.1 含稳定性测试预录视频) | 仓库内 mp4/webm | 演讲不卡壳 |

### v2 新增 4 张表 schema 概览(完整 schema 在 Phase 4 API 设计)

```typescript
// internal_objectives
{ id, name, description, key_results: string[], year, quarter, owner, active, created_at }

// evidence_sources
{ id, type: 'internal'|'external', name, url?, owner, status: 'active'|'pending_v2', created_at }

// evidence_cards
{ id, source_id, title, snippet, full_content, embedding: vector(384), tags: string[],
  cited_count, created_at }

// reproducibility_runs
{ id, proposal_id, run_count: 3, temperatures: number[], seeds: number[],
  conclusion_consistency_pct, top3_jaccard, evidence_overlap_pct,
  verdict: 'stable'|'unstable', created_at }
```

## 数据是什么时候更新的

**append-only(不可改写)**:
- Analysis Version(每次重跑生成新版本,旧版保留)
- Decision(决议永不修改,但可链式补充)
- Audit Log(所有写操作)

**可改写**:
- Persona 元数据(用户在 P05 编辑)
- 提案草稿(用户编辑中)

**追加式更新**(改但记录历史):
- Persona 的"备注"字段(决议回写时 append,旧条目保留)

## 版本与回滚

每个 Proposal 下有多个 `analysis_version`:
- v1.0 → 首次推理
- v1.1 → 用户重跑
- v1.2 → HITL 编辑后继续
- v1.3 → 用户回滚到 v1.1 → 生成新版本 v1.3 内容指向 v1.1

**回滚永远 append,从不删** — 这是 R10 输出可靠度护栏的关键。

## 敏感数据保护

- 提案中识别的敏感字段(供应商名/客户名/价格/SKU 成本)→ 进入 LLM 前**替换为占位符**(R8)
- 还原映射表**仅存浏览器内存** → 关闭页面即丢失,服务端永不接触原值
- 持久化的提案文本是**脱敏后版本** → 数据库永不存原始敏感字段
- LLM 调用配置 **`zdr=true`**(Vercel AI Gateway 支持),确保 Provider 不留训练痕迹

## 多设备同步

- **不做实时同步**(无 Yjs)→ 同一提案被多人同时编辑 → **后写赢** + 显示"最近修改人 + 时间"
- 用户在不同设备打开同一提案 → 看到最新已保存版本(通过 Postgres 单一数据源)

## 备份与灾备

- Neon 自带 PITR(point-in-time recovery)→ 7 天回溯免费
- 仓库 + Vercel + Neon 三方共同构成"代码 + 数据"备份
- 黑客松场景**不做异地备份**(超出范围)

## ❓ 需你拍板

无 — 数据策略以"append-only + 浏览器内存敏感数据"为核心,符合企业 X 数据安全需求。
