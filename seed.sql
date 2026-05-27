-- 管理者アカウント（パスワード: admin1234）
-- password_hash は bcrypt相当、ここではデモ用にプレーン表記
INSERT OR IGNORE INTO users (username, password_hash, role, name, first_login) VALUES
  ('admin', '$2a$10$demo_admin_hash', 'admin', '管理者', 0);

-- デモ先生アカウント（パスワード: teacher1234）
INSERT OR IGNORE INTO users (username, password_hash, role, name, subject, is_homeroom, homeroom_class, first_login) VALUES
  ('T001', '$2a$10$demo_teacher_hash', 'teacher', '山田太郎', '数学', 1, 1, 0),
  ('T002', '$2a$10$demo_teacher_hash2', 'teacher', '鈴木花子', '英語', 0, NULL, 0);

-- デモ生徒アカウント（パスワード: pass1234）
INSERT OR IGNORE INTO users (username, password_hash, role, name, grade, class_num, number, club, committee, first_login) VALUES
  ('24101', '$2a$10$demo_student_hash', 'captain', '田中一郎', 1, 1, 1, 'サッカー部', '生徒会', 0),
  ('24102', '$2a$10$demo_student_hash2', 'student', '佐藤二郎', 1, 1, 2, 'バスケ部', '整備委員会', 0);

-- 通知設定初期化
INSERT OR IGNORE INTO notification_settings (user_id, push_enabled, disaster_enabled, club_post_enabled, committee_post_enabled, school_notice_enabled, message_enabled)
SELECT id, 1, 1, 1, 1, 1, 1 FROM users;

-- デモ投稿
INSERT OR IGNORE INTO posts (author_id, category, title, content, expires_at) VALUES
  (1, 'bulletin', 'ようこそ上中黒板へ', 'このアプリは上中生のための黒板アプリです。部活や委員会の連絡にお使いください。', datetime('now', '+60 days')),
  (2, 'school_notice', '明日の全校集会について', '明日8:30から体育館で全校集会を行います。体育館シューズを持参してください。', datetime('now', '+7 days'));
