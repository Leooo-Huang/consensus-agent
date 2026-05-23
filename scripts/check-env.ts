const REQUIRED = [
  "NEON_DATABASE_URL",
  "NEON_DATABASE_URL_WS",
  "UPSTASH_REDIS_REST_URL",
  "UPSTASH_REDIS_REST_TOKEN",
  "AI_GATEWAY_API_KEY",
] as const;

const missing = REQUIRED.filter((k) => !process.env[k]);
if (missing.length > 0) {
  console.error(`[check-env] Missing required env vars: ${missing.join(", ")}`);
  console.error(`[check-env] 复制 .env.example → .env.local 并填值,或跑 \`pnpm vercel env pull .env.local\``);
  process.exit(1);
}
console.log("[check-env] All required env vars present.");
