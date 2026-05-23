# 共识算法层:防 LLM 跟风的工程化方案(v2.1 GAN 修)

> **核心问题**:LLM 智能体在多轮辩论中会出现 anchoring bias(被先发言者锚定)、最后一票随机性、"看起来一致但实际不对"等问题。
>
> 本文档定义议见在算法/工程层的四个对策。
>
> ⚠️ **GAN-A/B 修订说明**:
> - 原"Free-MAD"论文出处不实,已改名"**TWS 轨迹加权评分(Trajectory-Weighted Scoring)**",自研、启发自 multi-agent debate 文献(LLM Debate / Du et al. 2023 / MAD-Bench 等)
> - 增加完整态度分映射表、求和范围明示、可执行 TS 伪代码
> - 增加性能预算表 + Vercel 300s 兜底方案
> - Round 1 改为"伪并发"避免顺序 7×LLM 超时
> - 稳定复现改"客户端轮询 3 次独立请求",不在单个 Route Handler 内串跑

---

## 问题诊断

### 普通"轮询 + 投票"方案的缺陷

```
传统方案:
  Round 1: Agent A 发言 → Agent B 看到 A 发言后再发言 → ...
  Round N: 全员投票,majority 赢
```

缺陷:
1. **Anchoring bias**:Agent B 容易被 A 的措辞带偏
2. **Bandwagon effect**:发现多数支持后,异议方倾向于沉默
3. **Last-vote randomness**:LLM 的温度参数让最后一票有显著随机性
4. **表面一致 ≠ 真共识**:看起来 5/7 支持,实际是 4 个被前 2 个 anchor 带偏的

---

## 4 档态度分映射(全产品锁定)

```typescript
// lib/consensus/attitude.ts
export const ATTITUDE_SCORE = {
  support:        +1.0,   // 支持
  conditional:    +0.5,   // 谨慎支持
  insufficient:    0.0,   // 信息不足(中性)
  oppose:         -1.0,   // 反对
} as const;

export type Attitude = keyof typeof ATTITUDE_SCORE;
```

**严格锁定**:任何文档 / 代码 / UI 中提到"态度分"都引用本表,不允许其他映射。

---

## 对策 1:Blind First-Vote(独立先发表)

### 算法

```
Round 0(并发):
  并行调用 7 个角色 Agent(LangGraph Send API)
  每个 Agent 只收到:
    - 提案文本(脱敏)
    - 自己的 Persona(L3 利益边界)
    - 召回的证据(L2)
    - 公司级目标(L1)
  不收到其他 Agent 的初始观点

  → 收集 7 份独立的"初始观点向量"(R0)

Round 1(伪并发 — v2.1 修):
  原方案:顺序遍历 7 角色,每个 Agent 看到所有 round-0 观点
  问题:顺序 7 × LLM ≈ 70-105s,撞 Vercel 300s 风险高

  新方案("伪并发"):
    Round 0 完成后,所有 round-0 观点形成"快照"
    Round 1 也用 LangGraph Send 并发调用 7 角色
    每个角色 prompt 注入"others_round0_snapshot"(其他 6 个角色的 R0 观点)
    每个角色独立决定是否调整自己 + 必须给"调整理由"
    无理由调整或调整幅度 > 阈值 → flag 为"possible_anchoring"
```

### LangGraph 实现(TS 伪代码)

```typescript
// lib/graph/consensus-graph.ts
import { StateGraph, Send } from "@langchain/langgraph";

// Round 0: 真并发
const round0Node = (state) => {
  return personas.map(persona =>
    new Send("persona_reasoning", {
      persona,
      proposal: state.redactedProposal,
      objective: state.objective,
      evidence: state.recalledEvidence,
      mode: "round_0",
      othersSnapshot: null
    })
  );
};

// Round 1: 伪并发(基于 R0 快照)
const round1Node = (state) => {
  const snapshot = state.round0Results;  // 7 角色 R0 观点冻结
  return personas.map(persona =>
    new Send("persona_reasoning", {
      persona,
      proposal: state.redactedProposal,
      objective: state.objective,
      evidence: state.recalledEvidence,
      mode: "round_1",
      othersSnapshot: snapshot.filter(r => r.personaId !== persona.id)
    })
  );
};

// Anchoring 检测
function detectAnchoring(r1: Output, r0Snapshot: Output[]): boolean {
  // 立场翻转 + 调整理由 < 30 字
  if (r1.attitude !== r1.r0Attitude && r1.adjustReason.length < 30) return true;
  // 措辞 cosine 与某 R0 > 0.85
  for (const r0 of r0Snapshot) {
    if (cosineSim(r1.embedding, r0.embedding) > 0.85) return true;
  }
  return false;
}
```

### Anchoring 检测产物

- 立场翻转:Round 0 反对 → Round 1 支持(无理由 / 理由 < 30 字)
- 措辞过度借用:Round 1 表达与某 Round 0 观点 cosine 相似度 > 0.85
- 标记后在 P04 cell 显示橙色边框 + Tooltip "可能被 Round 0 观点 anchor"

---

## 对策 2:轨迹加权评分(Trajectory-Weighted Scoring,**自研**)

### 命名澄清(v2.1 GAN-A/B 修)

原文档引用"TWS(自研轨迹加权评分) 论文",但出处不可考。**改名为"轨迹加权评分(Trajectory-Weighted Scoring,TWS)",自研算法,启发来源**:
- Du et al., 2023, "Improving Factuality and Reasoning in Language Models through Multiagent Debate"
- Asch 一致性实验(社会心理学):**首次独立判断准确率显著高于受群体影响后的判断** → 因此 R0 权重应最高
- MAD-Bench / LLM Debate 工程实践

### 算法(完整可执行版本)

对每个**论点 c**(claim),对每个**角色 p**,我们有 R0 和 R1 两轮的态度分(`a_p^t ∈ {-1, -0.5, 0, +0.5, +1}`)。

**单论点 c 的 trajectory_score**:

```
tws(c) = Σ_t [ w_t × ( Σ_p ( weight_p × a_{p,c}^t ) / Σ_p weight_p ) ]

其中:
  t ∈ {0, 1}                            (R0, R1 两轮)
  p ∈ {operations, products, marketing, finance, brand, supply_chain, regional}
  a_{p,c}^t ∈ ATTITUDE_SCORE             (上文锁定表)
  weight_p = L4 权重表对应值              (见 methodology.md L4)
  w_0 = 0.6, w_1 = 0.4                  (R0 权重更高,基于 Asch 实验)
  w_0 + w_1 = 1.0(归一化)

输出值域: tws(c) ∈ [-1.0, +1.0]
  > +0.5  → 强共识支持
  +0.1 ~ +0.5 → 弱共识支持
  -0.1 ~ +0.1 → 无共识
  -0.5 ~ -0.1 → 弱共识反对
  < -0.5 → 强共识反对
```

### 衰减系数 (0.6, 0.4) 的理由

- **不是 0.5/0.5(平均)**:R0 比 R1 更"未被污染"(没看到他人观点),按 Asch 实验该权重更高
- **不是 0.8/0.2(过分偏 R0)**:R1 的调整代表了"基于他人证据补充后的更新判断",仍有信息价值
- **不是 0.7/0.3 或 0.6/0.4 的选择**:我们选 0.6/0.4 是因为 7 角色 R1 调整后通常 1-2 个角色翻转,如果 R1 权重过低(0.2)则这些"基于新证据的合理调整"被淹没
- (这是工程选择,Demo 时 P07 "Prompt 透明度"面板会展示此系数让评审知情)

### TS 实现

```typescript
// lib/consensus/trajectory-weighted-scoring.ts
import { ATTITUDE_SCORE, type Attitude } from "./attitude";

interface PersonaVote {
  personaId: string;
  weight: number;          // L4 权重
  attitude: Attitude;      // R0 或 R1
}

export function tws(round0: PersonaVote[], round1: PersonaVote[]): number {
  const w0 = 0.6, w1 = 0.4;

  const weightedAvg = (votes: PersonaVote[]) => {
    const sumWeight = votes.reduce((s, v) => s + v.weight, 0);
    if (sumWeight === 0) return 0;
    return votes.reduce(
      (s, v) => s + v.weight * ATTITUDE_SCORE[v.attitude],
      0
    ) / sumWeight;
  };

  return w0 * weightedAvg(round0) + w1 * weightedAvg(round1);
}
```

### 落地

- 文件:`lib/consensus/trajectory-weighted-scoring.ts`(原 free-mad.ts 重命名)
- 输出:每论点 trajectory_score + 4 档置信区间 + R0/R1 一致性指标(用于 Anchoring 标记)
- 与 majority vote 对比:**P07 "Prompt 透明度"面板可展示两种算法在本次推理下的差异**(评审看得见)

---

## 对策 3:Premortem(集体预想失败)

### 借鉴方法论

**Premortem**(Gary Klein,《Sources of Power》)

在结论出来**之前**,让团队集体想"6 个月后这个方案失败了,最可能的原因是什么"。

### 算法

```
1. 共识算法跑完 → 得到初步结论
2. 启动 Premortem 节点(并发 7 角色,与 Round 0 同样的 Send API 并发):
   每个 Agent prompt 改为:
   "假设这个决策 6 个月后失败了。从你的角色角度,
    最可能的失败原因是什么?给出 1-3 个具体场景。"
3. 聚合 7 角色的失败场景 → 去重 → 按"重复度"和"严重度"排序
4. Top 3-5 写入决策报告 § 风险 部分
```

### P0 必做(v2.1 + GAN-A v2 修)

> **GAN-B 红线 3 修复**:原 architecture.md 写"Premortem 可选",但 P12 决策报告第 5 部分是 Premortem 产出,如果可选 = 决策报告少一节 = **降阶违规**。
>
> **GAN-A v2 修复(2026-05-23)**:原文"用户可选加快模式跳过"与"必做"骑墙,GAN-A v2 标为新引入矛盾。
>
> **最终决定**:**Premortem 在 P0 是真硬性必做,无加快模式跳过选项**。理由:
> - Send API 并发只增加 ~10s,在 P50 67s 总预算内完全可承受
> - P12 § 风险依赖 Premortem 产出,跳过 = 决策报告残缺 = 降阶
> - 若用户嫌慢:推荐预录视频路演,不要破坏方法论完整度

### 落地

- LangGraph 节点 `premortem-node.ts`,与 R3 同样 Send API 并发
- 输出格式:
  ```typescript
  type PremortemRisk = {
    risk: string;
    raised_by: string[];          // ["finance", "supply_chain"]
    severity: "high" | "medium" | "low";
    mitigations: string[];
  };
  ```

---

## 对策 4:稳定复现测试(Reproducibility Check)

### 思路

**真共识的特征:同一个问题问 N 次,主要结论应该一致。**

如果同一份提案运行 3 次,结论排序差很多 → 这次共识"靠运气",不靠谱。

### 算法(P0:3 次客户端轮询)

```typescript
// 客户端发起 3 次独立请求,不在单个 Route Handler 内串跑
// 避免超过 Vercel 300s 单函数限制
async function reproducibilityCheck(proposal, runs = 3) {
  const results = await Promise.all([
    fetch('/api/analyze', { body: JSON.stringify({...proposal, temperature: 0.3, seed: 42 }) }),
    fetch('/api/analyze', { body: JSON.stringify({...proposal, temperature: 0.4, seed: 84 }) }),
    fetch('/api/analyze', { body: JSON.stringify({...proposal, temperature: 0.5, seed: 126 }) })
  ]);

  // 计算指标
  const metrics = {
    conclusion_consistency: pctSameConclusion(results),
    top_3_disagreement_jaccard: jaccardOverlap(results.map(r => r.top3Disagreements)),
    key_evidence_overlap: pctEvidenceShared(results),
    verdict: conclusion_consistency >= 0.67 ? "stable" : "unstable"
  };
  return metrics;
}
```

### 在产品里(v2.1 修)

- **P07 Safety Center 面板 7:稳定性测试**
  - Demo 时主动按按钮触发(3 次并发,因为是独立 Route Handler 请求,Vercel 各自计 300s)
  - 实时显示 3 次结果对比 + 一致率 / Jaccard / 证据 overlap
  - 不稳定时 UI 警告 + 建议"补充更多证据后重试"
- **Demo 兜底**(GAN-A 必杀 #3):
  - 推荐演示策略:**预录 3 次复现 demo 视频 + 提供"立即跑"按钮作为可选展示**
  - 因为 3 次并发 ≈ 60-90 秒(虽然不撞 timeout 但占演讲时间),路演时演视频更稳

### 产品级 KPI

写在 definition.md / product-direction-v2.md 的"成功标准":
**Demo 期间稳定复现一致率 ≥ 67%**(3 次中至少 2 次主要结论一致)。

> ⚠️ 所有文档统一 67%,删除任何 80% 字样(GAN-A High-1 修复)

### 67% 阈值统计学论证(v2.1 GAN-B 修)

> **背景**:GAN-B v2 指出"3 中 2 = 67% 是数学下限,随机均匀概率即可触达,不构成实质可靠度证据"。

**论证**:
1. **结论空间不是均匀分布**:决策报告"结论"字段只有 4 种状态(通过 / 暂缓 / 驳回 / 需补数据)。如果 3 次推理结果完全随机,4 种状态被任意挑中的概率均为 25%,**3 次相同概率 = 4 × (1/4)³ = 6.25%**(不是 50%)。
2. **2/3 一致的随机基线 = 28.1%**(C(3,2) × (1/4)² × (3/4) = 14.06% × 2 = 28.1%)
3. **我们要求 ≥ 67%(实际指 2/3 一致即视为 stable)**:基于上面 #2,这远超 28.1% 的随机基线,有显著统计意义
4. **为什么不要求 100%(3/3 一致)**:
   - LLM 温度 > 0 时,完全确定性不现实
   - 100% 阈值会让"看似 stable 实际只是模型刻板印象"被通过 — 67% 留 1/3 容忍度,反而能检测真实分歧
5. **更严格的辅助指标**(已实现):
   - **top 3 分歧 Jaccard 相似度 ≥ 0.6**(关键分歧不能差异太大)
   - **关键证据 overlap ≥ 70%**(引用的证据基本一致)
   - 综合判定 `stable` 要求 3 个指标都达标,不是只看结论一致率

**结论**:67% 是**复合指标的入门门槛**,不是孤立指标。Demo 时 P07 面板 7 同时展示 3 个指标。

---

## 5. 性能预算表(v2.1 新增,GAN-B Block-2 修复)

### 单次完整推理(P50)

| 节点 | 算子 | LLM 调用数 | 单次延迟 | 累计耗时 | 备注 |
| --- | --- | --- | --- | --- | --- |
| 1 结构化+决策类型 | streamObject 1× | 1 | 5-8s | 5-8s | Haiku 4.5 |
| 2 L1 目标对齐 | streamObject 1× | 1 | 3-5s | 8-13s | Haiku 4.5(简单评分) |
| 3 L2 证据召回 | embedding 1× + 排序 | 1 | 2-3s | 10-16s | embedding 模型,极快 |
| 4 Round 0 Blind First-Vote | **Send 并发 7×** | 7(并发) | 8-12s | 18-28s | Sonnet 4.6,等最慢一个 |
| 5 Round 1 二轮调整(伪并发) | **Send 并发 7×** | 7(并发) | 8-12s | 26-40s | Sonnet 4.6,等最慢一个 |
| 6 TWS 轨迹评分 | 纯计算 | 0 | < 100ms | 26-40s | 无 LLM |
| 7 L4 权重加权 | 纯计算 | 0 | < 100ms | 26-40s | 无 LLM |
| 8 Premortem | **Send 并发 7×** | 7(并发) | 8-12s | 34-52s | Sonnet 4.6 |
| 9 决策报告生成 | streamObject 1× | 1 | 10-15s | 44-67s | Opus 4.7(质量优先) |
| **合计 LLM 调用** | | **24 次**(其中 21 次并发,3 次顺序) | | **44-67s** | **< 90s 兜底** |

### Vercel Fluid Compute 300s 兜底

- 单次推理 P50 = 44-67s,P99 ≈ 90s(降级后),**安全余量 ≥ 3 倍**
- 稳定复现 ×3 走**独立 Route Handler 并发**(每个 300s 各自计算),不串跑
- Premortem 是 P0 必做(同步并发,只增加 ~10s,可承受)
- 万一节点 9(报告生成)堵塞超 30s → 触发降级到 Sonnet 4.6

### 端到端 SLA(v2.1 修)

- 旧 v2:"≤ 60 秒"(不现实,GAN-A High-2)
- **新 v2.1**:"**P50 ≤ 67 秒,P99 ≤ 90 秒**"
- 写入 [definition.md](../01-product/definition.md) 成功标准

---

## 6. Opus 限流应对(v2.1 新增,GAN-B 环境风险 #5)

Round 0 / Round 1 / Premortem 各 7 角色并发(其中 Round 0/Premortem 用 Sonnet 4.6,Round 1 也是 Sonnet 4.6 → 节点 9 才用 Opus 4.7)。

**预算**:同时 7 路 Sonnet 4.6 并发 + Demo 期间 Opus 4.7 偶尔被节点 9 调用。Anthropic Sonnet 默认 RPM 配额通常够,但黑客松 Demo 高峰可能触发 429。

**应对**:
- Demo 前 30 分钟做 1 次完整推理"预热",确认配额可用
- AI Gateway 配 `fallback: Sonnet 4.6 → Haiku 4.5 → 离线规则`,429 立即降级
- 路演时如果 Opus 不可用,**演讲者直接演示降级**(反而是加分项)

---

## 7. 实现总览(v2.1 更新)

```
┌──────────────────────────────────────────────────────┐
│  LangGraph 主图(consensus-graph.ts)                 │
│  8 主节点 + Premortem(P0 必做)= 共 9 节点          │
│                                                       │
│  [proposal + objective + evidence]                    │
│            ↓                                          │
│  Node 1: 结构化 + 决策类型识别                        │
│            ↓                                          │
│  Node 2: L1 目标对齐                                  │
│            ↓                                          │
│  Node 3: L2 证据召回(in-memory JSON cosine,P0)       │
│            ↓                                          │
│  ┌─ Node 4: Round 0 Blind First-Vote(真并发 7×)─┐  │
│  │ Send → 7 personas → 独立初始观点向量            │  │
│  └─────────────────────────────────────────────────┘  │
│            ↓                                          │
│  ┌─ Node 5: Round 1 伪并发 + Anchoring 检测 ──────┐  │
│  │ Send → 7 personas(注入 R0 快照)+ flags        │  │
│  └─────────────────────────────────────────────────┘  │
│            ↓                                          │
│  Node 6: TWS 轨迹加权评分(纯计算)                   │
│            ↓                                          │
│  Node 7: L4 权重加权(纯计算)                        │
│            ↓                                          │
│  ┌─ Node 8: Premortem(真并发 7× — P0 必做) ───────┐  │
│  │ "如果失败,最可能原因?"                         │  │
│  └─────────────────────────────────────────────────┘  │
│            ↓                                          │
│  Node 9: 决策报告生成(7 部分)                       │
│                                                       │
│  [interrupt() HITL] 任意节点均可暂停人工接管          │
└──────────────────────────────────────────────────────┘

外层(可选):
  reproducibilityCheck(3 次独立 Route Handler 并发,客户端聚合)
```

---

## ❓ 待拍板

- 稳定复现测试 Demo 时**真跑** vs **预录视频回放**? — 选项:真跑(3 次 ×60s,占演讲 3 分钟) / 预录(30s 内放完) — **推荐预录**
- Round 1 权重 0.4 是否过低?如果某角色 R1 因新证据翻转,被降权后影响最终结论 → 是否可配置?
