import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { getRawDb } from "./db";

/**
 * 执行 migrations/ 下所有「纯数字编号」的 SQL（0001_init.sql … 0016_comments.sql）。
 * - 跳过以 _ 开头的种子文件（_seed_*.sql 由后台另行处理）。
 * - 按文件名升序执行，CREATE TABLE 均带 IF NOT EXISTS，可安全重复执行。
 */
export function runMigrations(): { files: string[] } {
  const db = getRawDb();
  const dir = join(process.cwd(), "migrations");
  const files = readdirSync(dir)
    // 匹配 0001_init.sql … 0016_comments.sql（数字编号 + 任意后缀）
    .filter((f) => /^\d+.*\.sql$/.test(f))
    // 跳过种子文件（_seed_*.sql 与 0002_seed.sql 由后台/安装流程另行处理）
    .filter((f) => !/seed/i.test(f))
    .sort();
  for (const f of files) {
    const sql = readFileSync(join(dir, f), "utf8");
    db.exec(sql);
  }
  return { files };
}
