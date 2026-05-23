# 部署方向:Vercel + Neon(SaaS 一体)

> 用户的东西部署在哪、怎么部、谁运维。

## 决策

**最终选了**:**Vercel(Next.js + Fluid Compute)+ Neon Postgres(Marketplace 集成)+ Vercel AI Gateway**。

**为什么**:
- 项目栈 100% Vercel 原生(Next.js 15 + AI SDK v6 + AI Gateway)→ 零额外配置
- Fluid Compute 默认 300s timeout,覆盖最长链推理
- Neon 在 Vercel Marketplace 一键集成,提供 serverless Postgres,无需自管 DB 实例
- Demo 时全云端,演讲者只需打开浏览器,**无本地启动依赖**
- 黑客松 72h 场景下,自托管的运维成本根本承担不起

## 选项对比

| 选项 | 优点 | 缺点 | 成本量级 |
| --- | --- | --- | --- |
| **A. Vercel + Neon(选了)** | 一键部署 / AI Gateway 同栈 / Demo 零依赖 | 锁定 Vercel 生态 / 长任务受 300s 限制(够用) | $0(免费层够 Demo)/ ~$20-50/月 生产 |
| B. 自托管 Docker + Postgres + Nginx | 完全可控 / 无 timeout 限制 | 运维成本高 / 黑客松内学不完 | 时间成本最高 |
| C. Cloudflare Workers + D1 | 边缘性能好 / 免费层慷慨 | LangGraph.js 在 Workers 下未完整验证 / AI SDK 兼容性需测 | $0 起 |

## 选这个的代价

- 长链推理超 300s 会被 Vercel 杀掉 → 用 streamObject + 限制单次推理论点数 ≤ 8 兜底
- Vercel 地域限制(主要欧美节点)→ 黑客松现场若在中国/亚洲,**Demo 提前预热并测速**
- 锁定 Vercel 商业模式 → 赛后产品化可平滑迁移到 self-host(因为代码本身是标准 Next.js)

## CI/CD

- **Git push → Vercel 自动 Preview 部署** → 演讲前一晚锁定 Preview URL
- **Production deploy 手动触发** → 通过 `vercel deploy --prod`,避免 push 到 main 触发误部署
- **环境变量**:`vercel env pull` 同步到本地 `.env.local`,**绝不**提交到 git

## ❓ 需你拍板

- 是否提前申请自定义域名(如 yijian.app)→ 选项:申请 / 用默认 *.vercel.app — 影响:演讲品牌感

---

## v2.1 新增:Vercel maxDuration + Anthropic 限流应对(GAN-B 修)

### vercel.json / vercel.ts 显式声明 maxDuration

> **v2.3 GAN-B MEDIUM-1 修**:Vercel 2025-06 更新后,Fluid Compute **默认 maxDuration 已经是 300s**(全部计划),无需再显式声明 300s。Pro/Enterprise 可进一步延长到 800s。本节配置仍保留作为"显式锁定值,防被 Vercel 默认值变化影响",并对**唯一可能需要超过 300s** 的端点(短期内无此需求)预留扩展点。

```typescript
import type { VercelConfig } from '@vercel/config/v1';

export const config: VercelConfig = {
  buildCommand: 'pnpm build',
  framework: 'nextjs',
  functions: {
    'app/api/analyze/route.ts': { maxDuration: 300 },
    'app/api/reproducibility-check/route.ts': { maxDuration: 300 },
    'app/api/evidence/search/route.ts': { maxDuration: 30 },
    'app/api/decisions/route.ts': { maxDuration: 10 },
  }
};
```

### Anthropic Sonnet 4.6 限流应对

**预算**:Round 0 / Round 1 / Premortem 各 7 角色 Sonnet 4.6 并发 = 单次推理同时 7 路。Anthropic Sonnet 默认 RPM 通常够,但稳定复现 ×3 = 同时 21 路 → **黑客松 Demo 高峰可能触发 429**。

**应对策略**:
1. **演示前 30 分钟预热**:跑 1-2 次完整推理 + 1 次稳定复现,确认配额可用
2. **AI Gateway 配 fallback 链**:`Sonnet 4.6 → Haiku 4.5 → 离线规则`,429 立即降级 — UI 实时显示(Provider 角标 + toast)
3. **路演真触发降级是加分项**:如果 Opus/Sonnet 不可用,演讲者直接 narrate 降级,**评审看到产品真有降级机制**
4. **预录视频兜底**:稳定性测试预录,避免现场跑 21 路并发触发限流
