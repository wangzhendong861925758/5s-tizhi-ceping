// ============================================
// 生命数字（天赋数字）计算模块
// 基于阳历生日，计算三角形内外16个核心数字、12组联合密码、内心/潜意识/晚年码
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

function twoDigitSum(n) {
  const a = addDigits(n);
  const b = addDigits(Math.floor(n / 10) + (n % 10));
  return n >= 10 ? [Math.floor(n / 10), n % 10] : [0, n];
}

export function calculateNumerology(birthdayStr) {
  if (!birthdayStr) return null;

  const dateStr = String(birthdayStr).replace(/[^0-9]/g, '');
  if (dateStr.length !== 8) return null;

  const year = parseInt(dateStr.substring(0, 4));
  const month = parseInt(dateStr.substring(4, 6));
  const day = parseInt(dateStr.substring(6, 8));

  if (month < 1 || month > 12 || day < 1 || day > 31) return null;

  const dayTens = Math.floor(day / 10);
  const dayOnes = day % 10;
  const monthTens = Math.floor(month / 10);
  const monthOnes = month % 10;
  const yearThousands = Math.floor(year / 1000);
  const yearHundreds = Math.floor((year % 1000) / 100);
  const yearTens = Math.floor((year % 100) / 10);
  const yearOnes = year % 10;

  const I = addDigits(dayTens + dayOnes);
  const J = addDigits(monthTens + monthOnes);
  const K = addDigits(yearThousands + yearHundreds);
  const L = addDigits(yearTens + yearOnes);

  const M = addDigits(I + J);
  const N = addDigits(K + L);

  const O = addDigits(M + N);

  const T = addDigits(I + M);
  const S = addDigits(J + M);
  const U = addDigits(T + S);

  const V = addDigits(K + N);
  const W = addDigits(L + N);
  const X = addDigits(V + W);

  const topLeft = addDigits(I + M + T);
  const topRight = addDigits(K + N + V);
  const P = U;

  const innerCode = addDigits(M + N + O);
  const subconsciousCode = addDigits(I + L + O);
  const laterYearsCode = `${V}${W}${X}`;

  const unionCodes = [
    `${I}${J}${M}`,
    `${I}${M}${T}`,
    `${M}${O}${topRight}`,
    `${M}${N}${O}`,
    `${K}${L}${N}`,
    `${J}${M}${S}`,
    `${N}${O}${topLeft}`,
    `${L}${N}${W}`,
    `${K}${N}${V}`,
    `${T}${S}${U}`,
    [topLeft, P, topRight].sort().join(''),
    `${V}${W}${X}`,
  ];

  return {
    birthday: birthdayStr,
    triangle: {
      inner: { I, J, K, L, M, N, O },
      left: { T, S, U },
      top: { left: topLeft, P, right: topRight },
      right: { V, W, X },
    },
    mainCharacter: O,
    innerCode,
    subconsciousCode,
    laterYearsCode,
    fatherGene: `${I}${J}${M}`,
    motherGene: `${K}${L}${N}`,
    sittingCode: `${M}${N}${O}`,
    youthCode: `${T}${S}${U}`,
    middleCode: [topLeft, P, topRight].sort((a, b) => a - b).join(''),
    unionCodes,
    rawDigits: {
      day: `${String(day).padStart(2, '0')}`,
      month: `${String(month).padStart(2, '0')}`,
      yearFirstHalf: `${String(Math.floor(year / 100))}`,
      yearSecondHalf: `${String(year % 100).padStart(2, '0')}`,
    },
  };
}
