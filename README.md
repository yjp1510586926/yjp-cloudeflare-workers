# YJP Cloudflare Workers - GraphQL API

这是一个部署在 Cloudflare Workers 上的 GraphQL API 服务。

## 功能特性

- ✅ GraphQL API 支持
- ✅ CORS 跨域支持
- ✅ 内置 GraphQL Playground
- ✅ 用户查询和变更操作
- ✅ 健康检查端点

## 本地开发

### 安装依赖

```bash
npm install
```

### 启动开发服务器

```bash
npm run dev
```

开发服务器将在 `http://localhost:8787` 启动。

访问 `http://localhost:8787/graphql` 可以看到 GraphQL Playground 界面。

## API 端点

### GraphQL 端点
- **POST** `/graphql` - GraphQL 查询和变更
- **GET** `/graphql` - GraphQL Playground 界面

### 健康检查
- **GET** `/health` - 检查 API 状态

## GraphQL Schema

### 查询 (Queries)

```graphql
# 获取所有用户
query {
  users {
    id
    name
    email
    createdAt
  }
}

# 获取单个用户
query {
  user(id: "1") {
    id
    name
    email
  }
}

# Hello 查询
query {
  hello
}
```

### 变更 (Mutations)

```graphql
# 创建新用户
mutation {
  createUser(name: "张三", email: "zhangsan@example.com") {
    id
    name
    email
    createdAt
  }
}
```

## 部署到 Cloudflare Workers

### 首次部署

```bash
npm run deploy
```

### 配置

在 `wrangler.toml` 文件中配置你的 Worker 名称和其他设置。

## 在前端项目中使用

### 基础示例

```javascript
const API_URL = 'https://your-worker.workers.dev/graphql';

async function fetchUsers() {
  const response = await fetch(API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      query: `
        query {
          users {
            id
            name
            email
          }
        }
      `
    })
  });
  
  const { data } = await response.json();
  return data.users;
}
```

### 使用变量

```javascript
async function createUser(name, email) {
  const response = await fetch(API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      query: `
        mutation CreateUser($name: String!, $email: String!) {
          createUser(name: $name, email: $email) {
            id
            name
            email
            createdAt
          }
        }
      `,
      variables: { name, email }
    })
  });
  
  const { data } = await response.json();
  return data.createUser;
}
```

## 项目结构

```
yjp-cloudeflare-workers/
├── src/
│   └── index.js          # GraphQL 服务器主文件
├── wrangler.toml         # Cloudflare Workers 配置
├── package.json          # 项目依赖
└── README.md            # 项目文档
```

## 技术栈

- **Cloudflare Workers** - 边缘计算平台
- **GraphQL** - API 查询语言
- **Wrangler** - Cloudflare Workers CLI 工具

## 注意事项

### ⚠️ 数据存储

**当前版本：内存存储（仅用于开发测试）**

- ❌ Worker 重启后数据会丢失
- ❌ 每个 Worker 实例数据独立
- ❌ 不适合生产环境

**生产环境推荐：Cloudflare D1 数据库**

我们已经为你准备好了完整的 D1 迁移方案：

1. 📖 **[数据存储方案指南](./STORAGE_GUIDE.md)** - 了解 D1、KV、Durable Objects 的区别和使用场景
2. 🚀 **[D1 快速迁移指南](./D1_MIGRATION.md)** - 一步步将项目迁移到 D1 数据库
3. 📄 **[schema.sql](./schema.sql)** - D1 数据库表结构
4. 💻 **[src/index-d1.js](./src/index-d1.js)** - 使用 D1 的完整代码实现

**快速开始使用 D1：**

```bash
# 1. 创建数据库
npx wrangler d1 create yjp-database

# 2. 初始化表结构
npx wrangler d1 execute yjp-database --local --file=./schema.sql

# 3. 切换到 D1 版本
cp src/index.js src/index-memory.js  # 备份
cp src/index-d1.js src/index.js      # 使用 D1 版本

# 4. 测试
npm run dev
```

详细步骤请查看 [D1_MIGRATION.md](./D1_MIGRATION.md)

### CORS 配置

已配置 CORS 允许所有来源访问，生产环境请根据需要限制。

## 下一步

- [x] 集成 Cloudflare D1 数据库（已准备好迁移方案）
- [ ] 添加身份验证
- [ ] 添加更多 API 功能（分页、搜索、排序）
- [ ] 添加单元测试

## 相关文档

- 📖 [数据存储方案指南](./STORAGE_GUIDE.md)
- 🚀 [D1 快速迁移指南](./D1_MIGRATION.md)
- 🌐 [Cloudflare Workers 文档](https://developers.cloudflare.com/workers/)
- 🗄️ [Cloudflare D1 文档](https://developers.cloudflare.com/d1/)
