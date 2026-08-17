// ============================================
// 管理端：客户信息总览 + 详情分析（雷达图、体质说明）
// 仅管理端可查看结果，客户端不可见
// ============================================
import { CONSTITUTIONS, CONSTITUTION_MAP, SURVEY_QUESTIONS, SURVEY_OPTIONS, GROUPED_QUESTIONS } from './data.js';
import { api } from './api.js';
import { drawRadar } from './radar.js';
import { parseZodiac } from './zodiac.js';
import { drawBaguaWheel } from './bagua-wheel.js';
import { LIFESTYLE_INFO_FIELDS, LIFESTYLE_CATEGORIES } from './lifestyle-data.js';
import { calcLifestyleScores } from './lifestyle-score.js';
import { drawLifestyleBarChart } from './lifestyle-chart.js';
import { BODY_LANGUAGE_ITEMS } from './body-language-data.js';
import { calcBodyLanguageScores } from './body-language-score.js';
import { calculateNumerology } from './numerology.js';

const app = document.getElementById('app');

// 管理端视图状态
const state = {
  view: 'list', // login | register | list | customerRecords | detail | loading | error
  records: [],
  currentId: null, // 当前查看的记录 id
  currentGroupKey: null, // 当前查看的客户分组 key
  currentDateGroupKey: null, // 当前查看的日期分组 key（同一客户同一天合并）
  searchKeyword: '',
  authView: 'login' // login | register（未登录时的子视图）
};

// 启动：检查登录态（带凭证有效性验证，避免缓存残留导致幽灵登录）
(async () => {
  if (api.isLoggedIn()) {
    // 验证本地存的凭证在新 site 是否仍然有效
    const session = api.getSession();
    try {
      await api.verifyCode(session.code);
      init();
    } catch (err) {
      // 凭证已失效（可能换了 site 或账户被删），清除残留 session
      api.clearSession();
      renderAuth();
    }
  } else {
    renderAuth();
  }
})();

async function init() {
  state.view = 'loading';
  render();
  try {
    state.records = await api.list();
    state.view = 'list';
    render();
  } catch (err) {
    state.lastError = err.message || String(err);
    console.error('[admin init] 加载失败:', err);
    state.view = 'error';
    render();
  }
}

function render() {
  // 未登录时显示登录/注册页
  if (!api.isLoggedIn()) return renderAuth();
  if (state.view === 'loading') return renderLoading();
  if (state.view === 'error') return renderError();
  if (state.view === 'list') return renderList();
  if (state.view === 'customerRecords') return renderCustomerRecords();
  if (state.view === 'detail') return renderDetail();
}

// ================ 登录 / 注册 ================
function renderAuth() {
  const isLogin = state.authView === 'login';
  const session = api.getSession();

  // 已登录但状态异常时显示凭证
  if (session.code) {
    app.innerHTML = `
      <div class="admin-page admin-page--center">
        <div class="auth-card">
          <div class="auth-card__title">当前已登录</div>
          <div class="auth-card__row"><b>姓名：</b>${escapeHtml(session.name)}</div>
          <div class="auth-card__row"><b>默小乐仙女手机号：</b>${escapeHtml(session.jiyuanId)}</div>
          <div class="auth-card__row auth-card__row--code">
            <span>您的专属 6 位凭证：</span>
            <span class="auth-code">${session.code}</span>
          </div>
          <div class="auth-card__hint">请将此凭证提供给您的客户，客户填写问卷时需输入此凭证绑定到您</div>
          <button class="btn btn--primary btn--lg" id="btnGoAdmin">进入管理后台</button>
          <button class="btn btn--ghost btn--sm" id="btnLogout">退出登录</button>
        </div>
      </div>
    `;
    document.getElementById('btnGoAdmin').addEventListener('click', () => {
      state.view = 'loading';
      init();
    });
    document.getElementById('btnLogout').addEventListener('click', () => {
      if (confirm('确认退出登录？')) {
        api.clearSession();
        renderAuth();
      }
    });
    return;
  }

  app.innerHTML = `
    <div class="admin-page admin-page--center">
      <div class="auth-card">
        <div class="auth-card__brand">
          <span class="nav__brand-symbol">☯</span>
          <span>5S体质测评 · 管理端</span>
        </div>

        <div class="auth-tabs">
          <button class="auth-tab ${isLogin ? 'auth-tab--active' : ''}" data-tab="login">登录</button>
          <button class="auth-tab ${!isLogin ? 'auth-tab--active' : ''}" data-tab="register">注册</button>
        </div>

        <form class="auth-form" id="authForm">
          <div class="form-item">
            <label class="form-item__label">默小乐仙女手机号 ${isLogin ? '' : '<span class="form-item__required">*</span>'}</label>
            <input class="form-input" id="auth_jiyuanId" type="text" placeholder="请输入默小乐仙女手机号" autocomplete="username" />
          </div>

          ${
            !isLogin
              ? `<div class="form-item">
                  <label class="form-item__label">姓名 <span class="form-item__required">*</span></label>
                  <input class="form-input" id="auth_name" type="text" placeholder="请输入姓名" />
                </div>`
              : ''
          }

          <div class="form-item">
            <label class="form-item__label">密码 <span class="form-item__required">*</span></label>
            <input class="form-input" id="auth_password" type="password" placeholder="至少 6 位" autocomplete="current-password" />
          </div>

          <button class="btn btn--primary btn--lg form-submit" id="btnAuthSubmit" type="submit">
            ${isLogin ? '登录 →' : '注册并获取凭证 →'}
          </button>
        </form>

        <div class="auth-hint" id="authHint"></div>
      </div>
    </div>
  `;

  // Tab 切换
  document.querySelectorAll('.auth-tab').forEach((tab) => {
    tab.addEventListener('click', () => {
      state.authView = tab.dataset.tab;
      renderAuth();
    });
  });

  // 提交
  document.getElementById('authForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const hint = document.getElementById('authHint');
    const submitBtn = document.getElementById('btnAuthSubmit');
    const jiyuanId = document.getElementById('auth_jiyuanId').value.trim();
    const password = document.getElementById('auth_password').value;
    const name = document.getElementById('auth_name')?.value.trim() || '';

    hint.textContent = '';
    if (!jiyuanId) return (hint.textContent = '请填写默小乐仙女手机号');
    if (!password) return (hint.textContent = '请填写密码');
    if (!isLogin && !name) return (hint.textContent = '请填写姓名');
    if (!isLogin && password.length < 6) return (hint.textContent = '密码至少 6 位');

    submitBtn.disabled = true;
    submitBtn.textContent = '处理中...';

    try {
      if (isLogin) {
        const admin = await api.login({ jiyuanId, password });
        api.saveSession(admin);
        hint.textContent = '登录成功，正在进入...';
        setTimeout(() => init(), 500);
      } else {
        const admin = await api.register({ jiyuanId, name, password });
        api.saveSession(admin);
        hint.innerHTML = `注册成功！您的专属 6 位凭证：<b class="auth-code">${admin.code}</b>`;
        submitBtn.textContent = '进入后台 →';
        submitBtn.disabled = false;
        submitBtn.onclick = () => init();
      }
    } catch (err) {
      hint.textContent = err.message || '操作失败';
      submitBtn.disabled = false;
      submitBtn.textContent = isLogin ? '登录 →' : '注册并获取凭证 →';
    }
  });
}

// ================ 加载中 ================
function renderLoading() {
  app.innerHTML = `
    <div class="admin-page admin-page--center">
      <div class="loading">
        <div class="loading__spinner"></div>
        <div class="loading__text">正在加载记录...</div>
      </div>
    </div>
  `;
}

// ================ 错误页 ================
function renderError() {
  const errMsg = state.lastError || '未知错误';
  app.innerHTML = `
    <div class="admin-page admin-page--center">
      <div class="empty-page">
        <div class="empty-page__icon">!</div>
        <div class="empty-page__title">加载失败</div>
        <div class="empty-page__desc">无法获取测评记录，请检查服务是否运行</div>
        <div style="margin:12px 0;padding:10px 12px;background:#fff3f3;border:1px solid #f5c6cb;border-radius:6px;font-size:12px;color:#721c24;word-break:break-all;text-align:left;">错误详情：${escapeHtml(errMsg)}</div>
        <button class="btn btn--primary btn--lg" id="btnRetry">重试</button>
      </div>
    </div>
  `;
  document.getElementById('btnRetry').addEventListener('click', init);
}

// ================ 列表页（总览） ================
function renderList() {
  const session = api.getSession();
  const groups = filterGroups();

  // 统计概览（按记录总数）
  const totalCount = state.records.length;
  const todayCount = state.records.filter((r) => {
    const d = new Date(r.createdAt);
    const now = new Date();
    return (
      d.getFullYear() === now.getFullYear() &&
      d.getMonth() === now.getMonth() &&
      d.getDate() === now.getDate()
    );
  }).length;

  // 体质分布统计
  const biasStats = CONSTITUTIONS.map((c) => ({
    ...c,
    count: state.records.filter(
      (r) => r.mainBias && r.mainBias.constitutionId === c.id
    ).length
  })).sort((a, b) => b.count - a.count);

  app.innerHTML = `
    <div class="admin-page">
      <!-- 管理员信息条 -->
      <section class="container">
        <div class="admin-bar">
          <div class="admin-bar__user">
            <span class="admin-bar__name">${escapeHtml(session.name)}</span>
            <span class="admin-bar__id">默小乐仙女手机号：${escapeHtml(session.jiyuanId)}</span>
          </div>
          <div class="admin-bar__code">
            <span class="admin-bar__code-label">您的专属凭证：</span>
            <span class="admin-bar__code-num">${session.code}</span>
            <button class="btn btn--ghost btn--sm" id="btnCopyCode" title="复制凭证">复制</button>
          </div>
          <button class="btn btn--ghost btn--sm" id="btnLogoutTop">退出登录</button>
        </div>
      </section>

      <!-- 概览栏 -->
      <section class="container">
        <div class="section-header section-header--left">
          <h2 class="section-title">管理总览</h2>
          <div class="section-subtitle">查看所有客户测评记录与体质分析 · 共 ${groups.length} 位客户 / ${totalCount} 条记录</div>
        </div>

        <div class="admin-stats">
          <div class="stat-card">
            <div class="stat-card__num">${groups.length}</div>
            <div class="stat-card__label">客户数</div>
          </div>
          <div class="stat-card">
            <div class="stat-card__num">${totalCount}</div>
            <div class="stat-card__label">总测评数</div>
          </div>
          <div class="stat-card">
            <div class="stat-card__num">${todayCount}</div>
            <div class="stat-card__label">今日测评</div>
          </div>
          <div class="stat-card stat-card--tall">
            <div class="stat-card__title">主要偏颇体质 TOP3</div>
            <div class="stat-card__list">
              ${
                biasStats
                  .filter((s) => s.count > 0)
                  .slice(0, 3)
                  .map(
                    (s) => `
                <div class="stat-card__item">
                  <span style="color:${s.color}">${s.symbol}</span>
                  <span class="stat-card__item-name">${s.name}</span>
                  <b>${s.count}</b>
                </div>
              `
                  )
                  .join('') || '<div class="stat-card__empty">暂无数据</div>'
              }
            </div>
          </div>
        </div>
      </section>

      <!-- 客户列表（按客户合并） -->
      <section class="container">
        <div class="list-header">
          <h3 class="list-header__title">客户记录</h3>
          <div class="list-header__actions">
            <input class="search-input" id="searchInput" type="text"
              placeholder="搜索姓名 / 电话"
              value="${escapeHtml(state.searchKeyword)}" />
            <button class="btn btn--ghost btn--sm" id="btnRefresh">刷新</button>
            ${
              totalCount > 0
                ? `<button class="btn btn--ghost btn--sm list-header__clear" id="btnClearAll">清空全部</button>`
                : ''
            }
          </div>
        </div>

        ${
          groups.length === 0
            ? `
          <div class="empty-page">
            <div class="empty-page__icon">∅</div>
            <div class="empty-page__title">${totalCount === 0 ? '暂无测评记录' : '未找到匹配记录'}</div>
            <div class="empty-page__desc">${
              totalCount === 0
                ? '等待客户在客户端完成问卷'
                : '尝试更换搜索关键词'
            }</div>
          </div>
        `
            : `
          <div class="record-table">
            <div class="record-table__head">
              <div class="record-table__cell record-table__cell--name">客户</div>
              <div class="record-table__cell record-table__cell--gender">性别</div>
              <div class="record-table__cell record-table__cell--age">年龄</div>
              <div class="record-table__cell record-table__cell--zodiac">属相 / 脏器</div>
              <div class="record-table__cell record-table__cell--phone">电话</div>
              <div class="record-table__cell record-table__cell--main">主要偏颇</div>
              <div class="record-table__cell record-table__cell--score">最高分</div>
              <div class="record-table__cell record-table__cell--time">最近提交</div>
              <div class="record-table__cell record-table__cell--op">操作</div>
            </div>
            ${groups
              .map((g) => {
                const latest = g.records[0]; // 已按时间倒序，第一条为最新
                const mainMeta = latest.mainBias
                  ? CONSTITUTION_MAP[latest.mainBias.constitutionId]
                  : null;
                const zodiac = parseZodiac(latest.customer.birthday);
                // 最高分取所有记录中最大值
                const maxScore = g.records.reduce(
                  (max, r) =>
                    Math.max(
                      max,
                      safeScores(r).reduce((m, s) => Math.max(m, s.totalScore), 0)
                    ),
                  0
                );
                return `
              <div class="record-table__row" data-group-key="${g.key}">
                <div class="record-table__cell record-table__cell--name" data-label="客户">
                  <b>${escapeHtml(latest.customer.name)}</b>
                  ${
                    g.records.length > 1
                      ? `<span class="record-count-badge">${g.records.length} 条</span>`
                      : ''
                  }
                </div>
                <div class="record-table__cell record-table__cell--gender" data-label="性别">${escapeHtml(latest.customer.gender)}</div>
                <div class="record-table__cell record-table__cell--age" data-label="年龄">${escapeHtml(latest.customer.age)}</div>
                <div class="record-table__cell record-table__cell--zodiac" data-label="属相/脏器">
                  ${
                    zodiac
                      ? `<span class="zodiac-tag">${zodiac.zodiac}</span><span class="zodiac-organ">${zodiac.organ}</span>`
                      : '<span class="text-muted">—</span>'
                  }
                </div>
                <div class="record-table__cell record-table__cell--phone" data-label="电话">${escapeHtml(latest.customer.phone || '—')}</div>
                <div class="record-table__cell record-table__cell--main" data-label="主要偏颇">
                  ${
                    mainMeta
                      ? `<span class="bias-tag" style="color:${mainMeta.color};border-color:${mainMeta.color}">${mainMeta.symbol} ${latest.mainBias.name}</span>`
                      : '<span class="bias-tag bias-tag--plain">基本平和</span>'
                  }
                </div>
                <div class="record-table__cell record-table__cell--score" data-label="最高分">
                  <b>${maxScore || '-'}</b>
                </div>
                <div class="record-table__cell record-table__cell--time" data-label="最近提交">
                  ${new Date(latest.createdAt).toLocaleString('zh-CN')}
                </div>
                <div class="record-table__cell record-table__cell--op">
                  <button class="btn btn--primary btn--sm btn-view-group" data-group-key="${g.key}">查看</button>
                </div>
              </div>
            `;
              })
              .join('')}
          </div>
        `
        }
      </section>
    </div>
  `;

  // 事件绑定
  const searchInput = document.getElementById('searchInput');
  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      state.searchKeyword = e.target.value;
      renderList();
      const newInput = document.getElementById('searchInput');
      if (newInput) {
        newInput.focus();
        newInput.setSelectionRange(state.searchKeyword.length, state.searchKeyword.length);
      }
    });
  }

  document.getElementById('btnRefresh')?.addEventListener('click', init);

  document.getElementById('btnClearAll')?.addEventListener('click', async () => {
    if (!confirm('确认清空所有测评记录？此操作不可恢复。')) return;
    try {
      await api.clear();
      await init();
    } catch (err) {
      showToast('清空失败：' + err.message);
    }
  });

  document.getElementById('btnLogoutTop')?.addEventListener('click', () => {
    if (confirm('确认退出登录？')) {
      api.clearSession();
      renderAuth();
    }
  });

  document.getElementById('btnCopyCode')?.addEventListener('click', () => {
    const code = session.code;
    if (navigator.clipboard) {
      navigator.clipboard.writeText(code).then(
        () => showToast('凭证已复制：' + code),
        () => showToast('复制失败，请手动复制：' + code)
      );
    } else {
      showToast('凭证：' + code);
    }
  });

  // 点击客户行/查看按钮 → 进入该客户的记录列表
  document.querySelectorAll('.btn-view-group').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      state.currentGroupKey = btn.dataset.groupKey;
      state.view = 'customerRecords';
      render();
    });
  });

  document.querySelectorAll('.record-table__row').forEach((row) => {
    row.addEventListener('click', () => {
      state.currentGroupKey = row.dataset.groupKey;
      state.view = 'customerRecords';
      render();
    });
  });
}

/**
 * 按客户分组：姓名 + 出生年月日 + 性别 完全一致视为同一客户
 * 返回 [{ key, customer, records[] }]，records 按时间倒序
 */
function groupRecordsByCustomer(records) {
  const map = new Map();
  records.forEach((r) => {
    const c = r.customer || {};
    const key = `${(c.name || '').trim()}|${(c.birthday || '').trim()}|${(c.gender || '').trim()}`;
    if (!map.has(key)) {
      map.set(key, {
        key,
        customer: c,
        records: []
      });
    }
    map.get(key).records.push(r);
  });
  // 每组内按时间倒序
  const groups = Array.from(map.values());
  groups.forEach((g) => {
    g.records.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  });
  // 组间按最新记录时间倒序
  groups.sort((a, b) => new Date(b.records[0].createdAt) - new Date(a.records[0].createdAt));
  return groups;
}

/**
 * 按客户 + 日期分组：同一客户同一天（按 createdAt 的日期部分）提交的多个问卷合并为一组
 * 分组 key = `姓名|生日|性别|日期(YYYY-MM-DD)`
 * 返回 [{ key, dateKey, customer, records[] }]，records 按时间倒序，分组间按最新记录时间倒序
 */
function groupRecordsByCustomerAndDate(records) {
  const map = new Map();
  records.forEach((r) => {
    const c = r.customer || {};
    const d = new Date(r.createdAt);
    const dateKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    const key = `${(c.name || '').trim()}|${(c.birthday || '').trim()}|${(c.gender || '').trim()}|${dateKey}`;
    if (!map.has(key)) {
      map.set(key, {
        key,
        dateKey,
        customer: c,
        records: []
      });
    }
    map.get(key).records.push(r);
  });
  const groups = Array.from(map.values());
  // 每组内按时间倒序
  groups.forEach((g) => {
    g.records.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  });
  // 组间按最新记录时间倒序
  groups.sort((a, b) => new Date(b.records[0].createdAt) - new Date(a.records[0].createdAt));
  return groups;
}

/** 按搜索关键词过滤客户分组 */
function filterGroups() {
  const kw = state.searchKeyword.trim().toLowerCase();
  const groups = groupRecordsByCustomer(state.records);
  if (!kw) return groups;
  return groups.filter(
    (g) =>
      (g.customer.name || '').toLowerCase().includes(kw) ||
      (g.customer.phone || '').toLowerCase().includes(kw)
  );
}

function filterRecords() {
  const kw = state.searchKeyword.trim().toLowerCase();
  if (!kw) return state.records;
  return state.records.filter(
    (r) =>
      r.customer.name.toLowerCase().includes(kw) ||
      (r.customer.phone || '').toLowerCase().includes(kw)
  );
}

// ================ 客户记录列表页（同一客户的多条记录） ================
function renderCustomerRecords() {
  const groups = groupRecordsByCustomer(state.records);
  const group = groups.find((g) => g.key === state.currentGroupKey);
  if (!group || group.records.length === 0) {
    state.view = 'list';
    render();
    return;
  }

  const c = group.customer;
  const zodiac = parseZodiac(c.birthday);
  const records = group.records; // 已按时间倒序

  // 同一客户的所有记录按日期再分组（同一客户同一天合并为一条）
  const dateGroups = groupRecordsByCustomerAndDate(records);

  app.innerHTML = `
    <div class="admin-page">
      <section class="container">
        <div class="detail-header">
          <button class="btn btn--ghost btn--sm" id="btnBackToList">← 返回客户列表</button>
        </div>

        <!-- 客户基本信息卡 -->
        <div class="customer-card">
          <div class="customer-card__avatar" style="background:var(--color-primary)">
            ${escapeHtml(c.name.charAt(0))}
          </div>
          <div class="customer-card__info">
            <h2 class="customer-card__name">${escapeHtml(c.name)}</h2>
            <div class="customer-card__meta">
              <span>${escapeHtml(c.gender)}</span>
              <span class="customer-card__dot">·</span>
              <span>${escapeHtml(c.age)}岁</span>
              ${c.birthday ? `<span class="customer-card__dot">·</span><span>${escapeHtml(c.birthday)}</span>` : ''}
              ${c.phone ? `<span class="customer-card__dot">·</span><span>${escapeHtml(c.phone)}</span>` : ''}
            </div>
            <div class="customer-card__time">共 ${records.length} 条测评记录（按日合并为 ${dateGroups.length} 条显示）</div>
          </div>
          ${
            zodiac
              ? `<div class="customer-card__main">
                  <div class="customer-card__main-label">属相</div>
                  <div class="customer-card__main-name" style="color:var(--color-primary)">${zodiac.zodiac} · ${zodiac.organ}</div>
                </div>`
              : ''
          }
        </div>
      </section>

      <!-- 该客户的所有测评记录列表 -->
      <section class="container">
        <div class="section-header section-header--left">
          <h3 class="section-title">测评记录</h3>
          <div class="section-subtitle">同一日提交的多个问卷已合并显示，点击查看详细分析</div>
        </div>

        <div class="record-timeline">
          ${dateGroups
            .map((dg, idx) => {
              const dgRecords = dg.records; // 该日所有记录，按时间倒序
              const latest = dgRecords[0]; // 最新一条
              // 主要偏颇：取有 mainBias 的那条记录
              const biasRec = dgRecords.find((r) => r.mainBias);
              const mainBias = biasRec ? biasRec.mainBias : null;
              const mainMeta = mainBias
                ? CONSTITUTION_MAP[mainBias.constitutionId]
                : null;
              // 最高分：所有记录 scores 中的最大值
              const maxScore = dgRecords.reduce(
                (max, r) =>
                  Math.max(
                    max,
                    safeScores(r).reduce((m, s) => Math.max(m, s.totalScore), 0)
                  ),
                0
              );
              // 体质问卷
              const surveyRec = dgRecords.find((r) => r.submittedType === 'survey');
              const answeredCount = surveyRec && surveyRec.answers
                ? Object.keys(surveyRec.answers).length
                : 0;
              const hasSurvey = !!surveyRec;
              // 生活习惯
              const lifestyleRec = dgRecords.find((r) => r.submittedType === 'lifestyle');
              const hasLifestyle = !!lifestyleRec && lifestyleRec.lifestyleChecked;
              const lifestyleCount = hasLifestyle
                ? Object.keys(lifestyleRec.lifestyleChecked).filter(
                    (k) => lifestyleRec.lifestyleChecked[k]
                  ).length
                : 0;
              // 身体语言
              const bodyLangRec = dgRecords.find((r) => r.submittedType === 'bodyLanguage');
              const hasBodyLang = !!bodyLangRec && bodyLangRec.bodyLanguageChecked;
              const bodyLangCount = hasBodyLang
                ? Object.keys(bodyLangRec.bodyLanguageChecked).filter(
                    (k) => bodyLangRec.bodyLanguageChecked[k]
                  ).length
                : 0;
              // 耗时：该分组所有记录 durationSec 之和
              const totalDuration = dgRecords.reduce(
                (s, r) => s + (r.durationSec || 0),
                0
              );
              return `
              <div class="record-timeline__item" data-groupkey="${dg.key}">
                <div class="record-timeline__dot ${idx === 0 ? 'record-timeline__dot--latest' : ''}"></div>
                <div class="record-timeline__content">
                  <div class="record-timeline__head">
                    <div class="record-timeline__time">
                      ${new Date(latest.createdAt).toLocaleString('zh-CN')}
                      ${idx === 0 ? '<span class="record-timeline__badge">最新</span>' : ''}
                      ${dgRecords.length > 1 ? `<span class="record-timeline__badge">当日 ${dgRecords.length} 份</span>` : ''}
                    </div>
                    <div class="record-timeline__actions">
                      <button class="btn btn--primary btn--sm btn-view-record" data-groupkey="${dg.key}">查看详情</button>
                      <button class="btn btn--ghost btn--sm btn-del-record" data-groupkey="${dg.key}">删除</button>
                    </div>
                  </div>
                  <div class="record-timeline__body">
                    <div class="record-timeline__stat">
                      <span class="record-timeline__stat-label">主要偏颇</span>
                      <span class="record-timeline__stat-value">
                        ${
                          mainMeta
                            ? `<span class="bias-tag" style="color:${mainMeta.color};border-color:${mainMeta.color}">${mainMeta.symbol} ${mainBias.name}</span>`
                            : '<span class="bias-tag bias-tag--plain">基本平和</span>'
                        }
                      </span>
                    </div>
                    <div class="record-timeline__stat">
                      <span class="record-timeline__stat-label">最高分</span>
                      <span class="record-timeline__stat-value"><b>${maxScore || '-'}</b></span>
                    </div>
                    <div class="record-timeline__stat">
                      <span class="record-timeline__stat-label">体质问卷</span>
                      <span class="record-timeline__stat-value">
                        ${hasSurvey ? `已答 ${answeredCount} / 72 题` : '<span class="text-muted">未填</span>'}
                      </span>
                    </div>
                    <div class="record-timeline__stat">
                      <span class="record-timeline__stat-label">生活习惯自检表</span>
                      <span class="record-timeline__stat-value">
                        ${hasLifestyle ? `已填（勾选 ${lifestyleCount} 项）` : '<span class="text-muted">未填</span>'}
                      </span>
                    </div>
                    <div class="record-timeline__stat">
                      <span class="record-timeline__stat-label">身体语言自检表</span>
                      <span class="record-timeline__stat-value">
                        ${hasBodyLang ? `已填（勾选 ${bodyLangCount} 项）` : '<span class="text-muted">未填</span>'}
                      </span>
                    </div>
                    <div class="record-timeline__stat">
                      <span class="record-timeline__stat-label">耗时</span>
                      <span class="record-timeline__stat-value">${totalDuration} 秒</span>
                    </div>
                  </div>
                </div>
              </div>
            `;
            })
            .join('')}
        </div>
      </section>
    </div>
  `;

  document.getElementById('btnBackToList').addEventListener('click', () => {
    state.view = 'list';
    render();
  });

  document.querySelectorAll('.btn-view-record').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      state.currentDateGroupKey = btn.dataset.groupkey;
      state.view = 'detail';
      render();
    });
  });

  document.querySelectorAll('.btn-del-record').forEach((btn) => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const gk = btn.dataset.groupkey;
      // 找到该日期分组的所有记录
      const groups = groupRecordsByCustomerAndDate(state.records);
      const dg = groups.find((g) => g.key === gk);
      if (!dg) return;
      if (!confirm(`确认删除该日所有记录（共 ${dg.records.length} 条）？`)) return;
      try {
        for (const r of dg.records) {
          await api.remove(r.id);
        }
        showToast('删除成功');
        await reloadRecords();
        // 删除后若该客户分组仍有记录，留在记录列表页；否则返回客户列表
        const newGroups = groupRecordsByCustomer(state.records);
        const stillHasGroup = newGroups.some((g) => g.key === state.currentGroupKey);
        if (stillHasGroup) {
          render();
        } else {
          state.view = 'list';
          render();
        }
      } catch (err) {
        showToast('删除失败：' + err.message);
        render();
      }
    });
  });

  document.querySelectorAll('.record-timeline__item').forEach((item) => {
    item.addEventListener('click', () => {
      state.currentDateGroupKey = item.dataset.groupkey;
      state.view = 'detail';
      render();
    });
  });
}

/** 重新拉取记录列表（不切换视图） */
async function reloadRecords() {
  try {
    state.records = await api.list();
  } catch (err) {
    console.error('[admin] 重新加载记录失败:', err);
  }
}

// ================ 详情页 ================
function renderDetail() {
  // 基于日期分组渲染：同一客户同一天合并为一条
  const dateGroups = groupRecordsByCustomerAndDate(state.records);
  const group = dateGroups.find((g) => g.key === state.currentDateGroupKey);
  if (!group || group.records.length === 0) {
    state.view = 'list';
    render();
    return;
  }

  const records = group.records; // 该日期所有记录，按时间倒序
  // 聚合 merged 对象用于渲染
  const merged = {
    customer: group.customer,
    createdAt: records[0].createdAt, // 最新的
    durationSec: records.reduce((s, r) => s + (r.durationSec || 0), 0),
    // 找有对应数据的记录
    answers: records.find((r) => r.submittedType === 'survey')?.answers || {},
    scores: records.find((r) => r.submittedType === 'survey')?.scores || [],
    mainBias: records.find((r) => r.submittedType === 'survey')?.mainBias,
    lifestyleInfo: records.find((r) => r.submittedType === 'lifestyle')?.lifestyleInfo || {},
    lifestyleChecked: records.find((r) => r.submittedType === 'lifestyle')?.lifestyleChecked || {},
    bodyLanguageChecked: records.find((r) => r.submittedType === 'bodyLanguage')?.bodyLanguageChecked || {},
  };

  const mainBias = merged.mainBias;
  const mainMeta = mainBias ? CONSTITUTION_MAP[mainBias.constitutionId] : null;
  const pingheScore = safeScores(merged).find((s) => s.constitutionId === 9);
  const zodiac = parseZodiac(merged.customer.birthday);
  const numerology = calculateNumerology(merged.customer.birthday);

  app.innerHTML = `
    <div class="admin-page">
      <!-- 客户信息卡 -->
      <section class="container">
        <div class="detail-header">
          <button class="btn btn--ghost btn--sm" id="btnBackToCustomer">← 返回该客户记录</button>
          <button class="btn btn--ghost btn--sm" id="btnBackToList">返回客户列表</button>
          <span class="detail-header__time">提交于 ${new Date(merged.createdAt).toLocaleString('zh-CN')}</span>
        </div>

        <div class="customer-card">
          <div class="customer-card__avatar" style="background:${mainMeta ? mainMeta.color : 'var(--color-primary)'}">
            ${escapeHtml(merged.customer.name.charAt(0))}
          </div>
          <div class="customer-card__info">
            <h2 class="customer-card__name">${escapeHtml(merged.customer.name)}</h2>
            <div class="customer-card__meta">
              <span>${escapeHtml(merged.customer.gender)}</span>
              <span class="customer-card__dot">·</span>
              <span>${escapeHtml(merged.customer.age)}岁</span>
              ${merged.customer.birthday ? `<span class="customer-card__dot">·</span><span>${escapeHtml(merged.customer.birthday)}</span>` : ''}
              ${merged.customer.phone ? `<span class="customer-card__dot">·</span><span>${escapeHtml(merged.customer.phone)}</span>` : ''}
            </div>
            <div class="customer-card__time">
              耗时 ${merged.durationSec}s${records.length > 1 ? ` · 当日合并 ${records.length} 份问卷` : ''}
            </div>
          </div>
          <div class="customer-card__main">
            <div class="customer-card__main-label">${mainBias ? '主要偏颇' : '体质状态'}</div>
            <div class="customer-card__main-name" style="color:${mainMeta ? mainMeta.color : 'var(--color-primary)'}">
              ${mainBias ? mainBias.name : '基本平和'}
            </div>
          </div>
        </div>
      </section>

      <!-- 属相与对应经络 -->
      ${
        zodiac
          ? `
        <section class="container">
          <div class="zodiac-card">
            <div class="zodiac-card__left">
              <div class="zodiac-card__zodiac">${zodiac.zodiac}</div>
              <div class="zodiac-card__branch">地支 · ${zodiac.earthlyBranch}</div>
            </div>
            <div class="zodiac-card__right">
              <div class="zodiac-card__label">出生 ${escapeHtml(merged.customer.birthday)}</div>
              <div class="zodiac-card__organ">对应脏器：<b>${zodiac.organ}</b></div>
              <div class="zodiac-card__desc">${zodiac.desc}</div>
            </div>
          </div>
        </section>

        <!-- 八卦地支配经圆盘 -->
        <section class="container">
          <div class="chart-card">
            <div class="chart-card__head">
              <h2 class="chart-card__title">八卦地支配经圆盘</h2>
              <div class="chart-card__meta">中心八卦 · 中圈地支 · 外圈经络 · <span style="color:#e65a32">客户属相「${zodiac.zodiac}·${zodiac.earthlyBranch}」已点亮</span></div>
            </div>
            <div class="chart-card__canvas chart-card__canvas--wheel">
              <canvas id="baguaCanvas"></canvas>
            </div>
          </div>
        </section>
      `
          : ''
      }

      <!-- 生命数字（天赋数字） -->
      ${
        numerology
          ? `
        <section class="container">
          <div class="numerology-card">
            <div class="numerology-card__head">
              <h2 class="numerology-card__title">✦ 生命数字 · 天赋密码 ✦</h2>
              <div class="numerology-card__subtitle">基于阳历生日 ${escapeHtml(numerology.birthday)} 计算 · 主性格 ${numerology.mainCharacter} 号人</div>
            </div>
            <div class="numerology-card__body">
              <!-- 数字房子图（SVG精确布局，1:1复刻参考图） -->
              <div class="numerology-house">
                <svg class="n-house__svg" viewBox="0 0 400 540" xmlns="http://www.w3.org/2000/svg">
                  <!-- 三角形屋顶：顶点(200,70)，底角(70,210)(330,210) -->
                  <polygon points="200,70 70,210 330,210" fill="#fffaf5" stroke="#f0c8a0" stroke-width="2"/>
                  <!-- 正方形：x=70~330, y=210~470 -->
                  <rect x="70" y="210" width="260" height="260" fill="#fffaf5" stroke="#f0c8a0" stroke-width="2"/>
                  <line x1="200" y1="210" x2="200" y2="470" stroke="#f0c8a0" stroke-width="1.5"/>
                  <line x1="70" y1="340" x2="330" y2="340" stroke="#f0c8a0" stroke-width="1.5"/>

                  <!-- 最顶端位数字（三角形顶点上方，y=38） -->
                  <text x="200" y="38" text-anchor="middle" dominant-baseline="central" font-family="Georgia, SimSun, Noto Serif SC, serif" font-size="40" fill="#d97b44">${numerology.outer.top.apex}</text>

                  <!-- 左顶外位（三角形左腰外侧，y=110） -->
                  <text x="130" y="110" text-anchor="middle" dominant-baseline="central" font-family="Georgia, SimSun, Noto Serif SC, serif" font-size="40" fill="#d97b44">${numerology.outer.top.left}</text>

                  <!-- 右顶外位（三角形右腰外侧，y=110） -->
                  <text x="270" y="110" text-anchor="middle" dominant-baseline="central" font-family="Georgia, SimSun, Noto Serif SC, serif" font-size="40" fill="#d97b44">${numerology.outer.top.right}</text>

                  <!-- 左公式（三角形左侧外，y=140，此处三角形宽，外侧空间大） -->
                  <text x="5" y="140" text-anchor="start" dominant-baseline="central" font-family="Georgia, SimSun, Noto Serif SC, serif" font-size="40" fill="#d97b44">${numerology.formulas.left}</text>

                  <!-- 右公式（三角形右侧外，y=140） -->
                  <text x="395" y="140" text-anchor="end" dominant-baseline="central" font-family="Georgia, SimSun, Noto Serif SC, serif" font-size="40" fill="#d97b44">${numerology.formulas.right}</text>

                  <!-- 星号（三角形上部中央，y=105） -->
                  <text x="200" y="105" text-anchor="middle" dominant-baseline="central" font-family="Georgia, SimSun, Noto Serif SC, serif" font-size="40" fill="#d97b44">*</text>

                  <!-- 主性格数字（三角形中心偏下，y=170） -->
                  <text x="200" y="170" text-anchor="middle" dominant-baseline="central" font-family="Georgia, SimSun, Noto Serif SC, serif" font-size="40" font-weight="bold" fill="#c82020">${numerology.mainCharacter}</text>

                  <!-- 上层左格中心(135,275)：M -->
                  <text x="135" y="275" text-anchor="middle" dominant-baseline="central" font-family="Georgia, SimSun, Noto Serif SC, serif" font-size="40" fill="#d97b44">${numerology.inner.M}</text>

                  <!-- 上层右格中心(265,275)：N -->
                  <text x="265" y="275" text-anchor="middle" dominant-baseline="central" font-family="Georgia, SimSun, Noto Serif SC, serif" font-size="40" fill="#d97b44">${numerology.inner.N}</text>

                  <!-- 下层左格：I J -->
                  <text x="110" y="405" text-anchor="middle" dominant-baseline="central" font-family="Georgia, SimSun, Noto Serif SC, serif" font-size="40" fill="#d97b44">${numerology.inner.I}</text>
                  <text x="165" y="405" text-anchor="middle" dominant-baseline="central" font-family="Georgia, SimSun, Noto Serif SC, serif" font-size="40" fill="#d97b44">${numerology.inner.J}</text>

                  <!-- 下层右格：K L -->
                  <text x="235" y="405" text-anchor="middle" dominant-baseline="central" font-family="Georgia, SimSun, Noto Serif SC, serif" font-size="40" fill="#d97b44">${numerology.inner.K}</text>
                  <text x="290" y="405" text-anchor="middle" dominant-baseline="central" font-family="Georgia, SimSun, Noto Serif SC, serif" font-size="40" fill="#d97b44">${numerology.inner.L}</text>

                  <!-- 底部原始日期数字（正方形下方，y=505） -->
                  <text x="103" y="505" text-anchor="middle" dominant-baseline="central" font-family="Georgia, SimSun, Noto Serif SC, serif" font-size="40" fill="#222">${numerology.rawDigits.day}</text>
                  <text x="168" y="505" text-anchor="middle" dominant-baseline="central" font-family="Georgia, SimSun, Noto Serif SC, serif" font-size="40" fill="#222">${numerology.rawDigits.month}</text>
                  <text x="233" y="505" text-anchor="middle" dominant-baseline="central" font-family="Georgia, SimSun, Noto Serif SC, serif" font-size="40" fill="#222">${numerology.rawDigits.yearFirstHalf}</text>
                  <text x="298" y="505" text-anchor="middle" dominant-baseline="central" font-family="Georgia, SimSun, Noto Serif SC, serif" font-size="40" fill="#222">${numerology.rawDigits.yearSecondHalf}</text>
                </svg>
              </div>

              <!-- 核心数字摘要 + 联动数字（左右分栏） -->
              <div class="numerology-bottom">
                <!-- 核心数字摘要 -->
                <div class="numerology-summary">
                  <div class="numerology-summary__item">
                    <div class="numerology-summary__label">内心数字</div>
                    <div class="numerology-summary__value">${numerology.innerCode}</div>
                  </div>
                  <div class="numerology-summary__item">
                    <div class="numerology-summary__label">潜意识数字</div>
                    <div class="numerology-summary__value">${numerology.subconsciousCode}</div>
                  </div>
                  <div class="numerology-summary__item">
                    <div class="numerology-summary__label">晚年数字</div>
                    <div class="numerology-summary__value numerology-summary__value--code">${numerology.laterYearsCode}</div>
                  </div>
                </div>

                <!-- 联动数字（12组联合码，3行4列） -->
                <div class="numerology-union">
                  <div class="numerology-union__title">联动数字</div>
                  <div class="numerology-union__body">
                    ${numerology.unionCodeGroups.map(group => `
                    <div class="numerology-union__row">
                      <div class="numerology-union__label">${group.label}</div>
                      <div class="numerology-union__codes">
                        ${group.codes.map(code => `<div class="numerology-union__code">${code}</div>`).join('')}
                      </div>
                    </div>
                    `).join('')}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>
      `
          : ''
      }

      <!-- ============ 调查表 1：5S体质测评问卷 ============ -->
      ${
        safeScores(merged).length > 0 || Object.keys(merged.answers).length > 0
          ? `
      <div class="survey-section">
        <div class="survey-section__banner survey-section__banner--constitution">
          <span class="survey-section__num">调查表 ①</span>
          <span class="survey-section__name">5S体质测评问卷</span>
          <span class="survey-section__meta">${countAnsweredDetail(merged)} / 72 题已答</span>
        </div>

        <!-- 雷达图 -->
        <section class="container">
          <div class="chart-card">
            <div class="chart-card__head">
              <h2 class="chart-card__title">九种体质雷达图</h2>
              <div class="chart-card__meta">原始分值 8-40（8 题 × 1~5 分）</div>
            </div>
            <div class="chart-card__canvas">
              <canvas id="radarCanvas"></canvas>
            </div>
          </div>
        </section>

        <!-- 主偏颇体质说明 -->
        <section class="container">
          <div class="main-card" ${mainMeta ? `style="--accent:${mainMeta.color}"` : ''}>
            <div class="main-card__label">${mainBias ? '主要偏颇体质' : '体质状态'}</div>
            <div class="main-card__name">${mainBias ? mainBias.name : '基本平和'}</div>
            <div class="main-card__score">
              原始分值：<b class="main-card__score-num">${
                mainBias ? mainBias.totalScore : pingheScore?.totalScore
              }</b> / 40
            </div>
            <div class="main-card__desc">
              ${
                mainMeta
                  ? mainMeta.description
                  : '该客户体质较为平和，阴阳气血调和，继续保持良好的生活习惯即可。'
              }
            </div>
          </div>
        </section>

        <!-- 各体质得分列表 -->
        <section class="container">
          <div class="score-list-card">
            <h3 class="score-list-card__title">各体质得分明细</h3>
            <div class="score-list">
              ${safeScores(merged)
                .slice()
                .sort((a, b) => {
                  // 按得分降序排列；得分相同时按体质序号（constitutionId）升序排列
                  if (b.totalScore !== a.totalScore) return b.totalScore - a.totalScore;
                  return (a.constitutionId || 0) - (b.constitutionId || 0);
                })
                .map((s) => {
                  const meta = CONSTITUTION_MAP[s.constitutionId];
                  const pct = Math.max(
                    0,
                    Math.min(100, ((s.totalScore - 8) / (40 - 8)) * 100)
                  );
                  return `
                <div class="score-item">
                  <div class="score-item__head">
                    <span class="score-item__name">
                      <span class="score-item__symbol" style="color:${meta.color}">${meta.symbol}</span>
                      ${s.name}
                    </span>
                    <span class="score-item__value">
                      <b style="color:${meta.color}">${s.totalScore}</b> / 40
                    </span>
                  </div>
                  <div class="score-item__bar">
                    <div class="score-item__fill"
                         style="width:${pct}%;background:linear-gradient(90deg, ${meta.color}, ${meta.color}cc);"></div>
                  </div>
                </div>
              `;
                })
                .join('')}
            </div>
          </div>
        </section>

        <!-- 客户问卷作答明细（可折叠） -->
        <section class="container">
          <details class="answers-collapse">
          <summary class="answers-collapse__head">
            <span class="answers-collapse__title">客户问卷作答明细</span>
            <span class="answers-collapse__hint">点击展开查看完整 72 题作答</span>
          </summary>
          <div class="answers-collapse__body">
            ${CONSTITUTIONS.map((c) => {
              const meta = CONSTITUTION_MAP[c.id];
              const questions = GROUPED_QUESTIONS[c.id] || [];
              return `
              <div class="answer-group">
                <div class="answer-group__head" style="border-left-color:${meta.color}">
                  <span class="answer-group__symbol" style="color:${meta.color}">${meta.symbol}</span>
                  <span class="answer-group__name">${c.name}</span>
                  <span class="answer-group__brief">${meta.brief}</span>
                </div>
                <div class="answer-group__list">
                  ${questions
                    .map((q) => {
                      const val = merged.answers[q.key];
                      const opt = SURVEY_OPTIONS.find((o) => o.value === val);
                      return `
                    <div class="answer-item ${val == null ? 'answer-item--empty' : ''}">
                      <div class="answer-item__seq">${q.seq}</div>
                      <div class="answer-item__symptom">${escapeHtml(q.symptom)}</div>
                      <div class="answer-item__opt">
                        ${
                          opt
                            ? `<span class="answer-item__value answer-item__value--${val}">${opt.label}<small>${opt.desc}</small></span>`
                            : '<span class="answer-item__value answer-item__value--none">未作答</span>'
                        }
                      </div>
                    </div>
                  `;
                    })
                    .join('')}
                </div>
              </div>
            `;
            }).join('')}
          </div>
        </details>
      </section>
      </div><!-- /survey-section ① -->
      `
          : `
      <div class="survey-section survey-section--empty">
        <div class="survey-section__banner survey-section__banner--constitution survey-section__banner--muted">
          <span class="survey-section__num">调查表 ①</span>
          <span class="survey-section__name">5S体质测评问卷</span>
          <span class="survey-section__meta">未填写</span>
        </div>
      </div>
      `
      }

      <!-- ============ 调查表 2：生活习惯自检表 ============ -->
      ${
        merged.lifestyleChecked && Object.values(merged.lifestyleChecked).some(Boolean)
          ? `
      <div class="survey-section">
        <div class="survey-section__banner survey-section__banner--lifestyle">
          <span class="survey-section__num">调查表 ②</span>
          <span class="survey-section__name">生活习惯自检表</span>
          <span class="survey-section__meta">${countLifestyleCheckedDetail(merged)} 项已勾选</span>
        </div>
        ${renderLifestyleSection(merged)}
      </div>
      `
          : `
      <div class="survey-section survey-section--empty">
        <div class="survey-section__banner survey-section__banner--lifestyle survey-section__banner--muted">
          <span class="survey-section__num">调查表 ②</span>
          <span class="survey-section__name">生活习惯自检表</span>
          <span class="survey-section__meta">未填写</span>
        </div>
      </div>
      `
      }

      <!-- ============ 调查表 3：身体语言自检表 ============ -->
      ${
        merged.bodyLanguageChecked && Object.values(merged.bodyLanguageChecked).some(Boolean)
          ? `
      <div class="survey-section">
        <div class="survey-section__banner survey-section__banner--bodylang">
          <span class="survey-section__num">调查表 ③</span>
          <span class="survey-section__name">身体语言自检表</span>
          <span class="survey-section__meta">${countBodyLangCheckedDetail(merged)} 项已勾选</span>
        </div>
        ${renderBodyLanguageSection(merged)}
      </div>
      `
          : `
      <div class="survey-section survey-section--empty">
        <div class="survey-section__banner survey-section__banner--bodylang survey-section__banner--muted">
          <span class="survey-section__num">调查表 ③</span>
          <span class="survey-section__name">身体语言自检表</span>
          <span class="survey-section__meta">未填写</span>
        </div>
      </div>
      `
      }

      <!-- 底部操作 -->
      <section class="container">
        <div class="detail-footer">
          <button class="btn btn--ghost btn--lg" id="btnBack2">← 返回列表</button>
          <button class="btn btn--primary btn--lg" id="btnDelDetail">删除该记录</button>
        </div>
      </section>
    </div>
  `;

  // 绘制雷达图
  const canvas = document.getElementById('radarCanvas');
  if (canvas) {
    // 根据容器实际宽度动态计算尺寸，保证正圆且适配竖屏
    const renderRadar = () => {
      const container = canvas.parentElement;
      const availW = container ? container.clientWidth : 480;
      const size = Math.min(480, Math.max(280, availW - 32));
      drawRadar(canvas, safeScores(merged), size);
    };
    requestAnimationFrame(renderRadar);
    window.addEventListener('resize', renderRadar);
  }

  // 绘制八卦地支配经圆盘
  const baguaCanvas = document.getElementById('baguaCanvas');
  if (baguaCanvas && zodiac) {
    // 根据容器实际宽度动态计算尺寸，保证正圆且适配竖屏
    const renderBagua = () => {
      const container = baguaCanvas.parentElement;
      const availW = container ? container.clientWidth : 520;
      // 减去左右 padding（chart-card__canvas--wheel 在移动端有 padding）
      const size = Math.min(520, Math.max(280, availW - 32));
      drawBaguaWheel(baguaCanvas, zodiac.earthlyBranch, size);
    };
    requestAnimationFrame(renderBagua);
    // 窗口尺寸变化时重绘
    window.addEventListener('resize', renderBagua);
  }

  // 绘制生活习惯健康分析柱状图
  const lifestyleCanvas = document.getElementById('lifestyleChartCanvas');
  if (lifestyleCanvas && merged.lifestyleChecked) {
    const lsScores = calcLifestyleScores(merged.lifestyleChecked);
    const renderLsChart = () => {
      const container = lifestyleCanvas.parentElement;
      const availW = container ? container.clientWidth : 640;
      const size = Math.min(640, Math.max(320, availW - 32));
      drawLifestyleBarChart(lifestyleCanvas, lsScores, size);
    };
    requestAnimationFrame(renderLsChart);
    window.addEventListener('resize', renderLsChart);
  }

  // 绘制身体语言健康分析柱状图
  const bodyLangCanvas = document.getElementById('bodyLangChartCanvas');
  if (bodyLangCanvas && merged.bodyLanguageChecked) {
    const blScores = calcBodyLanguageScores(merged.bodyLanguageChecked);
    const renderBlChart = () => {
      const container = bodyLangCanvas.parentElement;
      const availW = container ? container.clientWidth : 640;
      const size = Math.min(640, Math.max(320, availW - 32));
      drawLifestyleBarChart(bodyLangCanvas, blScores, size);
    };
    requestAnimationFrame(renderBlChart);
    window.addEventListener('resize', renderBlChart);
  }

  const backToCustomer = () => {
    // 返回该客户的记录列表（若分组存在）
    if (state.currentGroupKey) {
      const groups = groupRecordsByCustomer(state.records);
      const stillHasGroup = groups.some((g) => g.key === state.currentGroupKey);
      if (stillHasGroup) {
        state.view = 'customerRecords';
        render();
        return;
      }
    }
    state.view = 'list';
    render();
  };
  const backToList = () => {
    state.view = 'list';
    render();
  };
  document.getElementById('btnBackToCustomer').addEventListener('click', backToCustomer);
  document.getElementById('btnBackToList').addEventListener('click', backToList);
  document.getElementById('btnBack2')?.addEventListener('click', backToCustomer);

  document.getElementById('btnDelDetail').addEventListener('click', async () => {
    if (!confirm(`确认删除该日所有记录（共 ${records.length} 条）？`)) return;
    try {
      for (const r of records) {
        await api.remove(r.id);
      }
      showToast('删除成功');
      await reloadRecords();
      // 删除后若该客户分组仍有记录，返回记录列表；否则返回客户列表
      const newGroups = groupRecordsByCustomer(state.records);
      const stillHasGroup = newGroups.some((g) => g.key === state.currentGroupKey);
      if (stillHasGroup) {
        state.view = 'customerRecords';
        render();
      } else {
        state.view = 'list';
        render();
      }
    } catch (err) {
      showToast('删除失败：' + err.message);
    }
  });
}

// ================ 生活习惯自检表渲染 ================
function renderLifestyleSection(result) {
  const lsScores = calcLifestyleScores(result.lifestyleChecked);
  const totalChecked = lsScores.reduce((s, x) => s + x.hitCount, 0);
  const info = result.lifestyleInfo || {};

  // 生活习惯基本信息卡片
  const infoCard = renderLifestyleInfoCard(info);

  // 各生活方式类别勾选明细（折叠）
  const categoryDetails = LIFESTYLE_CATEGORIES.map((cat) => {
    const checkedItems = cat.items.filter((it) => result.lifestyleChecked[it.key]);
    return `
      <details class="ls-detail-group">
        <summary class="ls-detail-group__head" style="--cat-color:${cat.color}">
          <span class="ls-detail-group__symbol">${cat.symbol}</span>
          <span class="ls-detail-group__name">${cat.name}</span>
          <span class="ls-detail-group__count">已勾选 ${checkedItems.length} / ${cat.items.length}</span>
        </summary>
        <div class="ls-detail-group__body">
          ${
            checkedItems.length === 0
              ? '<div class="ls-detail-empty">本类未勾选任何条目</div>'
              : checkedItems
                  .map(
                    (it) => `
              <div class="ls-detail-item">
                <span class="ls-detail-item__seq">${it.seq}</span>
                <span class="ls-detail-item__text">${escapeHtml(it.text)}</span>
              </div>
            `
                  )
                  .join('')
          }
        </div>
      </details>
    `;
  }).join('');

  // 7 类健康分析命中明细（折叠）
  const analysisDetails = lsScores
    .map((s) => {
      return `
      <details class="ls-analysis-group">
        <summary class="ls-analysis-group__head" style="--cat-color:${s.color}">
          <span class="ls-analysis-group__symbol">${s.symbol}</span>
          <span class="ls-analysis-group__name">${s.name}</span>
          <span class="ls-analysis-group__count">命中 <b style="color:${s.color}">${s.hitCount}</b> 项</span>
        </summary>
        <div class="ls-analysis-group__body">
          ${
            s.hitItems.length === 0
              ? '<div class="ls-detail-empty">未命中任何条目</div>'
              : s.hitItems
                  .map(
                    (it) => `
              <div class="ls-detail-item">
                <span class="ls-detail-item__seq">${it.seq}</span>
                <span class="ls-detail-item__text">${escapeHtml(it.text)}</span>
              </div>
            `
                  )
                  .join('')
          }
        </div>
      </details>
    `;
    })
    .join('');

  return `
    <!-- 生活习惯基本信息 -->
    <section class="container">
      <div class="chart-card">
        <div class="chart-card__head">
          <h2 class="chart-card__title">生活习惯自检表 · 基本信息</h2>
          <div class="chart-card__meta">职业 / 既往病史 / 服药情况 等 9 项</div>
        </div>
        <div class="ls-info-grid">
          ${infoCard}
        </div>
      </div>
    </section>

    <!-- 7 类健康分析柱状图 -->
    <section class="container">
      <div class="chart-card">
        <div class="chart-card__head">
          <h2 class="chart-card__title">7 类健康分析柱状图</h2>
          <div class="chart-card__meta">
            贫血 / 微循环不通 / 毒素 / 血脂粘稠 / 寒凉湿症 / 免疫 / 情绪 · 共命中 ${totalChecked} 项
          </div>
        </div>
        <div class="chart-card__canvas">
          <canvas id="lifestyleChartCanvas"></canvas>
        </div>
      </div>
    </section>

    <!-- 7 类生活方式勾选明细（折叠） -->
    <section class="container">
      <details class="answers-collapse answers-collapse--open">
        <summary class="answers-collapse__head">
          <span class="answers-collapse__title">7 类生活方式勾选明细</span>
          <span class="answers-collapse__hint">饮食 / 睡觉 / 运动 / 毒素 / 寒湿 / 生活 / 情绪</span>
        </summary>
        <div class="answers-collapse__body">
          ${categoryDetails}
        </div>
      </details>
    </section>

    <!-- 7 类健康分析命中明细（折叠） -->
    <section class="container">
      <details class="answers-collapse answers-collapse--open">
        <summary class="answers-collapse__head">
          <span class="answers-collapse__title">7 类健康分析命中明细</span>
          <span class="answers-collapse__hint">点击展开查看每类分析命中的具体条目</span>
        </summary>
        <div class="answers-collapse__body">
          ${analysisDetails}
        </div>
      </details>
    </section>
  `;
}

/** 渲染生活习惯基本信息卡片 */
function renderLifestyleInfoCard(info) {
  return LIFESTYLE_INFO_FIELDS.map((field) => {
    const val = info[field.key];
    let display = '';
    if (val == null || val === '' || (Array.isArray(val) && val.length === 0)) {
      display = '<span class="ls-info-item__empty">未填写</span>';
    } else if (Array.isArray(val)) {
      display = val
        .map((v) => {
          const opt = field.options.find((o) => o.value === v);
          return opt ? opt.label : v;
        })
        .join('、');
    } else if (field.type === 'single') {
      const opt = field.options.find((o) => o.value === val);
      display = opt ? opt.label : val;
    } else {
      display = escapeHtml(val);
    }

    return `
      <div class="ls-info-item">
        <div class="ls-info-item__label">${field.label}</div>
        <div class="ls-info-item__value">${display}</div>
      </div>
    `;
  }).join('');
}

// ================ 身体语言自检表渲染 ================
function renderBodyLanguageSection(result) {
  const blScores = calcBodyLanguageScores(result.bodyLanguageChecked);
  const totalChecked = blScores.reduce((s, x) => s + x.hitCount, 0);
  const checkedItems = BODY_LANGUAGE_ITEMS.filter(
    (it) => result.bodyLanguageChecked[it.key]
  );

  // 7 类健康分析命中明细（折叠）
  const analysisDetails = blScores
    .map((s) => {
      return `
      <details class="ls-analysis-group">
        <summary class="ls-analysis-group__head" style="--cat-color:${s.color}">
          <span class="ls-analysis-group__symbol">${s.symbol}</span>
          <span class="ls-analysis-group__name">${s.name}</span>
          <span class="ls-analysis-group__count">命中 <b style="color:${s.color}">${s.hitCount}</b> 项</span>
        </summary>
        <div class="ls-analysis-group__body">
          ${
            s.hitItems.length === 0
              ? '<div class="ls-detail-empty">未命中任何条目</div>'
              : s.hitItems
                  .map(
                    (it) => `
              <div class="ls-detail-item">
                <span class="ls-detail-item__seq">${it.seq}</span>
                <span class="ls-detail-item__text">${escapeHtml(it.text)}</span>
              </div>
            `
                  )
                  .join('')
          }
        </div>
      </details>
    `;
    })
    .join('');

  return `
    <!-- 身体语言自检表柱状图 -->
    <section class="container">
      <div class="chart-card">
        <div class="chart-card__head">
          <h2 class="chart-card__title">身体语言自检表 · 7 类健康分析柱状图</h2>
          <div class="chart-card__meta">
            贫血 / 微循环不通 / 毒素 / 血脂粘稠 / 寒凉湿症 / 免疫 / 情绪 · 共勾选 ${checkedItems.length} 项，命中 ${totalChecked} 项次
          </div>
        </div>
        <div class="chart-card__canvas">
          <canvas id="bodyLangChartCanvas"></canvas>
        </div>
      </div>
    </section>

    <!-- 客户勾选的身体语言条目（折叠） -->
    <section class="container">
      <details class="answers-collapse answers-collapse--open">
        <summary class="answers-collapse__head">
          <span class="answers-collapse__title">客户勾选的身体语言条目</span>
          <span class="answers-collapse__hint">共 ${checkedItems.length} 项</span>
        </summary>
        <div class="answers-collapse__body">
          ${
            checkedItems.length === 0
              ? '<div class="ls-detail-empty">未勾选任何条目</div>'
              : checkedItems
                  .map(
                    (it) => `
              <div class="ls-detail-item">
                <span class="ls-detail-item__seq">${it.seq}</span>
                <span class="ls-detail-item__text">${escapeHtml(it.text)}</span>
              </div>
            `
                  )
                  .join('')
          }
        </div>
      </details>
    </section>

    <!-- 7 类健康分析命中明细（折叠） -->
    <section class="container">
      <details class="answers-collapse answers-collapse--open">
        <summary class="answers-collapse__head">
          <span class="answers-collapse__title">身体语言 · 7 类健康分析命中明细</span>
          <span class="answers-collapse__hint">点击展开查看每类分析命中的具体条目</span>
        </summary>
        <div class="answers-collapse__body">
          ${analysisDetails}
        </div>
      </details>
    </section>
  `;
}

// ================ 工具函数 ================
/** 统计体质问卷已答题数 */
function countAnsweredDetail(result) {
  return result.answers ? Object.keys(result.answers).length : 0;
}

/** 统计生活习惯勾选数 */
function countLifestyleCheckedDetail(result) {
  if (!result.lifestyleChecked) return 0;
  return Object.keys(result.lifestyleChecked).filter(
    (k) => result.lifestyleChecked[k]
  ).length;
}

/** 统计身体语言勾选数 */
function countBodyLangCheckedDetail(result) {
  if (!result.bodyLanguageChecked) return 0;
  return Object.keys(result.bodyLanguageChecked).filter(
    (k) => result.bodyLanguageChecked[k]
  ).length;
}
function escapeHtml(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** 确保 scores 是数组（兼容旧数据中 scores 为 {} 的情况） */
function safeScores(r) {
  return Array.isArray(r && r.scores) ? r.scores : [];
}

function showToast(msg) {
  let toast = document.getElementById('__toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = '__toast';
    toast.className = 'toast';
    document.body.appendChild(toast);
  }
  toast.textContent = msg;
  toast.classList.add('toast--show');
  clearTimeout(toast.__timer);
  toast.__timer = setTimeout(() => {
    toast.classList.remove('toast--show');
  }, 2000);
}
