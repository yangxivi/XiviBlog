/**
 * 演示数据种子加载器（Cloudflare Workers / D1 适配层）
 *
 * 核心写入逻辑在 lib/seed-core.ts（与自托管版共用），
 * 这里只负责「用 D1 执行一条带参 SQL」。
 */
import { getDB } from "./db";
import { applySeed, type SeedData } from "./seed-core";

export type { SeedData } from "./seed-core";

/** D1 单条执行器：返回受影响行数 */
async function d1Exec(sql: string, params: unknown[]): Promise<number> {
  const db = await getDB();
  const stmt = db.prepare(sql);
  const r = await stmt.bind(...(params as never[])).run();
  const meta = r.meta as { changes?: number } | undefined;
  return Number(meta?.changes ?? 0);
}

/**
 * 把演示数据写入 D1。
 * @param seed 解析好的种子对象
 */
export async function applySeedToD1(seed: SeedData) {
  return applySeed(seed, d1Exec);
}
