-- 定时任务的「上次执行」记录。
--
-- Workers 上没有常驻进程、也没有 cron（本项目刻意不引 Cron Trigger，免去自定义
-- worker 入口与 OpenNext 产物冲突的麻烦）。这里用「心跳 + 到期判断」的惰性调度：
-- 前台每来一次访问就顺带看一眼哪些任务到期了，到期才真正执行。
-- 效果等同于定时任务，但零运维、零额外费用，也不会在没人访问时空跑。
CREATE TABLE IF NOT EXISTS jobs (
  key         TEXT    PRIMARY KEY,
  last_run    TEXT    NOT NULL DEFAULT '',
  last_status TEXT    NOT NULL DEFAULT '',
  runs        INTEGER NOT NULL DEFAULT 0
);
