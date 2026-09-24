-- 站点快照（定时备份）
--
-- 为什么不把整包 JSON 塞进一行：D1 单行/单值有 2MB 上限，正文里内嵌 base64 封面
-- 时很容易顶到天花板，一次超限整份备份就废了。拆成「快照头 + 逐篇明细」后，
-- 单篇再大也只影响它自己，还能顺手支持按篇恢复。
CREATE TABLE IF NOT EXISTS backup_snapshots (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  kind          TEXT    NOT NULL DEFAULT 'auto',  -- auto | manual
  note          TEXT    NOT NULL DEFAULT '',
  posts         INTEGER NOT NULL DEFAULT 0,
  bytes         INTEGER NOT NULL DEFAULT 0,       -- 正文体积估算（字节）
  signature     TEXT    NOT NULL DEFAULT '',      -- 内容指纹：没变化就不重复备份
  settings_json TEXT    NOT NULL DEFAULT '',
  created_at    TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_snap_kind ON backup_snapshots (kind, id DESC);

CREATE TABLE IF NOT EXISTS backup_snapshot_items (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  snapshot_id INTEGER NOT NULL,
  slug        TEXT    NOT NULL,
  title       TEXT    NOT NULL,
  excerpt     TEXT    NOT NULL DEFAULT '',
  content     TEXT    NOT NULL DEFAULT '',
  cover_image TEXT    NOT NULL DEFAULT '',
  tag         TEXT    NOT NULL DEFAULT '',
  status      TEXT    NOT NULL DEFAULT 'draft',
  pinned      INTEGER NOT NULL DEFAULT 0,
  publish_at  TEXT    NOT NULL DEFAULT '',
  created_at  TEXT    NOT NULL DEFAULT '',
  updated_at  TEXT    NOT NULL DEFAULT ''
);

CREATE INDEX IF NOT EXISTS idx_snap_items ON backup_snapshot_items (snapshot_id);
