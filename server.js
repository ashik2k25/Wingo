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
function selectMaxCategory(options, evaluator) {
  return options.reduce((best, curr) => evaluator(curr) > evaluator(best) ? curr : best);
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
    const dist = calculateModelDistribution(trainingSlice);
    const predNumber = dist.indexOf(Math.max(...dist));
    const predSize = selectMaxCategory(
      ["SMALL", "BIG"],
      (s) => calculateCategoryShare(dist, s)
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
function analyzeSizeAndPattern(history) {
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
      activeStreak: 1
    };
  }
  const dist = calculateModelDistribution(activeHistory);
  const bigShare = calculateCategoryShare(dist, "BIG");
  const smallShare = calculateCategoryShare(dist, "SMALL");
  const recommendedSize = bigShare >= smallShare ? "BIG" : "SMALL";
  const sizeConfidence = Math.max(bigShare, smallShare);
  const numbers = activeHistory.map((h) => h.number);
  const lastNum = numbers[len - 1];
  const lastSize = getSize(lastNum);
  let activeStreak = 0;
  for (let i = len - 1; i >= 0; i--) {
    if (getSize(numbers[i]) === lastSize) activeStreak++;
    else break;
  }
  const isChop = len >= 4 && getSize(numbers[len - 1]) !== getSize(numbers[len - 2]) && getSize(numbers[len - 2]) === getSize(numbers[len - 4]) && getSize(numbers[len - 1]) === getSize(numbers[len - 3]);
  const bigCount = numbers.filter((n) => n >= 5).length;
  const smallCount = len - bigCount;
  const isSaturated = bigCount >= 7 || smallCount >= 7;
  const isViolet0 = lastNum === 0;
  const isViolet5 = lastNum === 5;
  let patternType = "NORMAL";
  let sizeSafety = "SAFE";
  let advisoryNote = "";
  let hedgeTip = "";
  if (isChop) {
    patternType = "CHOP";
    sizeSafety = "SAFE";
    advisoryNote = "1-1 Alternation (Ping-Pong) rhythm confirmed. Cadence followed.";
    hedgeTip = "Follow alternating rhythm safely.";
  } else if (activeStreak >= 6) {
    patternType = "STREAK";
    sizeSafety = "RISKY";
    advisoryNote = `Mature ${activeStreak}x ${lastSize} dragon reached exhaustion ceiling.`;
    hedgeTip = "Prioritize COLOR bet for bankroll protection.";
  } else if (activeStreak >= 2) {
    patternType = "STREAK";
    sizeSafety = activeStreak >= 4 ? "MEDIUM" : "SAFE";
    advisoryNote = `Active ${activeStreak}x ${lastSize} momentum trend. Riding the wave safely.`;
    hedgeTip = activeStreak >= 4 ? "Watch for Violet 0/5 pivot." : "Follow trend momentum.";
  } else if (isViolet0 && len >= 2 && getSize(numbers[len - 2]) === "BIG") {
    patternType = "CHOP";
    sizeSafety = "SAFE";
    advisoryNote = "Violet 0 structural pivot: Big trend broken, Small reset initiated.";
    hedgeTip = "Color RED hedge supported.";
  } else if (isViolet5 && len >= 2 && getSize(numbers[len - 2]) === "SMALL") {
    patternType = "CHOP";
    sizeSafety = "SAFE";
    advisoryNote = "Violet 5 structural pivot: Small trend broken, Big reset initiated.";
    hedgeTip = "Color GREEN hedge supported.";
  } else if (isSaturated) {
    patternType = "NORMAL";
    sizeSafety = "MEDIUM";
    advisoryNote = `Anti-Blind filter active: ${Math.max(bigCount, smallCount)} of 10 draws were ${bigCount >= smallCount ? "BIG" : "SMALL"}. Damping applied.`;
    hedgeTip = "Balanced play with Color hedge.";
  } else {
    patternType = "NORMAL";
    sizeSafety = sizeConfidence >= 0.58 ? "SAFE" : "MEDIUM";
    advisoryNote = "Markov probability and frequency momentum aligned.";
    hedgeTip = "Standard balanced play.";
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
    activeStreak
  };
}
function buildSignal(history) {
  if (!history || history.length < 5) return null;
  const activeHistory = history.slice(-10);
  const dist = calculateModelDistribution(activeHistory);
  const patternAnalysis = analyzeSizeAndPattern(activeHistory);
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
    hedgeTip: patternAnalysis.hedgeTip
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
  const advisoryLine = signal.advisoryNote ? `\u{1F4A1} <b>Strategic Intel:</b> <i>${signal.advisoryNote}</i>` : "";
  const hedgeLine = signal.hedgeTip ? `\u{1F6E1} <b>Bankroll Hedge:</b> <i>${signal.hedgeTip}</i>` : "";
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
    const merged = Array.from(map.values()).sort((a, b) => a.period.localeCompare(b.period, void 0, { numeric: true })).slice(-16);
    const prevLatest = masterState.lastFetchedPeriod[tf];
    const newLatest = merged[merged.length - 1]?.period || null;
    const hasNewRound = !prevLatest || prevLatest !== newLatest;
    masterState.histories[tf] = merged;
    masterState.lastFetchedPeriod[tf] = newLatest;
    masterState.updatedAt[tf] = (/* @__PURE__ */ new Date()).toISOString();
    masterState.serverTime = Date.now();
    if (hasNewRound || !masterState.signals[tf]) {
      const newSignal = buildSignal(merged);
      if (newSignal) {
        masterState.signals[tf] = newSignal;
        sendTelegramSignal(tf, newSignal).catch((err) => {
          console.warn("[Telegram dispatch]", err?.message);
        });
      }
    }
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
}
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
  res.json({
    histories: masterState.histories,
    signals: masterState.signals,
    endpoints: masterState.endpoints,
    updatedAt: masterState.updatedAt,
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
