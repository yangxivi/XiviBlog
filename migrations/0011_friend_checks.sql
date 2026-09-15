-- 友链存活检测结果：一个地址一行，每次检测覆盖更新（只留最新状态，不存历史）
-- failures 是「连续失败次数」：偶尔抖一次不必紧张，连续失败才说明对方真的挂了。
CREATE TABLE IF NOT EXISTS friend_checks (
  href       TEXT    PRIMARY KEY,
  ok         INTEGER NOT NULL DEFAULT 0,
  status     INTEGER NOT NULL DEFAULT 0,  -- HTTP 状态码，0 = 请求没走通
  ms         INTEGER NOT NULL DEFAULT 0,  -- 耗时毫秒
  error      TEXT    NOT NULL DEFAULT '',
  final_url  TEXT    NOT NULL DEFAULT '', -- 跟随跳转后的最终地址
  failures   INTEGER NOT NULL DEFAULT 0,
  checked_at TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_friend_checked ON friend_checks (checked_at);
CREATE INDEX IF NOT EXISTS idx_friend_ok      ON friend_checks (ok, checked_at);
