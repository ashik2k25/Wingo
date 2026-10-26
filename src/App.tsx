/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Timeframe, AppState, Signal, DrawResult, SignalLedgerEntry, HighestLossRecord, PeakAccuracyWindow } from './types';
import {
  TIMEFRAMES,
  TIMEFRAME_LABELS,
  TIMEFRAME_SECONDS,
  DEFAULT_ENDPOINTS,
  buildSignal,
  nextPeriod,
} from './utils/engine';
import { setSoundEnabled, isSoundEnabled } from './utils/audio';
import { Header } from './components/Header';
import { WinGoGamePad } from './components/WinGoGamePad';
import { HowToPlayModal } from './components/HowToPlayModal';
import { NavigationDrawer } from './components/NavigationDrawer';
import { SettingsModal } from './components/SettingsModal';
import { FloatingOverlay } from './components/FloatingOverlay';
import { DownloadModal } from './components/DownloadModal';
import { AntiDetectionModal } from './components/AntiDetectionModal';
import { TrendModal } from './components/TrendModal';
import { GoldenHoursModal } from './components/GoldenHoursModal';
import { AlertSettingsModal } from './components/AlertSettingsModal';
import {
  Menu,
  Crosshair,
  Shield,
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

const loadSavedState = (): AppState => {
  if (typeof window === 'undefined') return initialAppState;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && parsed.histories) {
        return {
          ...initialAppState,
          ...parsed,
        };
      }
    }
  } catch {}
  return initialAppState;
};

const loadSavedSignals = (): Partial<Record<Timeframe, Signal>> => {
  if (typeof window === 'undefined') return {};
  try {
    const raw = localStorage.getItem('wingo_cached_signals');
    if (raw) return JSON.parse(raw);
  } catch {}
  return {};
};

const loadSavedLedgers = (): Record<Timeframe, SignalLedgerEntry[]> => {
  const empty: Record<Timeframe, SignalLedgerEntry[]> = {
    '30S': [],
    '1M': [],
    '3M': [],
    '5M': [],
  };
  if (typeof window === 'undefined') return empty;
  try {
    const raw = localStorage.getItem('wingo_cached_ledgers');
    if (raw) return { ...empty, ...JSON.parse(raw) };
  } catch {}
  return empty;
};

export default function App() {
  const [appState, setAppState] = useState<AppState>(loadSavedState);
  const [activeTimeframe, setActiveTimeframe] = useState<Timeframe>('1M');
  const [signals, setSignals] = useState<Partial<Record<Timeframe, Signal>>>(loadSavedSignals);
  const [isFetching, setIsFetching] = useState<Partial<Record<Timeframe, boolean>>>({});
  const [errors, setErrors] = useState<Partial<Record<Timeframe, string>>>({});
  const [infoMessage, setInfoMessage] = useState<string>('');
  const [isPanelVisible, setIsPanelVisible] = useState<boolean>(true);
  const [isNavDrawerOpen, setIsNavDrawerOpen] = useState<boolean>(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState<boolean>(false);
  const [isOverlayOpen, setIsOverlayOpen] = useState<boolean>(false);
  const [isDownloadOpen, setIsDownloadOpen] = useState<boolean>(false);
  const [isShieldOpen, setIsShieldOpen] = useState<boolean>(false);
  const [isTrendOpen, setIsTrendOpen] = useState<boolean>(false);
  const [isGoldenHoursOpen, setIsGoldenHoursOpen] = useState<boolean>(false);
  const [isAlertsOpen, setIsAlertsOpen] = useState<boolean>(false);
  const [isHowToPlayOpen, setIsHowToPlayOpen] = useState<boolean>(false);
  const [highestLossRecords, setHighestLossRecords] = useState<Record<Timeframe, HighestLossRecord>>({
    '30S': { streak: 0, occurredAt: '', period: '', timeframe: '30S' },
    '1M': { streak: 0, occurredAt: '', period: '', timeframe: '1M' },
    '3M': { streak: 0, occurredAt: '', period: '', timeframe: '3M' },
    '5M': { streak: 0, occurredAt: '', period: '', timeframe: '5M' },
  });
  const [peakWindows, setPeakWindows] = useState<PeakAccuracyWindow[]>([]);
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [soundOn, setSoundOn] = useState<boolean>(true);
  const [isLoaded, setIsLoaded] = useState<boolean>(true);

  // Server-Authoritative Global Synchronization
  const [serverSynced, setServerSynced] = useState<boolean>(false);
  const [serverTimeOffset, setServerTimeOffset] = useState<number>(0);
  const [ledgers, setLedgers] = useState<Record<Timeframe, SignalLedgerEntry[]>>(loadSavedLedgers);
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
        if (data.highestLossRecord) {
          setHighestLossRecords(data.highestLossRecord);
        }
        if (data.peakAccuracyWindows) {
          setPeakWindows(data.peakAccuracyWindows);
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
    let isReconnecting = false;

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
            if (data.highestLossRecord) {
              setHighestLossRecords(data.highestLossRecord);
            }
            if (data.peakAccuracyWindows) {
              setPeakWindows(data.peakAccuracyWindows);
            }
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
            if (data.ledger) {
              setLedgers((prev) => ({ ...prev, [data.tf]: data.ledger }));
            }
            if (data.highestLossRecord) {
              setHighestLossRecords((prev) => ({
                ...prev,
                [data.tf]: data.highestLossRecord,
              }));
            }
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

        es.addEventListener('golden-call-alert', (e) => {
          if (!isMounted) return;
          try {
            const data = JSON.parse(e.data);
            setInfoMessage(`📞 [CALL ALERT / READY] ${data.session} starts in 1 minute!`);
            setTimeout(() => setInfoMessage(''), 8000);
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

  // Persist state, signals, and ledger to localStorage for instant 0ms offline resumption
  useEffect(() => {
    try {
      if (appState.histories['1M']?.length > 0 || appState.histories['30S']?.length > 0) {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(appState));
      }
      if (Object.keys(signals).length > 0) {
        localStorage.setItem('wingo_cached_signals', JSON.stringify(signals));
      }
      if (ledgers['1M']?.length > 0 || ledgers['30S']?.length > 0) {
        localStorage.setItem('wingo_cached_ledgers', JSON.stringify(ledgers));
      }
    } catch {}
  }, [appState, signals, ledgers]);

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
    <div className="min-h-screen bg-[#060818] text-slate-100 flex flex-col items-center selection:bg-cyan-500/30 selection:text-cyan-200 font-sans relative overflow-x-hidden pb-12">
      {/* Background Neon Ambient Glows */}
      <div className="fixed top-0 left-1/2 -translate-x-1/2 w-[550px] h-[320px] bg-gradient-to-b from-indigo-900/25 via-purple-900/15 to-transparent rounded-full blur-[100px] pointer-events-none z-0" />
      <div className="fixed bottom-0 left-1/4 w-[380px] h-[380px] bg-cyan-900/15 rounded-full blur-[120px] pointer-events-none z-0" />
      <div className="fixed top-1/3 right-1/4 w-[320px] h-[320px] bg-fuchsia-900/10 rounded-full blur-[120px] pointer-events-none z-0" />

      {/* Main Centered Container strictly matching concept wireframe */}
      <main className="w-full max-w-sm sm:max-w-md mx-auto px-3 sm:px-4 flex flex-col z-10">
        {/* 1. Header: Icon + Number Shot Pro + Hamburger Menu */}
        <Header
          onOpenMenu={() => setIsNavDrawerOpen(true)}
          serverSynced={serverSynced}
        />

        {/* WinGo Screenshot Layout Game Console */}
        <WinGoGamePad
          activeTimeframe={activeTimeframe}
          onSelectTimeframe={(tf) => {
            setActiveTimeframe(tf);
            setInfoMessage('');
            if (!signals[tf]) {
              syncWithServer();
            }
          }}
          signal={currentSignal}
          history={currentHistory}
          ledger={ledgers[activeTimeframe] || []}
          serverTimeOffset={serverTimeOffset}
          onExpire={() => syncWithServer()}
          onOpenHowToPlay={() => setIsHowToPlayOpen(true)}
          onOpenTrends={() => setIsTrendOpen(true)}
          onOpenGoldenHours={() => setIsGoldenHoursOpen(true)}
          isResolving={Boolean(isFetching[activeTimeframe])}
          peakWindows={peakWindows}
        />

        {/* Subtle Bottom Note */}
        <footer className="text-center pt-3 pb-2 text-[10px] text-zinc-500 font-mono">
          WinGo Signal Console • Official Style with Pure Size Win Engine
        </footer>
      </main>

      {/* Slide-over Navigation Drawer housing all tools/settings */}
      <NavigationDrawer
        isOpen={isNavDrawerOpen}
        onClose={() => setIsNavDrawerOpen(false)}
        activeTimeframe={activeTimeframe}
        onSelectTimeframe={(tf) => {
          setActiveTimeframe(tf);
          setInfoMessage('');
          if (!signals[tf]) {
            syncWithServer();
          }
        }}
        serverSynced={serverSynced}
        soundOn={soundOn}
        onToggleSound={handleToggleSound}
        onOpenGoldenHours={() => {
          setIsNavDrawerOpen(false);
          setIsGoldenHoursOpen(true);
        }}
        onOpenAlerts={() => {
          setIsNavDrawerOpen(false);
          setIsAlertsOpen(true);
        }}
        onOpenTrends={() => {
          setIsNavDrawerOpen(false);
          setIsTrendOpen(true);
        }}
        onOpenShield={() => {
          setIsNavDrawerOpen(false);
          setIsShieldOpen(true);
        }}
        onOpenOverlay={() => {
          setIsNavDrawerOpen(false);
          setIsOverlayOpen(true);
        }}
        onOpenSettings={() => {
          setIsNavDrawerOpen(false);
          setIsSettingsOpen(true);
        }}
        onOpenDownload={() => {
          setIsNavDrawerOpen(false);
          setIsDownloadOpen(true);
        }}
        highestLossRecords={highestLossRecords}
      />

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

      {/* Trend Statistics & Missing Analysis Matrix Modal */}
      <TrendModal
        isOpen={isTrendOpen}
        onClose={() => setIsTrendOpen(false)}
        activeTimeframe={activeTimeframe}
        histories={appState.histories}
      />

      {/* 24-Hour Golden Trading Windows & Highest Loss Streak Modal */}
      <GoldenHoursModal
        isOpen={isGoldenHoursOpen}
        onClose={() => setIsGoldenHoursOpen(false)}
        windows={peakWindows}
        highestLossRecords={highestLossRecords}
        activeTimeframe={activeTimeframe}
        onSelectTimeframe={(tf) => setActiveTimeframe(tf)}
        serverTime={Date.now() + serverTimeOffset}
      />

      {/* 1-Min Golden Session Call Alert & Telegram Automation Modal */}
      <AlertSettingsModal
        isOpen={isAlertsOpen}
        onClose={() => setIsAlertsOpen(false)}
        windows={peakWindows}
        serverTime={Date.now() + serverTimeOffset}
      />

      {/* How To Play WinGo & AI Rules Guide Modal */}
      <HowToPlayModal
        isOpen={isHowToPlayOpen}
        onClose={() => setIsHowToPlayOpen(false)}
      />
    </div>
  );
}
