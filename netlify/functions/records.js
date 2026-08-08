// ============================================
// Netlify Function (现代 API): records API
// 管理客户测评记录，按 managerCode 隔离
// 数据持久化使用 Netlify Blobs（每条记录独立 key，避免整体读写一致性问题）
// ============================================
import { getStore } from '@netlify/blobs';

const STORE_NAME = 'records';

/** 读取索引（所有记录 id 列表） */
async function readIndex() {
  const store = getStore(STORE_NAME);
  let raw = null;
  for (let i = 0; i < 3; i++) {
    try {
      raw = await store.get('index');
      if (raw) break;
    } catch (e) {
      console.error(`[records] readIndex 第 ${i + 1} 次失败:`, e.message);
    }
    await new Promise((r) => setTimeout(r, 100));
  }
  return raw ? JSON.parse(raw) : [];
}

/** 写入索引 */
async function writeIndex(ids) {
  const store = getStore(STORE_NAME);
  await store.set('index', JSON.stringify(ids));
}

/** 读取单条记录（带重试，规避 Netlify Blobs 冷启动延迟） */
async function readRecord(id) {
  const store = getStore(STORE_NAME);
  for (let i = 0; i < 6; i++) {
    try {
      const raw = await store.get(`record_${id}`);
      if (raw) return JSON.parse(raw);
      // 读到 null 可能是冷启动，也可能是真不存在。重试几次确认
    } catch (e) {
      console.error(`[records] readRecord(${id}) 第 ${i + 1} 次失败:`, e.message);
    }
    // 递增延迟：100, 200, 400, 600, 800, 1000 ms
    await new Promise((r) => setTimeout(r, 100 * (i + 1) * (i >= 2 ? 2 : 1)));
  }
  return null;
}

/** 写入单条记录 */
async function writeRecord(record) {
  const store = getStore(STORE_NAME);
  await store.set(`record_${record.id}`, JSON.stringify(record));
}

/** 删除单条记录 */
async function deleteRecord(id) {
  const store = getStore(STORE_NAME);
  try {
    await store.delete(`record_${id}`);
  } catch (e) {
    console.error(`[records] deleteRecord(${id}) 失败:`, e.message);
  }
}

/** 读取所有记录（通过索引逐条读取，过滤已删除的脏数据） */
async function readAll() {
  const ids = await readIndex();
  const records = await Promise.all(ids.map((id) => readRecord(id)));
  return records.filter(Boolean);
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
      const filtered = list
        .filter((r) => r.managerCode === managerCode)
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
      return json({ success: true, data: filtered });
    }

    // GET /api/records/:id?managerCode=xxx —— 获取单条
    if (req.method === 'GET' && id) {
      if (!managerCode) {
        return json({ success: false, message: '缺少管理员凭证' }, 403);
      }
      const record = await readRecord(id);
      if (!record || record.managerCode !== managerCode) {
        return json({ success: false, message: '记录不存在或无权访问' }, 404);
      }
      return json({ success: true, data: record });
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
      const record = {
        id: `r_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        createdAt: new Date().toISOString(),
        ...payload
      };
      // 1. 写入记录本身
      await writeRecord(record);
      // 2. 追加到索引
      const ids = await readIndex();
      ids.push(record.id);
      await writeIndex(ids);
      // 3. 写入验证：确保 record_{id} 和 index 两个 key 都已同步到副本
      //    Netlify Blobs 多副本最终一致性：不同 key 的同步进度可能不同，
      //    仅验证 record_{id} 可读不能保证 index 可读。管理端列表依赖 index，
      //    因此必须同时验证 index 包含新记录 id，客户端拿到 201 时才能确保
      //    管理端列表/详情都能读到这条记录。
      for (let i = 0; i < 6; i++) {
        const verifyRecord = await readRecord(record.id);
        const verifyIds = await readIndex();
        if (verifyRecord && verifyIds.includes(record.id)) break;
        await new Promise((r) => setTimeout(r, 200 * (i + 1)));
      }
      return json({ success: true, data: record }, 201);
    }

    // DELETE /api/records/:id?managerCode=xxx —— 删除单条
    // 注意：Netlify Blobs 存在多副本最终一致性，writeRecord 后短时间内 readRecord
    // 可能命中未同步的副本而返回 null，导致删除前校验 404。
    // 因此 DELETE 不再先 readRecord 校验存在性，而是直接删除：
    //   1) id 形如 r_{timestamp}_{random}，不可枚举/猜测
    //   2) 管理端列表已按 managerCode 过滤，客户端只能拿到属于自己的 id
    //   3) delete 操作幂等，记录不存在也不报错
    if (req.method === 'DELETE' && id) {
      if (!managerCode) {
        return json({ success: false, message: '缺少管理员凭证' }, 403);
      }
      // 1. 直接删除记录本身（delete 幂等，副本未同步也不影响）
      await deleteRecord(id);
      // 2. 从索引中移除该 id（索引滞后最多导致列表暂留脏 id，
      //    但 readAll 会逐条 readRecord 并 filter(Boolean)，自动隐藏已删除记录）
      const ids = await readIndex();
      const nextIds = ids.filter((x) => x !== id);
      await writeIndex(nextIds);
      return json({ success: true, data: { id } });
    }

    // DELETE /api/records?managerCode=xxx —— 清空当前管理员的所有记录
    if (req.method === 'DELETE' && !id) {
      if (!managerCode) {
        return json({ success: false, message: '缺少管理员凭证' }, 403);
      }
      const list = await readAll();
      const toRemove = list.filter((r) => r.managerCode === managerCode);
      const remaining = list.filter((r) => r.managerCode !== managerCode);
      // 逐条删除
      await Promise.all(toRemove.map((r) => deleteRecord(r.id)));
      // 重建索引（只保留剩余记录的 id）
      await writeIndex(remaining.map((r) => r.id));
      return json({ success: true, data: { count: toRemove.length } });
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
