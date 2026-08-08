// ============================================
// 工具层：生活习惯计分逻辑
// 依据《功能新增.txt》###2 的 7 类健康分析映射
// 客户勾选哪些条目 → 命中哪些健康分析类别 → 各类命中数与条目列表
// ============================================
import { HEALTH_ANALYSIS, findLifestyleItem } from './lifestyle-data.js';

/**
 * 统计生活习惯命中的 7 类健康分析
 * @param {Object} lifestyleChecked 客户勾选状态，key 为 "{cat}-{seq}"，value 为 true/false
 * @returns {Array} 7 类健康分析结果，含命中数、命中条目列表
 */
export function calcLifestyleScores(lifestyleChecked = {}) {
  return HEALTH_ANALYSIS.map((analysis) => {
    const hitItems = [];

    analysis.mapping.forEach(({ cat, seqs }) => {
      seqs.forEach((seq) => {
        const key = `${cat}-${seq}`;
        if (lifestyleChecked[key]) {
          const item = findLifestyleItem(cat, seq);
          if (item) hitItems.push(item);
        }
      });
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
export function countLifestyleChecked(lifestyleChecked = {}) {
  return Object.keys(lifestyleChecked).filter((k) => lifestyleChecked[k]).length;
}

/**
 * 计算各生活方式类别的勾选数量
 */
export function countByCategory(lifestyleChecked = {}, categories = []) {
  const result = {};
  categories.forEach((cat) => {
    result[cat.key] = cat.items.filter((it) => lifestyleChecked[it.key]).length;
  });
  return result;
}
