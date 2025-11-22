# YJP Cloudflare Workers - GraphQL API

基于 Cloudflare Workers 和 D1 数据库的 GraphQL API 服务。

## 🚀 快速开始

### 本地开发

```bash
# 安装依赖
npm install

# 启动本地开发服务器
npm run dev
```

本地 API 地址: `http://localhost:8787/graphql`

### 部署到生产环境

```bash
# 部署到 Cloudflare Workers
npm run deploy
```

生产 API 地址: `https://yjp-cloudeflare-workers.yangjinpeng.workers.dev/graphql`

## 📊 数据库管理

### 初始化数据库

```bash
# 本地数据库
npm run db:init

# 生产数据库
npm run db:init:remote
```

### 查看数据

```bash
# 本地数据库
npx wrangler d1 execute yjp-database --local --command "SELECT * FROM users"

# 生产数据库
npx wrangler d1 execute yjp-database --remote --command "SELECT * FROM users"
```

## 🔌 GraphQL API

### 查询示例

#### 1. Hello 查询
```graphql
query {
  hello
}
```

#### 2. 获取所有用户
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

#### 3. 获取单个用户
```graphql
query GetUser($id: ID!) {
  user(id: $id) {
    id
    name
    email
    createdAt
  }
}
```

#### 4. 创建用户
```graphql
mutation CreateUser($name: String!, $email: String!) {
  createUser(name: $name, email: $email) {
    id
    name
    email
    createdAt
  }
}
```

### 使用 curl 测试

```bash
# Hello 查询
curl -X POST http://localhost:8787/graphql \
  -H "Content-Type: application/json" \
  -d '{"query":"query { hello }"}'

# 获取用户列表
curl -X POST http://localhost:8787/graphql \
  -H "Content-Type: application/json" \
  -d '{"query":"query { users { id name email } }"}'

# 创建用户
curl -X POST http://localhost:8787/graphql \
  -H "Content-Type: application/json" \
  -d '{"query":"mutation { createUser(name: \"测试用户\", email: \"test@example.com\") { id name email } }"}'
```

## 📁 项目结构

```
yjp-cloudeflare-workers/
├── src/
│   ├── index.js       # GraphQL 服务器主文件
│   └── schema.sql     # 数据库 Schema
├── wrangler.toml      # Cloudflare Workers 配置
└── package.json       # 项目依赖
```

## 🛠️ 技术栈

- **Cloudflare Workers** - 边缘计算平台
- **D1 Database** - Cloudflare 的 SQLite 数据库
- **GraphQL** - API 查询语言
- **Wrangler** - Cloudflare 开发工具

## 📝 环境变量

在 `wrangler.toml` 中配置：

```toml
[[d1_databases]]
binding = "DB"
database_name = "yjp-database"
database_id = "41d0ebf5-ea5f-415c-ad94-c14425b2026f"
```

## 🔗 相关链接

- [Cloudflare Workers 文档](https://developers.cloudflare.com/workers/)
- [D1 数据库文档](https://developers.cloudflare.com/d1/)
- [GraphQL 文档](https://graphql.org/)
