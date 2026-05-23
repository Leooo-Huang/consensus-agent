import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

// 将 tsconfig 的 "@/*" -> "./*" 路径别名同步给 Vitest/Vite 解析器。
// 没有该映射时,测试里的 `@/lib/schema/...` 导入会解析失败。
const rootDir = fileURLToPath(new URL(".", import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      "@": rootDir,
    },
  },
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
  },
});
