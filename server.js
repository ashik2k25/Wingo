// server.ts
import express from "express";
import path2 from "path";
import fs2 from "fs";
import { fileURLToPath } from "url";

// src/utils/engine.ts
var TIMEFRAMES = ["30S", "1M", "3M", "5M"];
var TIMEFRAME_SECONDS = {
  "30S": 30,
  "1M": 60,
  "3M": 180,
  "5M": 300
};
var DEFAULT_ENDPOINTS = {
  "30S": "https://draw.ar-lottery02.com/WinGo/WinGo_30S/GetHistoryIssuePage.json",
  "1M": "https://draw.ar-lottery02.com/WinGo/WinGo_1M/GetHistoryIssuePage.json",
  "3M": "https://draw.ar-lottery02.com/WinGo/WinGo_3M/GetHistoryIssuePage.json",
  "5M": "https://draw.ar-lottery02.com/WinGo/WinGo_5M/GetHistoryIssuePage.json"
};
function getColor(num) {
  if (num === 0) return "RED_VIOLET";
  if (num === 5) return "GREEN_VIOLET";
  if ([1, 3, 7, 9].includes(num)) return "GREEN";
  return "RED";
}
function getSize(num) {
  return num <= 4 ? "SMALL" : "BIG";
}
function isColorMatch(pred, actualNum) {
  const actualColor = getColor(actualNum);
  if (pred === actualColor) return true;
  if (pred === "GREEN") {
    return [1, 3, 5, 7, 9].includes(actualNum);
  }
  if (pred === "RED") {
    return [0, 2, 4, 6, 8].includes(actualNum);
  }
  if (pred === "VIOLET") {
    return actualNum === 0 || actualNum === 5;
  }
  if (pred === "RED_VIOLET") {
    return actualNum === 0 || [2, 4, 6, 8].includes(actualNum);
  }
  if (pred === "GREEN_VIOLET") {
    return actualNum === 5 || [1, 3, 7, 9].includes(actualNum);
  }
  return false;
}
function nextPeriod(history) {
  const last = history[history.length - 1]?.period;
  if (!last) return "NEXT ROUND";
  return last.replace(/(\d+)(?!.*\d)/, (matched) => {
    try {
      return (BigInt(matched) + 1n).toString().padStart(matched.length, "0");
    } catch {
      return matched;
    }
  });
}
function normalizeDistribution(arr) {
  const sum = arr.reduce((acc, v) => acc + v, 0);
  if (sum <= 0) return arr.map(() => 1 / arr.length);
  return arr.map((v) => v / sum);
}
function calculateFrequencies(numbers, smoothing) {
  const counts = Array.from({ length: 10 }, () => 0);
  for (const n of numbers) {
    if (n >= 0 && n <= 9) counts[n] += 1;
  }
  return normalizeDistribution(counts.map((c) => c + smoothing / 10));
}
function calculateModelDistribution(history) {
  const activeHistory = history.slice(-10);
  const numbers = activeHistory.map((h) => h.number);
  if (numbers.length === 0) return Array.from({ length: 10 }, () => 0.1);
  const baseline = calculateFrequencies(numbers, 2);
  const shortTerm = calculateFrequencies(numbers.slice(-5), 1.5);
  const momentum = Array.from({ length: 10 }, () => 0.1);
  numbers.forEach((n, idx) => {
    const age = numbers.length - idx - 1;
    const decay = Math.pow(0.962, age);
    if (n >= 0 && n <= 9) {
      momentum[n] += decay;
    }
  });
  const normMomentum = normalizeDistribution(momentum);
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
  const bigCount = numbers.filter((n) => n >= 5).length;
  const smallCount = numbers.length - bigCount;
  const lastSize = getSize(lastNum);
  let streak = 0;
  for (let i = numbers.length - 1; i >= 0; i--) {
    if (getSize(numbers[i]) === lastSize) streak++;
    else break;
  }
  const isChop = numbers.length >= 4 && getSize(numbers[numbers.length - 1]) !== getSize(numbers[numbers.length - 2]) && getSize(numbers[numbers.length - 2]) === getSize(numbers[numbers.length - 4]) && getSize(numbers[numbers.length - 1]) === getSize(numbers[numbers.length - 3]);
  const isViolet0 = lastNum === 0;
  const isViolet5 = lastNum === 5;
  const dynamicMultipliers = Array.from({ length: 10 }, (_, n) => {
    let mult = 1;
    const isBig = n >= 5;
    if (bigCount >= 6 && streak <= 1) {
      const damp = Math.min(0.35, (bigCount - 5) * 0.08);
      mult *= isBig ? 1 - damp : 1 + damp;
    } else if (smallCount >= 6 && streak <= 1) {
      const damp = Math.min(0.35, (smallCount - 5) * 0.08);
      mult *= !isBig ? 1 - damp : 1 + damp;
    }
    if (streak >= 2 && streak <= 4) {
      const isStreakSize = isBig && lastSize === "BIG" || !isBig && lastSize === "SMALL";
      mult *= isStreakSize ? 1.15 : 0.88;
    } else if (streak >= 6) {
      const isStreakSize = isBig && lastSize === "BIG" || !isBig && lastSize === "SMALL";
      mult *= isStreakSize ? 0.82 : 1.22;
    }
    if (isChop) {
      const isOpposite = isBig && lastSize === "SMALL" || !isBig && lastSize === "BIG";
      mult *= isOpposite ? 1.25 : 0.78;
    }
    if (isViolet0 && streak === 1) {
      mult *= !isBig ? 1.18 : 0.85;
      if (n === 0 || [2, 4, 6, 8].includes(n)) mult *= 1.1;
    } else if (isViolet5 && streak === 1) {
      mult *= isBig ? 1.18 : 0.85;
      if (n === 5 || [1, 3, 7, 9].includes(n)) mult *= 1.1;
    }
    return mult;
  });
  const blended = baseline.map((b, i) => {
    let p = 0.35 * b + 0.35 * shortTerm[i] + 0.3 * normMomentum[i];
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
function calculateCategoryShare(dist, category) {
  return dist.reduce((acc, prob, num) => {
    if (category === "SMALL") return acc + (num <= 4 ? prob : 0);
    if (category === "BIG") return acc + (num >= 5 ? prob : 0);
    if (category === "GREEN") {
      return acc + ([1, 3, 7, 9].includes(num) ? prob : num === 5 ? prob * 0.75 : 0);
    }
    if (category === "RED") {
      return acc + ([2, 4, 6, 8].includes(num) ? prob : num === 0 ? prob * 0.75 : 0);
    }
    if (category === "VIOLET") {
      return acc + (num === 0 || num === 5 ? prob : 0);
    }
    if (category === "RED_VIOLET") {
      return acc + (num === 0 ? prob : [2, 4, 6, 8].includes(num) ? prob * 0.5 : 0);
    }
    if (category === "GREEN_VIOLET") {
      return acc + (num === 5 ? prob : [1, 3, 7, 9].includes(num) ? prob * 0.5 : 0);
    }
    return acc;
  }, 0);
}
function runBacktest(history) {
  if (history.length < 15) return null;
  const start = Math.max(10, history.length - 30);
  let samples = 0;
  let numberHits = 0;
  let sizeHits = 0;
  let colorHits = 0;
  for (let i = start; i < history.length; i++) {
    const trainingSlice = history.slice(0, i);
    const analysis = analyzeSizeAndPattern(trainingSlice);
    const dist = calculateModelDistribution(trainingSlice);
    const predSize = analysis.recommendedSize;
    const predNumber = dist.indexOf(Math.max(...dist));
    const predColor = getColor(predNumber);
    const actual = history[i].number;
    samples += 1;
    if (predNumber === actual) numberHits += 1;
    if (predSize === getSize(actual)) sizeHits += 1;
    if (isColorMatch(predColor, actual)) colorHits += 1;
  }
  return { samples, numberHits, sizeHits, colorHits };
}
function detectHumanBrainPattern(sizes, history) {
  const n = sizes.length;
  if (n < 2) return null;
  if (history && history.length >= 2) {
    const lastNum = history[history.length - 1].number;
    const prevNum = history[history.length - 2].number;
    if (lastNum === prevNum && lastNum >= 0 && lastNum <= 9) {
      const reboundSize = lastNum <= 4 ? "BIG" : "SMALL";
      return {
        predictedSize: reboundSize,
        confidence: 0.97,
        patternType: "NUMBER_REBOUND",
        patternName: `Twin ${lastNum} Mean-Reversion (${lastNum}->${lastNum} -> ${reboundSize})`,
        advisoryNote: `\u{1F9E0} HUMAN BRAIN: Twin ${lastNum} repeat detected! Rebound to ${reboundSize} locked (User Golden Rule).`,
        hedgeTip: `Bet ${reboundSize} strictly on twin ${lastNum} rebound.`
      };
    }
  }
  if (history && history.length >= 4) {
    const recent = history.slice(-6);
    const lastDraw = recent[recent.length - 1];
    const prevDraw = recent[recent.length - 2];
    const lastColor = getColor(lastDraw.number);
    const prevColor = getColor(prevDraw.number);
    if (lastColor !== prevColor && lastColor !== "RED_VIOLET" && lastColor !== "GREEN_VIOLET") {
      let streakBefore = 0;
      for (let i = recent.length - 2; i >= 0; i--) {
        if (getColor(recent[i].number) === prevColor) streakBefore++;
        else break;
      }
      if (streakBefore >= 3) {
        const carrySize = getSize(lastDraw.number);
        return {
          predictedSize: carrySize,
          confidence: 0.95,
          patternType: "COLOR_INERTIA",
          patternName: `Color-Cut Size Inertia (${prevColor} streak cut -> Size ${carrySize})`,
          advisoryNote: `\u{1F9E0} HUMAN BRAIN: ${prevColor} color streak cut. Size inertia to ${carrySize} locked (User Color Rule).`,
          hedgeTip: `Follow ${carrySize} continuation after color cut.`
        };
      }
    }
    let activeColorCount = 0;
    const currCol = getColor(lastDraw.number);
    if (currCol === "RED" || currCol === "GREEN") {
      for (let i = recent.length - 1; i >= 0; i--) {
        if (getColor(recent[i].number) === currCol) activeColorCount++;
        else break;
      }
      if (activeColorCount >= 4) {
        const colorBias = currCol === "GREEN" ? "BIG" : "SMALL";
        return {
          predictedSize: colorBias,
          confidence: 0.93,
          patternType: "COLOR_INERTIA",
          patternName: `Color Dragon Momentum (${activeColorCount}x ${currCol} -> ${colorBias})`,
          advisoryNote: `\u{1F9E0} HUMAN BRAIN: Strong ${activeColorCount}x ${currCol} color dragon active. ${colorBias} mathematically favored.`,
          hedgeTip: `Ride ${currCol} dragon bias with ${colorBias}.`
        };
      }
    }
  }
  if (n < 4) return null;
  const lastSize = sizes[n - 1];
  let activeStreak = 0;
  for (let i = n - 1; i >= 0; i--) {
    if (sizes[i] === lastSize) activeStreak++;
    else break;
  }
  if (activeStreak >= 3) {
    const isExhausted = activeStreak >= 7;
    const targetSize = isExhausted ? lastSize === "BIG" ? "SMALL" : "BIG" : lastSize;
    return {
      predictedSize: targetSize,
      confidence: isExhausted ? 0.78 : Math.min(0.96, 0.84 + activeStreak * 0.02),
      patternType: "STREAK",
      patternName: `${activeStreak}x ${lastSize} Dragon`,
      advisoryNote: isExhausted ? `\u{1F6A8} Mature ${activeStreak}x ${lastSize} dragon reached ceiling. Anti-drag pivot alert to ${targetSize}.` : `\u{1F9E0} HUMAN BRAIN: Active ${activeStreak}x ${lastSize} dragon momentum. Riding trend securely.`,
      hedgeTip: isExhausted ? "Color hedge strongly recommended." : "Ride active dragon trend."
    };
  }
  const sampleSlice = sizes.slice(-Math.min(n, 24));
  const runs = [];
  let currRun = 1;
  for (let i = 1; i < sampleSlice.length; i++) {
    if (sampleSlice[i] === sampleSlice[i - 1]) {
      currRun++;
    } else {
      runs.push({ size: sampleSlice[i - 1], len: currRun });
      currRun = 1;
    }
  }
  runs.push({ size: sampleSlice[sampleSlice.length - 1], len: currRun });
  if (runs.length >= 4) {
    const closedRuns = runs.slice(0, -1);
    const maxClosedRun = Math.max(...closedRuns.map((r) => r.len));
    const currentRunLen = runs[runs.length - 1].len;
    if (maxClosedRun <= 2 && currentRunLen === 2) {
      const opposite = lastSize === "BIG" ? "SMALL" : "BIG";
      return {
        predictedSize: opposite,
        confidence: 0.93,
        patternType: "CUT_AT_2",
        patternName: "Double-Cut Table (Max Streak 2)",
        advisoryNote: `\u{1F9E0} HUMAN BRAIN: Double-Cut Table (No streak > 2) verified across board. 2x ${lastSize} reached ceiling -> Cut to ${opposite} locked.`,
        hedgeTip: `Cut to ${opposite} on 2-streak limit.`
      };
    }
    if (maxClosedRun <= 3 && currentRunLen === 3) {
      const opposite = lastSize === "BIG" ? "SMALL" : "BIG";
      return {
        predictedSize: opposite,
        confidence: 0.92,
        patternType: "CUT_AT_3",
        patternName: "Triple-Cut Table (Max Streak 3)",
        advisoryNote: `\u{1F9E0} HUMAN BRAIN: Triple-Cut Table (No streak > 3) verified. 3x ${lastSize} reached ceiling -> Cut to ${opposite} locked.`,
        hedgeTip: `Cut to ${opposite} on 3-streak limit.`
      };
    }
  }
  for (const lag of [3, 2, 4, 6, 5]) {
    if (n < lag * 2) continue;
    const testCount = Math.min(n - lag, 18);
    let matchCount = 0;
    for (let j = 0; j < testCount; j++) {
      if (sizes[n - 1 - j] === sizes[n - 1 - j - lag]) {
        matchCount++;
      }
    }
    const matchRate = matchCount / testCount;
    const isMatch = lag === 3 && (testCount >= 3 && matchRate === 1 || testCount >= 4 && matchRate >= 0.7) || lag === 2 && (testCount >= 2 && matchRate === 1 || testCount >= 4 && matchRate >= 0.75) || lag === 4 && (testCount >= 3 && matchRate >= 0.85 || testCount >= 4 && matchRate >= 0.75) || lag === 6 && testCount >= 4 && matchRate >= 0.75 || lag === 5 && testCount >= 5 && matchRate >= 0.75;
    if (isMatch) {
      const projected = sizes[n - lag];
      let patternType = "PERIODIC";
      let patternName = `Harmonic Cadence (Period ${lag})`;
      if (lag === 3) {
        const last3 = sizes.slice(-3);
        const bigCount3 = last3.filter((s) => s === "BIG").length;
        if (bigCount3 === 2) {
          patternType = "CYCLE_2_1";
          patternName = "2-1 Pattern (Big-Big-Small)";
        } else if (bigCount3 === 1) {
          patternType = "CYCLE_1_2";
          patternName = "1-2 Pattern (Small-Small-Big)";
        } else {
          patternType = "CYCLE_2_1";
          patternName = "3-Step Cycle";
        }
      } else if (lag === 2) {
        patternType = "CHOP";
        patternName = "1-1 Ping-Pong Alternation";
      } else if (lag === 4) {
        patternType = "DOUBLE";
        patternName = "2-2 Double Pair Rhythm";
      } else if (lag === 6) {
        patternType = "PERIODIC";
        patternName = "3-3 Triple Rhythm Cadence";
      }
      const matchPct = Math.round(matchRate * 100);
      return {
        predictedSize: projected,
        confidence: Math.min(0.96, 0.78 + matchRate * 0.18),
        patternType,
        patternName,
        advisoryNote: `\u{1F9E0} HUMAN BRAIN: ${patternName} locked (${matchPct}% cycle stability). Next projected: ${projected}.`,
        hedgeTip: `Follow ${patternName} cadence strictly.`
      };
    }
  }
  if (n >= 4) {
    const s1 = sizes[n - 1];
    const s2 = sizes[n - 2];
    const s3 = sizes[n - 3];
    const s4 = n >= 5 ? sizes[n - 4] : null;
    if (s1 === s2 && s1 !== s3 && (!s4 || s4 !== s3)) {
      const archSize = s3;
      return {
        predictedSize: archSize,
        confidence: 0.89,
        patternType: "BRIDGE_MIRROR",
        patternName: `1-2-1 Arch Symmetry [${s3}-${s2}-${s1}] -> ${archSize}`,
        advisoryNote: `\u{1F9E0} HUMAN BRAIN: 1-2-1 Bridge arch symmetry detected. Closing arch with ${archSize}.`,
        hedgeTip: `Lock ${archSize} for bridge symmetry completion.`
      };
    }
    if (s4 && s1 === s2 && s2 === s3 && s1 !== s4) {
      const pyramidSize = s4;
      return {
        predictedSize: pyramidSize,
        confidence: 0.9,
        patternType: "BRIDGE_MIRROR",
        patternName: `1-3-1 Pyramid Symmetry -> ${pyramidSize}`,
        advisoryNote: `\u{1F9E0} HUMAN BRAIN: 1-3-1 Pyramid arch symmetry detected. Closing arch with ${pyramidSize}.`,
        hedgeTip: `Lock ${pyramidSize} for pyramid symmetry completion.`
      };
    }
  }
  for (const k of [4, 3, 2]) {
    if (n <= k + 2) continue;
    const suffix = sizes.slice(n - k);
    let bigWeight = 0;
    let smallWeight = 0;
    let occurrences = 0;
    for (let i = 0; i <= n - 1 - k; i++) {
      let match = true;
      for (let m = 0; m < k; m++) {
        if (sizes[i + m] !== suffix[m]) {
          match = false;
          break;
        }
      }
      if (match) {
        const nextDraw = sizes[i + k];
        const recencyWeight = 1 + i / n * 1.5;
        if (nextDraw === "BIG") bigWeight += recencyWeight;
        else if (nextDraw === "SMALL") smallWeight += recencyWeight;
        occurrences++;
      }
    }
    if (occurrences >= 2) {
      const totalWeight = bigWeight + smallWeight;
      const bigShare = bigWeight / totalWeight;
      const smallShare = smallWeight / totalWeight;
      if (bigShare >= 0.65 || smallShare >= 0.65) {
        const bestSize = bigShare > smallShare ? "BIG" : "SMALL";
        const bestShare = Math.max(bigShare, smallShare);
        const motif = suffix.map((s) => s === "BIG" ? "B" : "S").join("-");
        const patternType = k === 2 && suffix[0] !== suffix[1] ? "CHOP" : "DOUBLE";
        return {
          predictedSize: bestSize,
          confidence: Math.min(0.94, 0.74 + bestShare * 0.2),
          patternType,
          patternName: `Sequence Motif [${motif}] -> ${bestSize}`,
          advisoryNote: `\u{1F9E0} HUMAN BRAIN: [${motif}] motif repetition detected (${occurrences} matches, ${(bestShare * 100).toFixed(0)}% follow-through).`,
          hedgeTip: `Ride [${motif}] -> ${bestSize} continuation.`
        };
      }
    }
  }
  return null;
}
function computeRecentLossStreak(history) {
  if (history.length < 5) return 0;
  const startIdx = Math.max(0, history.length - 12);
  let streak = 0;
  for (let i = startIdx; i < history.length; i++) {
    const past = history.slice(0, i);
    if (past.length < 5) continue;
    const analysis = analyzeSizeAndPattern(past, streak);
    const simPred = analysis.recommendedSize;
    const actual = getSize(history[i].number);
    if (simPred === actual) {
      streak = 0;
    } else {
      streak++;
    }
  }
  return streak;
}
function analyzeSizeAndPattern(history, knownLossStreak) {
  const activeHistory = history.slice(-10);
  const len = activeHistory.length;
  if (len === 0) {
    return {
      recommendedSize: "BIG",
      sizeConfidence: 0.5,
      sizeSafety: "SAFE",
      patternType: "NORMAL",
      primaryBet: "SIZE",
      colorSafety: "SAFE",
      advisoryNote: "Initial board state.",
      hedgeTip: "Standard play.",
      activeStreak: 1,
      stakingLevel: "LEVEL 1 (1X)",
      suggestedMultiplier: 1,
      consecutiveLosses: 0,
      lossStreakPrevented: false
    };
  }
  const allSizes = history.map((h) => getSize(h.number));
  const numbers = activeHistory.map((h) => h.number);
  const lastNum = numbers[len - 1];
  const lastSize = getSize(lastNum);
  let activeStreak = 0;
  for (let i = len - 1; i >= 0; i--) {
    if (getSize(numbers[i]) === lastSize) activeStreak++;
    else break;
  }
  const humanPattern = detectHumanBrainPattern(allSizes, history);
  const dist = calculateModelDistribution(activeHistory);
  const bigShare = calculateCategoryShare(dist, "BIG");
  const smallShare = calculateCategoryShare(dist, "SMALL");
  const statRecommendedSize = bigShare >= smallShare ? "BIG" : "SMALL";
  const statConfidence = Math.max(bigShare, smallShare);
  let recommendedSize = statRecommendedSize;
  let sizeConfidence = statConfidence;
  let patternType = "NORMAL";
  let sizeSafety = "SAFE";
  let advisoryNote = "";
  let hedgeTip = "";
  if (humanPattern) {
    recommendedSize = humanPattern.predictedSize;
    sizeConfidence = humanPattern.confidence;
    patternType = humanPattern.patternType;
    sizeSafety = activeStreak >= 7 ? "RISKY" : "SAFE";
    advisoryNote = humanPattern.advisoryNote;
    hedgeTip = humanPattern.hedgeTip;
  } else {
    recommendedSize = statRecommendedSize;
    sizeConfidence = statConfidence;
    patternType = "NORMAL";
    sizeSafety = activeStreak >= 7 ? "RISKY" : sizeConfidence >= 0.58 ? "SAFE" : "MEDIUM";
    advisoryNote = "Markov probability and frequency momentum aligned.";
    hedgeTip = "Standard balanced play.";
  }
  const consecutiveLosses = knownLossStreak !== void 0 ? knownLossStreak : computeRecentLossStreak(history);
  let lossStreakPrevented = false;
  let stakingLevel = "LEVEL 1 (1X BASE)";
  let suggestedMultiplier = 1;
  if (consecutiveLosses >= 2) {
    lossStreakPrevented = true;
    const last1 = getSize(numbers[len - 1]);
    const last2 = len >= 2 ? getSize(numbers[len - 2]) : last1;
    const last3 = len >= 3 ? getSize(numbers[len - 3]) : last2;
    if (humanPattern && humanPattern.patternType === "NUMBER_REBOUND") {
      recommendedSize = humanPattern.predictedSize;
      patternType = "NUMBER_REBOUND";
      sizeConfidence = 0.98;
      advisoryNote = `\u{1F6A8} VIP RECOVERY LOCK: ${humanPattern.advisoryNote}`;
      hedgeTip = "Twin Number Rebound recovery stake.";
    } else if (consecutiveLosses >= 3) {
      if (last1 === last2) {
        recommendedSize = last1;
        advisoryNote = `\u{1F6A8} EMERGENCY CIRCUIT BREAKER LEVEL 4: Momentum trend on ${last1} locked to terminate streak.`;
      } else {
        recommendedSize = last1 === "BIG" ? "SMALL" : "BIG";
        advisoryNote = `\u{1F6A8} EMERGENCY CIRCUIT BREAKER LEVEL 4: Alternation locked on ${recommendedSize} to terminate streak.`;
      }
      patternType = "EMERGENCY_LOCK";
      sizeConfidence = 0.99;
      hedgeTip = "Level 4 Max Stake - Streak Termination Guarantee.";
    } else {
      if (last1 === last2) {
        recommendedSize = last1;
        patternType = "STREAK";
        advisoryNote = `\u{1F6A8} VIP CIRCUIT BREAKER LEVEL 3: Micro-trend on ${last1} locked to secure rebound.`;
      } else if (last1 !== last2 && last2 !== last3) {
        recommendedSize = last1 === "BIG" ? "SMALL" : "BIG";
        patternType = "CHOP";
        advisoryNote = `\u{1F6A8} VIP CIRCUIT BREAKER LEVEL 3: Alternation locked on ${recommendedSize} to secure rebound.`;
      } else if (humanPattern && humanPattern.predictedSize === last1) {
        recommendedSize = humanPattern.predictedSize;
        patternType = humanPattern.patternType;
        advisoryNote = `\u{1F6A8} VIP CIRCUIT BREAKER LEVEL 3: ${humanPattern.advisoryNote}`;
      } else {
        recommendedSize = statRecommendedSize === "BIG" ? "SMALL" : "BIG";
        patternType = "ANTI_PHASE_INVERSION";
        advisoryNote = `\u{1F6A8} VIP CIRCUIT BREAKER LEVEL 3: Anti-phase market detected. Inverting prediction to ${recommendedSize}.`;
      }
      sizeConfidence = 0.95;
      hedgeTip = "Level 3 Stake (5X Rebound).";
    }
    if (consecutiveLosses >= 4) {
      stakingLevel = `LEVEL 5 (15X MAX DEFENSE)`;
      suggestedMultiplier = 15;
    } else if (consecutiveLosses === 3) {
      stakingLevel = `LEVEL 4 (8X REBOUND)`;
      suggestedMultiplier = 8;
    } else {
      stakingLevel = `LEVEL 3 (5X REBOUND)`;
      suggestedMultiplier = 5;
    }
  } else if (consecutiveLosses === 1) {
    stakingLevel = "LEVEL 2 (2X RECOVERY)";
    suggestedMultiplier = 2;
    if (humanPattern && humanPattern.patternType === "NUMBER_REBOUND") {
      recommendedSize = humanPattern.predictedSize;
      patternType = "NUMBER_REBOUND";
      sizeConfidence = 0.96;
      advisoryNote = `\u{1F6E1}\uFE0F LEVEL 2 DEFENSE: ${humanPattern.advisoryNote}`;
      hedgeTip = `Level 2 Stake on Twin Number Rebound.`;
    } else if (humanPattern) {
      recommendedSize = humanPattern.predictedSize;
      sizeConfidence = Math.max(0.88, humanPattern.confidence);
      advisoryNote = `\u{1F6E1}\uFE0F LEVEL 2 DEFENSE: ${humanPattern.advisoryNote}`;
      hedgeTip = `Level 2 Stake (2X Recovery).`;
    } else {
      const last1 = getSize(numbers[len - 1]);
      const last2 = len >= 2 ? getSize(numbers[len - 2]) : last1;
      if (last1 === last2) {
        recommendedSize = last1;
        advisoryNote = `\u{1F6E1}\uFE0F LEVEL 2 DEFENSE: Aligning with active ${last1} pair.`;
      } else {
        advisoryNote = advisoryNote || "Level 2 Play: Micro-trend rhythm aligned.";
      }
      hedgeTip = "Level 2 Stake (2X Recovery).";
    }
  } else {
    stakingLevel = "LEVEL 1 (1X BASE)";
    suggestedMultiplier = 1;
  }
  const primaryBet = sizeSafety === "RISKY" ? "COLOR" : "SIZE";
  const colorSafety = sizeSafety === "RISKY" ? "SAFE" : "MEDIUM";
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
    lossStreakPrevented,
    consecutiveLosses,
    stakingLevel,
    suggestedMultiplier
  };
}
function buildSignal(history, knownLossStreak) {
  if (!history || history.length < 5) return null;
  const activeHistory = history.slice(-10);
  const dist = calculateModelDistribution(activeHistory);
  const patternAnalysis = analyzeSizeAndPattern(history, knownLossStreak);
  const bestSize = patternAnalysis.recommendedSize;
  const adjustedDist = dist.map((prob, num) => {
    const isMatchingSize = getSize(num) === bestSize;
    return isMatchingSize ? prob * 1.45 : prob * 0.55;
  });
  const normalizedDist = normalizeDistribution(adjustedDist);
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
    lossStreakPrevented: patternAnalysis.lossStreakPrevented,
    consecutiveLosses: patternAnalysis.consecutiveLosses,
    stakingLevel: patternAnalysis.stakingLevel,
    suggestedMultiplier: patternAnalysis.suggestedMultiplier
  };
}
function safeString(v) {
  if (typeof v === "string" || typeof v === "number") {
    const s = String(v).trim();
    return s.length > 0 ? s : null;
  }
  return null;
}
function parseHistoryPayload(raw) {
  const root = typeof raw === "object" && raw !== null ? raw : null;
  const data = root && typeof root.data === "object" ? root.data : null;
  const candidateLists = [
    data?.list,
    data?.records,
    root?.list,
    root?.records,
    Array.isArray(raw) ? raw : null
  ];
  const list = candidateLists.find(Array.isArray);
  if (!Array.isArray(list)) {
    throw new Error("Feed response did not contain a draw history list.");
  }
  const map = /* @__PURE__ */ new Map();
  for (const item of list) {
    if (!item || typeof item !== "object") continue;
    const rawNum = item.number ?? item.openNumber ?? item.result;
    const num = Number(rawNum);
    const period = safeString(item.issueNumber ?? item.period ?? item.issue ?? item.issueNo);
    if (period && Number.isInteger(num) && num >= 0 && num <= 9) {
      map.set(period, { period, number: num });
    }
  }
  const sorted = Array.from(map.values()).sort(
    (a, b) => a.period.localeCompare(b.period, void 0, { numeric: true })
  );
  if (sorted.length === 0) {
    throw new Error("Feed returned no valid draw numbers from 0 to 9.");
  }
  return sorted;
}

// src/utils/telegram.ts
import fs from "fs";
import path from "path";
var SUBSCRIBERS_FILE = path.resolve(process.cwd(), "telegram_subscribers.json");
var ALT_SUBSCRIBERS_FILE = "/app/applet/telegram_subscribers.json";
var DEFAULT_BOT_TOKEN = "8388862676:AAEZM47QrR7OZ1PIZCOdavXe5bP8uh3JX7o";
var subscribersMap = /* @__PURE__ */ new Map();
function loadSubscribersFromDisk() {
  let savedPrimaryChatId = "";
  const pathsToTry = [SUBSCRIBERS_FILE, ALT_SUBSCRIBERS_FILE];
  for (const p of pathsToTry) {
    try {
      if (fs.existsSync(p)) {
        const raw = fs.readFileSync(p, "utf-8");
        const data = JSON.parse(raw);
        if (typeof data.primaryChatId === "string" && data.primaryChatId.trim()) {
          savedPrimaryChatId = data.primaryChatId.trim();
        }
        if (Array.isArray(data.subscribers)) {
          for (const sub of data.subscribers) {
            if (sub && sub.chatId) {
              subscribersMap.set(String(sub.chatId), sub);
            }
          }
        }
        if (subscribersMap.size > 0 || savedPrimaryChatId) {
          console.log(`[Telegram] Loaded ${subscribersMap.size} persistent subscribers from disk (${p}). Primary: ${savedPrimaryChatId || "none"}`);
          break;
        }
      }
    } catch (err) {
      console.error(`[Telegram] Failed to load subscribers from ${p}:`, err?.message);
    }
  }
  return savedPrimaryChatId;
}
var initialSavedChatId = loadSubscribersFromDisk();
function saveSubscribersToDisk() {
  try {
    const currentChatId = typeof telegramConfig !== "undefined" ? telegramConfig.chatId : initialSavedChatId;
    const subscribers = Array.from(subscribersMap.values());
    const payload = JSON.stringify(
      {
        primaryChatId: currentChatId || initialSavedChatId,
        subscribers,
        updatedAt: Date.now()
      },
      null,
      2
    );
    const pathsToSave = [SUBSCRIBERS_FILE, ALT_SUBSCRIBERS_FILE];
    for (const p of pathsToSave) {
      try {
        fs.writeFileSync(p, payload, "utf-8");
      } catch {
      }
    }
  } catch (err) {
    console.error("[Telegram] Failed to save subscribers to disk:", err?.message);
  }
}
var telegramConfig = {
  botToken: process.env.TELEGRAM_BOT_TOKEN || DEFAULT_BOT_TOKEN,
  chatId: process.env.TELEGRAM_CHAT_ID || initialSavedChatId || "",
  enabled: true,
  timeframes: {
    "30S": true,
    "1M": true,
    "3M": true,
    "5M": true
  },
  autoDetectChatId: true,
  lastSentPeriod: {
    "30S": null,
    "1M": null,
    "3M": null,
    "5M": null
  },
  lastSentTime: 0,
  lastError: null,
  botInfo: {
    username: "johnwickvip_bot",
    firstName: "John Wick VIP"
  },
  subscriberCount: subscribersMap.size
};
var lastUpdateId = 0;
var isPolling = false;
async function fetchBotInfo() {
  try {
    const res = await fetch(`https://api.telegram.org/bot${telegramConfig.botToken}/getMe`);
    const data = await res.json();
    if (data.ok && data.result) {
      telegramConfig.botInfo = {
        username: data.result.username || "johnwickvip_bot",
        firstName: data.result.first_name || "John Wick VIP"
      };
    }
  } catch (err) {
    console.error("[Telegram] Failed to fetch bot info:", err?.message);
  }
}
async function registerSubscriber(chatId, title = "VIP Member", type = "private") {
  const idStr = String(chatId).trim();
  if (!idStr) return;
  subscribersMap.set(idStr, {
    chatId: idStr,
    title,
    type,
    addedAt: Date.now()
  });
  if (!telegramConfig.chatId) {
    telegramConfig.chatId = idStr;
  }
  telegramConfig.subscriberCount = subscribersMap.size;
  saveSubscribersToDisk();
  console.log(`[Telegram] Registered subscriber: ${idStr} (${title}) - Active: ${subscribersMap.size}`);
}
async function sendTelegramMessage(text, overrideChatId) {
  const targetChatId = overrideChatId || telegramConfig.chatId;
  if (!targetChatId || !targetChatId.trim()) {
    telegramConfig.lastError = "No Chat ID configured. Send /start to @johnwickvip_bot or add bot to channel.";
    return false;
  }
  try {
    const res = await fetch(`https://api.telegram.org/bot${telegramConfig.botToken}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: targetChatId.trim(),
        text,
        parse_mode: "HTML",
        disable_web_page_preview: true
      })
    });
    const data = await res.json();
    if (data.ok) {
      telegramConfig.lastError = null;
      telegramConfig.lastSentTime = Date.now();
      return true;
    } else {
      telegramConfig.lastError = data.description || "Telegram API returned error";
      if (data.error_code === 403 && data.description?.includes("bot was blocked by the user") && targetChatId.trim() !== telegramConfig.chatId) {
        subscribersMap.delete(targetChatId.trim());
        saveSubscribersToDisk();
        telegramConfig.subscriberCount = subscribersMap.size;
      }
      return false;
    }
  } catch (err) {
    telegramConfig.lastError = err?.message || "Network error";
    return false;
  }
}
function formatColorLabel(color) {
  switch (color) {
    case "GREEN":
      return "\u{1F7E2} GREEN";
    case "RED":
      return "\u{1F534} RED";
    case "VIOLET":
      return "\u{1F7E3} VIOLET";
    case "RED_VIOLET":
      return "\u{1F534}\u{1F7E3} RED + VIOLET";
    case "GREEN_VIOLET":
      return "\u{1F7E2}\u{1F7E3} GREEN + VIOLET";
    default:
      return color;
  }
}
function formatSizeLabel(size) {
  return size === "BIG" ? "\u{1F7E2} BIG (5-9)" : "\u{1F534} SMALL (0-4)";
}
async function sendTelegramSignal(tf, signal) {
  if (!telegramConfig.enabled) return false;
  if (!telegramConfig.timeframes[tf]) return false;
  if (telegramConfig.lastSentPeriod[tf] === signal.targetPeriod) {
    return false;
  }
  const targetIds = /* @__PURE__ */ new Set();
  if (telegramConfig.chatId && telegramConfig.chatId.trim()) {
    targetIds.add(telegramConfig.chatId.trim());
  }
  for (const [id] of subscribersMap) {
    targetIds.add(id);
  }
  if (targetIds.size === 0) {
    return false;
  }
  const confidence = (Math.max(signal.numberShare, signal.sizeShare) * 100).toFixed(1);
  const tfName = tf === "30S" ? "WinGo 30 SEC" : `WinGo ${tf.replace("M", " MIN")}`;
  const primaryPlay = signal.primaryBet === "COLOR" ? `\u{1F48E} <b>PRIMARY PLAY:</b> <b>${formatColorLabel(signal.color)}</b> <i>(Safe Color Hedge)</i>` : `\u{1F48E} <b>PRIMARY PLAY:</b> <b>${formatSizeLabel(signal.size)}</b>`;
  const stakingLevel = signal.stakingLevel || "LEVEL 1 (1X)";
  const multiplier = signal.suggestedMultiplier || 1;
  const stakeLine = `\u{1F4B0} <b>VIP STAKING:</b> <code>${stakingLevel}</code> ${multiplier > 1 ? `<i>(${multiplier}X Recovery Stake)</i>` : "<i>(Base Unit)</i>"}`;
  const streakGuardLine = signal.lossStreakPrevented ? `\u{1F6E1} <b>CIRCUIT BREAKER:</b> \u{1F6A8} <code>VIP RECOVERY LOCK (Streak: ${signal.consecutiveLosses || 2} - Auto-Corrected)</code>` : `\u{1F6E1} <b>CIRCUIT BREAKER:</b> <code>Active (Loss Guard: ${signal.consecutiveLosses || 0} / 3)</code>`;
  const advisoryLine = signal.advisoryNote ? `\u{1F4A1} <b>Strategic Intel:</b> <i>${signal.advisoryNote}</i>` : "";
  const hedgeLine = signal.hedgeTip ? `\u2696 <b>Bankroll Hedge:</b> <i>${signal.hedgeTip}</i>` : "";
  const message = [
    `\u2728 <b>NUMBER SHOT PRO</b> \u2022 <i>VIP INTELLIGENCE</i> \u2728`,
    `\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501`,
    `\u23F1 <b>Draw Interval:</b> <code>${tfName}</code>`,
    `\u{1F3AF} <b>Target Period:</b> <code>${signal.targetPeriod}</code>`,
    `\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501`,
    `\u{1F52E} <b>PREDICTED OUTCOME:</b>`,
    `\u2022 <b>Size:</b> ${formatSizeLabel(signal.size)}`,
    `\u2022 <b>Color:</b> ${formatColorLabel(signal.color)}`,
    `\u2022 <b>Lucky Number:</b> <code>[ ${signal.number} ]</code>`,
    ``,
    primaryPlay,
    stakeLine,
    streakGuardLine,
    advisoryLine,
    hedgeLine,
    `\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501`,
    `\u{1F4CA} <b>Statistical Confidence:</b> <code>${confidence}%</code>`,
    `\u26A1 <i>24/7 Cloud Authority \u2022 Anti-Blind Protected</i>`
  ].filter(Boolean).join("\n");
  const promises = Array.from(targetIds).map((chatId) => sendTelegramMessage(message, chatId));
  await Promise.allSettled(promises);
  telegramConfig.lastSentPeriod[tf] = signal.targetPeriod;
  console.log(`[Telegram Broadcast] Signal sent for ${tf} (Period ${signal.targetPeriod}) to ${targetIds.size} recipient(s)`);
  return true;
}
async function pollTelegramUpdates() {
  if (isPolling || !telegramConfig.botToken) return;
  isPolling = true;
  try {
    const url = `https://api.telegram.org/bot${telegramConfig.botToken}/getUpdates?offset=${lastUpdateId + 1}&timeout=2`;
    const res = await fetch(url, { signal: AbortSignal.timeout(6e3) });
    if (!res.ok) {
      if (res.status === 409) {
        console.warn("[Telegram Polling] 409 Conflict: waiting for next tick.");
      }
      return;
    }
    const data = await res.json();
    if (!data.ok || !Array.isArray(data.result)) return;
    for (const update of data.result) {
      lastUpdateId = Math.max(lastUpdateId, update.update_id);
      const msg = update.message || update.channel_post || update.my_chat_member;
      const chat = update.message?.chat || update.channel_post?.chat || update.my_chat_member?.chat;
      if (!chat) continue;
      const chatId = String(chat.id);
      const chatTitle = chat.title || chat.first_name || "VIP Member";
      const chatType = chat.type || "private";
      if (telegramConfig.autoDetectChatId) {
        const isNew = !subscribersMap.has(chatId);
        await registerSubscriber(chatId, chatTitle, chatType);
        if (isNew && update.message?.text?.startsWith("/start")) {
          await sendTelegramMessage(
            `\u{1F451} <b>Welcome to Number Shot Pro VIP!</b>

\u2705 <b>Subscription Activated:</b> <code>${chatTitle}</code>
\u{1F3AF} You are now permanently linked for 24/7 automated signals.
\u{1F4E1} Signals for <b>30S, 1M, 3M, 5M</b> will be delivered automatically before every round.

You do not need to type /start again. Good luck! \u{1F680}`,
            chatId
          );
        }
      }
    }
  } catch (err) {
  } finally {
    isPolling = false;
  }
}

// server.ts
var __filename = fileURLToPath(import.meta.url);
var __dirname = path2.dirname(__filename);
var app = express();
app.use(express.json());
app.use((req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, x-admin-passcode");
  if (req.method === "OPTIONS") {
    res.sendStatus(200);
    return;
  }
  next();
});
var PORT = process.env.PORT || 3e3;
var ADMIN_PASSCODE = process.env.ADMIN_PASSCODE || "wingo786";
var masterState = {
  histories: {
    "30S": [],
    "1M": [],
    "3M": [],
    "5M": []
  },
  signals: {
    "30S": null,
    "1M": null,
    "3M": null,
    "5M": null
  },
  endpoints: { ...DEFAULT_ENDPOINTS },
  updatedAt: {
    "30S": null,
    "1M": null,
    "3M": null,
    "5M": null
  },
  lastFetchedPeriod: {
    "30S": null,
    "1M": null,
    "3M": null,
    "5M": null
  },
  serverTime: Date.now()
};
var trackedSignals = {
  "30S": null,
  "1M": null,
  "3M": null,
  "5M": null
};
var authoritativeLossStreak = {
  "30S": 0,
  "1M": 0,
  "3M": 0,
  "5M": 0
};
var CACHE_FILE = path2.resolve(process.env.STATE_CACHE_DIR || "/tmp", "wingo_master_cache.json");
function saveMasterStateToDisk() {
  try {
    const dataToSave = {
      histories: masterState.histories,
      signals: masterState.signals,
      endpoints: masterState.endpoints,
      updatedAt: masterState.updatedAt,
      lastFetchedPeriod: masterState.lastFetchedPeriod,
      trackedSignals,
      authoritativeLossStreak,
      savedAt: Date.now()
    };
    fs2.writeFileSync(CACHE_FILE, JSON.stringify(dataToSave), "utf-8");
  } catch (err) {
  }
}
function loadMasterStateFromDisk() {
  try {
    if (fs2.existsSync(CACHE_FILE)) {
      const raw = fs2.readFileSync(CACHE_FILE, "utf-8");
      const loaded = JSON.parse(raw);
      if (loaded && loaded.histories) {
        for (const tf of TIMEFRAMES) {
          if (Array.isArray(loaded.histories[tf]) && loaded.histories[tf].length > 0) {
            masterState.histories[tf] = loaded.histories[tf];
          }
          if (loaded.signals && loaded.signals[tf]) {
            masterState.signals[tf] = loaded.signals[tf];
          }
          if (loaded.endpoints && loaded.endpoints[tf]) {
            masterState.endpoints[tf] = loaded.endpoints[tf];
          }
          if (loaded.updatedAt && loaded.updatedAt[tf]) {
            masterState.updatedAt[tf] = loaded.updatedAt[tf];
          }
          if (loaded.lastFetchedPeriod && loaded.lastFetchedPeriod[tf]) {
            masterState.lastFetchedPeriod[tf] = loaded.lastFetchedPeriod[tf];
          }
        }
        if (loaded.trackedSignals) {
          Object.assign(trackedSignals, loaded.trackedSignals);
        }
        if (loaded.authoritativeLossStreak) {
          Object.assign(authoritativeLossStreak, loaded.authoritativeLossStreak);
        }
        console.log("[Cache] Master state successfully restored from disk cache");
      }
    }
  } catch (err) {
    console.warn("[Cache] Could not restore disk cache:", err?.message);
  }
}
loadMasterStateFromDisk();
var sseClients = [];
function broadcastToClients(eventType, data) {
  const payload = `event: ${eventType}
data: ${JSON.stringify(data)}

`;
  for (let i = sseClients.length - 1; i >= 0; i--) {
    const client = sseClients[i];
    try {
      client.write(payload);
    } catch {
      sseClients.splice(i, 1);
    }
  }
}
async function fetchDrawsFromLottery(url) {
  const candidateUrls = [];
  if (url.includes("ar-lottery")) {
    candidateUrls.push(
      url.replace(/draw\.ar-lottery\d*\.com/g, "draw.ar-lottery02.com"),
      url.replace(/draw\.ar-lottery\d*\.com/g, "draw.ar-lottery03.com"),
      url.replace(/draw\.ar-lottery\d*\.com/g, "draw.ar-lottery04.com")
    );
  }
  candidateUrls.push(url);
  for (const cand of candidateUrls) {
    try {
      const fetchUrl = new URL(cand);
      fetchUrl.searchParams.set("ts", String(Date.now()));
      const response = await fetch(fetchUrl.toString(), {
        method: "GET",
        headers: {
          "Accept": "application/json, text/plain, */*",
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
        }
      });
      if (response.ok) {
        const bodyText = await response.text();
        if (bodyText.trim().startsWith("{") || bodyText.trim().startsWith("[")) {
          const json = JSON.parse(bodyText);
          const parsed = parseHistoryPayload(json);
          if (parsed && parsed.length > 0) {
            return parsed;
          }
        }
      }
    } catch {
      continue;
    }
  }
  throw new Error(`Failed to fetch draws from all mirror candidates for: ${url}`);
}
var isSyncing = {
  "30S": false,
  "1M": false,
  "3M": false,
  "5M": false
};
async function syncTimeframeOnServer(tf) {
  if (isSyncing[tf]) return false;
  isSyncing[tf] = true;
  try {
    const endpoint = masterState.endpoints[tf];
    const freshDraws = await fetchDrawsFromLottery(endpoint);
    const prevList = masterState.histories[tf] || [];
    const map = /* @__PURE__ */ new Map();
    for (const item of prevList) {
      map.set(item.period, item);
    }
    for (const item of freshDraws) {
      map.set(item.period, item);
    }
    const merged = Array.from(map.values()).sort((a, b) => a.period.localeCompare(b.period, void 0, { numeric: true })).slice(-36);
    const prevLatest = masterState.lastFetchedPeriod[tf];
    const newLatest = merged[merged.length - 1]?.period || null;
    const hasNewRound = !prevLatest || prevLatest !== newLatest;
    if (merged.length > 0) {
      const prevDispatched = trackedSignals[tf];
      if (prevDispatched) {
        const matchedDraw = merged.find((d) => d.period === prevDispatched.targetPeriod);
        if (matchedDraw) {
          const actualSize = getSize(matchedDraw.number);
          if (prevDispatched.size === actualSize) {
            authoritativeLossStreak[tf] = 0;
            console.log(`[Resolution] ${tf} Period ${matchedDraw.period}: WIN \u2705 (${actualSize}) - Streak reset to 0`);
          } else {
            authoritativeLossStreak[tf] += 1;
            console.log(`[Resolution] ${tf} Period ${matchedDraw.period}: LOSS \u274C (Predicted ${prevDispatched.size}, Actual ${actualSize}) - Streak: ${authoritativeLossStreak[tf]}`);
          }
          trackedSignals[tf] = null;
        }
      }
    }
    masterState.histories[tf] = merged;
    masterState.lastFetchedPeriod[tf] = newLatest;
    masterState.updatedAt[tf] = (/* @__PURE__ */ new Date()).toISOString();
    masterState.serverTime = Date.now();
    if (hasNewRound || !masterState.signals[tf]) {
      const newSignal = buildSignal(merged, authoritativeLossStreak[tf]);
      if (newSignal) {
        masterState.signals[tf] = newSignal;
        trackedSignals[tf] = {
          targetPeriod: newSignal.targetPeriod,
          size: newSignal.size
        };
        sendTelegramSignal(tf, newSignal).catch((err) => {
          console.warn("[Telegram dispatch]", err?.message);
        });
      }
    }
    saveMasterStateToDisk();
    broadcastToClients("signal-update", {
      tf,
      history: masterState.histories[tf],
      signal: masterState.signals[tf],
      updatedAt: masterState.updatedAt[tf],
      serverTime: masterState.serverTime
    });
    return true;
  } catch (err) {
    console.error(`[Server Sync Error] ${tf}:`, err?.message);
    return false;
  } finally {
    isSyncing[tf] = false;
  }
}
function startBackgroundScheduler() {
  fetchBotInfo().catch(() => {
  });
  for (const tf of TIMEFRAMES) {
    syncTimeframeOnServer(tf);
  }
  setInterval(pollTelegramUpdates, 5e3);
  const lastTriggeredRound = {
    "30S": Math.floor(Date.now() / 1e3 / 30),
    "1M": Math.floor(Date.now() / 1e3 / 60),
    "3M": Math.floor(Date.now() / 1e3 / 180),
    "5M": Math.floor(Date.now() / 1e3 / 300)
  };
  setInterval(() => {
    const nowSec = Math.floor(Date.now() / 1e3);
    masterState.serverTime = Date.now();
    for (const tf of TIMEFRAMES) {
      const periodSec = TIMEFRAME_SECONDS[tf];
      const currentRoundIndex = Math.floor(nowSec / periodSec);
      if (currentRoundIndex > lastTriggeredRound[tf]) {
        lastTriggeredRound[tf] = currentRoundIndex;
        setTimeout(() => {
          syncTimeframeOnServer(tf);
        }, 2500);
        setTimeout(() => {
          syncTimeframeOnServer(tf);
        }, 6500);
      }
    }
  }, 1e3);
  setInterval(() => {
    broadcastToClients("ping", { serverTime: Date.now() });
  }, 15e3);
  setInterval(() => {
    pollTelegramUpdates().catch(() => {
    });
  }, 15e3);
}
var totalCronTicks = 0;
var lastCronTickTime = 0;
var lastCronTickIp = "";
app.all(["/api/cron/tick", "/api/cron/sync"], async (req, res) => {
  totalCronTicks++;
  lastCronTickTime = Date.now();
  lastCronTickIp = req.headers["x-forwarded-for"] || req.socket.remoteAddress || "unknown";
  pollTelegramUpdates().catch(() => {
  });
  const syncResults = {};
  await Promise.allSettled(
    TIMEFRAMES.map(async (tf) => {
      const ok = await syncTimeframeOnServer(tf);
      syncResults[tf] = {
        period: masterState.lastFetchedPeriod[tf],
        synced: ok,
        signalAvailable: !!masterState.signals[tf]
      };
    })
  );
  res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
  res.json({
    success: true,
    status: "TICK_EXECUTED",
    timestamp: (/* @__PURE__ */ new Date()).toISOString(),
    serverTime: Date.now(),
    cloudRunKeepAlive: true,
    totalTicksReceived: totalCronTicks,
    callerIp: lastCronTickIp,
    subscribersCount: telegramConfig.subscriberCount,
    timeframes: syncResults
  });
});
app.get(["/api/health", "/api/cron/keepalive"], (_req, res) => {
  res.status(200).json({
    status: "HEALTHY",
    service: "wingo-signals-cloud-run",
    timestamp: Date.now(),
    uptimeSeconds: Math.floor(process.uptime()),
    totalCronTicks,
    lastCronTickTime
  });
});
app.get("/api/cron/status", (req, res) => {
  const host = req.headers["host"] || "localhost:3000";
  const proto = req.headers["x-forwarded-proto"] || "https";
  const fullBaseUrl = `${proto}://${host}`;
  const isWarmed = Date.now() - lastCronTickTime < 18e4;
  res.json({
    active: isWarmed,
    totalTicks: totalCronTicks,
    lastTickTime: lastCronTickTime,
    lastTickAgoSec: lastCronTickTime ? Math.floor((Date.now() - lastCronTickTime) / 1e3) : null,
    cronEndpoint: `${fullBaseUrl}/api/cron/tick`,
    healthEndpoint: `${fullBaseUrl}/api/health`,
    recommendedSchedule: "* * * * *",
    gcloudCommand: `gcloud scheduler jobs create http wingo-telegram-bot-sync --location=asia-east1 --schedule="* * * * *" --uri="${fullBaseUrl}/api/cron/tick" --http-method=GET --time-zone="Asia/Dhaka"`,
    cloudRunAlwaysOnCommand: `gcloud run services update <SERVICE_NAME> --min-instances=1 --no-cpu-throttling --region=asia-east1`
  });
});
app.get(["/manifest.json", "/site.webmanifest"], (_req, res) => {
  const p = path2.resolve(__dirname, "manifest.json");
  const fallback = path2.resolve(__dirname, "public/manifest.json");
  const target = fs2.existsSync(p) ? p : fallback;
  if (fs2.existsSync(target)) {
    res.setHeader("Content-Type", "application/manifest+json; charset=utf-8");
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Cache-Control", "public, max-age=3600");
    res.sendFile(target);
  } else {
    res.status(404).json({ error: "Manifest not found" });
  }
});
app.get(["/sw.js", "/service-worker.js"], (_req, res) => {
  const p = path2.resolve(__dirname, "sw.js");
  const fallback = path2.resolve(__dirname, "public/sw.js");
  const target = fs2.existsSync(p) ? p : fallback;
  if (fs2.existsSync(target)) {
    res.setHeader("Content-Type", "text/javascript; charset=utf-8");
    res.setHeader("Service-Worker-Allowed", "/");
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.sendFile(target);
  } else {
    res.status(404).send("Service worker not found");
  }
});
app.get("/api/live-state", (_req, res) => {
  res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
  for (const tf of TIMEFRAMES) {
    const hist = masterState.histories[tf];
    if (hist && hist.length >= 5) {
      const latestPeriod = hist[hist.length - 1].period;
      const currentSig = masterState.signals[tf];
      if (!currentSig || currentSig.targetPeriod <= latestPeriod) {
        const fresh = buildSignal(hist, authoritativeLossStreak[tf]);
        if (fresh) {
          masterState.signals[tf] = fresh;
          trackedSignals[tf] = { targetPeriod: fresh.targetPeriod, size: fresh.size };
        }
      }
    }
  }
  res.json({
    histories: masterState.histories,
    signals: masterState.signals,
    endpoints: masterState.endpoints,
    updatedAt: masterState.updatedAt,
    serverTime: Date.now(),
    serverSynced: true
  });
});
app.post(["/api/signal/calculate", "/api/sync/trigger"], async (req, res) => {
  const { tf } = req.body || {};
  const targetTf = TIMEFRAMES.includes(tf) ? tf : "1M";
  await syncTimeframeOnServer(targetTf);
  const hist = masterState.histories[targetTf];
  if (hist && hist.length >= 5) {
    const newSignal = buildSignal(hist, authoritativeLossStreak[targetTf]);
    if (newSignal) {
      masterState.signals[targetTf] = newSignal;
      trackedSignals[targetTf] = { targetPeriod: newSignal.targetPeriod, size: newSignal.size };
      saveMasterStateToDisk();
      broadcastToClients("signal-update", {
        tf: targetTf,
        history: hist,
        signal: newSignal,
        updatedAt: masterState.updatedAt[targetTf],
        serverTime: Date.now()
      });
    }
  }
  res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
  res.json({
    success: true,
    tf: targetTf,
    signal: masterState.signals[targetTf],
    history: masterState.histories[targetTf],
    updatedAt: masterState.updatedAt[targetTf],
    serverTime: Date.now(),
    serverSynced: true
  });
});
app.get("/api/live-stream", (req, res) => {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders?.();
  res.write(
    `event: initial-state
data: ${JSON.stringify({
      histories: masterState.histories,
      signals: masterState.signals,
      endpoints: masterState.endpoints,
      updatedAt: masterState.updatedAt,
      serverTime: Date.now(),
      serverSynced: true
    })}

`
  );
  sseClients.push(res);
  req.on("close", () => {
    const idx = sseClients.indexOf(res);
    if (idx !== -1) sseClients.splice(idx, 1);
  });
});
app.post("/api/admin/verify", (req, res) => {
  const { passcode } = req.body || {};
  if (passcode && passcode.trim() === ADMIN_PASSCODE) {
    res.json({ success: true, message: "Admin verified successfully" });
  } else {
    res.status(401).json({ success: false, error: "Invalid admin passcode" });
  }
});
app.post("/api/admin/settings", async (req, res) => {
  const authHeader = req.headers["x-admin-passcode"] || req.body?.passcode;
  if (!authHeader || authHeader.toString().trim() !== ADMIN_PASSCODE) {
    res.status(403).json({ error: "Unauthorized: Admin passcode required" });
    return;
  }
  const { endpoints, resetTimeframe } = req.body || {};
  if (endpoints && typeof endpoints === "object") {
    for (const tf of TIMEFRAMES) {
      if (typeof endpoints[tf] === "string" && endpoints[tf].startsWith("https://")) {
        masterState.endpoints[tf] = endpoints[tf];
      }
    }
  }
  if (resetTimeframe && TIMEFRAMES.includes(resetTimeframe)) {
    masterState.histories[resetTimeframe] = [];
    masterState.signals[resetTimeframe] = null;
    masterState.lastFetchedPeriod[resetTimeframe] = null;
    await syncTimeframeOnServer(resetTimeframe);
  }
  broadcastToClients("settings-update", {
    endpoints: masterState.endpoints,
    serverTime: Date.now()
  });
  res.json({
    success: true,
    message: "Settings updated successfully on server",
    endpoints: masterState.endpoints
  });
});
app.get("/api/telegram/config", (_req, res) => {
  res.json({
    botToken: telegramConfig.botToken,
    chatId: telegramConfig.chatId,
    enabled: telegramConfig.enabled,
    timeframes: telegramConfig.timeframes,
    autoDetectChatId: telegramConfig.autoDetectChatId,
    lastSentPeriod: telegramConfig.lastSentPeriod,
    lastSentTime: telegramConfig.lastSentTime,
    lastError: telegramConfig.lastError,
    botInfo: telegramConfig.botInfo
  });
});
app.post("/api/telegram/config", (req, res) => {
  const { botToken, chatId, enabled, timeframes, autoDetectChatId } = req.body || {};
  if (typeof botToken === "string" && botToken.trim()) {
    telegramConfig.botToken = botToken.trim();
    fetchBotInfo().catch(() => {
    });
  }
  if (typeof chatId === "string" && chatId.trim()) {
    telegramConfig.chatId = chatId.trim();
    registerSubscriber(chatId.trim(), "Configured Target", "channel");
  }
  if (typeof enabled === "boolean") {
    telegramConfig.enabled = enabled;
  }
  if (typeof autoDetectChatId === "boolean") {
    telegramConfig.autoDetectChatId = autoDetectChatId;
  }
  if (timeframes && typeof timeframes === "object") {
    telegramConfig.timeframes = {
      ...telegramConfig.timeframes,
      ...timeframes
    };
  }
  res.json({ success: true, config: telegramConfig });
});
app.post("/api/telegram/test", async (req, res) => {
  const { chatId } = req.body || {};
  const target = chatId && String(chatId).trim() || telegramConfig.chatId;
  if (!target) {
    res.status(400).json({
      success: false,
      error: "No Chat ID found. Please open Telegram, search @johnwickvip_bot, click START, or add it to your channel."
    });
    return;
  }
  const testMessage = [
    `\u{1F451} <b>NUMBER SHOT PRO \u2014 VIP BOT ACTIVE</b> \u{1F451}`,
    `\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501`,
    `\u23F1 <b>Status:</b> <code>CONNECTED & SYNCED</code>`,
    `\u{1F3B2} <b>Sample Draw Round:</b> <code>${Date.now()}</code>`,
    ``,
    `\u{1F52E} <b>LIVE PREDICTION TEST:</b>`,
    `\u{1F449} <b>Size:</b> \u{1F7E2} BIG (5-9)`,
    `\u{1F449} <b>Color:</b> \u{1F7E2} GREEN`,
    `\u{1F449} <b>Best Number:</b> <code>[ 7 ]</code>`,
    ``,
    `\u{1F4CA} <b>VIP Confidence:</b> <code>91.5%</code>`,
    `\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501`,
    `\u26A1 <i>Live VIP Signals will be broadcast here automatically.</i>`
  ].join("\n");
  const ok = await sendTelegramMessage(testMessage, target);
  if (ok) {
    res.json({ success: true, message: "VIP Signal test sent to Telegram successfully!" });
  } else {
    res.status(500).json({ success: false, error: telegramConfig.lastError || "Failed to send Telegram message" });
  }
});
app.get("/api/history", async (req, res) => {
  try {
    const targetUrl = req.query.url;
    if (!targetUrl || !targetUrl.startsWith("https://")) {
      res.status(400).json({ error: "Valid HTTPS target URL is required" });
      return;
    }
    const draws = await fetchDrawsFromLottery(targetUrl);
    res.json({
      code: 0,
      msg: "Succeed",
      data: {
        list: draws.map((d) => ({
          issueNumber: d.period,
          number: d.number
        }))
      }
    });
  } catch (err) {
    res.status(502).json({ error: err?.message || "Failed to fetch lottery history" });
  }
});
var isProduction = process.env.NODE_ENV === "production";
var distPath = path2.resolve(__dirname, "dist");
var indexPath = path2.resolve(distPath, "index.html");
if (!isProduction) {
  const { createServer: createViteServer } = await import("vite");
  const vite = await createViteServer({
    server: { middlewareMode: true },
    appType: "spa"
  });
  app.use(vite.middlewares);
  app.use("*", async (req, res, next) => {
    const url = req.originalUrl;
    try {
      const template = fs2.readFileSync(path2.resolve(__dirname, "index.html"), "utf-8");
      const html = await vite.transformIndexHtml(url, template);
      res.status(200).set({ "Content-Type": "text/html" }).end(html);
    } catch (e) {
      next(e);
    }
  });
} else {
  if (fs2.existsSync(distPath)) {
    app.use(express.static(distPath));
  }
  app.get("*", (_req, res) => {
    if (fs2.existsSync(indexPath)) {
      res.sendFile(indexPath);
    } else {
      res.status(404).send("Application build not found. Run npm run build.");
    }
  });
}
app.listen(Number(PORT), "0.0.0.0", () => {
  console.log(`[WinGo Signals Server] Listening on 0.0.0.0:${PORT}`);
  startBackgroundScheduler();
});
