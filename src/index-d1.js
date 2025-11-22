// 使用 Cloudflare D1 数据库的 GraphQL 服务器实现

// GraphQL 解析器
class GraphQLParser {
  static parseQuery(query) {
    const cleanQuery = query.replace(/#[^\n]*/g, '').trim();
    const queryMatch = cleanQuery.match(/query\s*(?:\w+)?\s*(?:\([^)]*\))?\s*\{([\s\S]+)\}/);
    const mutationMatch = cleanQuery.match(/mutation\s*(?:\w+)?\s*(?:\([^)]*\))?\s*\{([\s\S]+)\}/);
    
    if (queryMatch) {
      return { type: 'query', content: queryMatch[1].trim() };
    } else if (mutationMatch) {
      return { type: 'mutation', content: mutationMatch[1].trim() };
    }
    return null;
  }
}

// GraphQL Resolvers（使用 D1 数据库）
const resolvers = {
  hello: async () => {
    return { data: { hello: 'Hello from Cloudflare Workers GraphQL API with D1! 你好！' } };
  },
  
  users: async (env) => {
    try {
      const { results } = await env.DB.prepare(
        'SELECT id, name, email, created_at as createdAt FROM users ORDER BY created_at DESC'
      ).all();
      return { data: { users: results } };
    } catch (error) {
      return { errors: [{ message: `Database error: ${error.message}` }] };
    }
  },
  
  user: async (env, args) => {
    try {
      const result = await env.DB.prepare(
        'SELECT id, name, email, created_at as createdAt FROM users WHERE id = ?'
      ).bind(args.id).first();
      return { data: { user: result || null } };
    } catch (error) {
      return { errors: [{ message: `Database error: ${error.message}` }] };
    }
  },
  
  createUser: async (env, args) => {
    try {
      // 检查邮箱是否已存在
      const existing = await env.DB.prepare(
        'SELECT id FROM users WHERE email = ?'
      ).bind(args.email).first();
      
      if (existing) {
        return { errors: [{ message: '该邮箱已被使用' }] };
      }
      
      // 插入新用户
      const result = await env.DB.prepare(
        'INSERT INTO users (name, email) VALUES (?, ?) RETURNING id, name, email, created_at as createdAt'
      ).bind(args.name, args.email).first();
      
      return { data: { createUser: result } };
    } catch (error) {
      return { errors: [{ message: `Database error: ${error.message}` }] };
    }
  }
};

// 处理 GraphQL 请求
async function handleGraphQL(query, variables = {}, env) {
  try {
    const parsed = GraphQLParser.parseQuery(query);
    if (!parsed) {
      return { errors: [{ message: 'Invalid query' }] };
    }

    const content = parsed.content;

    // Hello 查询
    if (content.includes('hello')) {
      return await resolvers.hello();
    }

    // Users 查询
    if (content.includes('users') && !content.includes('user(')) {
      return await resolvers.users(env);
    }

    // User 查询（单个）
    if (content.includes('user(id:')) {
      const idMatch = content.match(/user\(id:\s*"([^"]+)"\)/);
      if (idMatch) {
        return await resolvers.user(env, { id: idMatch[1] });
      }
    }

    // CreateUser 变更
    if (content.includes('createUser')) {
      const nameMatch = content.match(/name:\s*"([^"]+)"/);
      const emailMatch = content.match(/email:\s*"([^"]+)"/);
      
      if (variables.name && variables.email) {
        return await resolvers.createUser(env, { name: variables.name, email: variables.email });
      } else if (nameMatch && emailMatch) {
        return await resolvers.createUser(env, { name: nameMatch[1], email: emailMatch[1] });
      }
    }

    return { errors: [{ message: 'Query not supported' }] };
  } catch (error) {
    return { errors: [{ message: error.message }] };
  }
}

// CORS Headers
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

// Worker 主处理函数
export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    // 处理 CORS 预检请求
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        headers: corsHeaders
      });
    }

    // GraphQL 端点
    if (url.pathname === '/graphql') {
      if (request.method === 'POST') {
        try {
          const body = await request.json();
          const result = await handleGraphQL(body.query, body.variables || {}, env);

          return new Response(JSON.stringify(result), {
            headers: {
              'Content-Type': 'application/json',
              ...corsHeaders
            }
          });
        } catch (error) {
          return new Response(JSON.stringify({ 
            errors: [{ message: error.message }]
          }), {
            status: 400,
            headers: {
              'Content-Type': 'application/json',
              ...corsHeaders
            }
          });
        }
      }

      // GET 请求 - 返回 GraphQL Playground HTML
      if (request.method === 'GET') {
        return new Response(getPlaygroundHTML(), {
          headers: {
            'Content-Type': 'text/html',
            ...corsHeaders
          }
        });
      }
    }

    // 健康检查端点
    if (url.pathname === '/health') {
      // 测试数据库连接
      let dbStatus = 'unknown';
      try {
        await env.DB.prepare('SELECT 1').first();
        dbStatus = 'connected';
      } catch (error) {
        dbStatus = 'error: ' + error.message;
      }

      return new Response(JSON.stringify({ 
        status: 'ok',
        message: 'GraphQL API is running with D1 database',
        database: dbStatus,
        timestamp: new Date().toISOString()
      }), {
        headers: {
          'Content-Type': 'application/json',
          ...corsHeaders
        }
      });
    }

    // 默认路由
    return new Response(JSON.stringify({
      message: 'Welcome to YJP Cloudflare Workers GraphQL API with D1',
      endpoints: {
        graphql: '/graphql',
        health: '/health'
      }
    }), {
      headers: {
        'Content-Type': 'application/json',
        ...corsHeaders
      }
    });
  }
};

// GraphQL Playground HTML
function getPlaygroundHTML() {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>GraphQL Playground - D1 Edition</title>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      min-height: 100vh;
      padding: 20px;
    }
    .container {
      max-width: 1200px;
      margin: 0 auto;
      background: white;
      border-radius: 12px;
      padding: 30px;
      box-shadow: 0 20px 60px rgba(0,0,0,0.3);
    }
    h1 {
      color: #333;
      margin-bottom: 10px;
    }
    .subtitle {
      color: #666;
      margin-bottom: 30px;
    }
    .badge {
      display: inline-block;
      background: #4caf50;
      color: white;
      padding: 4px 12px;
      border-radius: 12px;
      font-size: 12px;
      font-weight: 600;
      margin-left: 10px;
    }
    .section {
      margin-bottom: 30px;
    }
    h2 {
      color: #667eea;
      border-bottom: 2px solid #667eea;
      padding-bottom: 10px;
      margin-bottom: 15px;
    }
    pre {
      background: #f5f5f5;
      padding: 15px;
      border-radius: 8px;
      overflow-x: auto;
      border-left: 4px solid #667eea;
    }
    code {
      font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
      font-size: 14px;
    }
    .endpoint {
      background: #e8f4f8;
      padding: 10px 15px;
      border-radius: 6px;
      margin-bottom: 10px;
      font-family: monospace;
    }
    .test-section {
      background: #f9f9f9;
      padding: 20px;
      border-radius: 8px;
      margin-top: 20px;
    }
    textarea {
      width: 100%;
      min-height: 150px;
      padding: 10px;
      border: 2px solid #ddd;
      border-radius: 6px;
      font-family: monospace;
      font-size: 14px;
      margin-bottom: 10px;
    }
    button {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      border: none;
      padding: 10px 20px;
      border-radius: 6px;
      cursor: pointer;
      font-size: 16px;
      font-weight: 600;
    }
    button:hover {
      opacity: 0.9;
    }
    #result {
      background: #2d2d2d;
      color: #f8f8f2;
      padding: 15px;
      border-radius: 6px;
      margin-top: 10px;
      white-space: pre-wrap;
      font-family: monospace;
      font-size: 14px;
      display: none;
    }
  </style>
</head>
<body>
  <div class="container">
    <h1>🚀 GraphQL API Playground <span class="badge">D1 数据库</span></h1>
    <p class="subtitle">YJP Cloudflare Workers GraphQL API with D1 Database</p>
    
    <div class="section">
      <h2>📍 API 端点</h2>
      <div class="endpoint">POST /graphql - GraphQL 查询和变更</div>
      <div class="endpoint">GET /health - 健康检查（包含数据库状态）</div>
    </div>

    <div class="section">
      <h2>📝 示例查询 (Queries)</h2>
      <pre><code># 获取所有用户（从 D1 数据库）
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
    createdAt
  }
}

# Hello 查询
query {
  hello
}</code></pre>
    </div>

    <div class="section">
      <h2>✏️ 示例变更 (Mutations)</h2>
      <pre><code># 创建新用户（保存到 D1 数据库）
mutation {
  createUser(name: "王五", email: "wangwu@example.com") {
    id
    name
    email
    createdAt
  }
}

# 使用变量创建用户
mutation CreateUser($name: String!, $email: String!) {
  createUser(name: $name, email: $email) {
    id
    name
    email
    createdAt
  }
}

# 变量（在单独的 JSON 中发送）:
# {
#   "name": "赵六",
#   "email": "zhaoliu@example.com"
# }</code></pre>
    </div>

    <div class="section test-section">
      <h2>🧪 在线测试</h2>
      <textarea id="queryInput" placeholder="输入你的 GraphQL 查询...">query {
  users {
    id
    name
    email
    createdAt
  }
}</textarea>
      <button onclick="executeQuery()">执行查询</button>
      <div id="result"></div>
    </div>

    <div class="section">
      <h2>💾 数据持久化</h2>
      <p>✅ 使用 Cloudflare D1 SQLite 数据库</p>
      <p>✅ 数据永久保存，不会因 Worker 重启而丢失</p>
      <p>✅ 全球分布式，低延迟访问</p>
      <p>✅ 支持复杂 SQL 查询</p>
    </div>
  </div>

  <script>
    async function executeQuery() {
      const query = document.getElementById('queryInput').value;
      const resultDiv = document.getElementById('result');
      
      try {
        const response = await fetch('/graphql', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ query })
        });
        
        const data = await response.json();
        resultDiv.textContent = JSON.stringify(data, null, 2);
        resultDiv.style.display = 'block';
      } catch (error) {
        resultDiv.textContent = 'Error: ' + error.message;
        resultDiv.style.display = 'block';
      }
    }
  </script>
</body>
</html>
  `;
}
