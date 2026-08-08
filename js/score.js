// ============================================
// 工具层：体质计分逻辑
// 单体质原始分区间：8-40（8 题 × 1~5 分）
// 雷达图与列表均展示原始分值，不使用百分制
// 注意：平和体质（id=9）的第 3~8 题为反向题，需反向计分
// ============================================
import { CONSTITUTIONS, SURVEY_QUESTIONS } from './data.js';

/** 偏颇判定阈值：原始分 ≥ 24 视为偏颇（8-40 区间的中位数） */
const BIAS_THRESHOLD = 24;

/** 平和体质反向题：第 3~8 题（key: 9-3 ~ 9-8） */
const REVERSE_KEYS = new Set(['9-3', '9-4', '9-5', '9-6', '9-7', '9-8']);

/** 反向计分：1↔5, 2↔4, 3→3 */
function reverseScore(v) {
  return 6 - v;
}

/** 计算各体质原始得分（含平和体质反向题处理） */
export function calcConstitutionScores(answers) {
  const totals = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0, 7: 0, 8: 0, 9: 0 };

  SURVEY_QUESTIONS.forEach((q) => {
    const raw = answers[q.key];
    if (!raw) return;
    // 平和体质反向题：原始分反转
    const v = REVERSE_KEYS.has(q.key) ? reverseScore(raw) : raw;
    totals[q.constitutionId] += v;
  });

  return CONSTITUTIONS.map((c) => ({
    constitutionId: c.id,
    name: c.name,
    symbol: c.symbol,
    color: c.color,
    totalScore: totals[c.id]
  }));
}

/** 找出主要偏颇体质（平和除外，原始分最高且 ≥ 24） */
export function findMainBias(scores) {
  const bias = scores
    .filter((s) => s.constitutionId !== 9)
    .sort((a, b) => b.totalScore - a.totalScore)[0];
  return bias && bias.totalScore >= BIAS_THRESHOLD ? bias : undefined;
}

/** 统计已作答数量 */
export function countAnswered(answers) {
  return Object.keys(answers).filter((k) => answers[k] != null).length;
}
