-- 管理設定テーブル
CREATE TABLE IF NOT EXISTS admin_settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL DEFAULT '',
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- デフォルト設定
INSERT OR IGNORE INTO admin_settings (key, value) VALUES
  ('teacher_can_users', 'true'),
  ('teacher_can_posts', 'true'),
  ('teacher_can_bulk', 'false'),
  ('notif_self_default', 'true');
