CREATE TABLE IF NOT EXISTS users (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  email         TEXT    NOT NULL UNIQUE,
  name          TEXT    NOT NULL DEFAULT '',
  pass_hash     TEXT    NOT NULL,
  pass_salt     TEXT    NOT NULL,
  role          TEXT    NOT NULL DEFAULT 'admin',
  created_at    TEXT    NOT NULL DEFAULT (datetime('now')),
  last_login_at TEXT    NOT NULL DEFAULT '',
  reset_token   TEXT    NOT NULL DEFAULT '',
  reset_expires INTEGER NOT NULL DEFAULT 0
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email ON users (email);
CREATE INDEX IF NOT EXISTS idx_users_reset ON users (reset_token);

-- 占位管理员：密码哈希为占位值，无法用于登录。
-- 部署后请通过前台 /admin/register 使用「邀请码 = 环境变量 ADMIN_PASSWORD」创建你自己的管理员账号，
-- 或删除该占位账号后自行注册。
INSERT INTO users (email, name, pass_hash, pass_salt, role)
VALUES ('admin@example.com', '管理员', '0000000000000000000000000000000000000000000000000000000000000000', '00000000000000000000000000000000', 'admin')
ON CONFLICT(email) DO NOTHING;
