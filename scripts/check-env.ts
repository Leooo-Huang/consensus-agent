// 启动前 env 自检。适配 Vercel Marketplace 集成实际注入的变量名(带 fallback)。
// AI Gateway 用 OIDC(VERCEL_OIDC_TOKEN,vercel env pull 自动带,12h 过期)免 API key,
// 也接受手动 AI_GATEWAY_API_KEY。
//
// 手动加载 .env.local(predev/prebuild 独立进程,Next 还没加载 env;0 依赖,
// 鲁棒处理引号/URL 特殊字符,比 tsx --env-file 可靠)。
import { readFileSync } from "node:fs";
import { join } from "node:path";

try {
  const content = readFileSync(join(process.cwd(), ".env.local"), "utf8");
  for (const line of content.split(/\r?\n/)) {
    const m = /^([A-Z_][A-Z0-9_]*)=(.*)$/.exec(line);
    if (!m) continue;
    const key = m[1]!;
    let val = m[2]!.trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    if (val && !process.env[key]) process.env[key] = val;
  }
} catch {
  // .env.local 不存在(如 CI / Vercel 部署用平台注入 env)→ 跳过,直接读 process.env
}

type Check = { label: string; ok: boolean; hint: string };

const checks: Check[] = [
  {
    label: "Postgres (pooled, Drizzle HTTP)",
    ok: !!(process.env.DATABASE_URL ?? process.env.NEON_DATABASE_URL),
    hint: "DATABASE_URL (Vercel Neon 集成) 或 NEON_DATABASE_URL",
  },
  {
    label: "Postgres (unpooled, LangGraph PostgresSaver)",
    ok: !!(
      process.env.DATABASE_URL_UNPOOLED ??
      process.env.POSTGRES_URL_NON_POOLING ??
      process.env.NEON_DATABASE_URL_WS ??
      process.env.DATABASE_URL
    ),
    hint: "DATABASE_URL_UNPOOLED (Vercel Neon 集成) 或 NEON_DATABASE_URL_WS",
  },
  {
    label: "Upstash Redis",
    ok: !!(
      (process.env.KV_REST_API_URL ?? process.env.UPSTASH_REDIS_REST_URL) &&
      (process.env.KV_REST_API_TOKEN ?? process.env.UPSTASH_REDIS_REST_TOKEN)
    ),
    hint: "KV_REST_API_URL + KV_REST_API_TOKEN (Vercel Upstash 集成) 或 UPSTASH_REDIS_REST_*",
  },
  {
    label: "AI Gateway (OIDC 或 API key)",
    ok: !!(process.env.VERCEL_OIDC_TOKEN ?? process.env.AI_GATEWAY_API_KEY),
    hint: "VERCEL_OIDC_TOKEN (vercel env pull 自动带) 或 AI_GATEWAY_API_KEY",
  },
];

const failed = checks.filter((c) => !c.ok);
if (failed.length > 0) {
  console.error("[check-env] 缺失必需 env:");
  for (const c of failed) console.error(`  - ${c.label}: ${c.hint}`);
  console.error("[check-env] 运行 `vercel env pull .env.local --environment=production`");
  process.exit(1);
}
console.log("[check-env] All required env present (Vercel 集成名已适配).");
