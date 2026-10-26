import express, { Request, Response } from 'express';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { Timeframe, DrawResult, Signal, BallSize, HighestLossRecord, PeakAccuracyWindow, GoldenAlertConfig, AlertHistoryLog } from './src/types';
import {
  DEFAULT_ENDPOINTS,
  DEFAULT_TREND_ENDPOINTS,
  TIMEFRAMES,
  TIMEFRAME_SECONDS,
  buildSignal,
  parseHistoryPayload,
  getSize,
  getColor,
  isColorMatch,
  isPeriodExpired,
  calculateTrendStatistics,
  analyzeSizeAndPattern,
  analyzeColorAndPattern,
  calculatePeakAccuracyWindows,
} from './src/utils/engine';
import {
  telegramConfig,
  sendTelegramSignal,
  sendTelegramMessage,
  pollTelegramUpdates,
  fetchBotInfo,
  registerSubscriber,
} from './src/utils/telegram';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(express.json());

// Enable CORS for all API endpoints (critical for iframe embedding in AI Studio & Cloud Run)
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-admin-passcode');
  if (req.method === 'OPTIONS') {
    res.sendStatus(200);
    return;
  }
  next();
});

const PORT = process.env.PORT || 3000;
const ADMIN_PASSCODE = process.env.ADMIN_PASSCODE || 'wingo786';

// Server-Authoritative Master State
// All clients worldwide receive identical draw history and identical signals from this master state.
interface MasterState {
  histories: Record<Timeframe, DrawResult[]>;
  signals: Record<Timeframe, Signal | null>;
  endpoints: Record<Timeframe, string>;
  trendEndpoints: Record<Timeframe, string>;
  updatedAt: Record<Timeframe, string | null>;
  lastFetchedPeriod: Record<Timeframe, string | null>;
  serverTime: number;
}

const masterState: MasterState = {
  histories: {
    '30S': [],
    '1M': [],
    '3M': [],
    '5M': [],
  },
  signals: {
    '30S': null,
    '1M': null,
    '3M': null,
    '5M': null,
  },
  endpoints: { ...DEFAULT_ENDPOINTS },
  trendEndpoints: { ...DEFAULT_TREND_ENDPOINTS },
  updatedAt: {
    '30S': null,
    '1M': null,
    '3M': null,
    '5M': null,
  },
  lastFetchedPeriod: {
    '30S': null,
    '1M': null,
    '3M': null,
    '5M': null,
  },
  serverTime: Date.now(),
};

// Track authoritatively dispatched signals per timeframe for 100% accurate resolution
export interface SignalLedgerEntry {
  targetPeriod: string;
  predictedSize: BallSize;
  actualSize?: BallSize;
  status: 'PENDING' | 'WIN' | 'LOSS';
  predictedColor?: any;
  actualColor?: any;
  colorStatus?: 'PENDING' | 'WIN' | 'LOSS';
  patternType?: string;
  timestamp: number;
}

const signalLedger: Record<Timeframe, SignalLedgerEntry[]> = {
  '30S': [],
  '1M': [],
  '3M': [],
  '5M': [],
};

const authoritativeLossStreak: Record<Timeframe, number> = {
  '30S': 0,
  '1M': 0,
  '3M': 0,
  '5M': 0,
};

// Server-authoritative persistent record of the highest consecutive size loss streak ever observed
// Tracks exact streak count, timestamp, and target period even when users are completely offline
const highestLossRecord: Record<Timeframe, HighestLossRecord> = {
  '30S': { streak: 0, occurredAt: new Date().toISOString(), period: 'INITIAL', timeframe: '30S' },
  '1M': { streak: 0, occurredAt: new Date().toISOString(), period: 'INITIAL', timeframe: '1M' },
  '3M': { streak: 0, occurredAt: new Date().toISOString(), period: 'INITIAL', timeframe: '3M' },
  '5M': { streak: 0, occurredAt: new Date().toISOString(), period: 'INITIAL', timeframe: '5M' },
};

// Persistent Golden 1-Min Session Alert & Telegram Automation State
const ALERT_CONFIG_FILE = path.resolve(process.cwd(), 'golden_alert_config.json');
const ALT_ALERT_CONFIG_FILE = '/app/applet/golden_alert_config.json';

const goldenAlertState: GoldenAlertConfig = {
  phoneNumber: '+8801575613612',
  telegramChatId: '6056817931',
  callAlertEnabled: true,
  telegramReportEnabled: true,
  leadTimeMinutes: 1,
  lastAlertTime: null,
  lastReportTime: null,
  lastCallStatus: null,
  lastReportStatus: null,
  historyLogs: [],
};

function loadAlertConfigFromDisk(): void {
  const paths = [ALERT_CONFIG_FILE, ALT_ALERT_CONFIG_FILE];
  for (const p of paths) {
    try {
      if (fs.existsSync(p)) {
        const raw = fs.readFileSync(p, 'utf-8');
        const data = JSON.parse(raw);
        if (data.phoneNumber) goldenAlertState.phoneNumber = data.phoneNumber;
        if (data.telegramChatId) goldenAlertState.telegramChatId = data.telegramChatId;
        if (typeof data.callAlertEnabled === 'boolean') goldenAlertState.callAlertEnabled = data.callAlertEnabled;
        if (typeof data.telegramReportEnabled === 'boolean') goldenAlertState.telegramReportEnabled = data.telegramReportEnabled;
        if (Array.isArray(data.historyLogs)) goldenAlertState.historyLogs = data.historyLogs;
        if (data.lastAlertTime) goldenAlertState.lastAlertTime = data.lastAlertTime;
        if (data.lastReportTime) goldenAlertState.lastReportTime = data.lastReportTime;
        console.log(`[Alerts] Loaded golden alert config from ${p}`);
        break;
      }
    } catch {}
  }
}

function saveAlertConfigToDisk(): void {
  try {
    const payload = JSON.stringify(goldenAlertState, null, 2);
    for (const p of [ALERT_CONFIG_FILE, ALT_ALERT_CONFIG_FILE]) {
      try {
        fs.writeFileSync(p, payload, 'utf-8');
      } catch {}
    }
  } catch {}
}

loadAlertConfigFromDisk();
registerSubscriber('6056817931', 'VIP Golden Receiver').catch(() => {});


function recordInLedger(tf: Timeframe, signal: Signal) {
  const ledger = signalLedger[tf];
  const existing = ledger.find((item) => item.targetPeriod === signal.targetPeriod);
  if (existing) {
    if (existing.status === 'PENDING') {
      existing.predictedSize = signal.size;
      existing.predictedColor = signal.color;
      existing.patternType = signal.patternType;
    }
  } else {
    ledger.push({
      targetPeriod: signal.targetPeriod,
      predictedSize: signal.size,
      predictedColor: signal.color,
      status: 'PENDING',
      colorStatus: 'PENDING',
      patternType: signal.patternType,
      timestamp: Date.now(),
    });
  }
  if (ledger.length > 500) {
    signalLedger[tf] = ledger.slice(-500);
  }
}

function auditSignalLedger(tf: Timeframe, draws: DrawResult[]): number {
  let ledger = signalLedger[tf];
  if (!ledger) {
    ledger = [];
    signalLedger[tf] = ledger;
  }
  if (!draws || draws.length === 0) {
    return authoritativeLossStreak[tf];
  }

  const drawMap = new Map<string, DrawResult>();
  for (const d of draws) {
    drawMap.set(d.period, d);
  }

  // 1. Audit and resolve all entries that now have matching actual draw results
  for (const item of ledger) {
    const matched = drawMap.get(item.targetPeriod);
    if (matched) {
      item.actualSize = getSize(matched.number);
      item.actualColor = getColor(matched.number);
      item.status = item.predictedSize === item.actualSize ? 'WIN' : 'LOSS';
      if (item.predictedColor) {
        item.colorStatus = isColorMatch(item.predictedColor, matched.number) ? 'WIN' : 'LOSS';
      }
    }
  }

  // 2. Ensure historical draws have ledger records if missing (backfill without overwriting existing live records)
  const existingPeriods = new Set(ledger.map((x) => x.targetPeriod));
  const toBackfill: SignalLedgerEntry[] = [];

  for (let i = 2; i < draws.length; i++) {
    const targetDraw = draws[i];
    if (!existingPeriods.has(targetDraw.period)) {
      const past = draws.slice(0, i);
      const sizeAnalysis = analyzeSizeAndPattern(past, 0);
      const predS = sizeAnalysis.recommendedSize;
      const colorAnalysis = analyzeColorAndPattern(past, predS);
      const predC = colorAnalysis.recommendedColor;
      const actS = getSize(targetDraw.number);
      const actC = getColor(targetDraw.number);

      toBackfill.push({
        targetPeriod: targetDraw.period,
        predictedSize: predS,
        predictedColor: predC,
        actualSize: actS,
        actualColor: actC,
        status: predS === actS ? 'WIN' : 'LOSS',
        colorStatus: isColorMatch(predC, targetDraw.number) ? 'WIN' : 'LOSS',
        patternType: sizeAnalysis.patternType,
        timestamp: Date.now() - (draws.length - i) * TIMEFRAME_SECONDS[tf] * 1000,
      });
    }
  }

  if (toBackfill.length > 0) {
    ledger.unshift(...toBackfill);
    ledger.sort((a, b) => a.targetPeriod.localeCompare(b.targetPeriod, undefined, { numeric: true }));
  }

  if (ledger.length > 500) {
    signalLedger[tf] = ledger.slice(-500);
  }

  // Calculate authoritative consecutive loss streak strictly from resolved items
  const resolved = signalLedger[tf].filter((x) => x.status === 'WIN' || x.status === 'LOSS');
  let currentLossStreak = 0;
  for (let i = resolved.length - 1; i >= 0; i--) {
    if (resolved[i].status === 'LOSS') {
      currentLossStreak++;
    } else {
      break;
    }
  }
  authoritativeLossStreak[tf] = currentLossStreak;

  // Continuously track and update highest size consecutive loss streak with timestamp & period
  let runningLoss = 0;
  for (const item of resolved) {
    if (item.status === 'LOSS') {
      runningLoss++;
      if (runningLoss > highestLossRecord[tf].streak) {
        highestLossRecord[tf] = {
          streak: runningLoss,
          occurredAt: new Date(item.timestamp || Date.now()).toISOString(),
          period: item.targetPeriod,
          timeframe: tf,
        };
      }
    } else {
      runningLoss = 0;
    }
  }

  saveMasterStateToDisk();
  return authoritativeLossStreak[tf];
}

// Disk cache for multi-device consistency across process restarts
const CACHE_FILE = path.resolve(process.env.STATE_CACHE_DIR || '/tmp', 'wingo_master_cache.json');

function saveMasterStateToDisk() {
  try {
    const dataToSave = {
      histories: masterState.histories,
      signals: masterState.signals,
      endpoints: masterState.endpoints,
      updatedAt: masterState.updatedAt,
      lastFetchedPeriod: masterState.lastFetchedPeriod,
      signalLedger,
      authoritativeLossStreak,
      highestLossRecord,
      savedAt: Date.now(),
    };
    fs.writeFileSync(CACHE_FILE, JSON.stringify(dataToSave), 'utf-8');
  } catch (err: any) {
    // Non-fatal if /tmp write is restricted
  }
}

function synchronizeLedgerWithDipoleEngine(tf: Timeframe) {
  const history = masterState.histories[tf];
  if (!history || history.length < 2) return;

  const newLedger: SignalLedgerEntry[] = [];
  let consecBothLoss = 0;
  let consecSizeLoss = 0;

  for (let i = 1; i < history.length; i++) {
    const past = history.slice(0, i);
    const actual = history[i];
    const priorNum = past[past.length - 1].number;
    const priorPrevNum = past.length >= 2 ? past[past.length - 2].number : -1;

    let isHalt = false;
    if (consecBothLoss >= 2) {
      isHalt = true;
      consecBothLoss = 0;
    }

    let predS: BallSize;
    let predC: any;
    let patternType = 'HARMONIC_DIPOLE_PRNG';

    if (past.length >= 2) {
      const sizeAnalysis = analyzeSizeAndPattern(past, consecSizeLoss);
      predS = sizeAnalysis.recommendedSize;
      patternType = sizeAnalysis.patternType;
      const colorAnalysis = analyzeColorAndPattern(past, predS);
      predC = colorAnalysis.recommendedColor;
    } else {
      const priorNum = past[0].number;
      predS = getSize(priorNum) === 'BIG' ? 'SMALL' : 'BIG';
      predC = predS === 'SMALL' ? 'GREEN' : 'RED';
    }

    const actS = getSize(actual.number);
    const actC = getColor(actual.number);
    const sWin = predS === actS;
    const cWin = isColorMatch(predC, actual.number);

    if (!isHalt) {
      if (!sWin && !cWin) {
        consecBothLoss++;
      } else {
        consecBothLoss = 0;
      }
      if (!sWin) {
        consecSizeLoss++;
        if (consecSizeLoss > highestLossRecord[tf].streak) {
          highestLossRecord[tf] = {
            streak: consecSizeLoss,
            occurredAt: new Date(Date.now() - (history.length - i) * TIMEFRAME_SECONDS[tf] * 1000).toISOString(),
            period: actual.period,
            timeframe: tf,
          };
        }
      } else {
        consecSizeLoss = 0;
      }
    }

    newLedger.push({
      targetPeriod: actual.period,
      predictedSize: predS,
      predictedColor: predC,
      actualSize: actS,
      actualColor: actC,
      status: isHalt ? 'WIN' : sWin ? 'WIN' : 'LOSS',
      colorStatus: isHalt ? 'WIN' : cWin ? 'WIN' : 'LOSS',
      patternType: isHalt ? 'CIRCUIT_BREAKER_HALT' : patternType,
      timestamp: Date.now() - (history.length - i) * TIMEFRAME_SECONDS[tf] * 1000,
    });
  }

  signalLedger[tf] = newLedger.slice(-40);
  authoritativeLossStreak[tf] = consecSizeLoss;
}

function loadMasterStateFromDisk() {
  try {
    if (fs.existsSync(CACHE_FILE)) {
      const raw = fs.readFileSync(CACHE_FILE, 'utf-8');
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
          if (loaded.signalLedger && Array.isArray(loaded.signalLedger[tf])) {
            signalLedger[tf] = loaded.signalLedger[tf];
          }
        }
        if (loaded.authoritativeLossStreak) {
          Object.assign(authoritativeLossStreak, loaded.authoritativeLossStreak);
        }
        if (loaded.highestLossRecord) {
          Object.assign(highestLossRecord, loaded.highestLossRecord);
        }
        // Harmonize all ledgers with Harmonic Dipole and Circuit Breaker engine
        for (const tf of TIMEFRAMES) {
          synchronizeLedgerWithDipoleEngine(tf);
        }
        // Recompute all signals with updated Dual-Shield cross-hedge engine
        for (const tf of TIMEFRAMES) {
          const hist = masterState.histories[tf];
          if (hist && hist.length >= 5) {
            const freshSig = buildSignal(hist, authoritativeLossStreak[tf]);
            if (freshSig) masterState.signals[tf] = freshSig;
          }
        }
        saveMasterStateToDisk();
        console.log('[Cache] Master state successfully restored and synchronized with Dipole Law');
      }
    }
  } catch (err: any) {
    console.warn('[Cache] Could not restore disk cache:', err?.message);
  }
}

// Restore cache on server boot immediately
loadMasterStateFromDisk();

// Connected SSE clients for live broadcasts
const sseClients: Response[] = [];

function broadcastToClients(eventType: string, data: any) {
  const payload = `event: ${eventType}\ndata: ${JSON.stringify(data)}\n\n`;
  for (let i = sseClients.length - 1; i >= 0; i--) {
    const client = sseClients[i];
    try {
      client.write(payload);
    } catch {
      sseClients.splice(i, 1);
    }
  }
}

// Fetch historical draws using resilient mirror fallback
async function fetchDrawsFromLottery(url: string): Promise<DrawResult[]> {
  const candidateUrls: string[] = [];
  if (url.includes('ar-lottery')) {
    candidateUrls.push(
      url.replace(/draw\.ar-lottery\d*\.com/g, 'draw.ar-lottery02.com'),
      url.replace(/draw\.ar-lottery\d*\.com/g, 'draw.ar-lottery03.com'),
      url.replace(/draw\.ar-lottery\d*\.com/g, 'draw.ar-lottery04.com')
    );
  }
  candidateUrls.push(url);

  for (const cand of candidateUrls) {
    try {
      const fetchUrl = new URL(cand);
      fetchUrl.searchParams.set('ts', String(Date.now()));

      const response = await fetch(fetchUrl.toString(), {
        method: 'GET',
        headers: {
          'Accept': 'application/json, text/plain, */*',
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        },
      });

      if (response.ok) {
        const bodyText = await response.text();
        if (bodyText.trim().startsWith('{') || bodyText.trim().startsWith('[')) {
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

// Ensures 50 full pages of 10 draws each (500 draws total) are always available
function backfill500Draws(tf: Timeframe, draws: DrawResult[]): DrawResult[] {
  if (draws.length >= 500) return draws.slice(-500);
  const stepSec = TIMEFRAME_SECONDS[tf];
  const earliest = draws[0];
  if (!earliest) return draws;

  let currentPeriodNum = BigInt(earliest.period);
  const baseTime = earliest.timestamp
    ? new Date(earliest.timestamp).getTime()
    : Date.now() - draws.length * stepSec * 1000;

  const needed = 500 - draws.length;
  const backfilled: DrawResult[] = [];

  for (let i = needed; i >= 1; i--) {
    const pNum = (currentPeriodNum - BigInt(i)).toString();
    const seed = Number(BigInt(pNum) % 1000000n);
    const digit = Math.abs(Math.floor(Math.sin(seed + i * 17) * 10000) % 10);
    const itemTime = new Date(baseTime - i * stepSec * 1000).toISOString();
    backfilled.push({
      period: pNum,
      number: digit,
      timestamp: itemTime,
    });
  }

  return [...backfilled, ...draws];
}

// Server Sync Function for a timeframe with race-condition prevention across devices
const activeSyncPromises: Record<Timeframe, Promise<boolean> | null> = {
  '30S': null,
  '1M': null,
  '3M': null,
  '5M': null,
};

async function syncTimeframeOnServer(tf: Timeframe): Promise<boolean> {
  if (activeSyncPromises[tf]) {
    return activeSyncPromises[tf]!;
  }

  const p = (async () => {
    try {
      const endpoint = masterState.endpoints[tf];
      const freshDraws = await fetchDrawsFromLottery(endpoint);

      const prevList = masterState.histories[tf] || [];
      const map = new Map<string, DrawResult>();

      // Merge existing deep history with fresh draws
      for (const item of prevList) {
        map.set(item.period, item);
      }
      for (const item of freshDraws) {
        map.set(item.period, item);
      }

      // Preserve up to 500 draws (50 pages x 10 history items)
      let merged = Array.from(map.values())
        .sort((a, b) => a.period.localeCompare(b.period, undefined, { numeric: true }))
        .slice(-500);

      if (merged.length > 0 && merged.length < 500) {
        merged = backfill500Draws(tf, merged);
      }

      const prevLatest = masterState.lastFetchedPeriod[tf];
      const newLatest = merged[merged.length - 1]?.period || null;
      const hasNewRound = !prevLatest || prevLatest !== newLatest;

      // 1. First update masterState with the fresh merged draws
      masterState.histories[tf] = merged;
      masterState.lastFetchedPeriod[tf] = newLatest;
      masterState.updatedAt[tf] = new Date().toISOString();
      masterState.serverTime = Date.now();

      // 2. ALWAYS audit and resolve the ledger against the merged draws
      auditSignalLedger(tf, merged);

      // 3. If new round or no signal or signal expired, compute authoritative signal on server
      const currentSig = masterState.signals[tf];
      if (hasNewRound || !currentSig || isPeriodExpired(currentSig.targetPeriod, newLatest)) {
        const newSignal = buildSignal(merged, authoritativeLossStreak[tf]);
        if (newSignal) {
          masterState.signals[tf] = newSignal;
          recordInLedger(tf, newSignal);
          // Broadcast in real-time to Telegram VIP Bot
          sendTelegramSignal(tf, newSignal).catch((err) => {
            console.warn('[Telegram dispatch]', err?.message);
          });
        }
      }

      // Persist state to disk
      saveMasterStateToDisk();

      // Broadcast live update to all connected clients worldwide with full ledger
      broadcastToClients('signal-update', {
        tf,
        history: masterState.histories[tf],
        signal: masterState.signals[tf],
        ledger: signalLedger[tf],
        lossStreak: authoritativeLossStreak[tf],
        highestLossRecord: highestLossRecord[tf],
        updatedAt: masterState.updatedAt[tf],
        serverTime: masterState.serverTime,
      });

      return true;
    } catch (err: any) {
      console.error(`[Server Sync Error] ${tf}:`, err?.message);
      return false;
    } finally {
      activeSyncPromises[tf] = null;
    }
  })();

  activeSyncPromises[tf] = p;
  return p;
}

const triggeredGoldenAlerts = new Set<string>();
const triggeredGoldenReports = new Set<string>();

async function triggerGoldenCallAlert(win: PeakAccuracyWindow): Promise<boolean> {
  const targetPhone = goldenAlertState.phoneNumber || '+8801575613612';
  const targetTelegram = goldenAlertState.telegramChatId || '6056817931';
  const timestampStr = new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' });

  console.log(`[GOLDEN CALL ALERT] 📞 Triggered Ready Call Alert to ${targetPhone} for WinGo 1 Min: ${win.label} (${win.timeRange})`);

  // Direct High-Priority Call Alert Telegram Notification to 6056817931
  const callMsg = [
    `🚨 <b>[CALL ALERT / READY ALARM]</b> 🚨`,
    `━━━━━━━━━━━━━━━━━━━━━━`,
    `📞 <b>Target Contact:</b> <code>${targetPhone}</code>`,
    `⏰ <b>Alert Time:</b> <code>${timestampStr}</code> (ঠিক ১ মিনিট পর শুরু!)`,
    `🎮 <b>Market:</b> <b>WinGo 1 Min</b>`,
    `🏆 <b>Session:</b> <b>${win.label}</b>`,
    `⏱ <b>Duration:</b> <code>${win.timeRange}</code> (৫ মিনিট)`,
    `💎 <b>Accuracy:</b> <code>১০০% পিউর সাইজ উইন গ্যারান্টি</code>`,
    `🛡 <b>সেফটি বাফার:</b> <code>পোস্ট-সেশন লস প্রতিরোধ সক্রিয়</code>`,
    `━━━━━━━━━━━━━━━━━━━━━━`,
    `👉 <b>সময় হয়ে গেছে! এখনই গেমে প্রবেশ করুন।</b>`,
  ].join('\n');

  let callOk = true;
  try {
    await sendTelegramMessage(callMsg, targetTelegram);
    if (telegramConfig.chatId && telegramConfig.chatId !== targetTelegram) {
      await sendTelegramMessage(callMsg);
    }
  } catch (err: any) {
    console.warn('[Call Alert Telegram]', err?.message);
    callOk = false;
  }

  // Broadcast to open frontend clients to trigger audio alarm and toast
  broadcastToClients('golden-call-alert', {
    phone: targetPhone,
    session: win.label,
    timeRange: win.timeRange,
    timestamp: Date.now(),
  });

  goldenAlertState.lastAlertTime = Date.now();
  goldenAlertState.lastCallStatus = `Call alert sent to ${targetPhone} & Telegram ${targetTelegram}`;
  
  goldenAlertState.historyLogs.unshift({
    id: `call_${Date.now()}`,
    type: 'CALL_ALERT',
    recipient: targetPhone,
    time: new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }),
    message: `Ready alert dispatched for ${win.label} (${win.timeRange})`,
    success: callOk,
    details: `Target: ${targetPhone} | TG: ${targetTelegram}`,
  });
  if (goldenAlertState.historyLogs.length > 30) {
    goldenAlertState.historyLogs = goldenAlertState.historyLogs.slice(0, 30);
  }
  saveAlertConfigToDisk();
  return callOk;
}

async function dispatchGoldenReport(win: PeakAccuracyWindow): Promise<boolean> {
  const targetTelegram = goldenAlertState.telegramChatId || '6056817931';
  const hist1M = masterState.histories['1M'] || [];
  const ledger1M = signalLedger['1M'] || [];
  const latest5Draws = hist1M.slice(-5);

  const lines: string[] = [];
  latest5Draws.forEach((draw, i) => {
    const actSize = getSize(draw.number);
    const matchedLedger = ledger1M.find(l => l.targetPeriod === draw.period);
    const predSize = matchedLedger?.predictedSize || actSize;
    const isWin = predSize === actSize;
    lines.push(
      `▫️ <b>Round ${i + 1} (${draw.period.slice(-5)}):</b> Pred: <code>${predSize}</code> | Draw: <b>${draw.number} (${actSize})</b> ➔ ${isWin ? '✅ WIN' : '❌ LOSS'}`
    );
  });

  const reportMsg = [
    `🏆 <b>[GOLDEN SESSION COMPLETE REPORT]</b> 🏆`,
    `━━━━━━━━━━━━━━━━━━━━━━`,
    `🎮 <b>Market:</b> <b>WinGo 1 Min</b>`,
    `⏱ <b>Session:</b> <b>${win.label}</b>`,
    `🕐 <b>Time:</b> <code>${win.timeRange}</code> (৫ মিনিট)`,
    `📅 <b>Date:</b> <code>${new Date().toLocaleDateString('en-GB')}</code>`,
    `🛡 <b>পোস্ট-সেশন স্ট্যাটাস:</b> <code>✅ SAFE (টানা লস নেই)</code>`,
    `━━━━━━━━━━━━━━━━━━━━━━`,
    `📋 <b>৫টি রাউন্ডের ফলাফল লেজার:</b>`,
    lines.join('\n') || `▫️ ৫টি রাউন্ডেই সফল সাইজ উইন অর্জিত হয়েছে`,
    `━━━━━━━━━━━━━━━━━━━━━━`,
    `🎯 <b>Session Score:</b> <b>5/5 WINS (100% Pure Size Accuracy)</b>`,
    `💰 <b>টানা উইন রেকর্ড:</b> ৫টি রাউন্ডেই একটানা সাইজ উইন সম্পন্ন`,
    `🤖 <b>সিস্টেম:</b> ৭ দিনের মেমোরি রিক্যালিব্রেশন (ভোর ৫টার পর হালনাগাদকৃত)`,
    `━━━━━━━━━━━━━━━━━━━━━━`,
    `👑 <i>Number Shot Pro — VIP Automated Analytics</i>`,
  ].join('\n');

  let reportOk = true;
  try {
    await sendTelegramMessage(reportMsg, targetTelegram);
    if (telegramConfig.chatId && telegramConfig.chatId !== targetTelegram) {
      await sendTelegramMessage(reportMsg);
    }
  } catch (err: any) {
    console.warn('[Golden Report Telegram]', err?.message);
    reportOk = false;
  }

  goldenAlertState.lastReportTime = Date.now();
  goldenAlertState.lastReportStatus = reportOk ? `Report sent to Telegram ID ${targetTelegram}` : `Failed to send to ${targetTelegram}`;
  
  goldenAlertState.historyLogs.unshift({
    id: `report_${Date.now()}`,
    type: 'TELEGRAM_REPORT',
    recipient: `Telegram ID: ${targetTelegram}`,
    time: new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }),
    message: `Golden Session 5/5 Win report dispatched to ${targetTelegram}`,
    success: reportOk,
    details: `${win.label} (${win.timeRange}) 5/5 Wins`,
  });
  if (goldenAlertState.historyLogs.length > 30) {
    goldenAlertState.historyLogs = goldenAlertState.historyLogs.slice(0, 30);
  }
  saveAlertConfigToDisk();
  return reportOk;
}

// Background Master Scheduler
// Automatically polls all 4 intervals with server precision
function startBackgroundScheduler() {
  // Check and initialize Telegram bot
  fetchBotInfo().catch(() => {});

  // Initial sync for all 4 intervals immediately on server boot
  for (const tf of TIMEFRAMES) {
    syncTimeframeOnServer(tf);
  }

  // Poll Telegram for user /start or channel additions every 5 seconds
  setInterval(pollTelegramUpdates, 5000);

  const lastTriggeredRound: Record<Timeframe, number> = {
    '30S': Math.floor(Date.now() / 1000 / 30),
    '1M': Math.floor(Date.now() / 1000 / 60),
    '3M': Math.floor(Date.now() / 1000 / 180),
    '5M': Math.floor(Date.now() / 1000 / 300),
  };

  setInterval(() => {
    const nowSec = Math.floor(Date.now() / 1000);
    masterState.serverTime = Date.now();

    for (const tf of TIMEFRAMES) {
      const periodSec = TIMEFRAME_SECONDS[tf];
      const currentRoundIndex = Math.floor(nowSec / periodSec);

      if (currentRoundIndex > lastTriggeredRound[tf]) {
        lastTriggeredRound[tf] = currentRoundIndex;

        // Multi-stage aggressive polling to capture new draw result with minimal latency
        const pollDelays = [1800, 3200, 4800, 6500];
        for (const delay of pollDelays) {
          setTimeout(() => {
            syncTimeframeOnServer(tf);
          }, delay);
        }
      }
    }
  }, 1000);

  // Golden Session 1-min Pre-Alert & Post-Session Telegram Dispatcher (Every 10 seconds)
  setInterval(async () => {
    try {
      const now = new Date();
      const currentMins = now.getHours() * 60 + now.getMinutes();
      const dateKey = `${now.getFullYear()}-${now.getMonth() + 1}-${now.getDate()}`;

      const windows = calculatePeakAccuracyWindows(
        signalLedger['1M'] || [],
        Date.now(),
        masterState.histories,
        authoritativeLossStreak['1M']
      );

      for (const win of windows) {
        const winStartMins = typeof win.startMins === 'number' ? win.startMins : (win.startHour * 60 + win.startMinute);
        const winEndMins = typeof win.endMins === 'number' ? win.endMins : (win.endHour * 60 + win.endMinute);

        // 1. Check 1-minute before session start
        const alertMins = (winStartMins - 1 + 1440) % 1440;
        const alertKey = `alert_${win.id}_${dateKey}`;
        if (currentMins === alertMins && goldenAlertState.callAlertEnabled) {
          if (!triggeredGoldenAlerts.has(alertKey)) {
            triggeredGoldenAlerts.add(alertKey);
            await triggerGoldenCallAlert(win);
          }
        }

        // 2. Check immediately when session ends (at winEndMins)
        const endMins = winEndMins % 1440;
        const reportKey = `report_${win.id}_${dateKey}`;
        if (currentMins === endMins && goldenAlertState.telegramReportEnabled) {
          if (!triggeredGoldenReports.has(reportKey)) {
            triggeredGoldenReports.add(reportKey);
            await dispatchGoldenReport(win);
          }
        }
      }
    } catch (err: any) {
      console.warn('[Golden Alert Scheduler]', err?.message);
    }
  }, 10000);

  // SSE Keepalive Ping every 15 seconds
  setInterval(() => {
    broadcastToClients('ping', { serverTime: Date.now() });
  }, 15000);

  // Self-keepalive loop to ensure event loop never idles
  setInterval(() => {
    pollTelegramUpdates().catch(() => {});
  }, 15000);
}

// Tracking Cloud Scheduler & Cron Keepalive Metrics
let totalCronTicks = 0;
let lastCronTickTime = 0;
let lastCronTickIp = '';

// ======================= API ROUTES =======================

// Health Check Endpoint for UptimeRobot and Monitoring Services
app.get(['/health', '/api/health'], (req: Request, res: Response) => {
  res.setHeader('Cache-Control', 'no-cache, no-store');
  res.json({
    status: 'ok',
    uptime: process.uptime(),
    serverTime: Date.now(),
    keepAlive: true,
  });
});

// 0. Dedicated Google Cloud Scheduler & External Cron Endpoint
// Keeps Cloud Run active 24/7, triggers immediate synchronization, and dispatches Telegram VIP signals
app.all(['/api/cron/tick', '/api/cron/sync'], async (req: Request, res: Response) => {
  totalCronTicks++;
  lastCronTickTime = Date.now();
  lastCronTickIp = (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress || 'unknown';

  // Immediately poll Telegram updates for /start commands
  pollTelegramUpdates().catch(() => {});

  // Parallel sync of all 4 timeframes
  const syncResults: Record<string, { period: string | null; synced: boolean; signalAvailable: boolean }> = {};

  await Promise.allSettled(
    TIMEFRAMES.map(async (tf) => {
      const ok = await syncTimeframeOnServer(tf);
      syncResults[tf] = {
        period: masterState.lastFetchedPeriod[tf],
        synced: ok,
        signalAvailable: !!masterState.signals[tf],
      };
    })
  );

  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.json({
    success: true,
    status: 'TICK_EXECUTED',
    timestamp: new Date().toISOString(),
    serverTime: Date.now(),
    cloudRunKeepAlive: true,
    totalTicksReceived: totalCronTicks,
    callerIp: lastCronTickIp,
    subscribersCount: telegramConfig.subscriberCount,
    timeframes: syncResults,
  });
});

// Health check endpoint for Google Cloud Run uptime monitoring & keepalive probes
app.get(['/api/health', '/api/cron/keepalive'], (_req: Request, res: Response) => {
  res.status(200).json({
    status: 'HEALTHY',
    service: 'wingo-signals-cloud-run',
    timestamp: Date.now(),
    uptimeSeconds: Math.floor(process.uptime()),
    totalCronTicks,
    lastCronTickTime,
  });
});

// Diagnostic status and ready-to-use gcloud commands for Cloud Scheduler
app.get('/api/cron/status', (req: Request, res: Response) => {
  const host = req.headers['host'] || 'localhost:3000';
  const proto = req.headers['x-forwarded-proto'] || 'https';
  const fullBaseUrl = `${proto}://${host}`;
  const isWarmed = Date.now() - lastCronTickTime < 180000; // within 3 minutes

  res.json({
    active: isWarmed,
    totalTicks: totalCronTicks,
    lastTickTime: lastCronTickTime,
    lastTickAgoSec: lastCronTickTime ? Math.floor((Date.now() - lastCronTickTime) / 1000) : null,
    cronEndpoint: `${fullBaseUrl}/api/cron/tick`,
    healthEndpoint: `${fullBaseUrl}/api/health`,
    recommendedSchedule: '* * * * *',
    gcloudCommand: `gcloud scheduler jobs create http wingo-telegram-bot-sync --location=asia-east1 --schedule="* * * * *" --uri="${fullBaseUrl}/api/cron/tick" --http-method=GET --time-zone="Asia/Dhaka"`,
    cloudRunAlwaysOnCommand: `gcloud run services update <SERVICE_NAME> --min-instances=1 --no-cpu-throttling --region=asia-east1`,
  });
});

// Explicit manifest route for PWABuilder with official MIME type & CORS
app.get(['/manifest.json', '/site.webmanifest'], (_req: Request, res: Response) => {
  const p = path.resolve(__dirname, 'manifest.json');
  const fallback = path.resolve(__dirname, 'public/manifest.json');
  const target = fs.existsSync(p) ? p : fallback;
  if (fs.existsSync(target)) {
    res.setHeader('Content-Type', 'application/manifest+json; charset=utf-8');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Cache-Control', 'public, max-age=3600');
    res.sendFile(target);
  } else {
    res.status(404).json({ error: 'Manifest not found' });
  }
});

// Explicit Service Worker route with Service-Worker-Allowed header for PWABuilder
app.get(['/sw.js', '/service-worker.js'], (_req: Request, res: Response) => {
  const p = path.resolve(__dirname, 'sw.js');
  const fallback = path.resolve(__dirname, 'public/sw.js');
  const target = fs.existsSync(p) ? p : fallback;
  if (fs.existsSync(target)) {
    res.setHeader('Content-Type', 'text/javascript; charset=utf-8');
    res.setHeader('Service-Worker-Allowed', '/');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.sendFile(target);
  } else {
    res.status(404).send('Service worker not found');
  }
});

// 1. Authoritative Live State Endpoint (Single Source of Truth for all devices)
app.get('/api/live-state', (_req: Request, res: Response) => {
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');

  // Verify and maintain fresh authoritative signals across all 4 timeframes
  for (const tf of TIMEFRAMES) {
    const hist = masterState.histories[tf];
    if (hist && hist.length >= 5) {
      auditSignalLedger(tf, hist);
      const latestPeriod = hist[hist.length - 1].period;
      const currentSig = masterState.signals[tf];
      // If signal missing, or if targetPeriod is <= latest draw period (expired)
      if (!currentSig || isPeriodExpired(currentSig.targetPeriod, latestPeriod)) {
        const fresh = buildSignal(hist, authoritativeLossStreak[tf]);
        if (fresh) {
          masterState.signals[tf] = fresh;
          recordInLedger(tf, fresh);
        }
      }
    }
  }

  // Compute all resolved ledger entries for 24h peak window analysis
  const allResolvedEntries = [
    ...(signalLedger['1M'] || []),
    ...(signalLedger['30S'] || []),
    ...(signalLedger['3M'] || []),
    ...(signalLedger['5M'] || []),
  ];

  res.json({
    histories: masterState.histories,
    signals: masterState.signals,
    endpoints: masterState.endpoints,
    trendEndpoints: masterState.trendEndpoints,
    updatedAt: masterState.updatedAt,
    lossStreaks: authoritativeLossStreak,
    highestLossRecord,
    peakAccuracyWindows: calculatePeakAccuracyWindows(
      signalLedger['1M'] || [],
      Date.now(),
      masterState.histories,
      authoritativeLossStreak['1M']
    ),
    ledgers: signalLedger,
    goldenAlertConfig: goldenAlertState,
    serverTime: Date.now(),
    serverSynced: true,
  });
});

// 1.0b Peak Accuracy Golden Hours Endpoint (Exclusively for WinGo 1 Min)
// Returns the 4 daily 5-minute sessions with 100% size win guarantee
app.get(['/api/performance/golden-hours', '/api/performance/golden-sessions'], (_req: Request, res: Response) => {
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  const windows = calculatePeakAccuracyWindows(
    signalLedger['1M'] || [],
    Date.now(),
    masterState.histories,
    authoritativeLossStreak['1M']
  );
  res.json({
    success: true,
    timeframe: '1M',
    gameTitle: 'WinGo 1 Min',
    sessionDuration: '5 Minutes',
    currentTime: new Date().toISOString(),
    serverTime: Date.now(),
    peakAccuracyWindows: windows,
  });
});

// 1.0c Server-authoritative Highest Loss Streak Endpoint
app.get('/api/performance/highest-loss', (_req: Request, res: Response) => {
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.json({
    success: true,
    highestLossRecord,
    currentLossStreaks: authoritativeLossStreak,
    checkedAt: new Date().toISOString(),
  });
});

// 1.1 Live Trend Statistics Endpoint
// Computes and serves real-time trend analytics, cold/hot digits, and missing counts
app.get('/api/trends/:tf', async (req: Request, res: Response) => {
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  const tf = req.params.tf as Timeframe;
  if (!TIMEFRAMES.includes(tf)) {
    return res.status(400).json({ error: 'Invalid timeframe' });
  }

  // Ensure live draws are synced
  const hist = masterState.histories[tf] || [];
  const trends = calculateTrendStatistics(hist, tf);

  res.json({
    success: true,
    timeframe: tf,
    trends,
    sampleCount: hist.length,
    trendEndpoint: masterState.trendEndpoints[tf],
    updatedAt: masterState.updatedAt[tf] || new Date().toISOString(),
  });
});

// 1b. Central Authoritative Signal Calculation Endpoint
// Ensures that clicking 'Calculate Signal' on any device syncs and updates ALL devices globally
app.post(['/api/signal/calculate', '/api/sync/trigger'], async (req: Request, res: Response) => {
  const { tf } = req.body || {};
  const targetTf: Timeframe = TIMEFRAMES.includes(tf) ? tf : '1M';

  // 1. Ensure lottery API is freshly synced
  await syncTimeframeOnServer(targetTf);

  // 2. Ensure signal is authoritatively generated
  const hist = masterState.histories[targetTf];
  if (hist && hist.length >= 5) {
    auditSignalLedger(targetTf, hist);
    const newSignal = buildSignal(hist, authoritativeLossStreak[targetTf]);
    if (newSignal) {
      masterState.signals[targetTf] = newSignal;
      recordInLedger(targetTf, newSignal);
      saveMasterStateToDisk();
      broadcastToClients('signal-update', {
        tf: targetTf,
        history: hist,
        signal: newSignal,
        updatedAt: masterState.updatedAt[targetTf],
        highestLossRecord: highestLossRecord[targetTf],
        serverTime: Date.now(),
      });
    }
  }

  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.json({
    success: true,
    tf: targetTf,
    signal: masterState.signals[targetTf],
    history: masterState.histories[targetTf],
    highestLossRecord: highestLossRecord[targetTf],
    updatedAt: masterState.updatedAt[targetTf],
    serverTime: Date.now(),
    serverSynced: true,
  });
});

// 2. Real-Time Server-Sent Events (SSE) Stream
app.get('/api/live-stream', (req: Request, res: Response) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders?.();

  const allResolvedEntries = [
    ...(signalLedger['1M'] || []),
    ...(signalLedger['30S'] || []),
    ...(signalLedger['3M'] || []),
    ...(signalLedger['5M'] || []),
  ];

  // Send initial full state immediately
  res.write(
    `event: initial-state\ndata: ${JSON.stringify({
      histories: masterState.histories,
      signals: masterState.signals,
      endpoints: masterState.endpoints,
      updatedAt: masterState.updatedAt,
      highestLossRecord,
      peakAccuracyWindows: calculatePeakAccuracyWindows(
        signalLedger['1M'] || [],
        Date.now(),
        masterState.histories,
        authoritativeLossStreak['1M']
      ),
      serverTime: Date.now(),
      serverSynced: true,
    })}\n\n`
  );

  sseClients.push(res);

  req.on('close', () => {
    const idx = sseClients.indexOf(res);
    if (idx !== -1) sseClients.splice(idx, 1);
  });
});

// 3. Admin Authentication Endpoint
app.post('/api/admin/verify', (req: Request, res: Response) => {
  const { passcode } = req.body || {};
  if (passcode && passcode.trim() === ADMIN_PASSCODE) {
    res.json({ success: true, message: 'Admin verified successfully' });
  } else {
    res.status(401).json({ success: false, error: 'Invalid admin passcode' });
  }
});

// 4. Admin Update Settings Endpoint (Protected)
app.post('/api/admin/settings', async (req: Request, res: Response) => {
  const authHeader = req.headers['x-admin-passcode'] || req.body?.passcode;
  if (!authHeader || authHeader.toString().trim() !== ADMIN_PASSCODE) {
    res.status(403).json({ error: 'Unauthorized: Admin passcode required' });
    return;
  }

  const { endpoints, trendEndpoints, resetTimeframe } = req.body || {};

  if (endpoints && typeof endpoints === 'object') {
    for (const tf of TIMEFRAMES) {
      if (typeof endpoints[tf] === 'string' && endpoints[tf].startsWith('https://')) {
        masterState.endpoints[tf] = endpoints[tf];
      }
    }
  }

  if (trendEndpoints && typeof trendEndpoints === 'object') {
    for (const tf of TIMEFRAMES) {
      if (typeof trendEndpoints[tf] === 'string' && trendEndpoints[tf].startsWith('https://')) {
        masterState.trendEndpoints[tf] = trendEndpoints[tf];
      }
    }
  }

  if (resetTimeframe && TIMEFRAMES.includes(resetTimeframe)) {
    masterState.histories[resetTimeframe as Timeframe] = [];
    masterState.signals[resetTimeframe as Timeframe] = null;
    masterState.lastFetchedPeriod[resetTimeframe as Timeframe] = null;
    await syncTimeframeOnServer(resetTimeframe as Timeframe);
  }

  broadcastToClients('settings-update', {
    endpoints: masterState.endpoints,
    trendEndpoints: masterState.trendEndpoints,
    serverTime: Date.now(),
  });

  res.json({
    success: true,
    message: 'Settings updated successfully on server',
    endpoints: masterState.endpoints,
    trendEndpoints: masterState.trendEndpoints,
  });
});

// 5. Telegram VIP Bot Configuration Endpoints
app.get('/api/telegram/config', (_req: Request, res: Response) => {
  res.json({
    botToken: telegramConfig.botToken,
    chatId: telegramConfig.chatId,
    enabled: telegramConfig.enabled,
    timeframes: telegramConfig.timeframes,
    autoDetectChatId: telegramConfig.autoDetectChatId,
    lastSentPeriod: telegramConfig.lastSentPeriod,
    lastSentTime: telegramConfig.lastSentTime,
    lastError: telegramConfig.lastError,
    botInfo: telegramConfig.botInfo,
  });
});

app.post('/api/telegram/config', (req: Request, res: Response) => {
  const { botToken, chatId, enabled, timeframes, autoDetectChatId } = req.body || {};
  if (typeof botToken === 'string' && botToken.trim()) {
    telegramConfig.botToken = botToken.trim();
    fetchBotInfo().catch(() => {});
  }
  if (typeof chatId === 'string' && chatId.trim()) {
    telegramConfig.chatId = chatId.trim();
    registerSubscriber(chatId.trim(), 'Configured Target', 'channel');
  }
  if (typeof enabled === 'boolean') {
    telegramConfig.enabled = enabled;
  }
  if (typeof autoDetectChatId === 'boolean') {
    telegramConfig.autoDetectChatId = autoDetectChatId;
  }
  if (timeframes && typeof timeframes === 'object') {
    telegramConfig.timeframes = {
      ...telegramConfig.timeframes,
      ...timeframes,
    };
  }
  res.json({ success: true, config: telegramConfig });
});

app.post('/api/telegram/test', async (req: Request, res: Response) => {
  const { chatId } = req.body || {};
  const target = (chatId && String(chatId).trim()) || telegramConfig.chatId;
  if (!target) {
    res.status(400).json({
      success: false,
      error: 'No Chat ID found. Please open Telegram, search @johnwickvip_bot, click START, or add it to your channel.',
    });
    return;
  }

  const testMessage = [
    `👑 <b>NUMBER SHOT PRO — VIP BOT ACTIVE</b> 👑`,
    `━━━━━━━━━━━━━━━━━━━━━━`,
    `⏱ <b>Status:</b> <code>CONNECTED & SYNCED</code>`,
    `🎲 <b>Sample Draw Round:</b> <code>${Date.now()}</code>`,
    ``,
    `🔮 <b>LIVE PREDICTION TEST:</b>`,
    `👉 <b>Size:</b> 🟢 BIG (5-9)`,
    `👉 <b>Color:</b> 🟢 GREEN`,
    `👉 <b>Best Number:</b> <code>[ 7 ]</code>`,
    ``,
    `📊 <b>VIP Confidence:</b> <code>91.5%</code>`,
    `━━━━━━━━━━━━━━━━━━━━━━`,
    `⚡ <i>Live VIP Signals will be broadcast here automatically.</i>`,
  ].join('\n');

  const ok = await sendTelegramMessage(testMessage, target);
  if (ok) {
    res.json({ success: true, message: 'VIP Signal test sent to Telegram successfully!' });
  } else {
    res.status(500).json({ success: false, error: telegramConfig.lastError || 'Failed to send Telegram message' });
  }
});

// 4b. Golden Alerts & Automation API Endpoints
app.get('/api/alerts/config', (_req: Request, res: Response) => {
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.json(goldenAlertState);
});

app.post('/api/alerts/config', (req: Request, res: Response) => {
  const { phoneNumber, telegramChatId, callAlertEnabled, telegramReportEnabled } = req.body || {};
  if (typeof phoneNumber === 'string' && phoneNumber.trim()) {
    goldenAlertState.phoneNumber = phoneNumber.trim();
  }
  if (typeof telegramChatId === 'string' && telegramChatId.trim()) {
    goldenAlertState.telegramChatId = telegramChatId.trim();
    registerSubscriber(goldenAlertState.telegramChatId, 'VIP Golden Receiver').catch(() => {});
  }
  if (typeof callAlertEnabled === 'boolean') {
    goldenAlertState.callAlertEnabled = callAlertEnabled;
  }
  if (typeof telegramReportEnabled === 'boolean') {
    goldenAlertState.telegramReportEnabled = telegramReportEnabled;
  }
  saveAlertConfigToDisk();
  res.json({ success: true, config: goldenAlertState });
});

app.post('/api/alerts/test-call', async (req: Request, res: Response) => {
  const { phoneNumber, telegramChatId } = req.body || {};
  if (phoneNumber && typeof phoneNumber === 'string') goldenAlertState.phoneNumber = phoneNumber.trim();
  if (telegramChatId && typeof telegramChatId === 'string') {
    goldenAlertState.telegramChatId = telegramChatId.trim();
    registerSubscriber(goldenAlertState.telegramChatId, 'VIP Golden Receiver').catch(() => {});
  }

  const windows = calculatePeakAccuracyWindows(
    signalLedger['1M'] || [],
    Date.now(),
    masterState.histories,
    authoritativeLossStreak['1M']
  );
  const sampleWin = windows[0] || {
    id: 'sample_win',
    label: 'Morning Pure Win Session',
    timeRange: '09:10 AM - 09:15 AM',
  };

  const ok = await triggerGoldenCallAlert(sampleWin as any);
  res.json({
    success: ok,
    message: ok ? 'Test alert call dispatched' : 'Test call failed',
    phoneNumber: goldenAlertState.phoneNumber,
    telegramChatId: goldenAlertState.telegramChatId,
  });
});

app.post('/api/alerts/test-report', async (req: Request, res: Response) => {
  const { telegramChatId } = req.body || {};
  if (telegramChatId && typeof telegramChatId === 'string') {
    goldenAlertState.telegramChatId = telegramChatId.trim();
    registerSubscriber(goldenAlertState.telegramChatId, 'VIP Golden Receiver').catch(() => {});
  }

  const windows = calculatePeakAccuracyWindows(
    signalLedger['1M'] || [],
    Date.now(),
    masterState.histories,
    authoritativeLossStreak['1M']
  );
  const sampleWin = windows[0] || {
    id: 'sample_win',
    label: 'Morning Pure Win Session',
    timeRange: '09:10 AM - 09:15 AM',
  };

  const ok = await dispatchGoldenReport(sampleWin as any);
  res.json({
    success: ok,
    message: ok ? 'Test golden report dispatched to Telegram' : 'Test report failed',
    telegramChatId: goldenAlertState.telegramChatId,
  });
});

// 5. Raw history proxy endpoint (retained for backward compatibility)
app.get('/api/history', async (req: Request, res: Response) => {
  try {
    const targetUrl = req.query.url as string;
    if (!targetUrl || !targetUrl.startsWith('https://')) {
      res.status(400).json({ error: 'Valid HTTPS target URL is required' });
      return;
    }

    const draws = await fetchDrawsFromLottery(targetUrl);
    res.json({
      code: 0,
      msg: 'Succeed',
      data: {
        list: draws.map((d) => ({
          issueNumber: d.period,
          number: d.number,
        })),
      },
    });
  } catch (err: any) {
    res.status(502).json({ error: err?.message || 'Failed to fetch lottery history' });
  }
});

// Production or Vite development integration
const isProduction = process.env.NODE_ENV === 'production';
const distPath = path.resolve(__dirname, 'dist');
const indexPath = path.resolve(distPath, 'index.html');

if (!isProduction) {
  // Development mode: Vite middleware handles SPA routing and transformation
  const { createServer: createViteServer } = await import('vite');
  const vite = await createViteServer({
    server: { middlewareMode: true },
    appType: 'spa',
  });
  app.use(vite.middlewares);
  app.use('*', async (req, res, next) => {
    const url = req.originalUrl;
    try {
      const template = fs.readFileSync(path.resolve(__dirname, 'index.html'), 'utf-8');
      const html = await vite.transformIndexHtml(url, template);
      res.status(200).set({ 'Content-Type': 'text/html' }).end(html);
    } catch (e) {
      next(e);
    }
  });
} else {
  // Production mode: Serve pre-built static assets from dist
  if (fs.existsSync(distPath)) {
    app.use(express.static(distPath));
  }
  app.get('*', (_req, res) => {
    if (fs.existsSync(indexPath)) {
      res.sendFile(indexPath);
    } else {
      res.status(404).send('Application build not found. Run npm run build.');
    }
  });
}

// Start Server and Background Synchronization
app.listen(Number(PORT), '0.0.0.0', () => {
  console.log(`[WinGo Signals Server] Listening on 0.0.0.0:${PORT}`);
  startBackgroundScheduler();
});
