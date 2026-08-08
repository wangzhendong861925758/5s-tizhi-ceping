// ============================================
// API 层：与后端 records / admins 接口通信封装
// 所有页面通过此模块访问后端数据
// ============================================

const RECORDS_BASE = '/api/records';
const ADMINS_BASE = '/api/admins';

/** 获取当前管理员的凭证（从 localStorage 读取） */
function getManagerCode() {
  return localStorage.getItem('admin_code') || '';
}

/** 统一请求封装 */
async function request(url, options = {}) {
  try {
    const res = await fetch(url, {
      headers: { 'Content-Type': 'application/json' },
      ...options
    });
    const data = await res.json();
    if (!res.ok || !data.success) {
      throw new Error(data.message || `请求失败 (${res.status})`);
    }
    return data.data;
  } catch (err) {
    console.error('[API] 请求失败:', err);
    throw err;
  }
}

/** 拼接带 managerCode 的查询字符串 */
function withCode(base, extraParams = {}) {
  const params = new URLSearchParams({ managerCode: getManagerCode(), ...extraParams });
  return `${base}?${params.toString()}`;
}

export const api = {
  // ============ 记录相关 ============
  /** 获取当前管理员的全部记录 */
  async list() {
    return request(withCode(RECORDS_BASE));
  },

  /** 获取单条记录 */
  async get(id) {
    return request(withCode(`${RECORDS_BASE}/${encodeURIComponent(id)}`));
  },

  /** 新增记录（record 必须包含 managerCode） */
  async create(record) {
    return request(RECORDS_BASE, {
      method: 'POST',
      body: JSON.stringify(record)
    });
  },

  /** 删除单条记录 */
  async remove(id) {
    return request(withCode(`${RECORDS_BASE}/${encodeURIComponent(id)}`), {
      method: 'DELETE'
    });
  },

  /** 清空当前管理员的所有记录 */
  async clear() {
    return request(withCode(RECORDS_BASE), { method: 'DELETE' });
  },

  // ============ 管理员账号相关 ============
  /** 注册管理员 */
  async register({ jiyuanId, name, password }) {
    return request(`${ADMINS_BASE}/register`, {
      method: 'POST',
      body: JSON.stringify({ jiyuanId, name, password })
    });
  },

  /** 登录 */
  async login({ jiyuanId, password }) {
    return request(`${ADMINS_BASE}/login`, {
      method: 'POST',
      body: JSON.stringify({ jiyuanId, password })
    });
  },

  /** 验证 6 位凭证是否存在（客户端使用） */
  async verifyCode(code) {
    return request(`${ADMINS_BASE}/verify?code=${encodeURIComponent(code)}`);
  },

  /** 保存登录态到 localStorage */
  saveSession(admin) {
    localStorage.setItem('admin_id', admin.id || '');
    localStorage.setItem('admin_jiyuanId', admin.jiyuanId || '');
    localStorage.setItem('admin_name', admin.name || '');
    localStorage.setItem('admin_code', admin.code || '');
  },

  /** 清除登录态 */
  clearSession() {
    localStorage.removeItem('admin_id');
    localStorage.removeItem('admin_jiyuanId');
    localStorage.removeItem('admin_name');
    localStorage.removeItem('admin_code');
  },

  /** 获取当前登录管理员信息 */
  getSession() {
    return {
      id: localStorage.getItem('admin_id') || '',
      jiyuanId: localStorage.getItem('admin_jiyuanId') || '',
      name: localStorage.getItem('admin_name') || '',
      code: localStorage.getItem('admin_code') || ''
    };
  },

  /** 是否已登录 */
  isLoggedIn() {
    return !!localStorage.getItem('admin_code');
  }
};
