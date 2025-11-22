# 🚀 快速迁移到 D1 数据库

按照以下步骤将项目从内存存储迁移到 Cloudflare D1 持久化数据库。

## 步骤 1: 创建 D1 数据库

```bash
cd /Users/edy/Documents/web3/yjp-cloudeflare/yjp-cloudeflare-workers
npx wrangler d1 create yjp-database
```

**重要：** 复制输出中的数据库配置信息，类似这样：

```toml
[[d1_databases]]
binding = "DB"
database_name = "yjp-database"
database_id = "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
```

## 步骤 2: 更新 wrangler.toml

打开 `wrangler.toml` 文件，添加数据库配置：

```toml
name = "yjp-cloudeflare-workers"
main = "src/index.js"
compatibility_date = "2024-11-22"

# 添加这部分（使用步骤1中获取的配置）
[[d1_databases]]
binding = "DB"
database_name = "yjp-database"
database_id = "你的数据库ID"  # 替换为实际的 ID

[env.production]
name = "yjp-cloudeflare-workers"
```

## 步骤 3: 创建数据表

### 本地开发环境

```bash
npx wrangler d1 execute yjp-database --local --file=./schema.sql
```

### 生产环境

```bash
npx wrangler d1 execute yjp-database --file=./schema.sql
```

## 步骤 4: 切换到 D1 版本代码

### 方法 1: 备份并替换（推荐）

```bash
# 备份当前版本
cp src/index.js src/index-memory.js

# 使用 D1 版本
cp src/index-d1.js src/index.js
```

### 方法 2: 手动修改

如果你想保留自定义修改，可以手动将 `src/index-d1.js` 的内容复制到 `src/index.js`。

## 步骤 5: 本地测试

```bash
# 启动本地开发服务器
npm run dev
```

访问 `http://localhost:8787/graphql` 测试：

1. 查看 Playground 页面（应该显示 "D1 数据库" 标记）
2. 执行查询测试：
   ```graphql
   query {
     users {
       id
       name
       email
       createdAt
     }
   }
   ```
3. 测试创建用户：
   ```graphql
   mutation {
     createUser(name: "测试用户", email: "test@example.com") {
       id
       name
       email
     }
   }
   ```

## 步骤 6: 部署到生产环境

```bash
npm run deploy
```

## 验证部署

部署成功后，访问你的 Worker URL：

```bash
# 健康检查（会显示数据库状态）
curl https://your-worker.workers.dev/health

# GraphQL 查询
curl -X POST https://your-worker.workers.dev/graphql \
  -H "Content-Type: application/json" \
  -d '{"query":"{ users { id name email } }"}'
```

## 常见问题

### Q: 本地测试时找不到数据库？

A: 确保使用 `--local` 参数初始化本地数据库：
```bash
npx wrangler d1 execute yjp-database --local --file=./schema.sql
```

### Q: 生产环境没有数据？

A: 需要分别在生产环境执行 schema：
```bash
npx wrangler d1 execute yjp-database --file=./schema.sql
```

### Q: 如何查看数据库内容？

```bash
# 本地
npx wrangler d1 execute yjp-database --local --command "SELECT * FROM users"

# 生产
npx wrangler d1 execute yjp-database --command "SELECT * FROM users"
```

### Q: 如何回滚到内存版本？

```bash
cp src/index-memory.js src/index.js
npm run dev
```

## 数据迁移（如果需要）

如果你在内存版本中已经创建了一些测试数据，可以通过前端界面重新创建，或者使用 SQL 插入：

```bash
npx wrangler d1 execute yjp-database --command \
  "INSERT INTO users (name, email) VALUES ('用户名', 'email@example.com')"
```

## 下一步

迁移完成后，你可以：

1. ✅ 数据永久保存，不会丢失
2. ✅ 支持更复杂的查询（分页、搜索、排序）
3. ✅ 添加更多表（如文章、评论等）
4. ✅ 使用 SQL 关系查询

查看 `STORAGE_GUIDE.md` 了解更多高级功能。
