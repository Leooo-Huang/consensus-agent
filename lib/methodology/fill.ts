// lib/methodology/fill.ts
// 简单 {key} / {a.b} 占位替换 helper(运行时把模板里的 {placeholder} 换成实际值)。
// 纯字符串操作,不调 LLM。

export type FillVars = Record<string, string | number | boolean | string[] | null | undefined>;

/**
 * 把 template 里的 {key} 占位符替换为 vars[key]。
 * - 支持点路径键:模板里的 {persona.name} 对应 vars["persona.name"]。
 * - 数组值用「、」连接(便于注入 key_results / kpis / natural_conflicts)。
 * - 命中的占位符即使值为空也会被替换(空串),保证替换后无残留 `{xxx}`。
 * - 未在 vars 中提供的占位符保持原样(便于分阶段填充)。
 */
export function fill(template: string, vars: FillVars): string {
  return template.replace(/\{([^{}]+)\}/g, (match, rawKey: string) => {
    const key = rawKey.trim();
    if (!(key in vars)) return match; // 未提供则原样保留
    const value = vars[key];
    if (value === null || value === undefined) return "";
    if (Array.isArray(value)) return value.join("、");
    return String(value);
  });
}
