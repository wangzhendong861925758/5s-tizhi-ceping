// ============================================
// 组件层：雷达图（Canvas 2D 手绘）
// 基于原始分值 8-40 绘制（8 题 × 1~5 分）
// ============================================

const MIN_SCORE = 8;
const MAX_SCORE = 40;

/**
 * 在指定 canvas 上绘制九体质雷达图
 * @param {HTMLCanvasElement} canvas
 * @param {Array} scores - 体质得分数组（含 totalScore 字段，区间 8-40）
 * @param {number} size - 画布逻辑尺寸（px）
 */
export function drawRadar(canvas, scores, size = 480) {
  if (!canvas || !scores || scores.length === 0) return;

  const ctx = canvas.getContext('2d');
  if (!ctx) {
    console.error('[Radar] getContext 失败');
    return;
  }

  const dpr = window.devicePixelRatio || 1;
  canvas.width = size * dpr;
  canvas.height = size * dpr;
  canvas.style.width = `${size}px`;
  canvas.style.height = `${size}px`;
  ctx.scale(dpr, dpr);

  const w = size;
  const h = size;
  const cx = w / 2;
  const cy = h / 2;
  const radius = Math.max(50, Math.min(w, h) / 2 - 80);
  const n = scores.length;
  const angleStep = (Math.PI * 2) / n;
  const startAngle = -Math.PI / 2;

  // 清空
  ctx.clearRect(0, 0, w, h);

  // ---- 1. 同心多边形网格（4 环，对应 16/24/32/40 分）----
  const rings = 4;
  ctx.strokeStyle = '#e5e6eb';
  ctx.lineWidth = 1;
  for (let r = 1; r <= rings; r++) {
    const ringRadius = (radius * r) / rings;
    ctx.beginPath();
    for (let i = 0; i < n; i++) {
      const angle = startAngle + i * angleStep;
      const x = cx + Math.cos(angle) * ringRadius;
      const y = cy + Math.sin(angle) * ringRadius;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.stroke();
  }

  // ---- 2. 中心放射轴 ----
  ctx.strokeStyle = '#f2f3f5';
  for (let i = 0; i < n; i++) {
    const angle = startAngle + i * angleStep;
    const x = cx + Math.cos(angle) * radius;
    const y = cy + Math.sin(angle) * radius;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(x, y);
    ctx.stroke();
  }

  // ---- 3. 网格刻度标签（8/16/24/32/40）----
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#c9cdd4';
  ctx.font = '10px -apple-system, sans-serif';
  ctx.fillText(`${MIN_SCORE}`, cx + 2, cy - 4);
  for (let r = 1; r <= rings; r++) {
    const ringRadius = (radius * r) / rings;
    const scoreLabel = MIN_SCORE + ((MAX_SCORE - MIN_SCORE) * r) / rings;
    ctx.fillText(`${scoreLabel}`, cx + 2, cy - ringRadius);
  }

  // ---- 4. 数据多边形 ----
  const dataPoints = [];
  ctx.beginPath();
  scores.forEach((s, i) => {
    const angle = startAngle + i * angleStep;
    // 原始分 8-40 映射到 0~radius
    const ratio =
      (Math.max(MIN_SCORE, Math.min(MAX_SCORE, s.totalScore)) - MIN_SCORE) /
      (MAX_SCORE - MIN_SCORE);
    const len = ratio * radius;
    const x = cx + Math.cos(angle) * len;
    const y = cy + Math.sin(angle) * len;
    dataPoints.push({ x, y, score: s });
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  });
  ctx.closePath();
  // 渐变填充
  const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, radius);
  grad.addColorStop(0, 'rgba(46, 125, 91, 0.45)');
  grad.addColorStop(1, 'rgba(46, 125, 91, 0.15)');
  ctx.fillStyle = grad;
  ctx.fill();
  // 描边
  ctx.strokeStyle = '#2e7d5b';
  ctx.lineWidth = 2.5;
  ctx.stroke();

  // 顶点圆点
  dataPoints.forEach((p) => {
    ctx.beginPath();
    ctx.arc(p.x, p.y, 4, 0, Math.PI * 2);
    ctx.fillStyle = p.score.color || '#2e7d5b';
    ctx.fill();
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;
    ctx.stroke();
  });

  // ---- 5. 顶点标签：体质符号 + 简称 + 原始分 ----
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  scores.forEach((s, i) => {
    const angle = startAngle + i * angleStep;
    const labelRadius = radius + 36;
    const x = cx + Math.cos(angle) * labelRadius;
    const y = cy + Math.sin(angle) * labelRadius;
    // 序号符号
    ctx.fillStyle = s.color || '#2e7d5b';
    ctx.font = 'bold 16px "Noto Serif SC", serif';
    ctx.fillText(`${s.symbol}`, x, y - 12);
    // 体质简称
    ctx.fillStyle = '#4e5969';
    ctx.font = '12px -apple-system, sans-serif';
    ctx.fillText(s.name.replace('体质', ''), x, y + 6);
    // 原始分值（8-40）
    ctx.fillStyle = '#1d2129';
    ctx.font = 'bold 13px -apple-system, sans-serif';
    ctx.fillText(`${s.totalScore}`, x, y + 24);
  });
}
