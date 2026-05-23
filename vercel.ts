import { type VercelConfig } from "@vercel/config/v1";

// Vercel 2026 官方推荐配置方式(@vercel/config),替代 vercel.json。
// 每端点 maxDuration 用 Next.js App Router 原生 `export const maxDuration`(写在各 route.ts 顶部)。
const config: VercelConfig = {
  framework: "nextjs",
  buildCommand: "pnpm build",
  installCommand: "pnpm install --frozen-lockfile",
};

export default config;
