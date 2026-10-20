import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { getRawDb } from "./db";

/**
 * 执行 migrations/ 下所有「纯数字编号」的 SQL（0001_init.sql … 0016_comments.sql）。
 * - 跳过以 _ 开头的种子文件（_seed_*.sql 由后台另行处理）。
 * - 按文件名升序执行，CREATE TABLE 均带 IF NOT EXISTS，可安全重复执行。
 * - 使用 sqlite_master 检查列是否已存在，避免 ALTER TABLE ADD COLUMN 重复时报错。
 */

/**
 * 按分号分割 SQL 语句，但跳过 CREATE TRIGGER ... BEGIN ... END 块。
 * 触发器体内部的分号不是语句分隔符，直接 split(";") 会把触发器切成残缺语句
 * （报 incomplete input）。遇到 END 行时整段触发器作为一条语句输出。
 */
function splitStatements(sql: string): string[] {
  const statements: string[] = [];
  let current = "";
  let inTrigger = false;

  for (const line of sql.split("\n")) {
    const trimmed = line.trim();

    if (!inTrigger && /^\s*BEGIN\b/i.test(trimmed)) {
      inTrigger = true;
      current += line + "\n";
      continue;
    }
    if (inTrigger && /^\s*END\b/i.test(trimmed)) {
      current += line + "\n";
      inTrigger = false;
      if (current.trim()) statements.push(current.trim());
      current = "";
      continue;
    }

    if (!inTrigger) {
      current += line + "\n";
      const parts = current.split(";");
      current = parts.pop() || "";
      for (const part of parts) {
        if (part.trim()) statements.push(part.trim());
      }
    } else {
      current += line + "\n";
    }
  }

  if (current.trim()) statements.push(current.trim());
  return statements;
}

export function runMigrations(): { files: string[]; skipped: string[] } {
  const db = getRawDb();
  const dir = join(process.cwd(), "migrations");
  const files = readdirSync(dir)
    .filter((f) => /^\d+.*\.sql$/.test(f))
    .sort();

  const executed: string[] = [];
  const skipped: string[] = [];

  for (const f of files) {
    const sql = readFileSync(join(dir, f), "utf8");
    try {
      // 先尝试执行 ALTER TABLE，如果列已存在则跳过该语句
      const statements = splitStatements(sql);
      for (const stmt of statements) {
        const trimmed = stmt.trim();
        if (!trimmed) continue;
        // 检测是否包含 ADD COLUMN
        if (/ALTER\s+TABLE\s+\w+\s+ADD\s+COLUMN/i.test(trimmed)) {
          const tableName = trimmed.match(/ALTER\s+TABLE\s+(\w+)/i)?.[1];
          const columnName = trimmed.match(/ADD\s+COLUMN\s+(\w+)/i)?.[1];
          if (tableName && columnName) {
            // 检查列是否已存在
            const colCheck = db.prepare(
              `PRAGMA table_info(${tableName})`
            ).all() as Array<{ name: string }>;
            const colExists = colCheck.some((c) => c.name === columnName);
            if (colExists) {
              skipped.push(`${f}: column ${columnName} already exists`);
              continue;
            }
          }
        }
        db.exec(trimmed);
      }
      executed.push(f);
    } catch (e) {
      console.error(`Migration ${f} failed:`, e);
      // 继续执行后续迁移
    }
  }

  return { files: executed, skipped };
}
