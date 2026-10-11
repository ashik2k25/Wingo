import { Timeframe, DrawResult, BallColor, BallSize, BacktestResult, Signal } from '../types';

export const TIMEFRAMES: Timeframe[] = ['30S', '1M', '3M', '5M'];

export const TIMEFRAME_LABELS: Record<Timeframe, string> = {
  '30S': '30 sec',
  '1M': '1 min',
  '3M': '3 min',
  '5M': '5 min',
};

export const TIMEFRAME_SECONDS: Record<Timeframe, number> = {
  '30S': 30,
  '1M': 60,
  '3M': 180,
  '5M': 300,
};

export const DEFAULT_ENDPOINTS: Record<Timeframe, string> = {
  '30S': 'https://draw.ar-lottery02.com/WinGo/WinGo_30S/GetHistoryIssuePage.json',
  '1M': 'https://draw.ar-lottery02.com/WinGo/WinGo_1M/GetHistoryIssuePage.json',
  '3M': 'https://draw.ar-lottery02.com/WinGo/WinGo_3M/GetHistoryIssuePage.json',
  '5M': 'https://draw.ar-lottery02.com/WinGo/WinGo_5M/GetHistoryIssuePage.json',
};

export function getColor(num: number): BallColor {
  if (num === 0) return 'RED_VIOLET';
  if (num === 5) return 'GREEN_VIOLET';
  if ([1, 3, 7, 9].includes(num)) return 'GREEN';
  return 'RED'; // 2, 4, 6, 8
}

export function getSize(num: number): BallSize {
  return num <= 4 ? 'SMALL' : 'BIG';
}

export function getDisplayColorName(color: BallColor): string {
  switch (color) {
    case 'RED_VIOLET':
      return 'RED / VIOLET';
    case 'GREEN_VIOLET':
      return 'GREEN / VIOLET';
    case 'GREEN':
      return 'GREEN';
    case 'RED':
      return 'RED';
    case 'VIOLET':
      return 'VIOLET';
  }
}

export function isColorMatch(pred: BallColor, actualNum: number): boolean {
  const actualColor = getColor(actualNum);
  if (pred === actualColor) return true;
  if (pred === 'GREEN') {
    return [1, 3, 5, 7, 9].includes(actualNum);
  }
  if (pred === 'RED') {
    return [0, 2, 4, 6, 8].includes(actualNum);
  }
  if (pred === 'VIOLET') {
    return actualNum === 0 || actualNum === 5;
  }
  if (pred === 'RED_VIOLET') {
    return actualNum === 0 || [2, 4, 6, 8].includes(actualNum);
  }
  if (pred === 'GREEN_VIOLET') {
    return actualNum === 5 || [1, 3, 7, 9].includes(actualNum);
  }
  return false;
}

export function sharePercent(n: number): string {
  return `${(100 * n).toFixed(1)}%`;
}

export function nextPeriod(history: DrawResult[]): string {
  const last = history[history.length - 1]?.period;
  if (!last) return 'NEXT ROUND';
  return last.replace(/(\d+)(?!.*\d)/, (matched) => {
    try {
      return (BigInt(matched) + 1n).toString().padStart(matched.length, '0');
    } catch {
      return matched;
    }
  });
}

function normalizeDistribution(arr: number[]): number[] {
  const sum = arr.reduce((acc, v) => acc + v, 0);
  if (sum <= 0) return arr.map(() => 1 / arr.length);
  return arr.map((v) => v / sum);
}

function calculateFrequencies(numbers: number[], smoothing: number): number[] {
  const counts = Array.from({ length: 10 }, () => 0);
  for (const n of numbers) {
    if (n >= 0 && n <= 9) counts[n] += 1;
  }
  return normalizeDistribution(counts.map((c) => c + smoothing / 10));
}

function calculateModelDistribution(history: DrawResult[]): number[] {
  // Evaluates the active 10 draws of the board (Oct 4, 1:14AM foundation)
  const activeHistory = history.slice(-10);
  const numbers = activeHistory.map((h) => h.number);
  if (numbers.length === 0) return Array.from({ length: 10 }, () => 0.1);

  // 1. Baseline Dirichlet frequencies across the active 10 draws & short-term 5-draw trend
  const baseline = calculateFrequencies(numbers, 2.0);
  const shortTerm = calculateFrequencies(numbers.slice(-5), 1.5);

  // 2. Exponential decay momentum across recent draws
  const momentum = Array.from({ length: 10 }, () => 0.1);
  numbers.forEach((n, idx) => {
    const age = numbers.length - idx - 1;
    const decay = Math.pow(0.962, age);
    if (n >= 0 && n <= 9) {
      momentum[n] += decay;
    }
  });
  const normMomentum = normalizeDistribution(momentum);

  // 3. First-order Markov chain transitions
  const lastNum = numbers[numbers.length - 1];
  const markov1 = Array.from({ length: 10 }, () => 0);
  let transCount1 = 0;
  for (let i = 0; i < numbers.length - 1; i++) {
    if (numbers[i] === lastNum) {
      const nextNum = numbers[i + 1];
      if (nextNum >= 0 && nextNum <= 9) {
        markov1[nextNum] += 1;
        transCount1 += 1;
      }
    }
  }

  // 4. Second-order Markov chain transitions
  const markov2 = Array.from({ length: 10 }, () => 0);
  let transCount2 = 0;
  if (numbers.length >= 3) {
    const prev2 = numbers[numbers.length - 2];
    for (let i = 0; i < numbers.length - 2; i++) {
      if (numbers[i] === prev2 && numbers[i + 1] === lastNum) {
        const nextNum = numbers[i + 2];
        if (nextNum >= 0 && nextNum <= 9) {
          markov2[nextNum] += 1;
          transCount2 += 1;
        }
      }
    }
  }

  // 5. ANTI-BLIND SATURATION FILTER (Solves the issue where 6-7 same size makes model blind)
  const bigCount = numbers.filter((n) => n >= 5).length;
  const smallCount = numbers.length - bigCount;
  const lastSize = getSize(lastNum);

  // Active unbroken streak length
  let streak = 0;
  for (let i = numbers.length - 1; i >= 0; i--) {
    if (getSize(numbers[i]) === lastSize) streak++;
    else break;
  }

  // Check 1-1 Ping-Pong Alternation
  const isChop =
    numbers.length >= 4 &&
    getSize(numbers[numbers.length - 1]) !== getSize(numbers[numbers.length - 2]) &&
    getSize(numbers[numbers.length - 2]) === getSize(numbers[numbers.length - 4]) &&
    getSize(numbers[numbers.length - 1]) === getSize(numbers[numbers.length - 3]);

  // Structural Pivot on 0 or 5
  const isViolet0 = lastNum === 0;
  const isViolet5 = lastNum === 5;

  // Calibrate per-digit multipliers
  const dynamicMultipliers = Array.from({ length: 10 }, (_, n) => {
    let mult = 1.0;
    const isBig = n >= 5;

    // A. Anti-Blind Equilibrium:
    // If one size dominates (>= 6 of 10 draws), dampen the saturated side
    // UNLESS there is a fresh active streak of 2-4 draws
    if (bigCount >= 6 && streak <= 1) {
      const damp = Math.min(0.35, (bigCount - 5) * 0.08);
      mult *= isBig ? 1.0 - damp : 1.0 + damp;
    } else if (smallCount >= 6 && streak <= 1) {
      const damp = Math.min(0.35, (smallCount - 5) * 0.08);
      mult *= !isBig ? 1.0 - damp : 1.0 + damp;
    }

    // B. Streak Dynamics:
    if (streak >= 2 && streak <= 4) {
      // Dragon trend active: support continuation
      const isStreakSize = (isBig && lastSize === 'BIG') || (!isBig && lastSize === 'SMALL');
      mult *= isStreakSize ? 1.15 : 0.88;
    } else if (streak >= 6) {
      // Overextended streak: mean-reversion pressure
      const isStreakSize = (isBig && lastSize === 'BIG') || (!isBig && lastSize === 'SMALL');
      mult *= isStreakSize ? 0.82 : 1.22;
    }

    // C. 1-1 Ping-Pong Alternation:
    if (isChop) {
      const isOpposite = (isBig && lastSize === 'SMALL') || (!isBig && lastSize === 'BIG');
      mult *= isOpposite ? 1.25 : 0.78;
    }

    // D. Violet 0/5 Pivots:
    if (isViolet0 && streak === 1) {
      // 0 drawn breaks Big into Small
      mult *= !isBig ? 1.18 : 0.85;
      if (n === 0 || [2, 4, 6, 8].includes(n)) mult *= 1.10; // Boost Red
    } else if (isViolet5 && streak === 1) {
      // 5 drawn breaks Small into Big
      mult *= isBig ? 1.18 : 0.85;
      if (n === 5 || [1, 3, 7, 9].includes(n)) mult *= 1.10; // Boost Green
    }

    return mult;
  });

  // Blend distributions with dynamic pattern multipliers
  const blended = baseline.map((b, i) => {
    let p = 0.35 * b + 0.35 * shortTerm[i] + 0.30 * normMomentum[i];
    if (transCount1 >= 1) {
      const m1Prob = markov1[i] / transCount1;
      p = p * 0.75 + m1Prob * 0.25;
    }
    if (transCount2 >= 1) {
      const m2Prob = markov2[i] / transCount2;
      p = p * 0.8 + m2Prob * 0.2;
    }
    p *= dynamicMultipliers[i];
    return p;
  });

  return normalizeDistribution(blended);
}

function calculateCategoryShare(dist: number[], category: BallSize | BallColor): number {
  return dist.reduce((acc, prob, num) => {
    if (category === 'SMALL') return acc + (num <= 4 ? prob : 0);
    if (category === 'BIG') return acc + (num >= 5 ? prob : 0);
    if (category === 'GREEN') {
      return acc + ([1, 3, 7, 9].includes(num) ? prob : num === 5 ? prob * 0.75 : 0);
    }
    if (category === 'RED') {
      return acc + ([2, 4, 6, 8].includes(num) ? prob : num === 0 ? prob * 0.75 : 0);
    }
    if (category === 'VIOLET') {
      return acc + (num === 0 || num === 5 ? prob : 0);
    }
    if (category === 'RED_VIOLET') {
      return acc + (num === 0 ? prob : [2, 4, 6, 8].includes(num) ? prob * 0.5 : 0);
    }
    if (category === 'GREEN_VIOLET') {
      return acc + (num === 5 ? prob : [1, 3, 7, 9].includes(num) ? prob * 0.5 : 0);
    }
    return acc;
  }, 0);
}

function selectMaxCategory<T extends string>(
  options: T[],
  evaluator: (opt: T) => number
): T {
  return options.reduce((best, curr) => (evaluator(curr) > evaluator(best) ? curr : best));
}

function runBacktest(history: DrawResult[]): BacktestResult | null {
  if (history.length < 15) return null;
  const start = Math.max(10, history.length - 30);
  let samples = 0;
  let numberHits = 0;
  let sizeHits = 0;
  let colorHits = 0;

  for (let i = start; i < history.length; i++) {
    const trainingSlice = history.slice(0, i);
    const dist = calculateModelDistribution(trainingSlice);
    const predNumber = dist.indexOf(Math.max(...dist));
    const predSize = selectMaxCategory<BallSize>(['SMALL', 'BIG'], (s) =>
      calculateCategoryShare(dist, s)
    );
    const predColor = getColor(predNumber);

    const actual = history[i].number;
    samples += 1;
    if (predNumber === actual) numberHits += 1;
    if (predSize === getSize(actual)) sizeHits += 1;
    if (isColorMatch(predColor, actual)) colorHits += 1;
  }

  return { samples, numberHits, sizeHits, colorHits };
}

export interface PatternAnalysis {
  recommendedSize: BallSize;
  sizeConfidence: number;
  sizeSafety: 'SAFE' | 'MEDIUM' | 'RISKY';
  patternType: 'STREAK' | 'CHOP' | 'DOUBLE' | 'NORMAL';
  primaryBet: 'SIZE' | 'COLOR' | 'NUMBER';
  colorSafety: 'SAFE' | 'MEDIUM';
  advisoryNote: string;
  hedgeTip: string;
  activeStreak: number;
  lossStreakPrevented?: boolean;
  consecutiveLosses?: number;
}

export function analyzeSizeAndPattern(history: DrawResult[]): PatternAnalysis {
  const activeHistory = history.slice(-10);
  const len = activeHistory.length;
  if (len === 0) {
    return {
      recommendedSize: 'BIG',
      sizeConfidence: 0.5,
      sizeSafety: 'SAFE',
      patternType: 'NORMAL',
      primaryBet: 'SIZE',
      colorSafety: 'SAFE',
      advisoryNote: 'Initial board state.',
      hedgeTip: 'Standard play.',
      activeStreak: 1,
    };
  }

  // 1. Unified statistical probability distribution
  const dist = calculateModelDistribution(activeHistory);
  const bigShare = calculateCategoryShare(dist, 'BIG');
  const smallShare = calculateCategoryShare(dist, 'SMALL');
  const recommendedSize: BallSize = bigShare >= smallShare ? 'BIG' : 'SMALL';
  const sizeConfidence = Math.max(bigShare, smallShare);

  const numbers = activeHistory.map((h) => h.number);
  const lastNum = numbers[len - 1];
  const lastSize = getSize(lastNum);

  // Active unbroken streak
  let activeStreak = 0;
  for (let i = len - 1; i >= 0; i--) {
    if (getSize(numbers[i]) === lastSize) activeStreak++;
    else break;
  }

  // 1-1 Ping-Pong Alternation
  const isChop =
    len >= 4 &&
    getSize(numbers[len - 1]) !== getSize(numbers[len - 2]) &&
    getSize(numbers[len - 2]) === getSize(numbers[len - 4]) &&
    getSize(numbers[len - 1]) === getSize(numbers[len - 3]);

  // Saturation check (6+ out of 10)
  const bigCount = numbers.filter((n) => n >= 5).length;
  const smallCount = len - bigCount;
  const isSaturated = bigCount >= 7 || smallCount >= 7;

  // Violet 0 or 5 Structural Pivot
  const isViolet0 = lastNum === 0;
  const isViolet5 = lastNum === 5;

  let patternType: 'STREAK' | 'CHOP' | 'DOUBLE' | 'NORMAL' = 'NORMAL';
  let sizeSafety: 'SAFE' | 'MEDIUM' | 'RISKY' = 'SAFE';
  let advisoryNote = '';
  let hedgeTip = '';

  if (isChop) {
    patternType = 'CHOP';
    sizeSafety = 'SAFE';
    advisoryNote = '1-1 Alternation (Ping-Pong) rhythm confirmed. Cadence followed.';
    hedgeTip = 'Follow alternating rhythm safely.';
  } else if (activeStreak >= 6) {
    patternType = 'STREAK';
    sizeSafety = 'RISKY';
    advisoryNote = `Mature ${activeStreak}x ${lastSize} dragon reached exhaustion ceiling.`;
    hedgeTip = 'Prioritize COLOR bet for bankroll protection.';
  } else if (activeStreak >= 2) {
    patternType = 'STREAK';
    sizeSafety = activeStreak >= 4 ? 'MEDIUM' : 'SAFE';
    advisoryNote = `Active ${activeStreak}x ${lastSize} momentum trend. Riding the wave safely.`;
    hedgeTip = activeStreak >= 4 ? 'Watch for Violet 0/5 pivot.' : 'Follow trend momentum.';
  } else if (isViolet0 && len >= 2 && getSize(numbers[len - 2]) === 'BIG') {
    patternType = 'CHOP';
    sizeSafety = 'SAFE';
    advisoryNote = 'Violet 0 structural pivot: Big trend broken, Small reset initiated.';
    hedgeTip = 'Color RED hedge supported.';
  } else if (isViolet5 && len >= 2 && getSize(numbers[len - 2]) === 'SMALL') {
    patternType = 'CHOP';
    sizeSafety = 'SAFE';
    advisoryNote = 'Violet 5 structural pivot: Small trend broken, Big reset initiated.';
    hedgeTip = 'Color GREEN hedge supported.';
  } else if (isSaturated) {
    patternType = 'NORMAL';
    sizeSafety = 'MEDIUM';
    advisoryNote = `Anti-Blind filter active: ${Math.max(bigCount, smallCount)} of 10 draws were ${bigCount >= smallCount ? 'BIG' : 'SMALL'}. Damping applied.`;
    hedgeTip = 'Balanced play with Color hedge.';
  } else {
    patternType = 'NORMAL';
    sizeSafety = sizeConfidence >= 0.58 ? 'SAFE' : 'MEDIUM';
    advisoryNote = 'Markov probability and frequency momentum aligned.';
    hedgeTip = 'Standard balanced play.';
  }

  // Safe primary bet recommendation:
  // If size is marked RISKY, direct user to safe COLOR bet!
  const primaryBet: 'SIZE' | 'COLOR' | 'NUMBER' = sizeSafety === 'RISKY' ? 'COLOR' : 'SIZE';
  const colorSafety: 'SAFE' | 'MEDIUM' = sizeSafety === 'RISKY' ? 'SAFE' : 'MEDIUM';

  return {
    recommendedSize,
    sizeConfidence,
    sizeSafety,
    patternType,
    primaryBet,
    colorSafety,
    advisoryNote,
    hedgeTip,
    activeStreak,
  };
}

export function buildSignal(history: DrawResult[]): Signal | null {
  if (!history || history.length < 5) return null;
  const activeHistory = history.slice(-10);

  // 1. Calculate distribution and smart pattern analysis
  const dist = calculateModelDistribution(activeHistory);
  const patternAnalysis = analyzeSizeAndPattern(activeHistory);
  const bestSize = patternAnalysis.recommendedSize;

  // 2. Harmonize number distribution with the recommended size
  const adjustedDist = dist.map((prob, num) => {
    const isMatchingSize = getSize(num) === bestSize;
    return isMatchingSize ? prob * 1.45 : prob * 0.55;
  });
  const normalizedDist = normalizeDistribution(adjustedDist);

  // 3. Best number & color
  const bestNumber = normalizedDist.indexOf(Math.max(...normalizedDist));
  const bestColor = getColor(bestNumber);

  return {
    number: bestNumber,
    size: bestSize,
    color: bestColor,
    numberShare: normalizedDist[bestNumber],
    sizeShare: patternAnalysis.sizeConfidence,
    colorShare: calculateCategoryShare(normalizedDist, bestColor),
    numberDistribution: normalizedDist,
    targetPeriod: nextPeriod(history),
    backtest: runBacktest(history),
    primaryBet: patternAnalysis.primaryBet,
    sizeSafety: patternAnalysis.sizeSafety,
    colorSafety: patternAnalysis.colorSafety,
    patternType: patternAnalysis.patternType,
    advisoryNote: patternAnalysis.advisoryNote,
    hedgeTip: patternAnalysis.hedgeTip,
  };
}

function safeString(v: unknown): string | null {
  if (typeof v === 'string' || typeof v === 'number') {
    const s = String(v).trim();
    return s.length > 0 ? s : null;
  }
  return null;
}

export function parseHistoryPayload(raw: any): DrawResult[] {
  const root = typeof raw === 'object' && raw !== null ? raw : null;
  const data = root && typeof root.data === 'object' ? root.data : null;

  const candidateLists = [
    data?.list,
    data?.records,
    root?.list,
    root?.records,
    Array.isArray(raw) ? raw : null,
  ];

  const list = candidateLists.find(Array.isArray);
  if (!Array.isArray(list)) {
    throw new Error('Feed response did not contain a draw history list.');
  }

  const map = new Map<string, DrawResult>();
  for (const item of list) {
    if (!item || typeof item !== 'object') continue;
    const rawNum = item.number ?? item.openNumber ?? item.result;
    const num = Number(rawNum);
    const period = safeString(item.issueNumber ?? item.period ?? item.issue ?? item.issueNo);

    if (period && Number.isInteger(num) && num >= 0 && num <= 9) {
      map.set(period, { period, number: num });
    }
  }

  const sorted = Array.from(map.values()).sort((a, b) =>
    a.period.localeCompare(b.period, undefined, { numeric: true })
  );

  if (sorted.length === 0) {
    throw new Error('Feed returned no valid draw numbers from 0 to 9.');
  }

  return sorted;
}

export function parseManualHistory(text: string): DrawResult[] {
  const trimmed = text.trim();
  if (!trimmed) {
    throw new Error('Paste a list of draw numbers first.');
  }

  if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
    try {
      const parsed = JSON.parse(trimmed);
      return parseHistoryPayload(parsed);
    } catch (err) {
      if (err instanceof Error) throw err;
      throw new Error('The pasted JSON could not be read.');
    }
  }

  const tokens = trimmed.split(/[\s,;|]+/).filter(Boolean);
  if (tokens.some((t) => !/^[0-9]$/.test(t))) {
    throw new Error('Use numbers 0–9 only, separated by spaces or commas, oldest result first.');
  }

  if (tokens.length < 5) {
    throw new Error('Add at least 5 results to generate an estimate.');
  }

  const now = new Date();
  const dateStr = now.toISOString().slice(0, 10).replace(/-/g, '');

  return tokens.map((token, idx) => ({
    period: `${dateStr}${String(idx + 1).padStart(5, '0')}`,
    number: Number(token),
  }));
}

export async function fetchHistory(url: string): Promise<DrawResult[]> {
  const cleanUrl = url.trim();
  if (!cleanUrl.startsWith('https://')) {
    throw new Error('History URL must start with https://');
  }

  // Generate candidate URLs (try proxy first, with mirror fallbacks)
  const candidateTargets = [cleanUrl];
  if (cleanUrl.includes('ar-lottery')) {
    candidateTargets.unshift(
      cleanUrl.replace(/draw\.ar-lottery\d*\.com/g, 'draw.ar-lottery02.com'),
      cleanUrl.replace(/draw\.ar-lottery\d*\.com/g, 'draw.ar-lottery03.com'),
      cleanUrl.replace(/draw\.ar-lottery\d*\.com/g, 'draw.ar-lottery04.com')
    );
  }

  // Remove duplicates
  const uniqueTargets = [...new Set(candidateTargets)];

  let lastError: Error | null = null;

  for (const target of uniqueTargets) {
    try {
      const u = new URL(target);
      u.searchParams.set('ts', String(Date.now()));
      const finalUrl = u.toString();

      // 1. Try server proxy route
      const proxyUrl = `/api/history?url=${encodeURIComponent(finalUrl)}`;
      let resp: Response;
      try {
        resp = await fetch(proxyUrl, {
          method: 'GET',
          headers: { Accept: 'application/json' },
        });
      } catch {
        // Fallback to direct client fetch if proxy unavailable
        resp = await fetch(finalUrl, {
          method: 'GET',
          headers: { Accept: 'application/json' },
        });
      }

      if (resp.ok) {
        const data = await resp.json();
        const results = parseHistoryPayload(data);
        if (results && results.length > 0) {
          return results;
        }
      }
    } catch (err: any) {
      lastError = err instanceof Error ? err : new Error(String(err));
    }
  }

  throw lastError || new Error('Could not reach history feed. All live mirrors failed to respond.');
}

/**
 * Generates a realistic seed history of consecutive WinGo draws
 * for instant testing, demonstration, and offline analysis.
 */
export function generateRealisticDataset(timeframe: Timeframe, count = 45): DrawResult[] {
  const now = new Date();
  const datePrefix = now.toISOString().slice(0, 10).replace(/-/g, '');
  const basePeriodNumber = 10000 + Math.floor(Math.random() * 2000);

  const results: DrawResult[] = [];
  let currentNum = Math.floor(Math.random() * 10);

  // Markov transition tendencies common in pseudo-random draws
  for (let i = 0; i < count; i++) {
    // 15% chance to repeat, 85% chance to jump
    if (Math.random() > 0.85) {
      // repeat currentNum
    } else {
      currentNum = Math.floor(Math.random() * 10);
    }
    const periodStr = `${datePrefix}${basePeriodNumber + i}`;
    results.push({
      period: periodStr,
      number: currentNum,
    });
  }

  return results;
}
