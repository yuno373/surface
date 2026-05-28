-- 複数ロール対応：user_rolesテーブル
CREATE TABLE IF NOT EXISTS user_roles (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  role TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  UNIQUE(user_id, role)
);

-- 既存ユーザーのroleをuser_rolesに移行
INSERT OR IGNORE INTO user_roles (user_id, role)
  SELECT id, role FROM users WHERE role IS NOT NULL;

-- 追加ロール用カラム（既存互換）
ALTER TABLE users ADD COLUMN roles_text TEXT;

-- メッセージ取消・編集対応
ALTER TABLE messages ADD COLUMN is_deleted INTEGER DEFAULT 0;
ALTER TABLE messages ADD COLUMN edited_at DATETIME;

-- スレッドピン留め・アーカイブ
ALTER TABLE message_threads ADD COLUMN is_pinned INTEGER DEFAULT 0;
ALTER TABLE message_threads ADD COLUMN is_archived INTEGER DEFAULT 0;

-- スレッド削除（完全削除ではなく非表示）
ALTER TABLE message_threads ADD COLUMN deleted_at DATETIME;

-- メッセージの既読詳細（誰がいつ読んだかはmessage_readsで既に管理済み）

-- チェックリスト最終確認ログ
CREATE TABLE IF NOT EXISTS pe_checklist_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  item_id INTEGER NOT NULL,
  user_id INTEGER NOT NULL,
  checked INTEGER DEFAULT 1,
  checked_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (item_id) REFERENCES pe_checklist_items(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- チェックリスト項目に最終確認情報追加
ALTER TABLE pe_checklist_items ADD COLUMN last_checked_by INTEGER;
ALTER TABLE pe_checklist_items ADD COLUMN last_checked_at DATETIME;

-- アンケート拡張
ALTER TABLE survey_answers ADD COLUMN updated_at DATETIME;

-- アンケート投稿ID紐付け
ALTER TABLE surveys ADD COLUMN post_id INTEGER;

-- ファイル管理（R2）
CREATE TABLE IF NOT EXISTS files (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  filename TEXT NOT NULL,
  original_name TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  size INTEGER NOT NULL,
  r2_key TEXT NOT NULL,
  post_id INTEGER,
  message_id INTEGER,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- ユーザーログインID（ログイン用・変更可能）
ALTER TABLE users ADD COLUMN login_id TEXT UNIQUE;

-- プロフィール編集履歴
CREATE TABLE IF NOT EXISTS profile_change_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  changed_by INTEGER NOT NULL,
  field_name TEXT NOT NULL,
  old_value TEXT,
  new_value TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (changed_by) REFERENCES users(id)
);

-- お知らせ既読（上中連絡のアップデート機能）
ALTER TABLE posts ADD COLUMN is_important INTEGER DEFAULT 0;

-- インデックス追加
CREATE INDEX IF NOT EXISTS idx_user_roles_user ON user_roles(user_id);
CREATE INDEX IF NOT EXISTS idx_files_user ON files(user_id);
CREATE INDEX IF NOT EXISTS idx_pe_checklist_logs_item ON pe_checklist_logs(item_id);
