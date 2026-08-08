// ============================================
// 组件层：生活习惯健康分析柱状图
// 用 Canvas 2D 绘制 7 类健康分析的命中数柱状图
// ============================================

/**
 * 绘制 7 类健康分析柱状图
 * @param {HTMLCanvasElement} canvas
 * @param {Array} scores calcLifestyleScores 的返回值
 * @param {Number} size 画布尺寸
 */
export function drawLifestyleBarChart(canvas, scores, size = 600) {
  if (!canvas || !scores || scores.length === 0) return;

  const dpr = window.devicePixelRatio || 1;
  const W = size;
  const H = Math.round(size * 0.66);
  canvas.width = W * dpr;
  canvas.height = H * dpr;
  canvas.style.width = `${W}px`;
  canvas.style.height = `${H}px`;

  const ctx = canvas.getContext('2d');
  ctx.scale(dpr, dpr);
  ctx.clearRect(0, 0, W, H);

  // 边距：padBottom 留出竖向名称空间（最长 3 字）
  const padLeft = 110; // 左侧留出标签空间
  const padRight = 30;
  const padTop = 30;
  const padBottom = 70;

  const chartW = W - padLeft - padRight;
  const chartH = H - padTop - padBottom;

  const maxCount = Math.max(1, ...scores.map((s) => s.hitCount));

  // 横向网格线（4 等分）
  ctx.strokeStyle = '#e8e8e8';
  ctx.lineWidth = 1;
  ctx.font = '11px sans-serif';
  ctx.fillStyle = '#999';
  ctx.textAlign = 'right';
  ctx.textBaseline = 'middle';
  for (let i = 0; i <= 4; i++) {
    const y = padTop + (chartH * i) / 4;
    ctx.beginPath();
    ctx.moveTo(padLeft, y);
    ctx.lineTo(W - padRight, y);
    ctx.stroke();
    const val = Math.round(maxCount * (1 - i / 4));
    ctx.fillText(String(val), padLeft - 8, y);
  }

  // Y 轴标题：竖向排列（逐字从上往下，文字正向）
  ctx.fillStyle = '#666';
  ctx.font = '12px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  const yTitle = '命中条目数';
  const yTitleChars = yTitle.split('');
  const yStartY = padTop + chartH / 2 - (yTitleChars.length * 14) / 2;
  yTitleChars.forEach((ch, i) => {
    ctx.fillText(ch, 16, yStartY + i * 14);
  });

  // 柱子
  const barCount = scores.length;
  const slotW = chartW / barCount;
  const barW = Math.min(38, slotW * 0.55);

  scores.forEach((s, idx) => {
    const cx = padLeft + slotW * idx + slotW / 2;
    const barH = (s.hitCount / maxCount) * chartH;
    const x = cx - barW / 2;
    const y = padTop + chartH - barH;

    // 柱子（渐变）
    if (barH > 0) {
      const grad = ctx.createLinearGradient(0, y, 0, y + barH);
      grad.addColorStop(0, s.color);
      grad.addColorStop(1, s.color + 'aa');
      ctx.fillStyle = grad;
      // 圆角顶部
      const r = Math.min(6, barW / 2, barH / 2 || 1);
      ctx.beginPath();
      ctx.moveTo(x, y + r);
      ctx.arc(x + r, y + r, r, Math.PI, Math.PI * 1.5);
      ctx.arc(x + barW - r, y + r, r, Math.PI * 1.5, 0);
      ctx.lineTo(x + barW, y + barH);
      ctx.lineTo(x, y + barH);
      ctx.closePath();
      ctx.fill();
    } else {
      // 空柱子占位
      ctx.fillStyle = '#f0f0f0';
      ctx.fillRect(x, padTop + chartH - 4, barW, 4);
    }

    // 顶部数值
    ctx.fillStyle = s.hitCount > 0 ? s.color : '#bbb';
    ctx.font = 'bold 13px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';
    ctx.fillText(String(s.hitCount), cx, y - 4);

    // 底部标签：简短名称，竖向排列（逐字从上往下）
    ctx.fillStyle = '#555';
    ctx.font = '12px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    // 柱状图下方仅显示简短名称
    const shortNameMap = {
      '贫血（气血不足）': '贫血',
      '微循环不通': '微循环',
      '血脂粘稠': '血脂',
      '寒凉湿症': '寒湿'
    };
    const label = shortNameMap[s.name] || s.name;
    const chars = label.split('');
    chars.forEach((ch, i) => {
      ctx.fillText(ch, cx, padTop + chartH + 8 + i * 14);
    });
  });
}
