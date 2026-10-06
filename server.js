// server.ts
import express from "express";
import path from "path";
import fs from "fs";
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
  let consecutiveSameSize = 1;
  const lastSize = getSize(lastNum);
  for (let i = numbers.length - 2; i >= 0; i--) {
    if (getSize(numbers[i]) === lastSize) {
      consecutiveSameSize++;
    } else {
      break;
    }
  }
  const sizeAdjustment = Array.from({ length: 10 }, (_, n) => {
    if (consecutiveSameSize >= 3) {
      const isOpposite = getSize(n) !== lastSize;
      return isOpposite ? 1 + Math.min(0.25, (consecutiveSameSize - 2) * 0.08) : 1;
    }
    return 1;
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
    p *= sizeAdjustment[i];
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
function buildSignal(history) {
  if (!history || history.length < 5) return null;
  const dist = calculateModelDistribution(history);
  const bestNumber = dist.indexOf(Math.max(...dist));
  const bestSize = selectMaxCategory(
    ["SMALL", "BIG"],
    (s) => calculateCategoryShare(dist, s)
  );
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
    backtest: runBacktest(history)
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

// server.ts
var __filename = fileURLToPath(import.meta.url);
var __dirname = path.dirname(__filename);
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
  for (const tf of TIMEFRAMES) {
    syncTimeframeOnServer(tf);
  }
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
  const p = path.resolve(__dirname, "manifest.json");
  const fallback = path.resolve(__dirname, "public/manifest.json");
  const target = fs.existsSync(p) ? p : fallback;
  if (fs.existsSync(target)) {
    res.setHeader("Content-Type", "application/manifest+json; charset=utf-8");
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Cache-Control", "public, max-age=3600");
    res.sendFile(target);
  } else {
    res.status(404).json({ error: "Manifest not found" });
  }
});
app.get(["/sw.js", "/service-worker.js"], (_req, res) => {
  const p = path.resolve(__dirname, "sw.js");
  const fallback = path.resolve(__dirname, "public/sw.js");
  const target = fs.existsSync(p) ? p : fallback;
  if (fs.existsSync(target)) {
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
var distPath = path.resolve(__dirname, "dist");
var indexPath = path.resolve(distPath, "index.html");
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
      const template = fs.readFileSync(path.resolve(__dirname, "index.html"), "utf-8");
      const html = await vite.transformIndexHtml(url, template);
      res.status(200).set({ "Content-Type": "text/html" }).end(html);
    } catch (e) {
      next(e);
    }
  });
} else {
  if (fs.existsSync(distPath)) {
    app.use(express.static(distPath));
  }
  app.get("*", (_req, res) => {
    if (fs.existsSync(indexPath)) {
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
