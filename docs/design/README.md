# 议见 (YiJian) — 产品设计(v2)

> 🔥 **v2 升级(2026-05-23)**:产品方向重大升级,从"多 Agent 视角解读工具"→ "基于业务方法论的企业 AI 共识形成系统"。
>
> **优先阅读**:[product-direction-v2.md](01-product/product-direction-v2.md)(v2 原文 + GAP 分析)
>
> **变更日志**:[../pipeline/update-log.md](../pipeline/update-log.md)

## 🎯 一句话产品定义(v2)

**议见(YiJian)是一个基于业务方法论的企业 AI 共识形成系统:把业务提案拆成"角色、事实、分歧、权重、证据链",输出可复现、可解释、有方法论支撑的决策结论。**

## ❓ 需你拍板的事(v2 更新清单,11 项)

| 来自 | 问题 | 选项 | 影响 |
| --- | --- | --- | --- |
| [product-direction-v2.md](01-product/product-direction-v2.md) | **v2 升级是否完整接受?** | 全接受 / 部分接受 / 调整 | 影响后续所有 Phase 4-8 |
| [personas.md](01-product/personas.md) | "用户作为 stakeholder 加入观点"是 P0 还是 P1? | P0 必做 / P1 可推迟 | 是否演示人机混合共识 |
| [methodology.md](03-tech-direction/methodology.md) | L1 公司级目标库默认提供哪些示范目标? | 你提供 / AI 编 4-6 个 | 演示真实感 |
| [consensus-algorithm.md](03-tech-direction/consensus-algorithm.md) | 稳定复现测试 N 默认值 | 固定 3 / 可配置 | 成本 vs 严谨度 |
| ~~[architecture.md](03-tech-direction/architecture.md)~~ | ~~LangGraph 节点数合并?~~ ✅ **v2.1 已决:9 节点,Premortem P0 必做** | — | — |
| [security-model.md](03-tech-direction/security-model.md) | P0 Demo 是否加访问码门? | 加 / 不加 | URL 可否公开 |
| [P01-home](02-pages/P01-home.md) | 4 个 Demo 场景的提案文本来源 | 真实脱敏 / 虚构 | 业务真实感 vs 合规 |
| [P08-judge-cheatsheet](02-pages/P08-judge-cheatsheet.md) | 团队成员名单 | 你提供 / 留空 | 演示完整度 |
| [deployment.md](03-tech-direction/deployment.md) | 是否申请自定义域名 | 申请 / 默认 *.vercel.app | 演讲品牌感 |
| [data-lifecycle.md](04-rules/data-lifecycle.md) | 软删保留期 | 30/90/180/永不真删 | DB 成本 vs 合规 |
| [error-handling.md](04-rules/error-handling.md) | 是否引入 Sentry | 引入 / 不引入 | 错误可观测 |

> ✅ 已拍板:10 页 P0+P1 → **v2 扩展到 12 页**(加 P11 证据库 + P12 决策报告)/ Neon Postgres / P08 URL 隐藏 / 项目名"议见 (YiJian)"

## 🗂️ 文件夹导航(v2)

| 在哪 | 看什么 |
| --- | --- |
| **🔥 [01-product/product-direction-v2.md](01-product/product-direction-v2.md)** | **v2 升级原文 + GAP 分析(最重要)** |
| [01-product/definition.md](01-product/definition.md) | 产品定义(已按 v2 重写) |
| [01-product/personas.md](01-product/personas.md) | 用户画像(7 角色 + 用户作为 stakeholder) |
| [02-pages/00-map.md](02-pages/00-map.md) | 12 页清单(v2)+ 跳转关系 |
| [02-pages/P01-home.md](02-pages/P01-home.md) | 首页 + Demo 模拟器 |
| [02-pages/P02-proposal-intake.md](02-pages/P02-proposal-intake.md) | 提案输入(v2 加 L1 + 决策类型 + 权重预览) |
| [02-pages/P03-analysis-stream.md](02-pages/P03-analysis-stream.md) | 推理流式展示 |
| [02-pages/P04-diff-heatmap.md](02-pages/P04-diff-heatmap.md) | 分歧热力图(v2 4 档量化 + 7 角色 + 权重) |
| [02-pages/P05-persona-workshop.md](02-pages/P05-persona-workshop.md) | 7 角色 Persona 工坊(v2 加利益边界) |
| [02-pages/P06-discussion-frame.md](02-pages/P06-discussion-frame.md) | 讨论框架(v2 降级为快速预览) |
| [02-pages/P07-safety-center.md](02-pages/P07-safety-center.md) | 风险护栏中心(v2 加面板 7 稳定性测试 + 面板 8 Prompt 透明度) |
| [02-pages/P08-judge-cheatsheet.md](02-pages/P08-judge-cheatsheet.md) | 评审视角对照(v2 路演动线更新) |
| [02-pages/P09-decision-log.md](02-pages/P09-decision-log.md) | 决议录入(v2 升级为 AAR) |
| [02-pages/P10-history.md](02-pages/P10-history.md) | 历史提案 / Persona 演化 |
| **🆕 [02-pages/P11-evidence-library.md](02-pages/P11-evidence-library.md)** | **证据库管理(v2 新)** |
| **🆕 [02-pages/P12-decision-report.md](02-pages/P12-decision-report.md)** | **决策报告 7 部分(v2 新)** |
| [03-tech-direction/architecture.md](03-tech-direction/architecture.md) | Next.js 单体 + LangGraph + 证据引擎 + 共识算法 |
| **🆕 [03-tech-direction/methodology.md](03-tech-direction/methodology.md)** | **四层共识方法论详解(v2 新)** |
| **🆕 [03-tech-direction/consensus-algorithm.md](03-tech-direction/consensus-algorithm.md)** | **反跟风算法层(v2 新)** |
| [03-tech-direction/deployment.md](03-tech-direction/deployment.md) | Vercel + Neon SaaS |
| [03-tech-direction/data-strategy.md](03-tech-direction/data-strategy.md) | 数据存储 + append-only |
| [03-tech-direction/security-model.md](03-tech-direction/security-model.md) | 三层防护 + ZDR + v2 证据引擎安全 |
| [03-tech-direction/oss-scan.md](03-tech-direction/oss-scan.md) | 开源扫描 v2(15 个 R 能力) |
| [04-rules/permissions.md](04-rules/permissions.md) | P0 无登录 / V2 角色矩阵 |
| [04-rules/data-lifecycle.md](04-rules/data-lifecycle.md) | 数据生老病死 |
| [04-rules/error-handling.md](04-rules/error-handling.md) | 出错怎么办 |
| [_raw-brainstorm.md](_raw-brainstorm.md) | brainstorming 原始草稿(审计存档) |

## 建议阅读路径(v2)

1. **先读 [product-direction-v2.md](01-product/product-direction-v2.md)**(必读,15 分钟)— 理解 v2 升级
2. 读 [definition.md](01-product/definition.md)(已按 v2 重写)— 5 分钟
3. 读 [00-map.md](02-pages/00-map.md)(12 页全貌)— 3 分钟
4. **按 ❓ 清单逐项拍板**(11 项)— 15-20 分钟
5. 关键页:[P12 决策报告](02-pages/P12-decision-report.md) + [P11 证据库](02-pages/P11-evidence-library.md) + [P04 热力图](02-pages/P04-diff-heatmap.md) + [P07 Safety Center](02-pages/P07-safety-center.md)
6. 技术深度:[methodology.md](03-tech-direction/methodology.md) + [consensus-algorithm.md](03-tech-direction/consensus-algorithm.md)

## v2 评审 6 维度 → 增量证据

| 维度 | 权重 | v2 新增证据(在 v1 基础上) |
| --- | --- | --- |
| 业务落地 | 25% | **四层共识 + 5 个 P0 真落地方法论(OKR / Stakeholder Mapping / RACI / Premortem / AAR)+ 决策报告 7 部分** = 工程化经典企业决策方法论(8 个 V2 候选见 [methodology.md](03-tech-direction/methodology.md)) |
| 技术实现 | 20% | **TWS(自研轨迹加权评分) + Blind First-Vote + Anchoring 检测 + 稳定复现测试** = 学术级严谨 |
| 风险安全 | 20% | **P07 第 7/8 面板**(稳定性测试 + Prompt 透明度)+ **Premortem 专节** = 风险机制再深一层 |
| 创新性 | 15% | **方法论 + AI 算法 + 工程化** 三重创新,非"AI 包装" |
| 演示 | 10% | **稳定性 Live 测试** + **Blind First-Vote 7 角色并发可视** |
| 非技术可理解 | 10% | 四层共识 + 决策报告 7 部分都是业务语言;**P12 § 纪要 = AI 综合生成可直接发飞书** |
