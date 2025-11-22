// Cloudflare Workers GraphQL API + D1
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

// 简易 GraphQL 解析
const parseQuery = (query) => {
  const clean = query.replace(/#[^\n]*/g, '').trim();
  // 支持简写查询 { ... }
  if (clean.startsWith('{')) return { type: 'query', content: clean.slice(1, -1).trim() };
  
  const type = clean.startsWith('mutation') ? 'mutation' : 'query';
  // 修复：使用 $2 获取内容
  const content = clean.replace(/^(query|mutation)\s*(?:\w+)?\s*(?:\([^)]*\))?\s*\{([\s\S]+)\}/, '$2').trim();
  return { type, content };
};

const resolvers = {
  hello: async () => ({ data: { hello: 'Hello from Cloudflare Workers + D1!' } }),
  
  users: async (env) => {
    try {
      const { results } = await env.DB.prepare('SELECT id, name, email, created_at as createdAt FROM users ORDER BY created_at DESC').all();
      return { data: { users: results } };
    } catch (e) { return { errors: [{ message: e.message }] }; }
  },
  
  user: async (env, { id }) => {
    try {
      const result = await env.DB.prepare('SELECT id, name, email, created_at as createdAt FROM users WHERE id = ?').bind(id).first();
      return { data: { user: result } };
    } catch (e) { return { errors: [{ message: e.message }] }; }
  },
  
  createUser: async (env, { name, email }) => {
    try {
      const existing = await env.DB.prepare('SELECT id FROM users WHERE email = ?').bind(email).first();
      if (existing) return { errors: [{ message: '邮箱已存在' }] };
      
      const result = await env.DB.prepare('INSERT INTO users (name, email) VALUES (?, ?) RETURNING id, name, email, created_at as createdAt').bind(name, email).first();
      return { data: { createUser: result } };
    } catch (e) { return { errors: [{ message: e.message }] }; }
  }
};

async function handleGraphQL(query, variables, env) {
  try {
    const { content } = parseQuery(query);
    if (content.includes('hello')) return resolvers.hello();
    if (content.includes('users') && !content.includes('user(')) return resolvers.users(env);
    if (content.includes('user(id:')) {
      const id = content.match(/user\(id:\s*"([^"]+)"\)/)?.[1];
      return id ? resolvers.user(env, { id }) : { errors: [{ message: 'Invalid ID' }] };
    }
    if (content.includes('createUser')) {
      const name = variables.name || content.match(/name:\s*"([^"]+)"/)?.[1];
      const email = variables.email || content.match(/email:\s*"([^"]+)"/)?.[1];
      return (name && email) ? resolvers.createUser(env, { name, email }) : { errors: [{ message: 'Missing args' }] };
    }
    return { errors: [{ message: 'Query not supported' }] };
  } catch (e) { return { errors: [{ message: e.message }] }; }
}

export default {
  async fetch(req, env) {
    const url = new URL(req.url);
    if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

    if (url.pathname === '/graphql') {
      if (req.method === 'POST') {
        const { query, variables = {} } = await req.json();
        const result = await handleGraphQL(query, variables, env);
        return new Response(JSON.stringify(result), { headers: { 'Content-Type': 'application/json', ...corsHeaders } });
      }
      return new Response(playgroundHTML, { headers: { 'Content-Type': 'text/html', ...corsHeaders } });
    }

    if (url.pathname === '/health') {
      const dbOk = await env.DB.prepare('SELECT 1').first().then(() => true).catch(() => false);
      return new Response(JSON.stringify({ status: 'ok', db: dbOk }), { headers: { 'Content-Type': 'application/json', ...corsHeaders } });
    }

    return new Response('YJP GraphQL API', { headers: corsHeaders });
  }
};

const playgroundHTML = `<!DOCTYPE html>
<html><head><title>GraphQL Playground</title>
<style>body{font-family:system-ui;padding:20px;background:#f4f4f9;max-width:800px;margin:0 auto}textarea{width:100%;height:150px;margin:10px 0;padding:10px;border-radius:5px;border:1px solid #ccc}button{background:#007bff;color:#fff;border:none;padding:10px 20px;border-radius:5px;cursor:pointer}pre{background:#2d2d2d;color:#fff;padding:15px;border-radius:5px;overflow:auto}</style>
</head><body>
<h1>GraphQL Playground</h1>
<textarea id="q">query { users { id name email } }</textarea>
<button onclick="run()">Run</button>
<pre id="r"></pre>
<script>async function run(){const q=document.getElementById('q').value;const r=document.getElementById('r');r.innerText='Loading...';try{const res=await fetch('/graphql',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({query:q})});r.innerText=JSON.stringify(await res.json(),null,2)}catch(e){r.innerText=e.message}}</script>
</body></html>`;
