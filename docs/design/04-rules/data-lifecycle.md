# 数据的生老病死

> 数据什么时候被创建、什么时候被改、什么时候被删、什么时候过期。

## 各类数据的生命周期

| 数据类型 | 什么时候创建 | 什么时候更新 | 什么时候删 / 过期 |
| --- | --- | --- | --- |
| Persona 元数据 | 系统初始化(6 个内置)/ 管理员新增 | P05 编辑保存 | 不删(只能"重置为默认值") |
| Persona 备注 | 决议回写(P09 提交) | append-only | 不删 |
| Proposal | P02 提交 | 标题/原文可改(改后产生新 analysis_version) | 软删(`deleted_at`),保留 90 天 |
| Analysis Version | 每次推理 / HITL 编辑 / 回滚 | **immutable**,从不改 | 永不删(审计要求) |
| Decision | P09 提交 | **immutable** | 永不删 |
| Audit Log | 任何写操作 | append-only | 永不删 |
| LangGraph Checkpoint | 推理过程中(每个 super-step) | append | 推理完成 7 天后清理(节省空间) |
| 草稿(localStorage) | 用户在 P02 输入 | 每 10 秒自动 | 提交后清除 / 7 天未提交清除 |
| 脱敏映射表(浏览器内存) | 提案提交时建立 | 不变 | 关闭浏览器 tab 即丢失 |

## 删除规则(详)

### 软删除

- 用户在 P10 历史页"删除提案" → 设置 `deleted_at = now()`
- 90 天内可恢复 → 显示在"已删除"分区
- 90 天后**真实删除**:proposal + 所有关联 analysis_version + decision

### 真实删除豁免

下列数据**永不删除**(即使提案被真删):
- 审计日志(仅按 proposal_id 标记 `referenced_proposal_deleted=true`)
- 已影响过 Persona 备注的决议记录(因为 Persona 中已嵌入)

## 数据迁移路径(赛后)

- Demo → 生产:Neon Postgres 直接迁移(同一引擎),仅需切换连接串
- 数据版本字段:所有表都有 `schema_version` 字段,便于未来 schema 演进时识别旧数据

## ❓ 需你拍板

- 软删保留期 90 天是否合适 — 选项:30 天 / 90 天 / 180 天 / 永不真删 — 影响:数据库成本 vs 合规要求
