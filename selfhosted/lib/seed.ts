/**
 * 演示数据种子加载器（自托管版 / SQLite 适配层）
 *
 * 核心写入逻辑在 lib/seed-core.ts（与 Cloudflare 版共用），
 * 这里只负责「用 better-sqlite3 执行一条带参 SQL」。
 */
import { getRawDb } from "./db";
import { applySeed, type SeedData } from "./seed-core";

export type { SeedData } from "./seed-core";

/**
 * 把演示数据写入 SQLite（自托管版）。
 * @param seed 解析好的种子对象
 */
export async function applySeedToSqlite(seed: SeedData) {
  const db = getRawDb();

  const sqliteExec = (sql: string, params: unknown[]): Promise<number> => {
    const r = db.prepare(sql).run(...(params as never[]));
    return Promise.resolve(Number(r.changes ?? 0));
  };

  return applySeed(seed, sqliteExec);
}
