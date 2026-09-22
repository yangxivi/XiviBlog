// 独立迁移脚本：在 Node 环境直接执行 migrations/ 下的编号 SQL。
// 用法：node scripts/install-db.mjs   （可先设置 DATABASE_PATH 环境变量）
import Database from "better-sqlite3";
import { mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { readdirSync, readFileSync } from "node:fs";

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
    // 与 lib/migrate.ts 保持一致：分割语句并逐个执行
    const statements = sql.split(";").filter((s) => s.trim());
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
