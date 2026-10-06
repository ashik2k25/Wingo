import express, { Request, Response } from 'express';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { Timeframe, DrawResult, Signal } from './src/types';
import {
  DEFAULT_ENDPOINTS,
  TIMEFRAMES,
  TIMEFRAME_SECONDS,
  buildSignal,
  parseHistoryPayload,
} from './src/utils/engine';

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

// Server Sync Function for a timeframe
let isSyncing: Record<Timeframe, boolean> = {
  '30S': false,
  '1M': false,
  '3M': false,
  '5M': false,
};

async function syncTimeframeOnServer(tf: Timeframe): Promise<boolean> {
  if (isSyncing[tf]) return false;
  isSyncing[tf] = true;

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

    // Match the exact Oct 4, 1:14AM version:
    // Strictly preserve the active table's newest draws (up to 16 for display, strictly 10 for prediction)
    const merged = Array.from(map.values())
      .sort((a, b) => a.period.localeCompare(b.period, undefined, { numeric: true }))
      .slice(-16);

    const prevLatest = masterState.lastFetchedPeriod[tf];
    const newLatest = merged[merged.length - 1]?.period || null;
    const hasNewRound = !prevLatest || prevLatest !== newLatest;

    masterState.histories[tf] = merged;
    masterState.lastFetchedPeriod[tf] = newLatest;
    masterState.updatedAt[tf] = new Date().toISOString();
    masterState.serverTime = Date.now();

    // If new round or no signal, compute authoritative signal on server
    if (hasNewRound || !masterState.signals[tf]) {
      const newSignal = buildSignal(merged);
      if (newSignal) {
        masterState.signals[tf] = newSignal;
      }
    }

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
    isSyncing[tf] = false;
  }
}

// Background Master Scheduler
// Automatically polls all 4 intervals with server precision
function startBackgroundScheduler() {
  // Initial sync for all 4 intervals immediately on server boot
  for (const tf of TIMEFRAMES) {
    syncTimeframeOnServer(tf);
  }

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

        // Allow upstream lottery server 2.5 seconds to compute and publish draw
        setTimeout(() => {
          syncTimeframeOnServer(tf);
        }, 2500);

        // Secondary fallback sync at 6 seconds to ensure no draw was missed
        setTimeout(() => {
          syncTimeframeOnServer(tf);
        }, 6500);
      }
    }
  }, 1000);

  // SSE Keepalive Ping every 15 seconds
  setInterval(() => {
    broadcastToClients('ping', { serverTime: Date.now() });
  }, 15000);
}

// ======================= API ROUTES =======================

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
  res.json({
    histories: masterState.histories,
    signals: masterState.signals,
    endpoints: masterState.endpoints,
    updatedAt: masterState.updatedAt,
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
