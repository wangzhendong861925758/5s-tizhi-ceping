// ============================================
// 客户端：客户信息表单 + 问卷填写
// 提交后仅显示感谢页，不展示结果分析
// ============================================
import {
  CONSTITUTIONS,
  GROUPED_QUESTIONS,
  SURVEY_OPTIONS,
  TOTAL_QUESTIONS
} from './data.js';
import { calcConstitutionScores, findMainBias, countAnswered } from './score.js';
import { api } from './api.js';
import { LIFESTYLE_INFO_FIELDS, LIFESTYLE_CATEGORIES, LIFESTYLE_TOTAL } from './lifestyle-data.js';
import { countLifestyleChecked } from './lifestyle-score.js';
import { BODY_LANGUAGE_ITEMS, BODY_LANGUAGE_TOTAL } from './body-language-data.js';
import { countBodyLanguageChecked } from './body-language-score.js';

const app = document.getElementById('app');

// 客户端状态
const state = {
  step: 'info', // info | lifestyleChoice | lifestyleInfo | lifestyleSurvey | bodyLanguage | survey | submitting | done
  withLifestyle: false, // 是否填写生活习惯自检表
  customer: { name: '', gender: '', age: '', birthday: '', phone: '' },
  managerCode: '', // 服务人员 6 位凭证
  managerName: '', // 服务人员姓名（验证成功后回填显示）
  lifestyleInfo: {}, // 生活习惯基本信息
  lifestyleChecked: {}, // 生活习惯勾选状态
  bodyLanguageChecked: {}, // 身体语言勾选状态
  answers: {},
  // 各问卷提交状态（已提交则该问卷视为"完成"，下次进入会提示是否重填）
  submittedSurveys: { lifestyle: false, bodyLanguage: false, survey: false },
  startedAt: Date.now(),
  // 提交失败持久提示（避免用户误判提交成功）
  // 结构: { type: 'survey'|'lifestyle'|'bodyLanguage', message: string, ts: number }
  submitError: null
};

// ================ 会话持久化（长登录 + 进度保存） ================
const SESSION_KEY = 'mole_client_session';
const USERS_KEY = 'mole_client_users'; // 同一设备多个用户

/** 保存当前用户会话（含进度）到 localStorage */
function saveClientSession() {
  const session = {
    customer: state.customer,
    managerCode: state.managerCode,
    managerName: state.managerName,
    lifestyleInfo: state.lifestyleInfo,
    lifestyleChecked: state.lifestyleChecked,
    bodyLanguageChecked: state.bodyLanguageChecked,
    answers: state.answers,
    submittedSurveys: state.submittedSurveys,
    startedAt: state.startedAt,
    savedAt: Date.now()
  };
  localStorage.setItem(SESSION_KEY, JSON.stringify(session));
  // 同时保存按用户标识的独立进度副本（用于切换用户时恢复）
  if (state.customer.name && state.customer.birthday && state.customer.gender) {
    const userSessionKey = `mole_client_session_${state.customer.name}_${state.customer.birthday}_${state.customer.gender}`;
    localStorage.setItem(userSessionKey, JSON.stringify(session));
  }
  // 同时更新用户列表（用于切换用户）
  saveUserToList(session);
}

/** 保存用户到本地用户列表（按姓名+生日+性别去重） */
function saveUserToList(session) {
  const users = listLocalUsers();
  const idx = users.findIndex(
    (u) =>
      u.customer.name === session.customer.name &&
      u.customer.birthday === session.customer.birthday &&
      u.customer.gender === session.customer.gender
  );
  const userRecord = {
    customer: session.customer,
    managerCode: session.managerCode,
    managerName: session.managerName,
    savedAt: Date.now()
  };
  if (idx >= 0) {
    users[idx] = userRecord;
  } else {
    users.push(userRecord);
  }
  localStorage.setItem(USERS_KEY, JSON.stringify(users));
}

/** 读取本地所有已登记用户（用于切换用户） */
function listLocalUsers() {
  try {
    return JSON.parse(localStorage.getItem(USERS_KEY) || '[]');
  } catch {
    return [];
  }
}

/** 删除本地用户 */
function removeLocalUser(customer) {
  const users = listLocalUsers().filter(
    (u) =>
      !(
        u.customer.name === customer.name &&
        u.customer.birthday === customer.birthday &&
        u.customer.gender === customer.gender
      )
  );
  localStorage.setItem(USERS_KEY, JSON.stringify(users));
}

/** 从 localStorage 恢复会话 */
function restoreClientSession() {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return false;
    const session = JSON.parse(raw);
    if (!session.customer || !session.customer.name) return false;
    state.customer = session.customer;
    state.managerCode = session.managerCode || '';
    state.managerName = session.managerName || '';
    state.lifestyleInfo = session.lifestyleInfo || {};
    state.lifestyleChecked = session.lifestyleChecked || {};
    state.bodyLanguageChecked = session.bodyLanguageChecked || {};
    state.answers = session.answers || {};
    state.submittedSurveys = session.submittedSurveys || {
      lifestyle: false,
      bodyLanguage: false,
      survey: false
    };
    state.startedAt = session.startedAt || Date.now();
    return true;
  } catch {
    return false;
  }
}

/** 清除当前会话（退出登录） */
function clearClientSession() {
  localStorage.removeItem(SESSION_KEY);
}

// 启动时尝试恢复会话
const hasRestored = restoreClientSession();
if (hasRestored) {
  // 已登录，直接进入调查表选择页
  state.step = 'lifestyleChoice';
}

render();
// 首次渲染时 bindSwitchUserNav 尚未包装进 render，需手动调用一次
bindSwitchUserNav();

function render() {
  if (state.step === 'info') return renderInfoStep();
  if (state.step === 'lifestyleChoice') return renderLifestyleChoice();
  if (state.step === 'lifestyleInfo') return renderLifestyleInfoStep();
  if (state.step === 'lifestyleSurvey') return renderLifestyleSurveyStep();
  if (state.step === 'bodyLanguage') return renderBodyLanguageStep();
  if (state.step === 'survey') return renderSurveyStep();
  if (state.step === 'submitting') return renderSubmitting();
  if (state.step === 'done') return renderDone();
}

// ================ Step 1: 客户信息 ================
function renderInfoStep() {
  app.innerHTML = `
    <div class="client-page">
      <section class="container container--narrow">
        <div class="info-hero">
          <div class="info-hero__tag">体质测评问卷</div>
          <h1 class="info-hero__title">填写您的信息</h1>
          <p class="info-hero__subtitle">请先填写基本信息，再进入问卷</p>
        </div>

        <div class="info-form-card">
          <div class="form-item">
            <label class="form-item__label">姓名 <span class="form-item__required">*</span></label>
            <input class="form-input" id="f_name" type="text" placeholder="请输入姓名"
              value="${escapeHtml(state.customer.name)}" />
          </div>

          <div class="form-item">
            <label class="form-item__label">性别 <span class="form-item__required">*</span></label>
            <div class="form-radio-group" id="f_gender">
              <label class="form-radio">
                <input type="radio" name="gender" value="男" ${state.customer.gender === '男' ? 'checked' : ''} />
                <span>男</span>
              </label>
              <label class="form-radio">
                <input type="radio" name="gender" value="女" ${state.customer.gender === '女' ? 'checked' : ''} />
                <span>女</span>
              </label>
            </div>
          </div>

          <div class="form-item">
            <label class="form-item__label">出生日期（阳历） <span class="form-item__required">*</span></label>
            <div class="birthday-inputs" id="f_birthday_group">
              <input class="form-input birthday-input" id="f_birthday_year" type="text" inputmode="numeric" maxlength="4" placeholder="年" />
              <span class="birthday-sep">-</span>
              <input class="form-input birthday-input" id="f_birthday_month" type="text" inputmode="numeric" maxlength="2" placeholder="月" />
              <span class="birthday-sep">-</span>
              <input class="form-input birthday-input" id="f_birthday_day" type="text" inputmode="numeric" maxlength="2" placeholder="日" />
            </div>
            <div class="form-hint" id="f_age_hint">${
              state.customer.birthday
                ? `当前年龄：${calcAge(state.customer.birthday)} 岁`
                : '请按年-月-日分别手动输入阳历出生日期'
            }</div>
          </div>

          <div class="form-item">
            <label class="form-item__label">联系电话</label>
            <input class="form-input" id="f_phone" type="tel" placeholder="选填"
              value="${escapeHtml(state.customer.phone)}" />
          </div>

          <div class="form-item">
            <label class="form-item__label">服务人员凭证 <span class="form-item__required">*</span></label>
            <input class="form-input" id="f_managerCode" type="text" maxlength="6" placeholder="请填写服务人员提供的 6 位数字凭证"
              value="${escapeHtml(state.managerCode)}" inputmode="numeric" />
            <div class="form-hint" id="f_manager_hint">${
              state.managerName ? `已验证服务人员：${escapeHtml(state.managerName)}` : '请向服务人员索要 6 位数字凭证'
            }</div>
          </div>

          <button class="btn btn--primary btn--lg form-submit" id="btnToSurvey">
            进入问卷 →
          </button>
        </div>
      </section>
    </div>
  `;

  // 出生日期：三个输入框联动，输入完自动跳转下一个
  const yearInput = document.getElementById('f_birthday_year');
  const monthInput = document.getElementById('f_birthday_month');
  const dayInput = document.getElementById('f_birthday_day');
  const ageHint = document.getElementById('f_age_hint');

  // 回填已有值
  if (state.customer.birthday) {
    const parts = state.customer.birthday.split('-');
    yearInput.value = parts[0] || '';
    monthInput.value = parts[1] || '';
    dayInput.value = parts[2] || '';
  }

  const updateAgeHint = () => {
    const y = yearInput.value.trim();
    const m = monthInput.value.trim();
    const d = dayInput.value.trim();
    if (y && m && d && /^\d{4}$/.test(y) && /^\d{1,2}$/.test(m) && /^\d{1,2}$/.test(d)) {
      const bd = `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
      const age = calcAge(bd);
      if (age >= 0 && age <= 120) {
        ageHint.textContent = `当前年龄：${age} 岁`;
      } else {
        ageHint.textContent = '出生日期无效，请检查年月日';
      }
    } else {
      ageHint.textContent = '请按年-月-日分别手动输入阳历出生日期';
    }
  };

  [yearInput, monthInput, dayInput].forEach((input) => {
    input.addEventListener('input', (e) => {
      // 仅允许数字
      e.target.value = e.target.value.replace(/\D/g, '');
      // 自动跳转下一个输入框
      if (e.target === yearInput && e.target.value.length === 4) monthInput.focus();
      if (e.target === monthInput && e.target.value.length === 2) dayInput.focus();
      updateAgeHint();
    });
  });

  document.getElementById('btnToSurvey').addEventListener('click', async () => {
    const name = document.getElementById('f_name').value.trim();
    const gender = document.querySelector('input[name="gender"]:checked')?.value || '';
    const year = yearInput.value.trim();
    const month = monthInput.value.trim();
    const day = dayInput.value.trim();
    const phone = document.getElementById('f_phone').value.trim();
    const managerCode = document.getElementById('f_managerCode').value.trim();

    if (!name) return showToast('请填写姓名');
    if (!gender) return showToast('请选择性别');
    if (!year || !month || !day) return showToast('请填写出生日期');

    // 校验日期格式
    if (!/^\d{4}$/.test(year)) return showToast('出生年份需为 4 位数字');
    if (!/^\d{1,2}$/.test(month) || Number(month) < 1 || Number(month) > 12) {
      return showToast('出生月份无效（1-12）');
    }
    if (!/^\d{1,2}$/.test(day) || Number(day) < 1 || Number(day) > 31) {
      return showToast('出生日期无效（1-31）');
    }

    // 组合为 YYYY-MM-DD
    const birthday = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;

    // 校验日期有效性
    const dateParts = [parseInt(year, 10), parseInt(month, 10), parseInt(day, 10)];
    const dateObj = new Date(dateParts[0], dateParts[1] - 1, dateParts[2]);
    if (
      dateObj.getFullYear() !== dateParts[0] ||
      dateObj.getMonth() !== dateParts[1] - 1 ||
      dateObj.getDate() !== dateParts[2]
    ) {
      return showToast('出生日期无效，请检查年月日是否正确');
    }
    const age = calcAge(birthday);
    if (age < 1 || age > 120) return showToast('出生日期无效');

    if (!managerCode) return showToast('请填写服务人员凭证');
    if (!/^\d{6}$/.test(managerCode)) return showToast('凭证应为 6 位数字');

    // 验证服务人员凭证
    try {
      const data = await api.verifyCode(managerCode);
      state.managerName = data.name || '';
      document.getElementById('f_manager_hint').textContent = `已验证服务人员：${state.managerName}`;
    } catch (err) {
      return showToast('服务人员凭证无效：' + err.message);
    }

    state.customer = { name, gender, age, birthday, phone };
    state.managerCode = managerCode;
    // 保存会话，保持长登录
    saveClientSession();
    // 进入「是否填写生活习惯自检表」选择步骤
    state.step = 'lifestyleChoice';
    render();
  });
}

// ================ Step 1.5: 是否填写生活习惯自检表 ================
function renderLifestyleChoice() {
  // 三个调查表的状态：未填 / 进行中（黄色）/ 已提交（绿色）
  const lsCount = countLifestyleChecked(state.lifestyleChecked);
  const blCount = countBodyLanguageChecked(state.bodyLanguageChecked);
  const surveyCount = countAnswered(state.answers);

  // 状态判定：已提交 > 进行中 > 未填
  const lsStatus = state.submittedSurveys.lifestyle
    ? 'submitted'
    : lsCount > 0 || Object.keys(state.lifestyleInfo || {}).length > 0
    ? 'progress'
    : 'empty';
  const blStatus = state.submittedSurveys.bodyLanguage
    ? 'submitted'
    : blCount > 0
    ? 'progress'
    : 'empty';
  const surveyStatus = state.submittedSurveys.survey
    ? 'submitted'
    : surveyCount > 0
    ? 'progress'
    : 'empty';

  // 可提交数量（进行中或已提交的都算）
  const totalDone =
    (lsStatus !== 'empty' ? 1 : 0) +
    (blStatus !== 'empty' ? 1 : 0) +
    (surveyStatus !== 'empty' ? 1 : 0);

  // 渲染状态徽章
  const badgeMap = {
    empty: '<span class="survey-choice-item__badge">未填</span>',
    progress: '<span class="survey-choice-item__badge survey-choice-item__badge--progress">继续填写</span>',
    submitted: '<span class="survey-choice-item__badge survey-choice-item__badge--done">已提交</span>'
  };
  const statusClassMap = {
    empty: '',
    progress: 'survey-choice-item--progress',
    submitted: 'survey-choice-item--done'
  };

  app.innerHTML = `
    <div class="client-page">
      <section class="container container--narrow">
        <div class="info-hero">
          <div class="info-hero__tag">下一步</div>
          <h1 class="info-hero__title">选择调查表</h1>
          <p class="info-hero__subtitle">可填写以下任意一个或多个调查表，完成至少一个即可提交</p>
        </div>

        <div class="survey-choice-card">
          <!-- 生活习惯自检表 -->
          <button class="survey-choice-item ${statusClassMap[lsStatus]}" id="btnGoLifestyle">
            <div class="survey-choice-item__head">
              <span class="survey-choice-item__icon">${lsStatus === 'submitted' ? '✓' : '1'}</span>
              <span class="survey-choice-item__name">生活习惯自检表</span>
              ${badgeMap[lsStatus]}
            </div>
            <div class="survey-choice-item__desc">
              基本信息（9 项）+ 饮食/睡觉/运动/毒素/寒湿/生活/情绪 7 类问卷（共 ${LIFESTYLE_TOTAL} 条）
              ${lsStatus === 'progress' ? `<br/><span class="survey-choice-item__progress">已勾选 ${lsCount} 项</span>` : ''}
              ${lsStatus === 'submitted' ? `<br/><span class="survey-choice-item__progress">已提交，可重新填写</span>` : ''}
            </div>
          </button>

          <!-- 身体语言自检表 -->
          <button class="survey-choice-item ${statusClassMap[blStatus]}" id="btnGoBodyLang">
            <div class="survey-choice-item__head">
              <span class="survey-choice-item__icon">${blStatus === 'submitted' ? '✓' : '2'}</span>
              <span class="survey-choice-item__name">身体语言自检表</span>
              ${badgeMap[blStatus]}
            </div>
            <div class="survey-choice-item__desc">
              100 条身体语言条目，勾选您目前的症状
              ${blStatus === 'progress' ? `<br/><span class="survey-choice-item__progress">已勾选 ${blCount} 项</span>` : ''}
              ${blStatus === 'submitted' ? `<br/><span class="survey-choice-item__progress">已提交，可重新填写</span>` : ''}
            </div>
          </button>

          <!-- 5S体质测评问卷 -->
          <button class="survey-choice-item ${statusClassMap[surveyStatus]}" id="btnGoSurvey">
            <div class="survey-choice-item__head">
              <span class="survey-choice-item__icon">${surveyStatus === 'submitted' ? '✓' : '3'}</span>
              <span class="survey-choice-item__name">5S体质测评问卷</span>
              ${badgeMap[surveyStatus]}
            </div>
            <div class="survey-choice-item__desc">
              九种体质共 72 题（每题 5 个选项）
              ${surveyStatus === 'progress' ? `<br/><span class="survey-choice-item__progress">已答 ${surveyCount} / ${TOTAL_QUESTIONS} 题</span>` : ''}
              ${surveyStatus === 'submitted' ? `<br/><span class="survey-choice-item__progress">已提交，可重新填写</span>` : ''}
            </div>
          </button>
        </div>

        <!-- 仅显示已完成数量，不再有提交按钮 -->
        <div class="survey-choice-submit">
          <div class="survey-choice-submit__info">
            已完成 <b>${totalDone}</b> / 3 个调查表
          </div>
        </div>

        <div class="form-back">
          <button class="btn btn--ghost btn--sm" id="btnBackInfo">← 返回修改信息</button>
        </div>
      </section>
    </div>
  `;

  document.getElementById('btnBackInfo').addEventListener('click', () => {
    state.step = 'info';
    render();
  });

  // 进入问卷前，若已提交则弹出重填提醒
  const confirmRefill = (callback) => {
    if (confirm('表格已提交，是否需要重新填写？')) {
      callback();
    }
  };

  document.getElementById('btnGoLifestyle').addEventListener('click', () => {
    state.withLifestyle = true;
    if (lsStatus === 'submitted') {
      confirmRefill(() => {
        // 清空生活习惯数据，重新开始
        state.lifestyleInfo = {};
        state.lifestyleChecked = {};
        state.submittedSurveys.lifestyle = false;
        state.step = 'lifestyleInfo';
        render();
      });
    } else {
      // 智能跳转：若基本信息已填，直接跳到问卷页；否则从基本信息开始
      const hasInfo = Object.keys(state.lifestyleInfo || {}).length > 0;
      state.step = hasInfo ? 'lifestyleSurvey' : 'lifestyleInfo';
      render();
    }
  });

  document.getElementById('btnGoBodyLang').addEventListener('click', () => {
    state.withLifestyle = true;
    if (blStatus === 'submitted') {
      confirmRefill(() => {
        state.bodyLanguageChecked = {};
        state.submittedSurveys.bodyLanguage = false;
        state.step = 'bodyLanguage';
        render();
      });
    } else {
      state.step = 'bodyLanguage';
      render();
    }
  });

  document.getElementById('btnGoSurvey').addEventListener('click', () => {
    if (surveyStatus === 'submitted') {
      confirmRefill(() => {
        state.answers = {};
        state.submittedSurveys.survey = false;
        state.startedAt = Date.now();
        state.step = 'survey';
        render();
      });
    } else {
      state.startedAt = Date.now();
      state.step = 'survey';
      render();
    }
  });
}

// ================ Step 2: 生活习惯基本信息 ================
function renderLifestyleInfoStep() {
  app.innerHTML = `
    <div class="client-page">
      <section class="container container--narrow">
        <div class="info-hero">
          <div class="info-hero__tag">生活习惯自检表 · 第 1 步</div>
          <h1 class="info-hero__title">基本信息</h1>
          <p class="info-hero__subtitle">请填写以下信息，以便更精准地分析您的健康状况</p>
        </div>

        <div class="info-form-card">
          ${LIFESTYLE_INFO_FIELDS.map((field) => renderLifestyleField(field)).join('')}
          <button class="btn btn--primary btn--lg form-submit" id="btnToLifestyleSurvey">
            进入生活方式问卷 →
          </button>
        </div>

        <div class="form-back">
          <button class="btn btn--ghost btn--sm" id="btnBackChoice">← 返回上一步</button>
        </div>
      </section>
    </div>
  `;

  // 绑定多选/单选按钮
  LIFESTYLE_INFO_FIELDS.forEach((field) => {
    if (field.type === 'multi' || field.type === 'single') {
      const group = document.getElementById(`f_${field.key}`);
      if (group) {
        group.querySelectorAll('input').forEach((input) => {
          input.addEventListener('change', () => {
            if (field.type === 'multi') {
              const selected = Array.from(group.querySelectorAll('input:checked')).map(
                (i) => i.value
              );
              state.lifestyleInfo[field.key] = selected;
            } else {
              state.lifestyleInfo[field.key] = input.value;
            }
            saveClientSession();
          });
        });
      }
    } else if (field.type === 'text' || field.type === 'textarea') {
      const el = document.getElementById(`f_${field.key}`);
      if (el) {
        el.addEventListener('input', () => {
          state.lifestyleInfo[field.key] = el.value;
          saveClientSession();
        });
      }
    }
  });

  document.getElementById('btnBackChoice').addEventListener('click', () => {
    // 保存已填的文本字段
    saveLifestyleInfoFields();
    saveClientSession();
    state.step = 'lifestyleChoice';
    render();
  });

  document.getElementById('btnToLifestyleSurvey').addEventListener('click', () => {
    // 保存文本字段
    saveLifestyleInfoFields();

    // 校验必填项
    for (const field of LIFESTYLE_INFO_FIELDS) {
      if (field.required) {
        const val = state.lifestyleInfo[field.key];
        if (!val || (Array.isArray(val) && val.length === 0)) {
          showToast(`请填写「${field.label}」`);
          return;
        }
      }
    }

    saveClientSession();
    state.step = 'lifestyleSurvey';
    render();
  });

  // 还原已填值（多选/单选）
  LIFESTYLE_INFO_FIELDS.forEach((field) => {
    if (field.type === 'multi' || field.type === 'single') {
      const val = state.lifestyleInfo[field.key];
      if (val) {
        const vals = Array.isArray(val) ? val : [val];
        vals.forEach((v) => {
          const input = document.querySelector(`#f_${field.key} input[value="${v}"]`);
          if (input) input.checked = true;
        });
      }
    }
  });
}

function renderLifestyleField(field) {
  const val = state.lifestyleInfo[field.key] || '';
  if (field.type === 'text') {
    return `
      <div class="form-item">
        <label class="form-item__label">${field.label} ${field.required ? '<span class="form-item__required">*</span>' : ''}</label>
        <input class="form-input" id="f_${field.key}" type="text" placeholder="${field.placeholder || ''}"
          value="${escapeHtml(val)}" />
      </div>
    `;
  }
  if (field.type === 'textarea') {
    return `
      <div class="form-item">
        <label class="form-item__label">${field.label} ${field.required ? '<span class="form-item__required">*</span>' : ''}</label>
        <textarea class="form-input form-input--textarea" id="f_${field.key}" rows="3" placeholder="${field.placeholder || ''}">${escapeHtml(val)}</textarea>
      </div>
    `;
  }
  // multi / single
  const inputType = field.type === 'multi' ? 'checkbox' : 'radio';
  return `
    <div class="form-item">
      <label class="form-item__label">${field.label} ${field.required ? '<span class="form-item__required">*</span>' : ''}</label>
      <div class="form-radio-group form-radio-group--wrap" id="f_${field.key}">
        ${field.options
          .map(
            (opt) => `
          <label class="form-radio form-radio--check">
            <input type="${inputType}" name="${field.key}" value="${opt.value}" />
            <span>${opt.label}</span>
          </label>
        `
          )
          .join('')}
      </div>
    </div>
  `;
}

function saveLifestyleInfoFields() {
  LIFESTYLE_INFO_FIELDS.forEach((field) => {
    const el = document.getElementById(`f_${field.key}`);
    if (!el) return;
    if (field.type === 'text' || field.type === 'textarea') {
      state.lifestyleInfo[field.key] = el.value.trim();
    }
    // 多选/单选已在 change 事件中保存
  });
}

// ================ Step 3: 生活习惯问卷（勾选式） ================
function renderLifestyleSurveyStep() {
  app.innerHTML = `
    <div class="client-page">
      <!-- 客户信息条 -->
      <div class="customer-bar">
        <div class="customer-bar__info">
          <b>${escapeHtml(state.customer.name)}</b>
          <span>${escapeHtml(state.customer.gender)} · ${escapeHtml(state.customer.age)}岁</span>
        </div>
        <button class="btn btn--ghost btn--sm" id="btnBackLifestyleInfo">← 返回基本信息</button>
      </div>

      <!-- 顶部进度 -->
      <div class="survey-progress">
        <div class="survey-progress__info">
          <span>已勾选 <b class="survey-progress__count" id="lsCount">0</b> / ${LIFESTYLE_TOTAL}</span>
          <span class="survey-progress__pct" id="lsPct">0%</span>
        </div>
        <div class="survey-progress__bar">
          <div class="survey-progress__fill" id="lsFill" style="width:0%"></div>
        </div>
      </div>

      ${renderSubmitErrorBanner('lifestyle')}

      <div class="container container--narrow">
        <div class="survey-tip">
          请勾选符合您实际情况的条目（可多选）
        </div>
      </div>

      <!-- 7 类生活方式问卷 -->
      <div class="container container--narrow">
        ${LIFESTYLE_CATEGORIES.map((cat) => renderLifestyleCategory(cat)).join('')}
      </div>

      <!-- 底部固定栏 -->
      <div class="survey-footer">
        <div class="survey-footer__left">
          <div class="survey-footer__progress">
            已勾选 <b id="lsFootPct">0</b> 项
          </div>
        </div>
        <button class="btn btn--primary btn--lg survey-footer__submit" id="btnLifestyleDone">
          提交当前问卷
        </button>
      </div>
    </div>
  `;

  refreshLifestyleView();

  document.querySelectorAll('.ls-item').forEach((el) => {
    el.addEventListener('click', () => {
      const key = el.dataset.key;
      state.lifestyleChecked[key] = !state.lifestyleChecked[key];
      refreshLifestyleView();
      saveClientSession();
    });
  });

  document.getElementById('btnBackLifestyleInfo').addEventListener('click', () => {
    saveClientSession();
    state.step = 'lifestyleInfo';
    render();
  });

  // 完成回到选择页（保存进度）
  const backToChoice = () => {
    saveClientSession();
    state.step = 'lifestyleChoice';
    render();
  };
  document.getElementById('btnLifestyleDone').addEventListener('click', () => {
    const checked = countLifestyleChecked(state.lifestyleChecked);
    if (checked === 0) {
      showToast('如需提交，请至少勾选一项；或直接返回选择其他调查表');
      return;
    }
    // 提交前清除上一次失败提示
    state.submitError = null;
    // 单独提交生活习惯问卷
    handleSubmitSingle('lifestyle');
  });

  bindSubmitErrorBanner('lifestyle');
}

// ================ Step 3.5: 身体语言自检表（勾选式，竖向排列） ================
function renderBodyLanguageStep() {
  app.innerHTML = `
    <div class="client-page">
      <!-- 客户信息条 -->
      <div class="customer-bar">
        <div class="customer-bar__info">
          <b>${escapeHtml(state.customer.name)}</b>
          <span>${escapeHtml(state.customer.gender)} · ${escapeHtml(state.customer.age)}岁</span>
        </div>
        <button class="btn btn--ghost btn--sm" id="btnBackToChoiceFromBl">← 返回上一步</button>
      </div>

      <!-- 顶部进度 -->
      <div class="survey-progress">
        <div class="survey-progress__info">
          <span>身体语言自检表 · 已勾选 <b class="survey-progress__count" id="blCount">0</b> / ${BODY_LANGUAGE_TOTAL}</span>
          <span class="survey-progress__pct" id="blPct">0%</span>
        </div>
        <div class="survey-progress__bar">
          <div class="survey-progress__fill" id="blFill" style="width:0%"></div>
        </div>
      </div>

      ${renderSubmitErrorBanner('bodyLanguage')}

      <div class="container container--narrow">
        <div class="survey-tip">
          请勾选您目前身体出现的症状（可多选）
        </div>
      </div>

      <!-- 身体语言条目（竖向排列） -->
      <div class="container container--narrow">
        <div class="bl-list">
          ${BODY_LANGUAGE_ITEMS.map(
            (item) => `
            <div class="bl-item" data-key="${item.key}">
              <span class="bl-item__check">✓</span>
              <span class="bl-item__seq">${item.seq}</span>
              <span class="bl-item__text">${escapeHtml(item.text)}</span>
            </div>
          `
          ).join('')}
        </div>
      </div>

      <!-- 底部固定栏 -->
      <div class="survey-footer">
        <div class="survey-footer__left">
          <div class="survey-footer__progress">
            已勾选 <b id="blFootPct">0</b> 项
          </div>
        </div>
        <button class="btn btn--primary btn--lg survey-footer__submit" id="btnBodyLangDone">
          提交当前问卷
        </button>
      </div>
    </div>
  `;

  refreshBodyLanguageView();

  document.querySelectorAll('.bl-item').forEach((el) => {
    el.addEventListener('click', () => {
      const key = el.dataset.key;
      state.bodyLanguageChecked[key] = !state.bodyLanguageChecked[key];
      refreshBodyLanguageView();
      saveClientSession();
    });
  });

  // 顶部返回上一步 / 完成都回到选择页（保存进度）
  const backToChoice = () => {
    saveClientSession();
    state.step = 'lifestyleChoice';
    render();
  };
  document.getElementById('btnBackToChoiceFromBl').addEventListener('click', backToChoice);
  document.getElementById('btnBodyLangDone').addEventListener('click', () => {
    const checked = countBodyLanguageChecked(state.bodyLanguageChecked);
    if (checked === 0) {
      showToast('如需提交，请至少勾选一项；或直接返回选择其他调查表');
      return;
    }
    // 提交前清除上一次失败提示
    state.submitError = null;
    // 单独提交身体语言问卷
    handleSubmitSingle('bodyLanguage');
  });

  bindSubmitErrorBanner('bodyLanguage');
}

function refreshBodyLanguageView() {
  document.querySelectorAll('.bl-item').forEach((el) => {
    const key = el.dataset.key;
    if (state.bodyLanguageChecked[key]) {
      el.classList.add('bl-item--checked');
    } else {
      el.classList.remove('bl-item--checked');
    }
  });

  const total = countBodyLanguageChecked(state.bodyLanguageChecked);
  const pct = Math.round((total / BODY_LANGUAGE_TOTAL) * 100);
  document.getElementById('blCount').textContent = total;
  document.getElementById('blPct').textContent = `${pct}%`;
  document.getElementById('blFill').style.width = `${pct}%`;
  document.getElementById('blFootPct').textContent = total;
}

function renderLifestyleCategory(cat) {
  return `
    <div class="ls-category-card">
      <div class="ls-category-card__head" style="--cat-color:${cat.color}">
        <span class="ls-category-card__symbol">${cat.symbol}</span>
        <span class="ls-category-card__name">${cat.name}</span>
        <span class="ls-category-card__count" id="lsCatCount_${cat.key}">0/${cat.items.length}</span>
      </div>
      <div class="ls-category-card__body">
        ${cat.items
          .map(
            (item) => `
          <div class="ls-item" data-key="${item.key}">
            <span class="ls-item__check">✓</span>
            <span class="ls-item__seq">${item.seq}</span>
            <span class="ls-item__text">${escapeHtml(item.text)}</span>
          </div>
        `
          )
          .join('')}
      </div>
    </div>
  `;
}

function refreshLifestyleView() {
  document.querySelectorAll('.ls-item').forEach((el) => {
    const key = el.dataset.key;
    if (state.lifestyleChecked[key]) {
      el.classList.add('ls-item--checked');
    } else {
      el.classList.remove('ls-item--checked');
    }
  });

  const total = countLifestyleChecked(state.lifestyleChecked);
  const pct = Math.round((total / LIFESTYLE_TOTAL) * 100);
  document.getElementById('lsCount').textContent = total;
  document.getElementById('lsPct').textContent = `${pct}%`;
  document.getElementById('lsFill').style.width = `${pct}%`;
  document.getElementById('lsFootPct').textContent = total;

  // 各分类小计
  LIFESTYLE_CATEGORIES.forEach((cat) => {
    const count = cat.items.filter((it) => state.lifestyleChecked[it.key]).length;
    const el = document.getElementById(`lsCatCount_${cat.key}`);
    if (el) el.textContent = `${count}/${cat.items.length}`;
  });
}

// ================ Step 4: 九种体质问卷 ================
function renderSurveyStep() {
  app.innerHTML = `
    <div class="client-page">
      <!-- 客户信息条 -->
      <div class="customer-bar">
        <div class="customer-bar__info">
          <b>${escapeHtml(state.customer.name)}</b>
          <span>${escapeHtml(state.customer.gender)} · ${escapeHtml(state.customer.age)}岁 · ${escapeHtml(state.customer.birthday)}</span>
        </div>
        <button class="btn btn--ghost btn--sm" id="btnBackToChoiceFromSurvey">← 返回选择</button>
      </div>

      <!-- 顶部进度 -->
      <div class="survey-progress">
        <div class="survey-progress__info">
          <span>已答 <b class="survey-progress__count" id="ansCount">0</b> / ${TOTAL_QUESTIONS}</span>
          <span class="survey-progress__pct" id="ansPct">0%</span>
        </div>
        <div class="survey-progress__bar">
          <div class="survey-progress__fill" id="ansFill" style="width:0%"></div>
        </div>
      </div>

      ${renderSubmitErrorBanner('survey')}

      <div class="container container--narrow">
        <div class="survey-tip">
          请在每道题下方选择最符合您程度的选项
        </div>
      </div>

      <!-- 问卷列表：每个体质一个卡片，每题一行，下方跟 5 个圆形选项 -->
      <div class="container container--narrow">
        <div class="survey-list" id="surveyTable">
          ${CONSTITUTIONS.map((c) => {
            const questions = GROUPED_QUESTIONS[c.id];
            return `
            <div class="survey-group" style="--c-color:${c.color}">
              <div class="survey-group__head">
                <span class="survey-group__symbol" style="color:${c.color}">${c.symbol}</span>
                <span class="survey-group__name">${c.name}</span>
                <span class="survey-group__count">${questions.length} 题</span>
              </div>
              ${questions
                .map(
                  (q) => `
                <div class="survey-question" data-q-key="${q.key}">
                  <div class="survey-question__head">
                    <span class="survey-question__seq">${q.seq}</span>
                    <span class="survey-question__text">${q.symptom}</span>
                  </div>
                  <div class="survey-question__options">
                    ${SURVEY_OPTIONS.map(
                      (opt) => `
                      <button type="button" class="opt-circle cell--option-body" data-key="${q.key}" data-value="${opt.value}">
                        <span class="opt-circle__label">${opt.label}</span>
                      </button>
                    `
                    ).join('')}
                  </div>
                </div>
              `
                )
                .join('')}
            </div>
          `;
          }).join('')}
        </div>
      </div>

      <!-- 底部固定栏 -->
      <div class="survey-footer">
        <div class="survey-footer__progress">
          已完成 <b id="footPct">0%</b>
        </div>
        <button class="btn btn--primary btn--lg survey-footer__submit" id="btnSubmit">
          提交当前问卷
        </button>
      </div>
    </div>
  `;

  refreshView();

  document.querySelectorAll('.cell--option-body').forEach((el) => {
    el.addEventListener('click', () => {
      const key = el.dataset.key;
      const value = Number(el.dataset.value);
      state.answers[key] = value;
      refreshView();
      saveClientSession();
    });
  });

  document.getElementById('btnBackToChoiceFromSurvey').addEventListener('click', () => {
    saveClientSession();
    state.step = 'lifestyleChoice';
    render();
  });

  document.getElementById('btnSubmit').addEventListener('click', () => {
    const count = countAnswered(state.answers);
    if (count === 0) {
      showToast('如需提交，请至少作答一题；或直接返回选择其他调查表');
      return;
    }
    // 提交前清除上一次失败提示
    state.submitError = null;
    // 单独提交5S体质测评问卷
    handleSubmitSingle('survey');
  });

  bindSubmitErrorBanner('survey');
}

function refreshView() {
  document.querySelectorAll('.cell--option-body').forEach((el) => {
    const key = el.dataset.key;
    const value = Number(el.dataset.value);
    if (state.answers[key] === value) {
      el.classList.add('opt-circle--selected');
    } else {
      el.classList.remove('opt-circle--selected');
    }
  });

  const count = countAnswered(state.answers);
  const pct = Math.round((count / TOTAL_QUESTIONS) * 100);
  document.getElementById('ansCount').textContent = count;
  document.getElementById('ansPct').textContent = `${pct}%`;
  document.getElementById('ansFill').style.width = `${pct}%`;
  document.getElementById('footPct').textContent = `${pct}%`;
}

// ================ 提交 ================
/**
 * 统一提交函数：仅提交指定的单个问卷
 * @param {'lifestyle'|'bodyLanguage'|'survey'} type - 提交的问卷类型
 */
async function handleSubmitSingle(type) {
  const endedAt = Date.now();
  const scores = calcConstitutionScores(state.answers);
  const mainBias = findMainBias(scores);

  // 提交前校验：对应问卷必须有实际内容
  if (type === 'survey') {
    const cnt = countAnswered(state.answers);
    if (cnt === 0) {
      showToast('请至少作答一题再提交');
      return;
    }
  } else if (type === 'lifestyle') {
    const cnt = countLifestyleChecked(state.lifestyleChecked);
    if (cnt === 0 && Object.keys(state.lifestyleInfo || {}).length === 0) {
      showToast('请至少勾选一项或填写基本信息再提交');
      return;
    }
  } else if (type === 'bodyLanguage') {
    const cnt = countBodyLanguageChecked(state.bodyLanguageChecked);
    if (cnt === 0) {
      showToast('请至少勾选一项再提交');
      return;
    }
  }

  // 构造记录：仅包含本次提交的问卷数据，其他问卷数据设为 undefined
  const record = {
    customer: state.customer,
    managerCode: state.managerCode,
    answers: type === 'survey' ? state.answers : {},
    scores: type === 'survey' ? scores : [],
    mainBias: type === 'survey' ? mainBias : undefined,
    withLifestyle: type === 'lifestyle',
    lifestyleInfo: type === 'lifestyle' ? state.lifestyleInfo : undefined,
    lifestyleChecked: type === 'lifestyle' ? state.lifestyleChecked : undefined,
    bodyLanguageChecked: type === 'bodyLanguage' ? state.bodyLanguageChecked : undefined,
    // 标记本次提交的是哪个问卷，便于管理端识别
    submittedType: type,
    durationSec: Math.max(1, Math.round((endedAt - state.startedAt) / 1000))
  };

  // 重复提交防护
  if (state.__submitting) {
    showToast('正在提交中，请稍候...');
    return;
  }
  state.__submitting = true;
  state.step = 'submitting';
  render();

  try {
    await api.create(record);
    // 标记对应问卷为已提交
    state.submittedSurveys[type] = true;
    // 提交成功，清除失败状态
    state.submitError = null;
    // 保存会话进度
    saveClientSession();
    state.step = 'done';
    state.__lastSubmittedType = type;
    render();
  } catch (err) {
    // 记录持久错误状态，在对应问卷页顶部显示横幅（不自动消失）
    state.submitError = {
      type,
      message: err.message || '网络错误，请检查网络后重试',
      ts: Date.now()
    };
    // 保留短 toast 即时反馈
    showToast('提交失败：' + (err.message || '网络错误'));
    // 返回对应的问卷页（横幅会在该页顶部显示）
    if (type === 'lifestyle') state.step = 'lifestyleSurvey';
    else if (type === 'bodyLanguage') state.step = 'bodyLanguage';
    else state.step = 'survey';
    render();
  } finally {
    state.__submitting = false;
  }
}

// 保留原 handleSubmit 兼容（不再使用，但避免潜在引用报错）
async function handleSubmit() {
  // 不再使用统一提交，直接返回
  return;
}

function renderSubmitting() {
  app.innerHTML = `
    <div class="client-page client-page--center">
      <div class="loading">
        <div class="loading__spinner"></div>
        <div class="loading__text">正在提交问卷...</div>
      </div>
    </div>
  `;
}

function renderDone() {
  const typeNameMap = {
    lifestyle: '生活习惯自检表',
    bodyLanguage: '身体语言自检表',
    survey: '5S体质测评问卷'
  };
  const typeName = typeNameMap[state.__lastSubmittedType] || '问卷';
  app.innerHTML = `
    <div class="client-page client-page--center">
      <div class="done-card">
        <div class="done-card__icon">✓</div>
        <h1 class="done-card__title">${typeName}提交成功</h1>
        <p class="done-card__desc">
          ${escapeHtml(state.customer.name)}，感谢您的填写！<br/>
          「${typeName}」已提交，可继续填写其他问卷。
        </p>
        <div class="done-card__actions">
          <button class="btn btn--ghost btn--lg" id="btnBackToChoice">继续填写其他问卷</button>
          <a class="btn btn--primary btn--lg" href="./index.html">返回首页</a>
        </div>
      </div>
    </div>
  `;

  document.getElementById('btnBackToChoice')?.addEventListener('click', () => {
    state.step = 'lifestyleChoice';
    render();
  });
}

// ================ 工具函数 ================
/** 根据出生日期字符串(YYYY-MM-DD)计算周岁年龄 */
function calcAge(birthday) {
  if (!birthday) return 0;
  const birth = new Date(birthday);
  if (isNaN(birth.getTime())) return 0;
  const now = new Date();
  let age = now.getFullYear() - birth.getFullYear();
  const m = now.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < birth.getDate())) {
    age--;
  }
  return age;
}

function escapeHtml(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
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

/**
 * 渲染提交失败持久横幅（仅在对应问卷页显示，不自动消失）
 * @param {'survey'|'lifestyle'|'bodyLanguage'} type 当前问卷类型
 * @returns {string} HTML 字符串（无错误时返回空字符串）
 */
function renderSubmitErrorBanner(type) {
  if (!state.submitError || state.submitError.type !== type) return '';
  const msg = state.submitError.message || '提交失败';
  return `
    <div class="submit-error-banner" id="submitErrorBanner">
      <div class="submit-error-banner__icon">!</div>
      <div class="submit-error-banner__body">
        <div class="submit-error-banner__title">本次提交未成功，请重试</div>
        <div class="submit-error-banner__desc">${escapeHtml(msg)}（您的填写内容已保留，无需重新填写）</div>
      </div>
      <button class="btn btn--primary btn--sm" id="btnRetrySubmit">重新提交</button>
      <button class="btn btn--ghost btn--sm" id="btnDismissError">×</button>
    </div>
  `;
}

/** 绑定持久错误横幅的按钮事件（重试 / 忽略） */
function bindSubmitErrorBanner(type) {
  const banner = document.getElementById('submitErrorBanner');
  if (!banner) return;
  document.getElementById('btnRetrySubmit')?.addEventListener('click', () => {
    handleSubmitSingle(type);
  });
  document.getElementById('btnDismissError')?.addEventListener('click', () => {
    state.submitError = null;
    render();
  });
}

// ================ 切换用户功能（全局导航栏） ================
function bindSwitchUserNav() {
  const navLink = document.getElementById('navSwitchUser');
  if (!navLink) return;
  // 事件绑定只做一次
  if (!navLink.__bound) {
    navLink.__bound = true;
    navLink.addEventListener('click', (e) => {
      e.preventDefault();
      showSwitchUserModal();
    });
  }
  // 每次渲染都更新当前用户姓名显示
  const userEl = document.getElementById('navCurrentUser');
  if (userEl) {
    userEl.textContent = state.customer.name ? `当前：${state.customer.name}` : '';
  }
}

function showSwitchUserModal() {
  const users = listLocalUsers();
  const modal = document.createElement('div');
  modal.className = 'modal-overlay';
  modal.innerHTML = `
    <div class="modal-card">
      <div class="modal-card__head">
        <span class="modal-card__title">切换用户</span>
        <button class="modal-card__close" id="modalClose">×</button>
      </div>
      <div class="modal-card__body">
        <button class="btn btn--primary btn--lg" id="modalNewUser" style="width:100%;margin-bottom:16px;">
          + 新增用户
        </button>
        ${users.length > 0 ? '<div class="modal-card__sub">已登记用户</div>' : '<div class="modal-card__empty">暂无已登记用户</div>'}
        <div class="user-list">
          ${users
            .map(
              (u, i) => `
            <div class="user-list__item">
              <button class="user-list__btn" data-idx="${i}">
                <span class="user-list__name">${escapeHtml(u.customer.name)}</span>
                <span class="user-list__info">${escapeHtml(u.customer.gender)} · ${escapeHtml(u.customer.birthday)}</span>
                ${u.managerName ? `<span class="user-list__mgr">服务：${escapeHtml(u.managerName)}</span>` : ''}
              </button>
              <button class="user-list__del" data-idx="${i}" title="删除">删除</button>
            </div>
          `
            )
            .join('')}
        </div>
      </div>
    </div>
  `;
  document.body.appendChild(modal);

  const close = () => modal.remove();
  modal.addEventListener('click', (e) => {
    if (e.target === modal) close();
  });
  document.getElementById('modalClose').addEventListener('click', close);

  document.getElementById('modalNewUser').addEventListener('click', () => {
    close();
    // 新增用户：保留当前 managerCode（自动归属当前管理人员），清空客户信息和问卷数据
    const currentManagerCode = state.managerCode;
    const currentManagerName = state.managerName;
    state.customer = { name: '', gender: '', age: '', birthday: '', phone: '' };
    state.managerCode = currentManagerCode;
    state.managerName = currentManagerName;
    state.lifestyleInfo = {};
    state.lifestyleChecked = {};
    state.bodyLanguageChecked = {};
    state.answers = {};
    state.submittedSurveys = { lifestyle: false, bodyLanguage: false, survey: false };
    state.startedAt = Date.now();
    clearClientSession();
    state.step = 'info';
    render();
  });

  // 切换到已有用户
  modal.querySelectorAll('.user-list__btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      const idx = Number(btn.dataset.idx);
      const user = users[idx];
      if (!user) return;
      close();
      // 恢复该用户的会话
      state.customer = user.customer;
      state.managerCode = user.managerCode;
      state.managerName = user.managerName;
      // 尝试恢复该用户的问卷进度（从 localStorage 读取独立保存）
      const userSessionKey = `mole_client_session_${user.customer.name}_${user.customer.birthday}_${user.customer.gender}`;
      try {
        const raw = localStorage.getItem(userSessionKey);
        if (raw) {
          const s = JSON.parse(raw);
          state.lifestyleInfo = s.lifestyleInfo || {};
          state.lifestyleChecked = s.lifestyleChecked || {};
          state.bodyLanguageChecked = s.bodyLanguageChecked || {};
          state.answers = s.answers || {};
          state.submittedSurveys = s.submittedSurveys || { lifestyle: false, bodyLanguage: false, survey: false };
          state.startedAt = s.startedAt || Date.now();
        } else {
          state.lifestyleInfo = {};
          state.lifestyleChecked = {};
          state.bodyLanguageChecked = {};
          state.answers = {};
          state.submittedSurveys = { lifestyle: false, bodyLanguage: false, survey: false };
          state.startedAt = Date.now();
        }
      } catch {
        state.lifestyleInfo = {};
        state.lifestyleChecked = {};
        state.bodyLanguageChecked = {};
        state.answers = {};
        state.submittedSurveys = { lifestyle: false, bodyLanguage: false, survey: false };
        state.startedAt = Date.now();
      }
      // 保存为当前会话
      saveClientSession();
      state.step = 'lifestyleChoice';
      render();
    });
  });

  // 删除用户
  modal.querySelectorAll('.user-list__del').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const idx = Number(btn.dataset.idx);
      const user = users[idx];
      if (!user) return;
      if (confirm(`确认删除用户「${user.customer.name}」？`)) {
        removeLocalUser(user.customer);
        // 清理该用户的独立进度
        const userSessionKey = `mole_client_session_${user.customer.name}_${user.customer.birthday}_${user.customer.gender}`;
        localStorage.removeItem(userSessionKey);
        close();
        showSwitchUserModal();
      }
    });
  });
}

// 每次渲染后重新绑定导航事件（因为 nav 在 HTML 中静态存在）
const _originalRender = render;
render = function (...args) {
  _originalRender.apply(this, args);
  bindSwitchUserNav();
};
