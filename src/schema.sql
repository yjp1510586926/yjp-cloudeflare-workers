-- 创建用户表
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 插入初始数据
INSERT INTO users (name, email) VALUES 
  ('张三', 'zhangsan@example.com'),
  ('李四', 'lisi@example.com');
