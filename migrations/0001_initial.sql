-- ユーザーテーブル
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'student', -- admin, teacher, chairman, captain, vice_chairman, vice_captain, student
  name TEXT,
  grade INTEGER, -- 学年
  class_num INTEGER, -- クラス
  number INTEGER, -- 番号
  club TEXT, -- 部活動
  committee TEXT, -- 委員会
  subject TEXT, -- 担当教科（先生）
  is_homeroom INTEGER DEFAULT 0, -- 担任かどうか（先生）
  homeroom_class INTEGER, -- 担任クラス（先生）
  avatar_url TEXT,
  bio TEXT,
  first_login INTEGER DEFAULT 1, -- 初回ログインフラグ
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- セッションテーブル
CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL,
  expires_at DATETIME NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- 投稿テーブル（掲示板・委員会・部活・クラス・上中連絡・忘れ物）
CREATE TABLE IF NOT EXISTS posts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  author_id INTEGER NOT NULL,
  category TEXT NOT NULL, -- bulletin, committee, club, class, school_notice, lost_item
  target TEXT, -- 委員会名・部活名・クラス番号など
  title TEXT,
  content TEXT NOT NULL,
  file_url TEXT, -- PDF/画像URL
  file_type TEXT, -- pdf, image
  expires_at DATETIME, -- 自動削除日時
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (author_id) REFERENCES users(id) ON DELETE CASCADE
);

-- リアクションテーブル
CREATE TABLE IF NOT EXISTS reactions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  post_id INTEGER,
  message_id INTEGER,
  user_id INTEGER NOT NULL,
  emoji TEXT NOT NULL DEFAULT '👍',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (post_id) REFERENCES posts(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- 既読テーブル（投稿）
CREATE TABLE IF NOT EXISTS post_reads (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  post_id INTEGER NOT NULL,
  user_id INTEGER NOT NULL,
  read_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (post_id) REFERENCES posts(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  UNIQUE(post_id, user_id)
);

-- メッセージスレッドテーブル
CREATE TABLE IF NOT EXISTS message_threads (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT, -- グループ名
  type TEXT NOT NULL DEFAULT 'direct', -- direct, group, captain_group
  created_by INTEGER NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE CASCADE
);

-- メッセージスレッドメンバー
CREATE TABLE IF NOT EXISTS thread_members (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  thread_id INTEGER NOT NULL,
  user_id INTEGER NOT NULL,
  joined_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (thread_id) REFERENCES message_threads(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  UNIQUE(thread_id, user_id)
);

-- メッセージテーブル
CREATE TABLE IF NOT EXISTS messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  thread_id INTEGER NOT NULL,
  sender_id INTEGER NOT NULL,
  content TEXT NOT NULL,
  file_url TEXT,
  file_type TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (thread_id) REFERENCES message_threads(id) ON DELETE CASCADE,
  FOREIGN KEY (sender_id) REFERENCES users(id) ON DELETE CASCADE
);

-- メッセージ既読テーブル
CREATE TABLE IF NOT EXISTS message_reads (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  message_id INTEGER NOT NULL,
  user_id INTEGER NOT NULL,
  read_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (message_id) REFERENCES messages(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  UNIQUE(message_id, user_id)
);

-- 質問テーブル（部長・委員長への質問）
CREATE TABLE IF NOT EXISTS questions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  asker_id INTEGER NOT NULL,
  target_id INTEGER NOT NULL, -- 質問先ユーザーID
  content TEXT NOT NULL,
  answer TEXT,
  answered_at DATETIME,
  expires_at DATETIME, -- 15日後自動削除
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (asker_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (target_id) REFERENCES users(id) ON DELETE CASCADE
);

-- 相談テーブル（先生への相談）
CREATE TABLE IF NOT EXISTS consultations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  student_id INTEGER NOT NULL,
  teacher_id INTEGER NOT NULL,
  content TEXT NOT NULL,
  reply TEXT,
  replied_at DATETIME,
  status TEXT DEFAULT 'open', -- open, closed
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (student_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (teacher_id) REFERENCES users(id) ON DELETE CASCADE
);

-- ユーザー登録許可テーブル
CREATE TABLE IF NOT EXISTS registration_tokens (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  token TEXT UNIQUE NOT NULL,
  role TEXT NOT NULL DEFAULT 'student',
  username TEXT, -- 個人指定の場合
  expires_at DATETIME NOT NULL,
  used INTEGER DEFAULT 0,
  created_by INTEGER,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (created_by) REFERENCES users(id)
);

-- 通知テーブル
CREATE TABLE IF NOT EXISTS notifications (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  type TEXT NOT NULL, -- disaster, normal, self, push_test
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  scheduled_at DATETIME, -- 自分通知の予約時刻
  sent INTEGER DEFAULT 0,
  created_by INTEGER,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- 通知設定テーブル
CREATE TABLE IF NOT EXISTS notification_settings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL UNIQUE,
  push_enabled INTEGER DEFAULT 1,
  disaster_enabled INTEGER DEFAULT 1,
  club_post_enabled INTEGER DEFAULT 1,
  committee_post_enabled INTEGER DEFAULT 1,
  school_notice_enabled INTEGER DEFAULT 1,
  message_enabled INTEGER DEFAULT 1,
  push_subscription TEXT, -- Web Push subscription JSON
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- アンケートテーブル
CREATE TABLE IF NOT EXISTS surveys (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  description TEXT,
  created_by INTEGER NOT NULL,
  target TEXT DEFAULT 'all', -- all, class, club, committee
  target_value TEXT,
  expires_at DATETIME,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE CASCADE
);

-- アンケート質問テーブル
CREATE TABLE IF NOT EXISTS survey_questions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  survey_id INTEGER NOT NULL,
  question_text TEXT NOT NULL,
  question_type TEXT DEFAULT 'single', -- single, multiple, text
  options TEXT, -- JSON配列
  order_num INTEGER DEFAULT 0,
  FOREIGN KEY (survey_id) REFERENCES surveys(id) ON DELETE CASCADE
);

-- アンケート回答テーブル
CREATE TABLE IF NOT EXISTS survey_answers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  survey_id INTEGER NOT NULL,
  question_id INTEGER NOT NULL,
  user_id INTEGER NOT NULL,
  answer TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (survey_id) REFERENCES surveys(id) ON DELETE CASCADE,
  FOREIGN KEY (question_id) REFERENCES survey_questions(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- 体育委員チェックリストテーブル
CREATE TABLE IF NOT EXISTS pe_checklist_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  total_count INTEGER DEFAULT 1,
  checked INTEGER DEFAULT 0,
  created_by INTEGER,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (created_by) REFERENCES users(id)
);

-- 貸し出しテーブル
CREATE TABLE IF NOT EXISTS pe_rentals (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  item_id INTEGER NOT NULL,
  borrower_name TEXT NOT NULL,
  borrower_user_id INTEGER,
  count INTEGER DEFAULT 1,
  borrowed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  returned_at DATETIME,
  FOREIGN KEY (item_id) REFERENCES pe_checklist_items(id) ON DELETE CASCADE,
  FOREIGN KEY (borrower_user_id) REFERENCES users(id)
);

-- 設定変更許可テーブル
CREATE TABLE IF NOT EXISTS profile_edit_permissions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  granted_by INTEGER NOT NULL,
  expires_at DATETIME,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (granted_by) REFERENCES users(id)
);

-- インデックス
CREATE INDEX IF NOT EXISTS idx_posts_category ON posts(category);
CREATE INDEX IF NOT EXISTS idx_posts_target ON posts(target);
CREATE INDEX IF NOT EXISTS idx_posts_author ON posts(author_id);
CREATE INDEX IF NOT EXISTS idx_messages_thread ON messages(thread_id);
CREATE INDEX IF NOT EXISTS idx_thread_members_user ON thread_members(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_questions_target ON questions(target_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id);
