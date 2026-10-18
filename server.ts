import express, { Request, Response } from 'express';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { Timeframe, DrawResult, Signal, BallSize } from './src/types';
import {
  DEFAULT_ENDPOINTS,
  TIMEFRAMES,
  TIMEFRAME_SECONDS,
  buildSignal,
  parseHistoryPayload,
  getSize,
  isPeriodExpired,
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

function recordInLedger(tf: Timeframe, signal: Signal) {
  const ledger = signalLedger[tf];
  const existing = ledger.find((item) => item.targetPeriod === signal.targetPeriod);
  if (existing) {
    if (existing.status === 'PENDING') {
      existing.predictedSize = signal.size;
      existing.patternType = signal.patternType;
    }
  } else {
    ledger.push({
      targetPeriod: signal.targetPeriod,
      predictedSize: signal.size,
      status: 'PENDING',
      patternType: signal.patternType,
      timestamp: Date.now(),
    });
  }
  if (ledger.length > 40) {
    signalLedger[tf] = ledger.slice(-40);
  }
}

function auditSignalLedger(tf: Timeframe, draws: DrawResult[]): number {
  const ledger = signalLedger[tf];
  if (!ledger || ledger.length === 0 || !draws || draws.length === 0) {
    return authoritativeLossStreak[tf];
  }

  const drawMap = new Map<string, DrawResult>();
  for (const d of draws) {
    drawMap.set(d.period, d);
  }

  for (const item of ledger) {
    if (item.status === 'PENDING') {
      const matched = drawMap.get(item.targetPeriod);
      if (matched) {
        item.actualSize = getSize(matched.number);
        item.status = item.predictedSize === item.actualSize ? 'WIN' : 'LOSS';
        console.log(`[Ledger Audit] ${tf} Period ${item.targetPeriod}: ${item.status === 'WIN' ? 'WIN ✅' : 'LOSS ❌'} (Predicted ${item.predictedSize}, Actual ${item.actualSize}, Pattern: ${item.patternType || 'NONE'})`);
      }
    }
  }

  // Calculate authoritative consecutive loss streak strictly from resolved items
  const resolved = ledger.filter((x) => x.status === 'WIN' || x.status === 'LOSS');
  let currentLossStreak = 0;
  for (let i = resolved.length - 1; i >= 0; i--) {
    if (resolved[i].status === 'LOSS') {
      currentLossStreak++;
    } else {
      break;
    }
  }
  if (resolved.length > 0) {
    authoritativeLossStreak[tf] = currentLossStreak;
  }
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
      savedAt: Date.now(),
    };
    fs.writeFileSync(CACHE_FILE, JSON.stringify(dataToSave), 'utf-8');
  } catch (err: any) {
    // Non-fatal if /tmp write is restricted
  }
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
        console.log('[Cache] Master state successfully restored from disk cache');
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

      // Preserve up to 36 draws in server memory for deep human-brain pattern recognition
      // (UI cleanly renders latest 16 in HistoryTimeline)
      const merged = Array.from(map.values())
        .sort((a, b) => a.period.localeCompare(b.period, undefined, { numeric: true }))
        .slice(-36);

      const prevLatest = masterState.lastFetchedPeriod[tf];
      const newLatest = merged[merged.length - 1]?.period || null;
      const hasNewRound = !prevLatest || prevLatest !== newLatest;

      // 1. Authoritative resolution of previous target periods with actual draws
      auditSignalLedger(tf, merged);

      masterState.histories[tf] = merged;
      masterState.lastFetchedPeriod[tf] = newLatest;
      masterState.updatedAt[tf] = new Date().toISOString();
      masterState.serverTime = Date.now();

      // If new round or no signal or signal expired, compute authoritative signal on server
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

      // Broadcast live update to all connected clients worldwide
      broadcastToClients('signal-update', {
        tf,
        history: masterState.histories[tf],
        signal: masterState.signals[tf],
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

  res.json({
    histories: masterState.histories,
    signals: masterState.signals,
    endpoints: masterState.endpoints,
    updatedAt: masterState.updatedAt,
    lossStreaks: authoritativeLossStreak,
    ledgers: signalLedger,
    serverTime: Date.now(),
    serverSynced: true,
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

  // Send initial full state immediately
  res.write(
    `event: initial-state\ndata: ${JSON.stringify({
      histories: masterState.histories,
      signals: masterState.signals,
      endpoints: masterState.endpoints,
      updatedAt: masterState.updatedAt,
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

  const { endpoints, resetTimeframe } = req.body || {};

  if (endpoints && typeof endpoints === 'object') {
    for (const tf of TIMEFRAMES) {
      if (typeof endpoints[tf] === 'string' && endpoints[tf].startsWith('https://')) {
        masterState.endpoints[tf] = endpoints[tf];
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
    serverTime: Date.now(),
  });

  res.json({
    success: true,
    message: 'Settings updated successfully on server',
    endpoints: masterState.endpoints,
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
