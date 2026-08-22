// ============================================
// Netlify Function (现代 API): admins API
// 管理员注册/登录 + 6 位数字凭证生成
// 数据持久化使用 Netlify Blobs（现代 API 下自动配置）
// ============================================
import { getStore } from '@netlify/blobs';

const STORE_NAME = 'admins';

async function readAll() {
  const store = getStore(STORE_NAME);
  // 重试机制：Netlify Blobs 多副本最终一致性偶尔返回 null
  // 5 次重试 × 200ms 间隔，总等待 ~1s，覆盖绝大多数不一致窗口
  let raw = null;
  for (let i = 0; i < 5; i++) {
    try {
      raw = await store.get('list');
      if (raw) break;
    } catch (e) {
      console.error(`[admins] readAll 第 ${i + 1} 次读取失败:`, e.message);
    }
    // 短暂等待后重试
    await new Promise((r) => setTimeout(r, 200));
  }
  return raw ? JSON.parse(raw) : [];
}

async function writeAll(list) {
  const store = getStore(STORE_NAME);
  await store.set('list', JSON.stringify(list));
}

/** 生成唯一 6 位数字凭证（避免与已有凭证重复） */
async function generateUniqueCode() {
  const list = await readAll();
  const existingCodes = new Set(list.map((a) => a.code));
  let code;
  let attempts = 0;
  do {
    code = String(Math.floor(100000 + Math.random() * 900000));
    attempts++;
    if (attempts > 100) break;
  } while (existingCodes.has(code));
  return code;
}

function json(data, status = 200) {
  return Response.json(data, {
    status,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
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
        'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type'
      }
    });
  }

  const url = new URL(req.url);
  const action = url.pathname.replace(/^\/+/, '').replace(/^api\/admins\/?/, '');

  try {
    // POST /api/admins/register —— 注册
    if (req.method === 'POST' && action === 'register') {
      const payload = await req.json();
      const jiyuanId = String(payload.jiyuanId || '').trim();
      const name = String(payload.name || '').trim();
      const password = String(payload.password || '');

      if (!jiyuanId || !name || !password) {
        return json({ success: false, message: '默小乐仙女手机号、姓名、密码均不能为空' }, 400);
      }
      if (password.length < 6) {
        return json({ success: false, message: '密码长度至少 6 位' }, 400);
      }

      const list = await readAll();
      if (list.some((a) => a.jiyuanId === jiyuanId)) {
        return json({ success: false, message: '该默小乐仙女手机号已注册' }, 409);
      }

      const code = await generateUniqueCode();
      const admin = {
        id: `a_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        jiyuanId,
        name,
        password, // 简化版：明文存储
        code,
        createdAt: new Date().toISOString()
      };
      list.push(admin);
      await writeAll(list);

      const { password: _pw, ...safeAdmin } = admin;
      return json({ success: true, data: safeAdmin }, 201);
    }

    // POST /api/admins/login —— 登录
    if (req.method === 'POST' && action === 'login') {
      const payload = await req.json();
      const jiyuanId = String(payload.jiyuanId || '').trim();
      const password = String(payload.password || '');

      if (!jiyuanId || !password) {
        return json({ success: false, message: '默小乐仙女手机号和密码不能为空' }, 400);
      }

      const list = await readAll();
      const admin = list.find((a) => a.jiyuanId === jiyuanId);
      if (!admin || admin.password !== password) {
        return json({ success: false, message: '默小乐仙女手机号或密码错误' }, 401);
      }

      const { password: _pw, ...safeAdmin } = admin;
      return json({ success: true, data: safeAdmin }, 200);
    }

    // GET /api/admins/verify?code=xxx —— 客户端验证 6 位凭证
    if (req.method === 'GET' && action === 'verify') {
      const code = String(url.searchParams.get('code') || '').trim();
      if (!code) {
        return json({ success: false, message: '凭证不能为空' }, 400);
      }
      const list = await readAll();
      // 区分"数据暂不可用"与"凭证确实无效"
      // list 为空可能是 Netlify Blobs 多副本未同步（实际有数据但读到 null）
      // 返回 503 让客户端可重试，避免误判"凭证无效"
      if (!list || list.length === 0) {
        return json({ success: false, message: '服务暂不可用，请稍后重试' }, 503);
      }
      const admin = list.find((a) => a.code === code);
      if (!admin) {
        return json({ success: false, message: '凭证无效' }, 404);
      }
      return json({
        success: true,
        data: { code: admin.code, name: admin.name }
      }, 200);
    }

    return json({ success: false, message: 'API 不存在' }, 404);
  } catch (err) {
    console.error('[admins API] 异常:', err);
    return json({ success: false, message: '服务器错误' }, 500);
  }
};

// 路由配置：匹配 /api/admins 和 /api/admins/:action
export const config = {
  path: ['/api/admins', '/api/admins/*']
};
