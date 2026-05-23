# 安全模型(v2)

> 🔥 **v2 升级**:加入证据引擎和 IM bot 后,数据接入面变大,安全模型需要扩展。


> 谁能看到什么、怎么验证身份、敏感数据怎么保护、LLM 调用怎么不留痕。

## 谁能看到什么

> 黑客松 P0 阶段:**不做账号系统**,所有人可见所有数据(单租户演示模式)。
> 下表是**赛后产品化的目标安全模型**,P08 评审视角对照页提及作为 V2 规划。

| 角色 | 能看到 | 不能看到 |
| --- | --- | --- |
| 提案人 | 自己提案的全部 / 公开提案的摘要 | 别人私有提案 / 完整审计日志 |
| 评审人(被分配 Owner) | 分配给自己的待回答清单 + 该提案的讨论框架 | 其他无关提案 |
| 决策者(总监) | 本部门所有提案 + 全局共识度统计 | — |
| 管理员 / 合规 | 全部 + 审计日志全表 | — |
| Agent(LLM) | 脱敏后的提案文本 + Persona 配置 | 原始敏感字段 / 用户身份信息 |

## 身份验证(P0 vs V2)

- **P0 阶段**:无登录,匿名访问(Demo 模式)
- **V2 阶段**:**Sign in with Vercel** OAuth(直接复用 Vercel 提供的 OAuth,免实现密码逻辑)

## 敏感数据怎么保护

### 三层防护

1. **入口层**:提案输入时正则白名单检测敏感字段(供应商名/手机/邮箱/价格范围/SKU 成本)→ 替换为占位符
2. **AI 层**:Haiku 4.5 zero-shot 兜底检测正则没捕到的敏感词
3. **LLM 调用层**:Vercel AI Gateway 配 `providerOptions.gateway.zeroDataRetention=true` → 强制 ZDR(仅路由到与 Vercel 有 ZDR 协议的 Provider,Anthropic / OpenAI / Google 已支持)
   - **官方文档**:[Vercel ZDR on AI Gateway](https://vercel.com/docs/ai-gateway/capabilities/zdr)、[Disallow Prompt Training](https://vercel.com/docs/ai-gateway/capabilities/disallow-prompt-training)
   - **变更说明(v2.1 GAN-B 修)**:原文档误写为 `allowProviderRetention=false`,实际 Vercel AI SDK v5.0(`ai@5.0.0`) API 是 `zeroDataRetention: true`(2026-04 起 GA)。可同时配 `disallowPromptTraining: true` 防止提案被 Provider 用于训练
   - **Team 级 vs 请求级**:可在 AI Gateway Dashboard Settings 全局开启 ZDR,所有请求自动路由 ZDR 兼容 Provider;也可按请求级 `providerOptions` 控制

### 占位符语义

| 原值类型 | 占位符 |
| --- | --- |
| 供应商名 | `[供应商_001]` |
| 客户名 | `[客户_001]` |
| 邮箱/手机 | `[邮箱]` / `[手机]` |
| 价格区间 | `[价格区间_A]` |
| SKU 成本 | `[成本数据]` |

占位符保留语义(不是 `[REDACT_001]`),保证 LLM 仍能理解上下文。

### 还原边界

- 还原**只在浏览器前端**进行 → 服务端永不接触原值
- 还原映射表**仅本浏览器会话内存** → 关页面即丢
- P07 Safety Center 面板 2 显示 diff + 提供"导出映射表"(用户主动,本地下载,**不经服务端**)

## 数据传输

- 浏览器 ↔ Vercel:全程 HTTPS
- Vercel ↔ Neon:Postgres TLS + 连接字符串走 Vercel env var
- Vercel ↔ AI Gateway:同 Vercel 内部网络
- LLM Provider 响应:经 AI Gateway 转发,前端永不直连 Provider

## 审计

- 所有写操作 → `audit_log` 表 append(P07 面板 6 可视)
- 输入/输出存 SHA-256 hash → 任何篡改可发现
- HITL 决策必须留说明 ≥ 5 字
- 日志**永不删**,即使用户"删除"提案,也只是软删除(`deleted_at` 字段)

## ❓ 需你拍板

- 是否在 P0 Demo 加最简单的"团队代码"门(避免演示链接被滥用)— 选项:加 / 不加 — 影响:Demo URL 可否公开

---

## v2 新增:证据引擎数据安全

### P0(fixture 阶段)

- 证据池来自仓库内 JSON,**不接真实企业数据**
- fixture 内容刻意设计为"看起来真实但非真实"(虚构供应商名 / 历史项目 / 市场报告等)
- Demo 时主动声明"这是模拟数据,V2 才真接飞书/ERP"

### V2(真接数据)

- **飞书 OpenAPI**:OAuth + 应用级权限,只读 + 限定文件夹
- **ERP**:走 VPN + IP 白名单 + 只读 service account
- **外部数据**:走 AI Gateway 代理(隐藏内部 IP)
- 所有证据**入库前必须经 R8 脱敏管线**,不向 LLM 暴露原始敏感字段

### 证据引用的可审计性

- 每条 citation 必须包含 `source_id`(指向 evidence_cards 表)+ `snippet`(被引用的具体片段)+ `relevance_score`
- 审计员可查"某次决策引用了哪些证据 / 这些证据原文是什么 / 引用是否准确"
- 不允许 LLM 引用**未在召回结果中**的证据(从源头防幻觉)

---

## v2 新增:稳定复现测试的数据隔离

- 3 次复现产生的 3 份 analysis_version 都独立存盘(不互相覆盖)
- 用户可在 P10 历史页看到"这次决策有 3 个复现版本,主要结论一致率 X%"
- 复现失败不污染原版本
