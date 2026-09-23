// 独立迁移脚本：在 Node 环境直接执行 migrations/ 下的编号 SQL。
// 用法：node scripts/install-db.mjs   （可先设置 DATABASE_PATH 环境变量）
import Database from "better-sqlite3";
import { mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { readdirSync, readFileSync } from "node:fs";

/**
 * 按分号分割 SQL 语句，但跳过 CREATE TRIGGER ... BEGIN ... END 块。
 * SQLite 触发器体内部的分号是语句分隔符，不应在此处拆分。
 */
function splitStatements(sql) {
  const statements = [];
  let current = "";
  let inTrigger = false;
  const lines = sql.split("\n");

  for (const line of lines) {
    const trimmed = line.trim();

    // 检测 BEGIN 开始触发器体
    if (/^\s*BEGIN\s*$/i.test(trimmed) || /^\s*BEGIN/i.test(trimmed)) {
      inTrigger = true;
    }

    // 检测 END 结束触发器体
    if (/^\s*END\s*$/i.test(trimmed) || /^\s*END/i.test(trimmed)) {
      inTrigger = false;
    }

    if (!inTrigger) {
      current += line + "\n";
      // 只在非触发器体内按分号分割
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

const path = process.env.DATABASE_PATH || "./data/xiviblog.db";
mkdirSync(dirname(path), { recursive: true });

const db = new Database(path);
db.pragma("journal_mode = WAL");
db.pragma("busy_timeout = 5000");
db.pragma("foreign_keys = OFF");

const dir = join(process.cwd(), "migrations");
const files = readdirSync(dir)
  // 与 lib/migrate.ts 保持一致：0001_init.sql … 0017_pages.sql（数字编号开头即可）
  .filter((f) => /^\d+.*\.sql$/.test(f))
  // 跳过种子文件（_seed_*.sql 与 0002_seed.sql 由安装流程另行处理）
  .filter((f) => !/seed/i.test(f))
  .sort();

const executed = [];
const skipped = [];

for (const f of files) {
  const sql = readFileSync(join(dir, f), "utf8");
  try {
    // 使用 splitStatements 避免破坏 CREATE TRIGGER ... BEGIN ... END 块
    const statements = splitStatements(sql);
    for (const stmt of statements) {
      const trimmed = stmt.trim();
      if (!trimmed) continue;
      // 检测是否包含 ADD COLUMN，如果列已存在则跳过
      if (/ALTER\s+TABLE\s+\w+\s+ADD\s+COLUMN/i.test(trimmed)) {
        const tableName = trimmed.match(/ALTER\s+TABLE\s+(\w+)/i)?.[1];
        const columnName = trimmed.match(/ADD\s+COLUMN\s+(\w+)/i)?.[1];
        if (tableName && columnName) {
          const colCheck = db.prepare(
            `PRAGMA table_info(${tableName})`
          ).all();
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
    console.error(`✗ Migration ${f} failed:`, e instanceof Error ? e.message : e);
    // 继续执行后续迁移，不中断整个过程
  }
}

db.close();
console.log(`✓ 已执行 ${executed.length} 个迁移文件，跳过 ${skipped.length} 条：${path}`);
if (skipped.length > 0) {
  console.log("  跳过详情:", skipped.join("; "));
}
