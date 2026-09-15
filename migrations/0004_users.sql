-- 后台账号体系：注册 / 登录 / 忘记密码
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
