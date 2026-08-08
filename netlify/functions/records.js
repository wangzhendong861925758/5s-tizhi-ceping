// ============================================
// Netlify Function (现代 API): records API
// 管理客户测评记录，按 managerCode 隔离
// 数据持久化使用 Netlify Blobs（现代 API 下自动配置）
// ============================================
import { getStore } from '@netlify/blobs';

const STORE_NAME = 'records';

async function readAll() {
  const store = getStore(STORE_NAME);
  // 重试机制：Netlify Blobs 冷启动时偶尔返回 null
  let raw = null;
  for (let i = 0; i < 3; i++) {
    try {
      raw = await store.get('list');
      if (raw) break;
    } catch (e) {
      console.error(`[records] readAll 第 ${i + 1} 次读取失败:`, e.message);
    }
    await new Promise((r) => setTimeout(r, 100));
  }
  return raw ? JSON.parse(raw) : [];
}

async function writeAll(list) {
  const store = getStore(STORE_NAME);
  await store.set('list', JSON.stringify(list));
}

function json(data, status = 200) {
  return Response.json(data, {
    status,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET,POST,DELETE,OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type'
    }
  });
}

export default async (req) => {
  // CORS 预检
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET,POST,DELETE,OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type'
      }
    });
  }

  const url = new URL(req.url);
  const pathname = url.pathname.replace(/^\/+/, '').replace(/^api\/records\/?/, '');
  const id = pathname || null;
  const managerCode = String(url.searchParams.get('managerCode') || '').trim();

  try {
    // GET /api/records?managerCode=xxx —— 按管理员凭证获取记录
    if (req.method === 'GET' && !id) {
      if (!managerCode) {
        return json({ success: false, message: '缺少管理员凭证' }, 403);
      }
      const list = await readAll();
      const filtered = list.filter((r) => r.managerCode === managerCode);
      return json({ success: true, data: filtered });
    }

    // GET /api/records/:id?managerCode=xxx —— 获取单条
    if (req.method === 'GET' && id) {
      if (!managerCode) {
        return json({ success: false, message: '缺少管理员凭证' }, 403);
      }
      const list = await readAll();
      const found = list.find((r) => r.id === id && r.managerCode === managerCode);
      if (!found) return json({ success: false, message: '记录不存在或无权访问' }, 404);
      return json({ success: true, data: found });
    }

    // POST /api/records —— 新增（必须含 managerCode）
    if (req.method === 'POST' && !id) {
      const payload = await req.json();
      if (
        !payload.customer ||
        !payload.customer.name ||
        !payload.answers ||
        !payload.scores
      ) {
        return json({ success: false, message: '参数缺失' }, 400);
      }
      if (!payload.managerCode) {
        return json({ success: false, message: '缺少服务人员凭证' }, 400);
      }
      const list = await readAll();
      const record = {
        id: `r_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        createdAt: new Date().toISOString(),
        ...payload
      };
      list.unshift(record);
      await writeAll(list);
      return json({ success: true, data: record }, 201);
    }

    // DELETE /api/records/:id?managerCode=xxx —— 删除单条
    if (req.method === 'DELETE' && id) {
      if (!managerCode) {
        return json({ success: false, message: '缺少管理员凭证' }, 403);
      }
      const list = await readAll();
      console.log('[records DELETE] id=', JSON.stringify(id), 'managerCode=', JSON.stringify(managerCode), 'list长度=', list.length, '所有id=', list.map((r) => r.id));
      const target = list.find((r) => r.id === id && r.managerCode === managerCode);
      if (!target) {
        return json({ success: false, message: '记录不存在或无权删除', debug: { id, managerCode, listCount: list.length, ids: list.map((r) => ({ id: r.id, code: r.managerCode })) } }, 404);
      }
      const next = list.filter((r) => r.id !== id);
      await writeAll(next);
      return json({ success: true, data: { id } });
    }

    // DELETE /api/records?managerCode=xxx —— 清空当前管理员的所有记录
    if (req.method === 'DELETE' && !id) {
      if (!managerCode) {
        return json({ success: false, message: '缺少管理员凭证' }, 403);
      }
      const list = await readAll();
      const remaining = list.filter((r) => r.managerCode !== managerCode);
      const removedCount = list.length - remaining.length;
      await writeAll(remaining);
      return json({ success: true, data: { count: removedCount } });
    }

    return json({ success: false, message: 'API 不存在' }, 404);
  } catch (err) {
    console.error('[records API] 异常:', err);
    return json({ success: false, message: '服务器错误' }, 500);
  }
};

// 路由配置：匹配 /api/records 和 /api/records/:id
export const config = {
  path: ['/api/records', '/api/records/*']
};
