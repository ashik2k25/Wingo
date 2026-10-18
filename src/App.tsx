/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Timeframe, AppState, Signal, DrawResult, SignalLedgerEntry } from './types';
import {
  TIMEFRAMES,
  TIMEFRAME_LABELS,
  TIMEFRAME_SECONDS,
  DEFAULT_ENDPOINTS,
  buildSignal,
  nextPeriod,
} from './utils/engine';
import { setSoundEnabled, isSoundEnabled } from './utils/audio';
import { SignalCard } from './components/SignalCard';
import { HistoryTimeline } from './components/HistoryTimeline';
import { WalkForwardCheck } from './components/WalkForwardCheck';
import { LiveDrawTicker } from './components/LiveDrawTicker';
import { SettingsModal } from './components/SettingsModal';
import { FloatingOverlay } from './components/FloatingOverlay';
import { DownloadModal } from './components/DownloadModal';
import { AntiDetectionModal } from './components/AntiDetectionModal';
import {
  Activity,
  Sliders,
  RefreshCw,
  Radio,
  Shield,
  ShieldCheck,
  Volume2,
  VolumeX,
  Layers,
  Sparkles,
  Download,
  Lock,
  Unlock,
  CheckCircle2,
} from 'lucide-react';

const STORAGE_KEY = 'wingo-signals-state-v1';

const createEmptyHistories = (): Record<Timeframe, DrawResult[]> => ({
  '30S': [],
  '1M': [],
  '3M': [],
  '5M': [],
});

const createEmptyModes = (): Record<Timeframe, 'api'> => ({
  '30S': 'api',
  '1M': 'api',
  '3M': 'api',
  '5M': 'api',
});

const createEmptyManual = (): Record<Timeframe, string> => ({
  '30S': '',
  '1M': '',
  '3M': '',
  '5M': '',
});

const initialAppState: AppState = {
  endpoints: { ...DEFAULT_ENDPOINTS },
  histories: createEmptyHistories(),
  sourceModes: createEmptyModes(),
  manualTexts: createEmptyManual(),
  updatedAt: {
    '30S': null,
    '1M': null,
    '3M': null,
    '5M': null,
  },
  liveSyncEnabled: true,
  liveSyncInterval: 30,
};

export default function App() {
  const [appState, setAppState] = useState<AppState>(initialAppState);
  const [activeTimeframe, setActiveTimeframe] = useState<Timeframe>('1M');
  const [signals, setSignals] = useState<Partial<Record<Timeframe, Signal>>>({});
  const [isFetching, setIsFetching] = useState<Partial<Record<Timeframe, boolean>>>({});
  const [errors, setErrors] = useState<Partial<Record<Timeframe, string>>>({});
  const [infoMessage, setInfoMessage] = useState<string>('');
  const [isPanelVisible, setIsPanelVisible] = useState<boolean>(true);
  const [isSettingsOpen, setIsSettingsOpen] = useState<boolean>(false);
  const [isOverlayOpen, setIsOverlayOpen] = useState<boolean>(false);
  const [isDownloadOpen, setIsDownloadOpen] = useState<boolean>(false);
  const [isShieldOpen, setIsShieldOpen] = useState<boolean>(false);
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [soundOn, setSoundOn] = useState<boolean>(true);
  const [isLoaded, setIsLoaded] = useState<boolean>(false);

  // Server-Authoritative Global Synchronization
  const [serverSynced, setServerSynced] = useState<boolean>(false);
  const [serverTimeOffset, setServerTimeOffset] = useState<number>(0);
  const [ledgers, setLedgers] = useState<Record<Timeframe, SignalLedgerEntry[]>>({
    '30S': [],
    '1M': [],
    '3M': [],
    '5M': [],
  });
  const [isAdmin, setIsAdmin] = useState<boolean>(() => {
    return typeof window !== 'undefined' && sessionStorage.getItem('wingo_admin_auth') === 'true';
  });
  const [adminPasscode, setAdminPasscode] = useState<string>(() => {
    return typeof window !== 'undefined' ? sessionStorage.getItem('wingo_admin_passcode') || '' : '';
  });

  // Capture PWA install prompt
  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  // Fetch authoritative state from the server (ensures 100% same signals across all devices)
  const syncWithServer = useCallback(async () => {
    try {
      const res = await fetch('/api/live-state', { cache: 'no-store' });
      if (!res.ok) return;
      const data = await res.json();
      if (data && data.histories && data.signals) {
        setAppState((prev) => ({
          ...prev,
          histories: data.histories,
          endpoints: data.endpoints || prev.endpoints,
          updatedAt: data.updatedAt || prev.updatedAt,
        }));
        setSignals(data.signals);
        if (data.ledgers) {
          setLedgers(data.ledgers);
        }
        if (data.serverTime) {
          setServerTimeOffset(data.serverTime - Date.now());
        }
        setServerSynced(true);
      }
    } catch {
      // Server is warming up or connection is momentarily offline; continue quietly
    } finally {
      setIsLoaded(true);
    }
  }, []);

  // Real-time Server-Sent Events (SSE) Stream + Heartbeat fallback
  useEffect(() => {
    let es: EventSource | null = null;
    let isMounted = true;

    function initSSE() {
      try {
        es = new EventSource('/api/live-stream');

        es.addEventListener('initial-state', (e) => {
          if (!isMounted) return;
          try {
            const data = JSON.parse(e.data);
            setAppState((prev) => ({
              ...prev,
              histories: data.histories,
              endpoints: data.endpoints || prev.endpoints,
              updatedAt: data.updatedAt,
            }));
            setSignals(data.signals);
            if (data.serverTime) {
              setServerTimeOffset(data.serverTime - Date.now());
            }
            setServerSynced(true);
            setIsLoaded(true);
          } catch {}
        });

        es.addEventListener('signal-update', (e) => {
          if (!isMounted) return;
          try {
            const data = JSON.parse(e.data);
            setAppState((prev) => ({
              ...prev,
              histories: { ...prev.histories, [data.tf]: data.history },
              updatedAt: { ...prev.updatedAt, [data.tf]: data.updatedAt },
            }));
            setSignals((prev) => ({ ...prev, [data.tf]: data.signal }));
            if (data.serverTime) {
              setServerTimeOffset(data.serverTime - Date.now());
            }
            setServerSynced(true);
          } catch {}
        });

        es.addEventListener('settings-update', (e) => {
          if (!isMounted) return;
          try {
            const data = JSON.parse(e.data);
            setAppState((prev) => ({
              ...prev,
              endpoints: data.endpoints,
            }));
          } catch {}
        });

        es.onerror = () => {
          es?.close();
          if (isMounted) setTimeout(initSSE, 4000);
        };
      } catch {
        // Fallback polling handles connection issues
      }
    }

    syncWithServer();
    initSSE();

    // Heartbeat poll every 2.5 seconds to guarantee 100% sync even through mobile proxies
    const heartbeat = setInterval(syncWithServer, 2500);

    return () => {
      isMounted = false;
      es?.close();
      clearInterval(heartbeat);
    };
  }, [syncWithServer]);

  // Resilient multi-device synchronization (phone unlock, tab switch, network reconnect)
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        syncWithServer();
      }
    };
    const handleFocus = () => {
      syncWithServer();
    };
    const handleOnline = () => {
      syncWithServer();
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', handleFocus);
    window.addEventListener('online', handleOnline);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handleFocus);
      window.removeEventListener('online', handleOnline);
    };
  }, [syncWithServer]);

  // Sound toggle handler
  const handleToggleSound = () => {
    const next = !soundOn;
    setSoundOn(next);
    setSoundEnabled(next);
  };

  // Manual trigger for refresh button (authoritative server sync)
  const handleManualSync = async (tf: Timeframe) => {
    setIsFetching((prev) => ({ ...prev, [tf]: true }));
    try {
      await fetch('/api/signal/calculate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tf }),
      });
    } catch {}
    await syncWithServer();
    setTimeout(() => {
      setIsFetching((prev) => ({ ...prev, [tf]: false }));
    }, 400);
  };

  // Admin Login Handler
  const handleAdminLogin = async (passcode: string): Promise<boolean> => {
    try {
      const res = await fetch('/api/admin/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ passcode }),
      });
      const data = await res.json();
      if (data.success) {
        setIsAdmin(true);
        setAdminPasscode(passcode);
        sessionStorage.setItem('wingo_admin_auth', 'true');
        sessionStorage.setItem('wingo_admin_passcode', passcode);
        return true;
      }
      return false;
    } catch {
      return false;
    }
  };

  // Admin Logout Handler
  const handleAdminLogout = () => {
    setIsAdmin(false);
    setAdminPasscode('');
    sessionStorage.removeItem('wingo_admin_auth');
    sessionStorage.removeItem('wingo_admin_passcode');
  };

  // Admin Save Endpoints to Server
  const handleSaveEndpoints = async (newEndpoints: Record<Timeframe, string>): Promise<boolean> => {
    try {
      const res = await fetch('/api/admin/settings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-passcode': adminPasscode,
        },
        body: JSON.stringify({ endpoints: newEndpoints }),
      });
      const data = await res.json();
      if (data.success) {
        setAppState((prev) => ({ ...prev, endpoints: newEndpoints }));
        return true;
      }
      return false;
    } catch {
      return false;
    }
  };

  // Admin Reset Timeframe
  const handleResetServerTimeframe = async (tf: Timeframe): Promise<boolean> => {
    try {
      const res = await fetch('/api/admin/settings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-passcode': adminPasscode,
        },
        body: JSON.stringify({ resetTimeframe: tf }),
      });
      const data = await res.json();
      if (data.success) {
        await syncWithServer();
        return true;
      }
      return false;
    } catch {
      return false;
    }
  };

  // Fallbacks for Admin Manual entry if needed
  const handleAddSingleResult = (num: number) => {
    if (!isAdmin) return;
    const history = appState.histories[activeTimeframe] || [];
    const nextP = nextPeriod(history);
    const updated = [...history, { period: nextP, number: num }];
    setAppState((prev) => ({
      ...prev,
      histories: { ...prev.histories, [activeTimeframe]: updated },
    }));
    const freshSignal = buildSignal(updated);
    if (freshSignal) {
      setSignals((prev) => ({ ...prev, [activeTimeframe]: freshSignal }));
    }
  };

  const handleClearHistory = () => {
    if (!isAdmin) return;
    handleResetServerTimeframe(activeTimeframe);
  };

  // Authoritative signal calculation requested from the server
  // Guarantees all devices (PC, Mobile, Tablet, Telegram) see the exact same signal
  const handleGenerateSignal = async () => {
    setIsFetching((prev) => ({ ...prev, [activeTimeframe]: true }));
    try {
      const res = await fetch('/api/signal/calculate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tf: activeTimeframe }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.signal) {
          setSignals((prev) => ({ ...prev, [activeTimeframe]: data.signal }));
        }
        if (data.history) {
          setAppState((prev) => ({
            ...prev,
            histories: { ...prev.histories, [activeTimeframe]: data.history },
            updatedAt: { ...prev.updatedAt, [activeTimeframe]: data.updatedAt },
          }));
        }
        if (data.serverTime) {
          setServerTimeOffset(data.serverTime - Date.now());
        }
        setServerSynced(true);
      } else {
        await syncWithServer();
      }
    } catch {
      await syncWithServer();
    } finally {
      setIsFetching((prev) => ({ ...prev, [activeTimeframe]: false }));
    }
  };

  const currentHistory = appState.histories[activeTimeframe] || [];
  const currentSignal = signals[activeTimeframe] || null;
  const currentError = errors[activeTimeframe];

  return (
    <div className="min-h-screen aura-bg text-[#e2edf2] font-sans flex flex-col items-center p-3 sm:p-5 selection:bg-emerald-500/30 selection:text-emerald-300 relative">
      {/* Ambient Floating Glow Lights */}
      <div className="fixed top-0 left-1/4 w-96 h-96 bg-emerald-500/[0.07] rounded-full blur-[128px] pointer-events-none" />
      <div className="fixed top-1/3 right-1/4 w-96 h-96 bg-purple-600/[0.06] rounded-full blur-[128px] pointer-events-none" />
      <div className="fixed bottom-10 left-1/2 -translate-x-1/2 w-[500px] h-64 bg-teal-500/[0.05] rounded-full blur-[140px] pointer-events-none" />

      <main className="w-full max-w-xl flex flex-col gap-3.5 sm:gap-4 pb-12 relative z-10">
        {/* Navigation & Status Header */}
        <header className="flex items-center justify-between min-h-[52px] py-1">
          <div className="flex items-center gap-3">
            <div className="relative">
              <img
                src="/icon-192.png"
                alt="Number Shot Pro"
                className="w-10 h-10 rounded-2xl border border-white/10 object-cover shadow-lg shadow-black/40"
              />
              <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-emerald-400 border-2 border-[#070b10] animate-pulse" />
            </div>
            <div>
              <h1 className="text-base sm:text-lg font-black tracking-tight text-white flex items-center gap-1.5">
                <span>NUMBER SHOT</span>
                <span className="bg-gradient-to-r from-emerald-400 via-teal-300 to-cyan-300 bg-clip-text text-transparent">
                  PRO
                </span>
                <span className="text-[9px] font-black uppercase px-1.5 py-0.5 rounded-md bg-white/10 text-emerald-300 border border-white/10">
                  VIP
                </span>
              </h1>
              <p className="text-[10px] text-slate-400 font-medium tracking-wide">
                Real-Time Cloud Intelligence Suite
              </p>
            </div>
          </div>

          {/* Top Quick Actions Glass Capsule */}
          <div className="glass-pill rounded-2xl p-1 flex items-center gap-1 shadow-md">
            {/* Global Server Sync Badge */}
            <div
              className={`flex items-center gap-1.5 px-2 py-1 rounded-xl text-[9px] font-mono font-bold ${
                serverSynced
                  ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/20'
                  : 'bg-amber-400/15 text-amber-300 border border-amber-400/20'
              }`}
              title="Cloud authoritative real-time synchronization"
            >
              <span
                className={`w-1.5 h-1.5 rounded-full ${
                  serverSynced ? 'bg-emerald-400 animate-ping' : 'bg-amber-400 animate-pulse'
                }`}
              />
              <span className="hidden sm:inline">{serverSynced ? 'ALL DEVICES SYNCED' : 'SYNCING'}</span>
            </div>

            {/* Stealth Anti-Trap Shield */}
            <button
              onClick={() => setIsShieldOpen(true)}
              className="w-8 h-8 rounded-xl flex items-center justify-center text-emerald-400 hover:text-emerald-200 hover:bg-emerald-500/15 transition-all cursor-pointer"
              title="Stealth Anti-Detection Shield (সাইটের ট্র্যাকিং এড়ানোর গাইড)"
            >
              <ShieldCheck className="w-4 h-4" />
            </button>

            {/* Audio toggle */}
            <button
              onClick={handleToggleSound}
              className="w-8 h-8 rounded-xl flex items-center justify-center text-slate-400 hover:text-white hover:bg-white/10 transition-all cursor-pointer"
              title={soundOn ? 'Mute Audio' : 'Enable Audio'}
            >
              {soundOn ? <Volume2 className="w-4 h-4 text-emerald-400" /> : <VolumeX className="w-4 h-4" />}
            </button>

            {/* Compact Overlay HUD */}
            <button
              onClick={() => setIsOverlayOpen(!isOverlayOpen)}
              className={`w-8 h-8 rounded-xl flex items-center justify-center transition-all cursor-pointer ${
                isOverlayOpen
                  ? 'bg-emerald-500/20 text-emerald-300'
                  : 'text-slate-400 hover:text-white hover:bg-white/10'
              }`}
              title="Toggle Compact Floating HUD"
            >
              <Layers className="w-4 h-4" />
            </button>

            {/* Download / Install App */}
            <button
              onClick={() => setIsDownloadOpen(true)}
              className="w-8 h-8 rounded-xl flex items-center justify-center text-slate-400 hover:text-white hover:bg-white/10 transition-all cursor-pointer"
              title="Download / Install Web APK"
            >
              <Download className="w-4 h-4" />
            </button>

            {/* Settings modal */}
            <button
              onClick={() => setIsSettingsOpen(true)}
              className={`w-8 h-8 rounded-xl flex items-center justify-center transition-all cursor-pointer ${
                isAdmin
                  ? 'bg-amber-400/20 text-amber-300'
                  : 'text-slate-400 hover:text-white hover:bg-white/10'
              }`}
              title={isAdmin ? 'Admin Console' : 'Settings'}
            >
              <Sliders className="w-4 h-4" />
            </button>
          </div>
        </header>

        {/* Draw Interval & Live Countdown Bar */}
        <div className="flex items-center justify-between gap-2 px-0.5">
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
              INTERVAL
            </span>
            <div className="flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
              <span className="text-[10px] font-mono text-emerald-400 font-bold">
                {TIMEFRAME_LABELS[activeTimeframe]}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <LiveDrawTicker
              timeframe={activeTimeframe}
              serverTimeOffset={serverTimeOffset}
              onRoundExpire={() => syncWithServer()}
            />

            <button
              onClick={() => handleManualSync(activeTimeframe)}
              disabled={isFetching[activeTimeframe]}
              className="h-8 px-2.5 rounded-xl glass-pill hover:bg-white/10 flex items-center gap-1.5 text-[10px] font-extrabold tracking-wider uppercase text-white transition-all disabled:opacity-50 cursor-pointer"
              title={`Sync ${TIMEFRAME_LABELS[activeTimeframe]}`}
            >
              <RefreshCw
                className={`w-3 h-3 text-emerald-400 ${
                  isFetching[activeTimeframe] ? 'animate-spin' : ''
                }`}
              />
              <span className="hidden sm:inline">SYNC</span>
            </button>
          </div>
        </div>

        {/* Timeframe Rail Tabs (Classy Floating Pill Bar) */}
        <div className="flex p-1 rounded-2xl glass-panel-subtle gap-1 shadow-inner">
          {TIMEFRAMES.map((tf) => {
            const isSelected = activeTimeframe === tf;
            const hasData = appState.histories[tf]?.length > 0;
            const hasSignal = Boolean(signals[tf]);

            return (
              <button
                key={tf}
                onClick={() => {
                  setActiveTimeframe(tf);
                  setInfoMessage('');
                  if (!signals[tf]) {
                    syncWithServer();
                  }
                }}
                className={`flex-1 min-h-[40px] rounded-xl flex items-center justify-center px-1 font-mono text-[11px] font-black tracking-wider uppercase transition-all duration-200 cursor-pointer relative ${
                  isSelected
                    ? 'bg-gradient-to-r from-emerald-500 to-teal-400 text-[#051a14] shadow-md shadow-emerald-500/25 scale-[1.01]'
                    : 'text-slate-400 hover:text-white hover:bg-white/[0.04]'
                }`}
              >
                <span>{tf === '30S' ? '30 SEC' : tf.replace('M', ' MIN')}</span>
                {hasSignal && !isSelected && (
                  <span className="absolute top-1.5 right-1.5 flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-400" />
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Signal Panel or Reopen Button */}
        {isPanelVisible ? (
          <SignalCard
            signal={currentSignal}
            timeframe={activeTimeframe}
            historyLength={currentHistory.length}
            latestPeriod={currentHistory[currentHistory.length - 1]?.period || null}
            sourceMode="api"
            isFetching={Boolean(isFetching[activeTimeframe])}
            errorMessage={currentError}
            infoMessage={infoMessage}
            updatedAt={appState.updatedAt[activeTimeframe]}
            onGenerate={handleGenerateSignal}
            onHide={() => setIsPanelVisible(false)}
            onOpenShield={() => setIsShieldOpen(true)}
          />
        ) : (
          <div className="w-full flex justify-center py-2 animate-fadeIn">
            <button
              onClick={() => setIsPanelVisible(true)}
              className="h-10 px-5 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-400 hover:from-emerald-400 hover:to-teal-300 text-[#051a14] font-black text-xs tracking-wider uppercase flex items-center gap-2 shadow-lg shadow-emerald-500/25 transition-all cursor-pointer"
            >
              <Radio className="w-4 h-4 animate-pulse" />
              <span>OPEN VIP SIGNAL PANEL</span>
            </button>
          </div>
        )}

        {/* Walk-Forward Check Component */}
        {currentSignal && (
          <WalkForwardCheck
            backtest={currentSignal.backtest}
            historyLength={currentHistory.length}
          />
        )}

        {/* History Timeline */}
        <HistoryTimeline
          history={currentHistory}
          timeframe={activeTimeframe}
          ledger={ledgers[activeTimeframe] || []}
          isAdmin={isAdmin}
          onAddResult={handleAddSingleResult}
          onClearHistory={handleClearHistory}
          onOpenSettings={() => setIsSettingsOpen(true)}
        />

        {/* Bottom Disclaimer */}
        <footer className="flex items-start gap-2 pt-2 px-1 text-[11px] text-[#91aaa0] leading-relaxed">
          <Shield className="w-4 h-4 text-[#f1c97a] flex-shrink-0 mt-0.5" />
          <p>
            Estimates are calculated using historical Markov transition matrices and frequency decay.
            They are mathematical demonstrations and do not reveal or guarantee random lottery outcomes.
          </p>
        </footer>
      </main>

      {/* Settings Modal (Admin Protected) */}
      <SettingsModal
        isOpen={isSettingsOpen}
        activeTimeframe={activeTimeframe}
        endpoints={appState.endpoints}
        isAdmin={isAdmin}
        onClose={() => setIsSettingsOpen(false)}
        onAdminLogin={handleAdminLogin}
        onAdminLogout={handleAdminLogout}
        onSaveEndpoints={handleSaveEndpoints}
        onResetServerTimeframe={handleResetServerTimeframe}
      />

      {/* Floating Overlay HUD */}
      <FloatingOverlay
        isOpen={isOverlayOpen}
        signal={currentSignal}
        timeframe={activeTimeframe}
        latestPeriod={currentHistory[currentHistory.length - 1]?.period || null}
        serverTimeOffset={serverTimeOffset}
        onClose={() => setIsOverlayOpen(false)}
        onGenerate={handleGenerateSignal}
        onRoundExpire={() => syncWithServer()}
        onMaximize={() => {
          setIsOverlayOpen(false);
          setIsPanelVisible(true);
          window.scrollTo({ top: 0, behavior: 'smooth' });
        }}
      />

      {/* Download / Install App Modal */}
      <DownloadModal
        isOpen={isDownloadOpen}
        onClose={() => setIsDownloadOpen(false)}
        deferredPrompt={deferredPrompt}
      />

      {/* Stealth Anti-Detection Shield Modal */}
      <AntiDetectionModal
        isOpen={isShieldOpen}
        onClose={() => setIsShieldOpen(false)}
      />
    </div>
  );
}
