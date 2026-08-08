// ============================================
// 后端服务器
// - 静态文件托管（前端 HTML/CSS/JS）
// - records API（客户测评记录的增删查）
// - JSON 文件持久化（data/records.json）
// ============================================
const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = 8000;
const ROOT = __dirname;
const DATA_DIR = path.join(ROOT, 'data');
const RECORDS_FILE = path.join(DATA_DIR, 'records.json');

// 确保数据目录与文件存在
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
if (!fs.existsSync(RECORDS_FILE)) fs.writeFileSync(RECORDS_FILE, '[]', 'utf-8');

// ---- MIME 类型 ----
const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon'
};

// ---- 工具：读取/写入记录 ----
function readRecords() {
  try {
    return JSON.parse(fs.readFileSync(RECORDS_FILE, 'utf-8') || '[]');
  } catch (err) {
    console.error('[API] 读取记录失败:', err);
    return [];
  }
}

function writeRecords(list) {
  try {
    fs.writeFileSync(RECORDS_FILE, JSON.stringify(list, null, 2), 'utf-8');
  } catch (err) {
    console.error('[API] 写入记录失败:', err);
    throw err;
  }
}

// ---- 解析请求体（JSON）----
function parseBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', (chunk) => {
      body += chunk;
      if (body.length > 5 * 1024 * 1024) {
        // 限制 5MB
        reject(new Error('Body too large'));
        req.destroy();
      }
    });
    req.on('end', () => {
      if (!body) return resolve({});
      try {
        resolve(JSON.parse(body));
      } catch (err) {
        reject(new Error('Invalid JSON'));
      }
    });
    req.on('error', reject);
  });
}

// ---- 发送 JSON 响应 ----
function sendJson(res, status, data) {
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET,POST,DELETE,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type'
  });
  res.end(JSON.stringify(data));
}

// ---- API 路由 ----
async function handleApi(req, res, urlPath) {
  // GET /api/records          获取全部记录
  // GET /api/records/:id      获取单条记录
  // POST /api/records         新增记录
  // DELETE /api/records/:id   删除记录
  // DELETE /api/records       清空全部

  if (urlPath === '/api/records' && req.method === 'GET') {
    const list = readRecords();
    return sendJson(res, 200, { success: true, data: list });
  }

  if (urlPath.startsWith('/api/records/') && req.method === 'GET') {
    const id = urlPath.replace('/api/records/', '');
    const list = readRecords();
    const found = list.find((r) => r.id === id);
    if (!found) return sendJson(res, 404, { success: false, message: '记录不存在' });
    return sendJson(res, 200, { success: true, data: found });
  }

  if (urlPath === '/api/records' && req.method === 'POST') {
    try {
      const body = await parseBody(req);
      // 基础校验：customer 对象 + answers + scores
      if (
        !body.customer ||
        !body.customer.name ||
        !body.answers ||
        !body.scores
      ) {
        return sendJson(res, 400, { success: false, message: '参数缺失' });
      }
      const list = readRecords();
      const record = {
        id: `r_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        createdAt: new Date().toISOString(),
        ...body
      };
      list.unshift(record);
      writeRecords(list);
      return sendJson(res, 201, { success: true, data: record });
    } catch (err) {
      console.error('[API] 新增记录失败:', err);
      return sendJson(res, 500, { success: false, message: '服务器错误' });
    }
  }

  if (urlPath.startsWith('/api/records/') && req.method === 'DELETE') {
    const id = urlPath.replace('/api/records/', '');
    const list = readRecords();
    const next = list.filter((r) => r.id !== id);
    writeRecords(next);
    return sendJson(res, 200, { success: true, data: { id } });
  }

  if (urlPath === '/api/records' && req.method === 'DELETE') {
    writeRecords([]);
    return sendJson(res, 200, { success: true, data: { count: 0 } });
  }

  return sendJson(res, 404, { success: false, message: 'API 不存在' });
}

// ---- 静态文件托管 ----
function serveStatic(req, res, urlPath) {
  let filePath = path.join(ROOT, urlPath);
  if (!filePath.startsWith(ROOT)) {
    res.writeHead(403);
    res.end('Forbidden');
    return;
  }

  // 目录则访问 index.html
  try {
    const stat = fs.statSync(filePath);
    if (stat.isDirectory()) {
      filePath = path.join(filePath, 'index.html');
    }
  } catch (e) {
    // 文件不存在，继续到下方 404
  }

  fs.stat(filePath, (err, stat) => {
    if (err || !stat.isFile()) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('404 Not Found');
      return;
    }
    const ext = path.extname(filePath).toLowerCase();
    const mime = MIME[ext] || 'application/octet-stream';
    res.writeHead(200, { 'Content-Type': mime });
    fs.createReadStream(filePath).pipe(res);
  });
}

// ---- 创建服务器 ----
const server = http.createServer(async (req, res) => {
  try {
    let urlPath = decodeURIComponent(req.url.split('?')[0]);

    // 处理 CORS 预检
    if (req.method === 'OPTIONS') {
      res.writeHead(204, {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET,POST,DELETE,OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type'
      });
      res.end();
      return;
    }

    // API 路由
    if (urlPath.startsWith('/api/')) {
      return await handleApi(req, res, urlPath);
    }

    // 根路径返回入口页
    if (urlPath === '/') {
      urlPath = '/index.html';
    }

    return serveStatic(req, res, urlPath);
  } catch (err) {
    console.error('[Server] 异常:', err);
    res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ success: false, message: '服务器错误' }));
  }
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`[Preview] 服务已启动:`);
  console.log(`  - 入口: http://127.0.0.1:${PORT}`);
  console.log(`  - 客户端: http://127.0.0.1:${PORT}/client.html`);
  console.log(`  - 管理端: http://127.0.0.1:${PORT}/admin.html`);
});
