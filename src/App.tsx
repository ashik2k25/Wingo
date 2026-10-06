/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Timeframe, AppState, Signal, DrawResult } from './types';
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
import {
  Activity,
  Sliders,
  RefreshCw,
  Radio,
  Shield,
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
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [soundOn, setSoundOn] = useState<boolean>(true);
  const [isLoaded, setIsLoaded] = useState<boolean>(false);

  // Server-Authoritative Global Synchronization
  const [serverSynced, setServerSynced] = useState<boolean>(false);
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

  // Sound toggle handler
  const handleToggleSound = () => {
    const next = !soundOn;
    setSoundOn(next);
    setSoundEnabled(next);
  };

  // Manual trigger for refresh button
  const handleManualSync = async (tf: Timeframe) => {
    setIsFetching((prev) => ({ ...prev, [tf]: true }));
    await syncWithServer();
    setTimeout(() => {
      setIsFetching((prev) => ({ ...prev, [tf]: false }));
    }, 500);
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

  // Generate signal immediately for active timeframe (restores Oct 4 1:14AM APK responsiveness)
  const handleGenerateSignal = () => {
    const history = appState.histories[activeTimeframe] || [];
    if (history.length >= 5) {
      const freshSignal = buildSignal(history);
      if (freshSignal) {
        setSignals((prev) => ({ ...prev, [activeTimeframe]: freshSignal }));
      }
    } else {
      syncWithServer();
    }
  };

  const currentHistory = appState.histories[activeTimeframe] || [];
  const currentSignal = signals[activeTimeframe] || null;
  const currentError = errors[activeTimeframe];

  return (
    <div className="min-h-screen bg-[#061b17] text-[#e9fff4] font-sans flex flex-col items-center p-3 sm:p-5 selection:bg-[#25c98e]/30 selection:text-[#25c98e]">
      <main className="w-full max-w-xl flex flex-col gap-3 sm:gap-4 pb-12">
        {/* Navigation & Status Header */}
        <header className="flex items-center justify-between min-h-[48px] py-1">
          <div className="flex items-center gap-2.5">
            <img
              src="/icon-192.png"
              alt="Number Shot Pro"
              className="w-9 h-9 rounded-2xl border border-[#21483c] object-cover shadow-inner"
            />
            <div>
              <h1 className="text-base font-extrabold tracking-tight text-[#e9fff4] flex items-center gap-1.5">
                <span>Number Shot Pro</span>
                <span className="text-[10px] font-black uppercase px-1.5 py-0.2 rounded bg-[#25c98e] text-[#04221a]">
                  APK
                </span>
              </h1>
              <p className="text-[11px] text-[#91aaa0]">Global Real-Time Authority</p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 sm:gap-2">
            {/* Global Server Sync Badge */}
            {serverSynced ? (
              <div
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-[#25c98e]/15 border border-[#25c98e]/40 text-[#25c98e] text-[10px] font-mono font-bold"
                title="All devices worldwide receive identical signals from the cloud engine."
              >
                <span className="w-1.5 h-1.5 rounded-full bg-[#25c98e] animate-ping" />
                <span className="hidden sm:inline">GLOBAL LIVE</span>
                <span>SYNCED</span>
              </div>
            ) : (
              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-[#f1c97a]/15 border border-[#f1c97a]/40 text-[#f1c97a] text-[10px] font-mono font-bold">
                <span className="w-1.5 h-1.5 rounded-full bg-[#f1c97a] animate-pulse" />
                <span>CONNECTING...</span>
              </div>
            )}

            {/* Admin Badge */}
            {isAdmin && (
              <span className="hidden sm:flex items-center gap-1 px-2 py-1 rounded-xl bg-[#f59e0b]/20 border border-[#f59e0b]/50 text-[#f59e0b] text-[10px] font-mono font-black">
                👑 ADMIN
              </span>
            )}

            {/* Overlay toggle */}
            <button
              onClick={() => setIsOverlayOpen(!isOverlayOpen)}
              className={`w-9 h-9 rounded-xl border flex items-center justify-center transition-colors cursor-pointer ${
                isOverlayOpen
                  ? 'border-[#25c98e] bg-[#25c98e]/20 text-[#25c98e]'
                  : 'border-[#21483c] bg-[#0c2822] text-[#91aaa0] hover:text-[#e9fff4]'
              }`}
              title="Toggle Compact Overlay Mode"
            >
              <Layers className="w-4 h-4" />
            </button>

            {/* Audio toggle */}
            <button
              onClick={handleToggleSound}
              className="w-9 h-9 rounded-xl border border-[#21483c] bg-[#0c2822] flex items-center justify-center text-[#91aaa0] hover:text-[#e9fff4] transition-colors cursor-pointer"
              title={soundOn ? 'Mute Audio' : 'Enable Audio'}
            >
              {soundOn ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
            </button>

            {/* Download / Install App */}
            <button
              onClick={() => setIsDownloadOpen(true)}
              className="w-9 h-9 rounded-xl border border-[#25c98e]/40 bg-[#0c2822] flex items-center justify-center text-[#25c98e] hover:text-[#e9fff4] hover:bg-[#14362e] transition-colors cursor-pointer"
              title="Download / Install App on Phone"
            >
              <Download className="w-4 h-4" />
            </button>

            {/* Settings modal */}
            <button
              onClick={() => setIsSettingsOpen(true)}
              className={`w-9 h-9 rounded-xl border flex items-center justify-center transition-colors cursor-pointer ${
                isAdmin
                  ? 'border-[#f59e0b]/50 bg-[#f59e0b]/15 text-[#f59e0b]'
                  : 'border-[#21483c] bg-[#0c2822] text-[#91aaa0] hover:text-[#e9fff4]'
              }`}
              title={isAdmin ? 'Admin Console' : 'View Settings (Admin Protected)'}
            >
              <Sliders className="w-4 h-4" />
            </button>
          </div>
        </header>

        {/* Global Live Info Card */}
        <section className="rounded-3xl border border-[#21483c] bg-[#0c2822] p-4 sm:p-5 flex items-start justify-between gap-3 shadow-md relative overflow-hidden">
          <div className="flex-1 pr-2">
            <span className="text-[9px] font-black tracking-widest uppercase text-[#25c98e] block mb-1">
              CLOUD REAL-TIME SIGNAL AUTHORITY
            </span>
            <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-[#e9fff4] leading-tight">
              One panel. Four draw speeds.
            </h2>
            <p className="text-xs text-[#91aaa0] mt-1.5 leading-relaxed">
              সবার ডিভাইসে একই সাথে হুবহু এক সিগন্যাল সার্ভার থেকে লাইভ সিঙ্ক হচ্ছে।
            </p>
          </div>

          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full border border-[#21483c] bg-[#12342b] text-[9px] font-extrabold tracking-wider uppercase flex-shrink-0">
            <span className="w-1.5 h-1.5 rounded-full bg-[#25c98e]" />
            <span className="text-[#25c98e]">CLOUD LIVE</span>
          </div>
        </section>

        {/* Draw Interval & Controls Header */}
        <div className="flex items-center justify-between mt-1">
          <div>
            <h3 className="text-base font-bold text-[#e9fff4]">Draw interval</h3>
            <p className="text-[11px] text-[#91aaa0] mt-0.5">Separate history for each mode</p>
          </div>

          <div className="flex items-center gap-2">
            <LiveDrawTicker
              timeframe={activeTimeframe}
              onRoundExpire={() => syncWithServer()}
            />

            <button
              onClick={() => handleManualSync(activeTimeframe)}
              disabled={isFetching[activeTimeframe]}
              className="h-9 px-3 rounded-xl bg-[#14362e] hover:bg-[#173d33] border border-[#21483c] flex items-center gap-1.5 text-xs font-black tracking-wider uppercase text-[#e9fff4] transition-colors disabled:opacity-60 cursor-pointer"
              title={`Sync ${TIMEFRAME_LABELS[activeTimeframe]} history`}
            >
              <RefreshCw
                className={`w-3.5 h-3.5 text-[#25c98e] ${
                  isFetching[activeTimeframe] ? 'animate-spin' : ''
                }`}
              />
              <span>SYNC</span>
            </button>
          </div>
        </div>

        {/* Timeframe Rail Tabs */}
        <div className="flex p-1 rounded-2xl border border-[#21483c] bg-[#0c2822] gap-1 shadow-inner">
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
                }}
                className={`flex-1 min-h-[42px] rounded-xl flex items-center justify-center px-1 font-mono text-[11px] font-black tracking-wider uppercase transition-all duration-200 cursor-pointer relative ${
                  isSelected
                    ? 'bg-[#25c98e] text-[#04221a] shadow-md shadow-[#25c98e]/20 scale-[1.01]'
                    : 'text-[#91aaa0] hover:text-[#e9fff4] hover:bg-[#14362e]/50'
                }`}
              >
                <span>{tf === '30S' ? '30 SEC' : tf.replace('M', ' MIN')}</span>
                {hasSignal && !isSelected && (
                  <span className="absolute top-1.5 right-1.5 flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#25c98e] opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-[#25c98e]"></span>
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
            sourceMode="api"
            isFetching={Boolean(isFetching[activeTimeframe])}
            errorMessage={currentError}
            infoMessage={infoMessage}
            updatedAt={appState.updatedAt[activeTimeframe]}
            onGenerate={handleGenerateSignal}
            onHide={() => setIsPanelVisible(false)}
          />
        ) : (
          <div className="w-full flex justify-center py-2 animate-fadeIn">
            <button
              onClick={() => setIsPanelVisible(true)}
              className="h-10 px-4 rounded-2xl bg-[#25c98e] hover:bg-[#28d59b] text-[#04221a] font-black text-xs tracking-wider uppercase flex items-center gap-2 shadow-lg shadow-[#25c98e]/20 transition-all cursor-pointer"
            >
              <Radio className="w-4 h-4 animate-pulse" />
              <span>OPEN SIGNAL PANEL</span>
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
    </div>
  );
}
