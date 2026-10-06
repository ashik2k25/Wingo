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
  // Restore exact Oct 4, 1:14AM prediction model:
  // Strictly evaluates the active 10 draws of the board as returned by the official lottery feed
  const activeHistory = history.slice(-10);
  const numbers = activeHistory.map((h) => h.number);
  if (numbers.length === 0) return Array.from({ length: 10 }, () => 0.1);

  // Baseline frequencies across the active board & immediate short-term trend
  const baseline = calculateFrequencies(numbers, 2);
  const shortTerm = calculateFrequencies(numbers.slice(-5), 1.5);

  // Exponential decay momentum across the recent draws
  const momentum = Array.from({ length: 10 }, () => 0.1);
  numbers.forEach((n, idx) => {
    const age = numbers.length - idx - 1;
    const decay = Math.pow(0.962, age);
    if (n >= 0 && n <= 9) {
      momentum[n] += decay;
    }
  });
  const normMomentum = normalizeDistribution(momentum);

  // First-order Markov chain: what follows the last drawn number in the active board
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

  // Second-order Markov chain: what follows [secondLastNum, lastNum]
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

  // Size trend & streak balance (mean-reversion after long streaks of BIG / SMALL)
  let consecutiveSameSize = 1;
  const lastSize = getSize(lastNum);
  for (let i = numbers.length - 2; i >= 0; i--) {
    if (getSize(numbers[i]) === lastSize) {
      consecutiveSameSize++;
    } else {
      break;
    }
  }

  // If streak >= 3, slightly adjust odds toward opposite size to account for reversion
  const sizeAdjustment = Array.from({ length: 10 }, (_, n) => {
    if (consecutiveSameSize >= 3) {
      const isOpposite = getSize(n) !== lastSize;
      return isOpposite ? 1 + Math.min(0.25, (consecutiveSameSize - 2) * 0.08) : 1;
    }
    return 1;
  });

  // Blend distributions
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
    p *= sizeAdjustment[i];
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

export function buildSignal(history: DrawResult[]): Signal | null {
  if (!history || history.length < 5) return null;
  const dist = calculateModelDistribution(history);
  const bestNumber = dist.indexOf(Math.max(...dist));
  const bestSize = selectMaxCategory<BallSize>(['SMALL', 'BIG'], (s) =>
    calculateCategoryShare(dist, s)
  );
  // Color strictly based on number per WinGo rules and screenshot:
  const bestColor = getColor(bestNumber);

  return {
    number: bestNumber,
    size: bestSize,
    color: bestColor,
    numberShare: dist[bestNumber],
    sizeShare: calculateCategoryShare(dist, bestSize),
    colorShare: calculateCategoryShare(dist, bestColor),
    numberDistribution: dist,
    targetPeriod: nextPeriod(history),
    backtest: runBacktest(history),
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
