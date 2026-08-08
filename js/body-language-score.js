// ============================================
// 工具层：身体语言自检表计分逻辑
// 依据《功能新增.txt》###3 的 7 类健康分析映射
// 客户勾选哪些条目 → 命中哪些健康分析类别 → 各类命中数与条目列表
// ============================================
import { BODY_LANGUAGE_ANALYSIS, findBodyLanguageItem } from './body-language-data.js';

/**
 * 统计身体语言命中的 7 类健康分析
 * @param {Object} checked 客户勾选状态，key 为 "bl-{seq}"，value 为 true/false
 * @returns {Array} 7 类健康分析结果，含命中数、命中条目列表
 */
export function calcBodyLanguageScores(checked = {}) {
  return BODY_LANGUAGE_ANALYSIS.map((analysis) => {
    const hitItems = [];

    analysis.seqs.forEach((seq) => {
      const key = `bl-${seq}`;
      if (checked[key]) {
        const item = findBodyLanguageItem(seq);
        if (item) hitItems.push(item);
      }
    });

    return {
      key: analysis.key,
      name: analysis.name,
      symbol: analysis.symbol,
      color: analysis.color,
      hitCount: hitItems.length,
      hitItems
    };
  });
}

/**
 * 统计客户勾选总条目数
 */
export function countBodyLanguageChecked(checked = {}) {
  return Object.keys(checked).filter((k) => checked[k]).length;
}
