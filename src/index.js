// 简单的 GraphQL 解析器（不依赖外部库）
class GraphQLParser {
  static parseQuery(query) {
    // 移除注释和多余空格
    const cleanQuery = query.replace(/#[^\n]*/g, '').trim();
    
    // 匹配 query 或 mutation（支持带变量的格式）
    // 例如: mutation CreateUser($name: String!, $email: String!) { ... }
    // 或: mutation { ... }
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

// 模拟数据库
let users = [
  { id: '1', name: '张三', email: 'zhangsan@example.com', createdAt: new Date().toISOString() },
  { id: '2', name: '李四', email: 'lisi@example.com', createdAt: new Date().toISOString() }
];

// GraphQL Resolvers
const resolvers = {
  hello: () => {
    return { data: { hello: 'Hello from Cloudflare Workers GraphQL API! 你好！' } };
  },
  
  users: () => {
    return { data: { users } };
  },
  
  user: (args) => {
    const user = users.find(u => u.id === args.id);
    return { data: { user } };
  },
  
  createUser: (args) => {
    const newUser = {
      id: String(users.length + 1),
      name: args.name,
      email: args.email,
      createdAt: new Date().toISOString()
    };
    users.push(newUser);
    return { data: { createUser: newUser } };
  }
};

// 处理 GraphQL 请求
function handleGraphQL(query, variables = {}) {
  try {
    // 解析查询
    const parsed = GraphQLParser.parseQuery(query);
    if (!parsed) {
      return { errors: [{ message: 'Invalid query' }] };
    }

    const content = parsed.content;

    // Hello 查询
    if (content.includes('hello')) {
      return resolvers.hello();
    }

    // Users 查询
    if (content.includes('users') && !content.includes('user(')) {
      return resolvers.users();
    }

    // User 查询（单个）
    if (content.includes('user(id:')) {
      const idMatch = content.match(/user\(id:\s*"([^"]+)"\)/);
      if (idMatch) {
        return resolvers.user({ id: idMatch[1] });
      }
    }

    // CreateUser 变更
    if (content.includes('createUser')) {
      const nameMatch = content.match(/name:\s*"([^"]+)"/);
      const emailMatch = content.match(/email:\s*"([^"]+)"/);
      
      if (variables.name && variables.email) {
        return resolvers.createUser({ name: variables.name, email: variables.email });
      } else if (nameMatch && emailMatch) {
        return resolvers.createUser({ name: nameMatch[1], email: emailMatch[1] });
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
          const result = handleGraphQL(body.query, body.variables || {});

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
      return new Response(JSON.stringify({ 
        status: 'ok',
        message: 'GraphQL API is running',
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
      message: 'Welcome to YJP Cloudflare Workers GraphQL API',
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
  <title>GraphQL Playground</title>
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
    <h1>🚀 GraphQL API Playground</h1>
    <p class="subtitle">YJP Cloudflare Workers GraphQL API</p>
    
    <div class="section">
      <h2>📍 API 端点</h2>
      <div class="endpoint">POST /graphql</div>
      <div class="endpoint">GET /health</div>
    </div>

    <div class="section">
      <h2>📝 示例查询 (Queries)</h2>
      <pre><code># 获取所有用户
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
}</code></pre>
    </div>

    <div class="section">
      <h2>✏️ 示例变更 (Mutations)</h2>
      <pre><code># 创建新用户
mutation {
  createUser(name: "王五", email: "wangwu@example.com") {
    id
    name
    email
    createdAt
  }
}</code></pre>
    </div>

    <div class="section test-section">
      <h2>🧪 在线测试</h2>
      <textarea id="queryInput" placeholder="输入你的 GraphQL 查询...">query {
  users {
    id
    name
    email
  }
}</textarea>
      <button onclick="executeQuery()">执行查询</button>
      <div id="result"></div>
    </div>

    <div class="section">
      <h2>🔧 使用 cURL 测试</h2>
      <pre><code>curl -X POST \\
  -H "Content-Type: application/json" \\
  -d '{"query":"{ users { id name email } }"}' \\
  https://your-worker.workers.dev/graphql</code></pre>
    </div>

    <div class="section">
      <h2>💻 在前端中使用</h2>
      <pre><code>// 使用 fetch API
const response = await fetch('https://your-worker.workers.dev/graphql', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    query: \`
      query {
        users {
          id
          name
          email
        }
      }
    \`
  })
});

const data = await response.json();
console.log(data);</code></pre>
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
