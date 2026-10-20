/**
 * 演示数据种子加载器（自托管版 / SQLite 适配层）
 *
 * 核心写入逻辑在 lib/seed-core.ts（与 Cloudflare 版共用），
 * 这里只负责「执行一条带参 SQL」。
 *
 * 用 getDB() 而非 getRawDb()：getDB() 返回的是 D1 兼容封装，
 * 内部会把 ?N 编号占位符改写成匿名 ?（better-sqlite3 不认编号占位符），
 * 用它可避免占位符风格踩坑。
 */
import { getDB } from "./db";
import { applySeed, type SeedData } from "./seed-core";

export type { SeedData } from "./seed-core";

/**
 * 把演示数据写入 SQLite（自托管版）。
 * @param seed 解析好的种子对象
 */
export async function applySeedToSqlite(seed: SeedData) {
  const db = await getDB();

  const sqliteExec = (sql: string, params: unknown[]): Promise<number> => {
    const r = db.prepare(sql).bind(...(params as never[])).run();
    return Promise.resolve(Number(r.meta?.changes ?? 0));
  };

  return applySeed(seed, sqliteExec);
}
