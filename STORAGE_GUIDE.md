# Cloudflare Workers 数据存储方案指南

## 当前状态 ⚠️

**目前使用：内存存储（临时）**

数据存储在 Worker 的内存变量中：
```javascript
let users = [...];
```

### 限制
- ❌ Worker 重启后数据丢失
- ❌ 每个 Worker 实例数据独立（全球分布式部署）
- ❌ 不适合生产环境
- ✅ 仅适合开发测试

---

## 生产环境存储方案

Cloudflare 提供三种主要的持久化存储方案：

### 1. 🗄️ Cloudflare D1（推荐用于结构化数据）

**适用场景：** 用户数据、订单、文章等结构化数据

**特点：**
- SQLite 数据库
- 支持 SQL 查询
- 全球分布式
- 免费额度：每天 100,000 次读取，50,000 次写入

#### 使用步骤

**1. 创建 D1 数据库**

```bash
# 创建数据库
npx wrangler d1 create yjp-database

# 输出会显示数据库 ID，复制它
```

**2. 更新 wrangler.toml**

```toml
name = "yjp-cloudeflare-workers"
main = "src/index.js"
compatibility_date = "2024-11-22"

[[d1_databases]]
binding = "DB"  # 在代码中通过 env.DB 访问
database_name = "yjp-database"
database_id = "你的数据库ID"  # 从上一步获取
```

**3. 创建数据表**

创建 `schema.sql`：

```sql
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
```

执行迁移：

```bash
# 本地开发环境
npx wrangler d1 execute yjp-database --local --file=./schema.sql

# 生产环境
npx wrangler d1 execute yjp-database --file=./schema.sql
```

**4. 更新代码使用 D1**

```javascript
// src/index-d1.js
const resolvers = {
  users: async (env) => {
    const { results } = await env.DB.prepare(
      'SELECT * FROM users ORDER BY created_at DESC'
    ).all();
    return { data: { users: results } };
  },
  
  user: async (env, args) => {
    const { results } = await env.DB.prepare(
      'SELECT * FROM users WHERE id = ?'
    ).bind(args.id).all();
    return { data: { user: results[0] || null } };
  },
  
  createUser: async (env, args) => {
    const result = await env.DB.prepare(
      'INSERT INTO users (name, email) VALUES (?, ?) RETURNING *'
    ).bind(args.name, args.email).first();
    return { data: { createUser: result } };
  }
};

export default {
  async fetch(request, env, ctx) {
    // ... 在 handleGraphQL 中传入 env
    const result = handleGraphQL(body.query, body.variables, env);
    // ...
  }
};
```

---

### 2. 🔑 Cloudflare KV（键值存储）

**适用场景：** 配置、缓存、简单的键值数据

**特点：**
- 键值对存储
- 最终一致性（全球同步需要 60 秒）
- 读取极快
- 免费额度：每天 100,000 次读取，1,000 次写入

#### 使用步骤

**1. 创建 KV 命名空间**

```bash
# 生产环境
npx wrangler kv:namespace create "USERS"

# 开发环境
npx wrangler kv:namespace create "USERS" --preview
```

**2. 更新 wrangler.toml**

```toml
[[kv_namespaces]]
binding = "USERS"
id = "你的KV命名空间ID"
preview_id = "你的预览KV命名空间ID"
```

**3. 使用 KV 存储**

```javascript
// 存储用户
await env.USERS.put('user:1', JSON.stringify({
  id: '1',
  name: '张三',
  email: 'zhangsan@example.com'
}));

// 读取用户
const userData = await env.USERS.get('user:1', 'json');

// 删除用户
await env.USERS.delete('user:1');

// 列出所有键（有限制）
const { keys } = await env.USERS.list({ prefix: 'user:' });
```

**注意：** KV 不适合频繁写入和复杂查询，更适合缓存场景。

---

### 3. 🔄 Durable Objects（有状态对象）

**适用场景：** 实时协作、聊天室、游戏状态、需要强一致性的场景

**特点：**
- 强一致性
- 每个对象有独立的状态
- 支持 WebSocket
- 适合实时应用

#### 基本示例

```javascript
export class UserManager {
  constructor(state, env) {
    this.state = state;
  }

  async fetch(request) {
    // 从持久化存储读取
    let users = await this.state.storage.get('users') || [];
    
    // 处理请求...
    
    // 保存到持久化存储
    await this.state.storage.put('users', users);
    
    return new Response(JSON.stringify(users));
  }
}
```

---

## 推荐方案对比

| 方案 | 适用场景 | 一致性 | 查询能力 | 成本 |
|------|---------|--------|---------|------|
| **D1** | 结构化数据、复杂查询 | 强一致 | SQL 查询 | 免费额度大 |
| **KV** | 缓存、配置、简单数据 | 最终一致 | 键值查询 | 读取免费额度大 |
| **Durable Objects** | 实时应用、强一致性 | 强一致 | 自定义 | 按使用计费 |

---

## 🚀 快速迁移到 D1（推荐）

我已经为你准备了完整的 D1 迁移方案。按照以下步骤操作：

### 步骤 1: 创建数据库

```bash
cd /Users/edy/Documents/web3/yjp-cloudeflare/yjp-cloudeflare-workers
npx wrangler d1 create yjp-database
```

### 步骤 2: 复制输出的数据库配置到 wrangler.toml

输出会类似：
```toml
[[d1_databases]]
binding = "DB"
database_name = "yjp-database"
database_id = "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
```

### 步骤 3: 创建数据表

我已经准备好了 schema.sql 文件（见项目根目录）

```bash
# 本地测试
npx wrangler d1 execute yjp-database --local --file=./schema.sql

# 生产环境
npx wrangler d1 execute yjp-database --file=./schema.sql
```

### 步骤 4: 使用新的代码

我已经准备了 `src/index-d1.js`，你可以：
- 备份当前的 `src/index.js`
- 将 `src/index-d1.js` 重命名为 `src/index.js`

### 步骤 5: 测试和部署

```bash
# 本地测试
npm run dev

# 部署到生产
npm run deploy
```

---

## 💡 最佳实践建议

### 对于你的项目（用户管理系统）

**推荐使用 D1**，因为：

1. ✅ 支持复杂的 SQL 查询（查找、排序、分页）
2. ✅ 数据结构化，易于管理
3. ✅ 免费额度充足
4. ✅ 全球分布式，低延迟
5. ✅ 支持事务和关系

### 混合使用方案

```
D1: 存储用户数据（主数据）
KV: 缓存热门查询结果
Durable Objects: 实时在线状态（如果需要）
```

---

## 📚 相关资源

- [Cloudflare D1 文档](https://developers.cloudflare.com/d1/)
- [Cloudflare KV 文档](https://developers.cloudflare.com/kv/)
- [Durable Objects 文档](https://developers.cloudflare.com/durable-objects/)
- [定价信息](https://developers.cloudflare.com/workers/platform/pricing/)

---

## ❓ 常见问题

**Q: 免费额度够用吗？**
A: D1 免费额度每天 10 万次读取、5 万次写入，对于中小型应用完全够用。

**Q: 数据会丢失吗？**
A: 使用 D1/KV/Durable Objects 的数据都是持久化的，不会因为 Worker 重启而丢失。

**Q: 如何备份数据？**
A: D1 支持导出 SQL，可以定期备份。KV 可以通过 API 导出所有键值。

**Q: 可以使用外部数据库吗？**
A: 可以，但会增加延迟。Cloudflare Workers 可以连接外部数据库（如 PostgreSQL、MySQL），但推荐使用 Cloudflare 原生存储以获得最佳性能。
