// ============================================
// 组件层：八卦地支配经圆盘（Canvas 2D）
// 三层结构：中心八卦图 / 中圈十二地支 / 外圈对应经络解读
// 客户所属地支位置点亮，其余暗淡
// ============================================
import { ZODIAC_LIST } from './zodiac.js';

/**
 * 绘制八卦地支配经圆盘
 * @param {HTMLCanvasElement} canvas
 * @param {string} activeBranch - 客户对应地支（如 '子'），用于点亮
 * @param {number} size - 画布逻辑尺寸
 */
export function drawBaguaWheel(canvas, activeBranch, size = 520) {
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    console.error('[BaguaWheel] getContext 失败');
    return;
  }

  const dpr = window.devicePixelRatio || 1;
  canvas.width = size * dpr;
  canvas.height = size * dpr;
  canvas.style.width = `${size}px`;
  canvas.style.height = `${size}px`;
  ctx.scale(dpr, dpr);

  const cx = size / 2;
  const cy = size / 2;
  // 三层半径
  const rBagua = size * 0.13; // 八卦图半径
  const rBranchInner = size * 0.13;
  const rBranchOuter = size * 0.27; // 中圈地支外缘
  const rOuterInner = size * 0.27;
  const rOuterOuter = size * 0.48; // 外圈解读外缘

  const n = 12;
  const angleStep = (Math.PI * 2) / n;
  // 起始角度：让「子」位于正上方（12 点钟方向）
  const startAngle = -Math.PI / 2;

  ctx.clearRect(0, 0, size, size);

  // ============ 外圈背景：12 等分扇形 ============
  ZODIAC_LIST.forEach((item, i) => {
    const a0 = startAngle + i * angleStep - angleStep / 2;
    const a1 = a0 + angleStep;
    const isActive = item.earthlyBranch === activeBranch;

    // 扇形
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.arc(cx, cy, rOuterOuter, a0, a1);
    ctx.closePath();
    if (isActive) {
      const grad = ctx.createRadialGradient(cx, cy, rOuterInner, cx, cy, rOuterOuter);
      grad.addColorStop(0, 'rgba(230, 90, 50, 0.35)');
      grad.addColorStop(1, 'rgba(230, 90, 50, 0.12)');
      ctx.fillStyle = grad;
    } else {
      ctx.fillStyle = i % 2 === 0 ? 'rgba(245, 245, 240, 0.9)' : 'rgba(232, 232, 226, 0.9)';
    }
    ctx.fill();
    ctx.strokeStyle = isActive ? '#e65a32' : 'rgba(180, 180, 170, 0.5)';
    ctx.lineWidth = isActive ? 2 : 0.8;
    ctx.stroke();
  });

  // ============ 中圈背景：12 等分扇形 ============
  ZODIAC_LIST.forEach((item, i) => {
    const a0 = startAngle + i * angleStep - angleStep / 2;
    const a1 = a0 + angleStep;
    const isActive = item.earthlyBranch === activeBranch;

    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.arc(cx, cy, rBranchOuter, a0, a1);
    ctx.closePath();
    if (isActive) {
      const grad = ctx.createRadialGradient(cx, cy, rBranchInner, cx, cy, rBranchOuter);
      grad.addColorStop(0, 'rgba(230, 90, 50, 0.55)');
      grad.addColorStop(1, 'rgba(230, 90, 50, 0.25)');
      ctx.fillStyle = grad;
    } else {
      ctx.fillStyle = i % 2 === 0 ? '#f7f5ef' : '#ece9e0';
    }
    ctx.fill();
    ctx.strokeStyle = isActive ? '#e65a32' : 'rgba(170, 165, 150, 0.4)';
    ctx.lineWidth = isActive ? 2 : 0.8;
    ctx.stroke();
  });

  // ============ 分隔环线 ============
  ctx.strokeStyle = 'rgba(140, 130, 110, 0.4)';
  ctx.lineWidth = 1;
  [rBranchInner, rBranchOuter, rOuterOuter].forEach((r) => {
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.stroke();
  });

  // ============ 中圈：地支文字 + 生肖 ============
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ZODIAC_LIST.forEach((item, i) => {
    const angle = startAngle + i * angleStep;
    const r = (rBranchInner + rBranchOuter) / 2;
    const x = cx + Math.cos(angle) * r;
    const y = cy + Math.sin(angle) * r;
    const isActive = item.earthlyBranch === activeBranch;

    // 地支
    ctx.font = `${isActive ? 'bold' : 'normal'} ${isActive ? 24 : 18}px "Noto Serif SC", serif`;
    ctx.fillStyle = isActive ? '#e65a32' : '#6b6557';
    ctx.fillText(item.earthlyBranch, x, y - 8);
    // 生肖小字
    ctx.font = `${isActive ? 'bold 12px' : '11px'} -apple-system, sans-serif`;
    ctx.fillStyle = isActive ? '#c84a22' : '#9a9384';
    ctx.fillText(item.zodiac, x, y + 10);
  });

  // ============ 外圈：经络解读文字（沿扇形中心） ============
  ZODIAC_LIST.forEach((item, i) => {
    const angle = startAngle + i * angleStep;
    const r = (rOuterInner + rOuterOuter) / 2 + 6;
    const x = cx + Math.cos(angle) * r;
    const y = cy + Math.sin(angle) * r;
    const isActive = item.earthlyBranch === activeBranch;

    // 旋转文字使其沿径向阅读
    ctx.save();
    ctx.translate(x, y);
    // 让文字朝外阅读：旋转角度 = angle + 90°
    let rot = angle + Math.PI / 2;
    // 底部文字翻转避免倒着读
    if (rot > Math.PI / 2 && rot < (Math.PI * 3) / 2) {
      rot += Math.PI;
    }
    ctx.rotate(rot);

    // 脏器名
    ctx.font = `${isActive ? 'bold' : 'normal'} ${isActive ? 14 : 12}px "Noto Serif SC", serif`;
    ctx.fillStyle = isActive ? '#e65a32' : '#7a7468';
    ctx.fillText(item.organ, 0, -8);
    // 经络名
    ctx.font = `${isActive ? 'bold' : 'normal'} ${isActive ? 11 : 9}px -apple-system, sans-serif`;
    ctx.fillStyle = isActive ? '#c84a22' : '#9a9384';
    ctx.fillText(item.meridian, 0, 8);
    ctx.restore();
  });

  // ============ 中心八卦图 ============
  drawBagua(ctx, cx, cy, rBagua);
}

/**
 * 绘制中心八卦图
 * 与网站左上角导航的品牌符号保持一致：使用 Unicode 字符 ☯（太极阴阳鱼）
 * 颜色采用黑白色，呈现传统阴阳鱼本色
 * @param {CanvasRenderingContext2D} ctx
 * @param {number} cx 中心x
 * @param {number} cy 中心y
 * @param {number} r 半径
 */
function drawBagua(ctx, cx, cy, r) {
  // 外圆背景（白色）
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fillStyle = '#ffffff';
  ctx.fill();
  // 黑色细边
  ctx.strokeStyle = '#1d2129';
  ctx.lineWidth = 2;
  ctx.stroke();

  // ============ 太极阴阳鱼（☯ 符号，黑白两色） ============
  // 使用 Unicode 字符 ☯ 渲染，与左上角导航保持一致
  // 字体大小根据半径自适应
  const fontSize = Math.round(r * 1.7);
  ctx.font = `${fontSize}px "Noto Serif SC", "STSong", serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#1d2129'; // 黑色
  ctx.fillText('☯', cx, cy);
}
