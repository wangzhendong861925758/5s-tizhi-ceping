// ============================================
// 生命数字（天赋数字）计算模块
// 基于阳历生日，计算三角形内7个核心数字（七魄）、
// 外部9个延伸数字、3组公式、12组联合码
// ============================================

function addDigits(n) {
  let sum = Math.abs(n);
  while (sum > 9) {
    let s = 0;
    while (sum > 0) {
      s += sum % 10;
      sum = Math.floor(sum / 10);
    }
    sum = s;
  }
  return sum;
}

export function calculateNumerology(birthdayStr) {
  if (!birthdayStr) return null;

  const dateStr = String(birthdayStr).replace(/[^0-9]/g, '');
  if (dateStr.length !== 8) return null;

  const year = parseInt(dateStr.substring(0, 4));
  const month = parseInt(dateStr.substring(4, 6));
  const day = parseInt(dateStr.substring(6, 8));

  if (month < 1 || month > 12 || day < 1 || day > 31) return null;

  // ========== 一、原始生日数字拆分 ==========
  const dayTens = Math.floor(day / 10);
  const dayOnes = day % 10;
  const monthTens = Math.floor(month / 10);
  const monthOnes = month % 10;
  const yearFirstTens = Math.floor(year / 1000);
  const yearFirstOnes = Math.floor((year % 1000) / 100);
  const yearLastTens = Math.floor((year % 100) / 10);
  const yearLastOnes = year % 10;

  // ========== 二、三角形内部7个核心数字（七魄） ==========
  // 第一层：底层4个数字（从左至右）
  const I = addDigits(dayTens + dayOnes);           // 日和位
  const J = addDigits(monthTens + monthOnes);       // 月和位
  const K = addDigits(yearFirstTens + yearFirstOnes); // 年前和位
  const L = addDigits(yearLastTens + yearLastOnes);   // 年后和位

  // 第二层：中层2个数字（从左至右）
  const M = addDigits(I + J);  // 左中位（父系位）
  const N = addDigits(K + L);  // 右中位（母系位）

  // 第三层：顶点1个数字
  const O = addDigits(M + N);  // 主性格位

  // ========== 三、三角形外部9个延伸数字 ==========
  // 1. 左外翼（事业/父亲线，从下到上）
  const S = addDigits(J + M);  // 左下外位 = 月和位 + 左中位
  const T = addDigits(I + M);  // 左上外位 = 日和位 + 左中位
  const U = addDigits(S + T);  // 左外顶端位 = 左下外位 + 左上外位

  // 2. 右外翼（家庭/母亲线，从下到上）
  const W = addDigits(L + N);  // 右下外位 = 年后和位 + 右中位
  const V = addDigits(K + N);  // 右上外位 = 年前和位 + 右中位
  const X = addDigits(V + W);  // 右外顶端位 = 右上外位 + 右下外位

  // 3. 上外翼（晚年/天纹线，三角形顶部，交叉对应）
  const leftTopOuter = addDigits(N + O);   // 左顶外位 = 右中位 + 主性格位
  const rightTopOuter = addDigits(M + O);  // 右顶外位 = 左中位 + 主性格位
  const topApex = addDigits(leftTopOuter + rightTopOuter); // 最顶端位

  // ========== 四、12组联合码 ==========
  const unionCodeGroups = [
    {
      label: '左外翼',
      codes: [
        `${I}${J}${M}`,   // 日和位、月和位、左中位
        `${I}${M}${T}`,   // 日和位、左中位、左上外位（I+M=T）
        `${J}${M}${S}`,   // 月和位、左中位、左下外位（J+M=S）
        `${T}${S}${U}`,   // 左上外位、左下外位、左外顶端位（T+S=U）
      ],
    },
    {
      label: '右外翼',
      codes: [
        `${K}${L}${N}`,   // 年前和位、年后和位、右中位
        `${K}${N}${V}`,   // 年前和位、右中位、右上外位
        `${L}${N}${W}`,   // 年后和位、右中位、右下外位
        `${V}${W}${X}`,   // 右上外位、右下外位、右外顶端位
      ],
    },
    {
      label: '上外翼',
      codes: [
        `${M}${N}${O}`,                         // 左中位、右中位、主性格位
        `${M}${O}${rightTopOuter}`,             // 左中位、主性格位、右顶外位
        `${N}${O}${leftTopOuter}`,              // 右中位、主性格位、左顶外位
        `${leftTopOuter}${rightTopOuter}${topApex}`, // 左顶外位、右顶外位、最顶端位
      ],
    },
  ];

  // ========== 公式 ==========
  const formulas = {
    left: `${U}=${S} ${T}`,           // 左外翼: 左外顶端位=左下外位 左上外位
    right: `${X}=${V} ${W}`,          // 右外翼: 右外顶端位=右上外位 右下外位
    top: `${topApex}=${leftTopOuter} ${rightTopOuter}`, // 上外翼: 最顶端位=左顶外位 右顶外位
  };

  // ========== 派生数字 ==========
  const innerCode = addDigits(M + N + O);
  const subconsciousCode = addDigits(I + L + O);
  const laterYearsCode = `${leftTopOuter}${rightTopOuter}${topApex}`;

  return {
    birthday: birthdayStr,
    rawDigits: {
      day: `${String(day).padStart(2, '0')}`,
      month: `${String(month).padStart(2, '0')}`,
      yearFirstHalf: `${String(Math.floor(year / 100))}`,
      yearSecondHalf: `${String(year % 100).padStart(2, '0')}`,
    },
    inner: { I, J, K, L, M, N, O },
    outer: {
      left: { bottom: S, top: T, apex: U },
      right: { top: V, bottom: W, apex: X },
      top: { left: leftTopOuter, right: rightTopOuter, apex: topApex },
    },
    formulas,
    mainCharacter: O,
    unionCodeGroups,
    unionCodes: unionCodeGroups.flatMap(g => g.codes),
    innerCode,
    subconsciousCode,
    laterYearsCode,
  };
}
