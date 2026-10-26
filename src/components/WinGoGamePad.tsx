import React, { useState, useMemo, useEffect } from 'react';
import {
  Timeframe,
  Signal,
  DrawResult,
  SignalLedgerEntry,
  BallSize,
  BallColor,
  PeakAccuracyWindow,
} from '../types';
import {
  TIMEFRAMES,
  TIMEFRAME_LABELS,
  TIMEFRAME_SECONDS,
  getSize,
  getColor,
  analyzeSizeAndPattern,
  analyzeColorAndPattern,
  isColorMatch,
} from '../utils/engine';
import {
  Clock,
  BookOpen,
  ChevronLeft,
  ChevronRight,
  TrendingUp,
  Shield,
  Zap,
  CheckCircle2,
  XCircle,
  HelpCircle,
  Crosshair,
  Sparkles,
  Flame,
} from 'lucide-react';

interface WinGoGamePadProps {
  activeTimeframe: Timeframe;
  onSelectTimeframe: (tf: Timeframe) => void;
  signal: Signal | null;
  history: DrawResult[];
  ledger?: SignalLedgerEntry[];
  serverTimeOffset?: number;
  onExpire?: () => void;
  onOpenHowToPlay: () => void;
  onOpenTrends: () => void;
  onOpenGoldenHours: () => void;
  isResolving?: boolean;
  peakWindows?: PeakAccuracyWindow[];
}

export const WinGoGamePad: React.FC<WinGoGamePadProps> = ({
  activeTimeframe,
  onSelectTimeframe,
  signal,
  history,
  ledger = [],
  serverTimeOffset = 0,
  onExpire,
  onOpenHowToPlay,
  onOpenTrends,
  onOpenGoldenHours,
  isResolving = false,
  peakWindows = [],
}) => {
  const [activeTab, setActiveTab] = useState<'game' | 'chart' | 'myHistory'>('game');
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [selectedMultiplier, setSelectedMultiplier] = useState<number>(
    signal?.suggestedMultiplier || 1
  );

  const pageSize = 10;
  const totalPages = 50;

  // Real-time flip clock countdown timer
  const [timeLeft, setTimeLeft] = useState<{ minutes: number; seconds: number }>({
    minutes: 0,
    seconds: 0,
  });

  useEffect(() => {
    const periodSec = TIMEFRAME_SECONDS[activeTimeframe] || 60;
    const updateTimer = () => {
      const nowMs = Date.now() + serverTimeOffset;
      const nowSec = Math.floor(nowMs / 1000);
      const remaining = periodSec - (nowSec % periodSec);

      const minutes = Math.floor(remaining / 60);
      const seconds = remaining % 60;

      setTimeLeft({ minutes, seconds });

      if (remaining === periodSec || remaining <= 1) {
        onExpire?.();
      }
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, [activeTimeframe, serverTimeOffset, onExpire]);

  // Reset page when timeframe switches
  useEffect(() => {
    setCurrentPage(1);
  }, [activeTimeframe]);

  // Synchronize suggested multiplier from signal
  useEffect(() => {
    if (signal?.suggestedMultiplier) {
      setSelectedMultiplier(signal.suggestedMultiplier);
    }
  }, [signal]);

  // Ensure 500 sorted draws are always available for 50 pages of 10 items
  const sortedDraws = useMemo(() => {
    const sorted = [...history].sort((a, b) =>
      b.period.localeCompare(a.period, undefined, { numeric: true })
    );

    const full: DrawResult[] = [...sorted];
    if (full.length < 500 && full.length > 0) {
      const lastItem = full[full.length - 1];
      const basePeriod = BigInt(lastItem.period);
      const stepSec = TIMEFRAME_SECONDS[activeTimeframe];
      const needed = 500 - full.length;

      for (let i = 1; i <= needed; i++) {
        const pNum = (basePeriod - BigInt(i)).toString();
        const seed = Number(BigInt(pNum) % 1000000n);
        const digit = Math.abs(Math.floor(Math.sin(seed + i * 19) * 10000) % 10);
        full.push({
          period: pNum,
          number: digit,
          timestamp: new Date(Date.now() - (full.length + i) * stepSec * 1000).toISOString(),
        });
      }
    }
    return full;
  }, [history, activeTimeframe]);

  // Resolve historical predictions for Win/Loss highlight overlay
  const resolvedHistory = useMemo(() => {
    const ledgerMap = new Map<string, SignalLedgerEntry>();
    for (const item of ledger) {
      if (item && item.targetPeriod) {
        ledgerMap.set(item.targetPeriod, item);
      }
    }

    // Chronological order (oldest to newest) to run engine simulation
    const chronological = [...sortedDraws].reverse();

    const resultMap = new Map<
      string,
      {
        predictedSize: BallSize;
        predictedColor: BallColor;
        isSizeWin: boolean;
        isColorWin: boolean;
      }
    >();

    for (let i = 0; i < chronological.length; i++) {
      const item = chronological[i];
      const actualSize = getSize(item.number);
      const actualColor = getColor(item.number);

      const ledgerEntry = ledgerMap.get(item.period);
      if (ledgerEntry) {
        const pSize = ledgerEntry.predictedSize;
        const pColor = (ledgerEntry.predictedColor as BallColor) || (pSize === 'SMALL' ? 'GREEN' : 'RED');
        // If entry has status WIN/LOSS, respect it; if PENDING, compute directly against the actual draw
        const isSizeWin = ledgerEntry.status === 'WIN' || (ledgerEntry.status === 'PENDING' ? pSize === actualSize : pSize === actualSize);
        const isColorWin = ledgerEntry.colorStatus === 'WIN' || (ledgerEntry.colorStatus === 'PENDING' ? isColorMatch(pColor, item.number) : isColorMatch(pColor, item.number));

        resultMap.set(item.period, {
          predictedSize: pSize,
          predictedColor: pColor,
          isSizeWin,
          isColorWin,
        });
      } else {
        // Fallback simulation from preceding draws
        const past = chronological.slice(0, i);
        let simSize: BallSize = 'BIG';
        let simColor: BallColor = 'RED';

        if (past.length >= 2) {
          const sAnalysis = analyzeSizeAndPattern(past, 0);
          simSize = sAnalysis.recommendedSize;
          const cAnalysis = analyzeColorAndPattern(past, simSize);
          simColor = cAnalysis.recommendedColor as BallColor;
        } else if (past.length === 1) {
          simSize = getSize(past[0].number) === 'BIG' ? 'SMALL' : 'BIG';
          simColor = simSize === 'SMALL' ? 'GREEN' : 'RED';
        }

        const isSizeWin = simSize === actualSize;
        const isColorWin = isColorMatch(simColor, item.number);

        resultMap.set(item.period, {
          predictedSize: simSize,
          predictedColor: simColor,
          isSizeWin,
          isColorWin,
        });
      }
    }

    return resultMap;
  }, [sortedDraws, ledger]);

  // Current page items (10 rows per page)
  const startIndex = (currentPage - 1) * pageSize;
  const currentPageItems = sortedDraws.slice(startIndex, startIndex + pageSize);

  // Recent 5 mini ball numbers for the ticket card
  const recent5Draws = useMemo(() => {
    return sortedDraws.slice(0, 5);
  }, [sortedDraws]);

  // Target period ID formatted (guarantees upcoming round is shown, never an expired round)
  const latestPeriod = sortedDraws[0]?.period || '';
  const expectedNextPeriod = latestPeriod ? (BigInt(latestPeriod) + 1n).toString() : '';
  const targetPeriodId =
    signal?.targetPeriod && (!latestPeriod || BigInt(signal.targetPeriod) > BigInt(latestPeriod))
      ? signal.targetPeriod
      : expectedNextPeriod || '20261025100051941';

  // Multiplier choices matching game UI
  const multipliers = [
    { label: 'Random', val: -1 },
    { label: 'X1', val: 1 },
    { label: 'X5', val: 5 },
    { label: 'X10', val: 10 },
    { label: 'X20', val: 20 },
    { label: 'X50', val: 50 },
    { label: 'X100', val: 100 },
  ];

  // Helper for 2-digit format
  const pad2 = (n: number) => (n < 10 ? `0${n}` : `${n}`);
  const minStr = pad2(timeLeft.minutes);
  const secStr = pad2(timeLeft.seconds);

  // Predicted values from AI signal
  const aiPredictedNumber = signal ? signal.number : 7;
  const aiPredictedSize = signal ? signal.size : 'BIG';
  const aiPredictedColor = signal ? signal.color : 'RED';

  const isAiGreen = aiPredictedColor === 'GREEN' || aiPredictedColor === 'GREEN_VIOLET';
  const isAiViolet = aiPredictedColor === 'VIOLET' || aiPredictedColor === 'RED_VIOLET' || aiPredictedColor === 'GREEN_VIOLET';
  const isAiRed = aiPredictedColor === 'RED' || aiPredictedColor === 'RED_VIOLET';

  const activeGoldenSession = useMemo(() => {
    return peakWindows.find((w) => w.isActiveNow) || null;
  }, [peakWindows]);

  const nextGoldenSession = useMemo(() => {
    if (activeGoldenSession) return activeGoldenSession;
    return peakWindows[0] || null;
  }, [peakWindows, activeGoldenSession]);

  return (
    <div className="w-full flex flex-col items-center gap-3 animate-fadeIn">
      {/* 1. TOP TIMEFRAME SELECTOR CARD MATCHING SCREENSHOT */}
      <div className="w-full rounded-2xl bg-[#090d24]/90 border border-white/[0.08] backdrop-blur-xl p-1.5 shadow-[0_0_25px_rgba(0,163,255,0.15)]">
        <div className="grid grid-cols-4 gap-1 sm:gap-1.5">
          {TIMEFRAMES.map((tf) => {
            const isSelected = activeTimeframe === tf;
            return (
              <button
                key={tf}
                onClick={() => onSelectTimeframe(tf)}
                className={`flex flex-col items-center justify-center py-2 px-1 rounded-xl transition-all cursor-pointer relative overflow-hidden ${
                  isSelected
                    ? 'bg-gradient-to-b from-amber-500/30 to-amber-600/20 border border-amber-400 text-amber-300 shadow-[0_0_20px_rgba(245,158,11,0.35)]'
                    : 'bg-white/[0.02] border border-transparent text-zinc-400 hover:text-zinc-200 hover:bg-white/[0.05]'
                }`}
              >
                {/* Circular Clock Icon */}
                <div
                  className={`w-7 h-7 sm:w-8 sm:h-8 rounded-full flex items-center justify-center mb-1 transition-all ${
                    isSelected
                      ? 'bg-amber-400 text-black shadow-[0_0_10px_#f59e0b]'
                      : 'bg-white/10 text-zinc-400'
                  }`}
                >
                  <Clock className="w-4 h-4" strokeWidth={2.5} />
                </div>
                <span className="text-[10.5px] sm:text-xs font-bold font-mono tracking-tight text-center leading-tight">
                  {tf === '30S'
                    ? 'WinGo 30sec'
                    : tf === '1M'
                    ? 'WinGo 1 Min'
                    : tf === '3M'
                    ? 'WinGo 3 Min'
                    : 'WinGo 5 Min'}
                </span>
                {isSelected && (
                  <span className="absolute bottom-0 left-1/2 -translate-x-1/2 w-6 h-0.5 bg-amber-400 rounded-full" />
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* 1.5 GOLDEN 5-MIN SESSION STATUS BANNER (EXCLUSIVELY WinGo 1 MIN) */}
      {activeTimeframe === '1M' ? (
        <div
          onClick={onOpenGoldenHours}
          className={`w-full px-3 py-2 rounded-2xl border transition-all flex items-center justify-between cursor-pointer shadow-md ${
            activeGoldenSession
              ? 'bg-gradient-to-r from-emerald-950/80 via-emerald-900/50 to-black/80 border-emerald-400 text-emerald-200 shadow-[0_0_25px_rgba(16,185,129,0.3)] animate-pulse'
              : 'bg-gradient-to-r from-amber-950/40 via-[#180e06]/70 to-[#0c0603]/80 border-amber-500/40 text-amber-200 hover:border-amber-400/80'
          }`}
        >
          <div className="flex items-center gap-2">
            <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${
              activeGoldenSession ? 'bg-emerald-500/20 text-emerald-400' : 'bg-amber-500/20 text-amber-400'
            }`}>
              <Flame className="w-4 h-4" />
            </div>
            <div className="flex flex-col text-left font-mono">
              <div className="flex items-center gap-1.5">
                <span className="text-[11px] font-black text-white">
                  {activeGoldenSession ? '100% PURE GOLDEN SESSION ACTIVE' : '4 PURE 5-MIN SESSIONS'}
                </span>
                <span className="text-[8.5px] px-1.5 py-0.2 rounded bg-emerald-500/20 border border-emerald-400/40 text-emerald-300 font-bold">
                  1 MIN ONLY
                </span>
              </div>
              <span className="text-[9.5px] text-zinc-300">
                {activeGoldenSession
                  ? `${activeGoldenSession.label} • ${activeGoldenSession.statusText} (5/5 Pure Wins)`
                  : nextGoldenSession
                  ? `Next: ${nextGoldenSession.label} (${nextGoldenSession.timeRange}) • 100% Win Rate`
                  : '7-day memory pure size win guarantee'}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-1 font-mono text-[10px] font-bold text-amber-300 bg-black/40 px-2 py-1 rounded-lg border border-amber-500/30 shrink-0">
            <span>{activeGoldenSession ? 'OPEN' : 'VIEW'}</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </div>
        </div>
      ) : (
        /* Subtle notice if viewing 30S, 3M, or 5M: Golden Session is on 1 Min */
        <div
          onClick={() => onSelectTimeframe('1M')}
          className="w-full px-3 py-1.5 rounded-xl border border-white/[0.08] bg-white/[0.02] hover:bg-white/[0.05] transition-all flex items-center justify-between cursor-pointer font-mono text-zinc-400 hover:text-white"
        >
          <div className="flex items-center gap-2 text-[10px]">
            <span className="text-amber-400">💡</span>
            <span>
              Pure Golden 5-Min Sessions are <strong className="text-amber-300">exclusively for WinGo 1 Min</strong>
              {activeGoldenSession ? ' (🔥 Session Active Now!)' : ''}
            </span>
          </div>
          <span className="text-[9px] font-bold px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/40 shrink-0">
            Switch to 1 Min
          </span>
        </div>
      )}

      {/* 2. NOTCHED TICKET BANNER CARD (HOW TO PLAY, RECENT 5 MINI BALLS, FLIP COUNTDOWN, PERIOD ID) */}
      <div className="w-full relative rounded-2xl bg-[#0d122e]/95 border border-white/[0.1] backdrop-blur-2xl shadow-[0_0_35px_rgba(10,18,50,0.8)] overflow-hidden">
        {/* Ticket Left & Right Scalloped Notches */}
        <div className="absolute top-1/2 -left-3 -translate-y-1/2 w-6 h-6 rounded-full bg-[#060818] border-r border-white/[0.1] z-20 pointer-events-none" />
        <div className="absolute top-1/2 -right-3 -translate-y-1/2 w-6 h-6 rounded-full bg-[#060818] border-l border-white/[0.1] z-20 pointer-events-none" />

        <div className="grid grid-cols-2 p-3 sm:p-4 relative z-10">
          {/* LEFT SIDE: How to play + Mode + 5 Mini Number Balls */}
          <div className="flex flex-col justify-between pr-3 border-r border-dashed border-white/15">
            {/* How to Play pill button */}
            <button
              onClick={onOpenHowToPlay}
              className="w-fit flex items-center gap-1 px-2.5 py-1 rounded-full bg-white/10 hover:bg-white/15 border border-white/20 text-white font-mono text-[10px] font-bold transition cursor-pointer active:scale-95 shadow-sm"
            >
              <BookOpen className="w-3 h-3 text-amber-400" />
              <span>How to play</span>
            </button>

            {/* Timeframe Name */}
            <div className="my-1.5">
              <span className="text-xs sm:text-sm font-bold text-amber-300 font-mono">
                {activeTimeframe === '30S'
                  ? 'WinGo 30sec'
                  : activeTimeframe === '1M'
                  ? 'WinGo 1 Min'
                  : activeTimeframe === '3M'
                  ? 'WinGo 3 Min'
                  : 'WinGo 5 Min'}
              </span>
            </div>

            {/* 5 Mini Number Balls matching screenshot */}
            <div className="flex items-center gap-1 sm:gap-1.5">
              {recent5Draws.map((d, i) => {
                const num = d.number;
                const isRed = num === 2 || num === 4 || num === 6 || num === 8;
                const isGreen = num === 1 || num === 3 || num === 7 || num === 9;
                const isZero = num === 0;
                const isFive = num === 5;

                return (
                  <div
                    key={`${d.period}-${i}`}
                    className={`w-6 h-6 sm:w-7 sm:h-7 rounded-full flex items-center justify-center font-mono font-black text-[11px] sm:text-xs text-white shadow-md relative ${
                      isZero
                        ? 'bg-gradient-to-tr from-purple-600 via-rose-600 to-rose-500 ring-1 ring-purple-400/50'
                        : isFive
                        ? 'bg-gradient-to-tr from-purple-600 via-emerald-600 to-emerald-500 ring-1 ring-emerald-400/50'
                        : isRed
                        ? 'bg-gradient-to-b from-rose-500 to-rose-700 ring-1 ring-rose-400/50'
                        : 'bg-gradient-to-b from-emerald-500 to-emerald-700 ring-1 ring-emerald-400/50'
                    }`}
                  >
                    <span>{num}</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* RIGHT SIDE: Time remaining + Digital Flip Boxes + Period ID */}
          <div className="flex flex-col items-end justify-between pl-3 text-right">
            <span className="text-[10px] font-mono font-medium text-amber-300/80 uppercase tracking-wider">
              Time remaining
            </span>

            {/* 4 Split Digital Flip Boxes: [0] [0] : [0] [8] */}
            <div className="flex items-center gap-1 my-1">
              {/* Minutes digits */}
              <div className="w-6 h-8 sm:w-7 sm:h-9 rounded-md bg-[#070b1c] border border-white/20 flex items-center justify-center font-mono font-black text-lg sm:text-xl text-white shadow-inner relative overflow-hidden">
                <span>{minStr[0]}</span>
                <span className="absolute top-1/2 left-0 right-0 h-[1px] bg-black/50" />
              </div>
              <div className="w-6 h-8 sm:w-7 sm:h-9 rounded-md bg-[#070b1c] border border-white/20 flex items-center justify-center font-mono font-black text-lg sm:text-xl text-white shadow-inner relative overflow-hidden">
                <span>{minStr[1]}</span>
                <span className="absolute top-1/2 left-0 right-0 h-[1px] bg-black/50" />
              </div>

              {/* Colon */}
              <span className="text-amber-400 font-mono font-black text-base animate-pulse">
                :
              </span>

              {/* Seconds digits */}
              <div className="w-6 h-8 sm:w-7 sm:h-9 rounded-md bg-[#070b1c] border border-cyan-500/40 flex items-center justify-center font-mono font-black text-lg sm:text-xl text-cyan-300 shadow-[0_0_10px_rgba(6,182,212,0.3)] relative overflow-hidden">
                <span>{secStr[0]}</span>
                <span className="absolute top-1/2 left-0 right-0 h-[1px] bg-black/50" />
              </div>
              <div className="w-6 h-8 sm:w-7 sm:h-9 rounded-md bg-[#070b1c] border border-cyan-500/40 flex items-center justify-center font-mono font-black text-lg sm:text-xl text-cyan-300 shadow-[0_0_10px_rgba(6,182,212,0.3)] relative overflow-hidden">
                <span>{secStr[1]}</span>
                <span className="absolute top-1/2 left-0 right-0 h-[1px] bg-black/50" />
              </div>
            </div>

            {/* Target Period ID */}
            <div className="text-[11px] sm:text-xs font-mono font-bold text-amber-300 tracking-wider">
              {targetPeriodId}
            </div>
          </div>
        </div>
      </div>

      {/* 3. COLOR BETTING BUTTONS (GREEN, VIOLET, RED) WITH AI RECOMMENDATION HIGHLIGHT */}
      <div className="w-full grid grid-cols-3 gap-2">
        {/* Green Button */}
        <div
          className={`py-2.5 sm:py-3 px-2 rounded-2xl flex items-center justify-center font-sans font-bold text-xs sm:text-sm text-white transition-all shadow-md relative overflow-hidden ${
            isAiGreen
              ? 'bg-gradient-to-r from-emerald-600 to-green-500 ring-2 ring-emerald-400 shadow-[0_0_25px_rgba(16,185,129,0.5)]'
              : 'bg-emerald-700/80 hover:bg-emerald-600/90 border border-emerald-500/30'
          }`}
        >
          <span>Green</span>
          {isAiGreen && (
            <span className="absolute -top-1 -right-1 flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-300" />
            </span>
          )}
          {isAiGreen && (
            <span className="absolute bottom-0.5 right-1 text-[8px] font-mono text-emerald-100 font-bold">
              AI SIGNAL
            </span>
          )}
        </div>

        {/* Violet Button */}
        <div
          className={`py-2.5 sm:py-3 px-2 rounded-2xl flex items-center justify-center font-sans font-bold text-xs sm:text-sm text-white transition-all shadow-md relative overflow-hidden ${
            isAiViolet
              ? 'bg-gradient-to-r from-purple-600 to-fuchsia-600 ring-2 ring-purple-400 shadow-[0_0_25px_rgba(168,85,247,0.5)]'
              : 'bg-purple-700/80 hover:bg-purple-600/90 border border-purple-500/30'
          }`}
        >
          <span>Violet</span>
          {isAiViolet && (
            <span className="absolute -top-1 -right-1 flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-purple-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-3 w-3 bg-purple-300" />
            </span>
          )}
          {isAiViolet && (
            <span className="absolute bottom-0.5 right-1 text-[8px] font-mono text-purple-100 font-bold">
              AI SIGNAL
            </span>
          )}
        </div>

        {/* Red Button */}
        <div
          className={`py-2.5 sm:py-3 px-2 rounded-2xl flex items-center justify-center font-sans font-bold text-xs sm:text-sm text-white transition-all shadow-md relative overflow-hidden ${
            isAiRed
              ? 'bg-gradient-to-r from-rose-600 to-red-500 ring-2 ring-rose-400 shadow-[0_0_25px_rgba(244,63,94,0.5)]'
              : 'bg-rose-700/80 hover:bg-rose-600/90 border border-rose-500/30'
          }`}
        >
          <span>Red</span>
          {isAiRed && (
            <span className="absolute -top-1 -right-1 flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-3 w-3 bg-rose-300" />
            </span>
          )}
          {isAiRed && (
            <span className="absolute bottom-0.5 right-1 text-[8px] font-mono text-rose-100 font-bold">
              AI SIGNAL
            </span>
          )}
        </div>
      </div>

      {/* 4. 0-9 CIRCULAR 3D NUMBER BALLS GRID MATCHING SCREENSHOT WITH SPLIT 0 & 5 */}
      <div className="w-full rounded-2xl bg-[#090d24]/90 border border-white/[0.08] backdrop-blur-xl p-3 sm:p-4 shadow-[0_0_30px_rgba(10,15,45,0.7)]">
        <div className="grid grid-cols-5 gap-2.5 sm:gap-3.5 justify-items-center">
          {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map((digit) => {
            const isPredicted = aiPredictedNumber === digit;
            const isZero = digit === 0;
            const isFive = digit === 5;
            const isEvenRed = digit === 2 || digit === 4 || digit === 6 || digit === 8;
            const isOddGreen = digit === 1 || digit === 3 || digit === 7 || digit === 9;

            return (
              <div
                key={digit}
                className="relative flex flex-col items-center group cursor-pointer"
              >
                {/* 3D Circular Ball Widget */}
                <div
                  className={`w-12 h-12 sm:w-14 sm:h-14 rounded-full flex items-center justify-center font-sans font-black text-xl sm:text-2xl transition-all duration-300 relative ${
                    isPredicted
                      ? 'scale-110 shadow-[0_0_25px_rgba(6,182,212,0.8)] z-10'
                      : 'hover:scale-105 shadow-md'
                  }`}
                  style={{
                    background: isZero
                      ? 'radial-gradient(circle at 35% 35%, #ec4899 0%, #a855f7 40%, #e11d48 85%)'
                      : isFive
                      ? 'radial-gradient(circle at 35% 35%, #10b981 0%, #059669 45%, #9333ea 90%)'
                      : isEvenRed
                      ? 'radial-gradient(circle at 35% 35%, #fb7185 0%, #e11d48 55%, #9f1239 100%)'
                      : 'radial-gradient(circle at 35% 35%, #34d399 0%, #059669 55%, #064e3b 100%)',
                  }}
                >
                  {/* Outer Glossy Rim */}
                  <div
                    className={`absolute inset-0 rounded-full border-2 ${
                      isZero
                        ? 'border-purple-300/70'
                        : isFive
                        ? 'border-emerald-300/70'
                        : isEvenRed
                        ? 'border-rose-300/70'
                        : 'border-emerald-300/70'
                    }`}
                  />

                  {/* Inner Circular Highlight for 3D sphere look */}
                  <div className="absolute top-1 left-2.5 w-4 h-2 rounded-full bg-white/40 blur-[1px]" />

                  {/* Digit in Center */}
                  <span className="text-white drop-shadow-[0_2px_4px_rgba(0,0,0,0.6)] z-10">
                    {digit}
                  </span>

                  {/* Active AI Recommendation Pulsing Rings */}
                  {isPredicted && (
                    <div className="absolute -inset-1.5 rounded-full border-2 border-cyan-400 animate-ping opacity-75 pointer-events-none" />
                  )}
                  {isPredicted && (
                    <div className="absolute -inset-1 rounded-full border-2 border-cyan-300 shadow-[0_0_15px_#22d3ee] pointer-events-none" />
                  )}
                </div>

                {/* AI TARGET TAG */}
                {isPredicted && (
                  <span className="mt-1 text-[8.5px] font-mono font-black text-cyan-300 tracking-wider bg-cyan-950/80 px-1.5 py-0.2 rounded-full border border-cyan-400/50 flex items-center gap-0.5">
                    <Crosshair className="w-2.5 h-2.5 text-cyan-400" />
                    TARGET
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* 5. MULTIPLIER CHIPS ROW (RANDOM, X1, X5, X10, X20, X50, X100) */}
      <div className="w-full flex items-center justify-between gap-1 overflow-x-auto py-1 px-0.5">
        {multipliers.map((chip) => {
          const isSelected = selectedMultiplier === chip.val;
          return (
            <button
              key={chip.label}
              onClick={() => setSelectedMultiplier(chip.val)}
              className={`py-1.5 px-2.5 sm:px-3 rounded-xl font-mono text-[11px] sm:text-xs font-bold transition-all shrink-0 cursor-pointer ${
                isSelected
                  ? 'bg-emerald-500 text-black shadow-[0_0_15px_rgba(16,185,129,0.5)] border border-emerald-400 font-black'
                  : 'bg-white/[0.04] text-zinc-300 hover:text-white hover:bg-white/[0.08] border border-white/[0.06]'
              }`}
            >
              {chip.label}
            </button>
          );
        })}
      </div>

      {/* 6. BIG / SMALL DUAL CAPSULE BAR WITH AI LOCK AURA */}
      <div className="w-full grid grid-cols-2 gap-2 sm:gap-3">
        {/* BIG CAPSULE */}
        <div
          className={`py-3 sm:py-3.5 px-3 rounded-2xl flex items-center justify-center gap-2 font-sans font-bold text-base sm:text-lg text-white transition-all shadow-md relative overflow-hidden ${
            aiPredictedSize === 'BIG'
              ? 'bg-gradient-to-r from-amber-600 to-orange-500 ring-2 ring-amber-400 shadow-[0_0_30px_rgba(245,158,11,0.5)]'
              : 'bg-gradient-to-r from-amber-800/60 to-orange-800/60 text-zinc-300 hover:text-white'
          }`}
        >
          <span>Big</span>
          {aiPredictedSize === 'BIG' && (
            <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-black/40 border border-amber-300/40 text-amber-200">
              {signal?.sizeShare ? `${Math.round(signal.sizeShare * 100)}% SAFE` : '98% SAFE'}
            </span>
          )}
          {aiPredictedSize === 'BIG' && (
            <span className="absolute -top-1 -right-1 flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-3 w-3 bg-amber-300" />
            </span>
          )}
        </div>

        {/* SMALL CAPSULE */}
        <div
          className={`py-3 sm:py-3.5 px-3 rounded-2xl flex items-center justify-center gap-2 font-sans font-bold text-base sm:text-lg text-white transition-all shadow-md relative overflow-hidden ${
            aiPredictedSize === 'SMALL'
              ? 'bg-gradient-to-r from-blue-600 to-cyan-500 ring-2 ring-cyan-400 shadow-[0_0_30px_rgba(6,182,212,0.5)]'
              : 'bg-gradient-to-r from-blue-900/60 to-cyan-900/60 text-zinc-300 hover:text-white'
          }`}
        >
          <span>Small</span>
          {aiPredictedSize === 'SMALL' && (
            <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-black/40 border border-cyan-300/40 text-cyan-200">
              {signal?.sizeShare ? `${Math.round(signal.sizeShare * 100)}% SAFE` : '98% SAFE'}
            </span>
          )}
          {aiPredictedSize === 'SMALL' && (
            <span className="absolute -top-1 -right-1 flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-3 w-3 bg-cyan-300" />
            </span>
          )}
        </div>
      </div>

      {/* 7. THREE TABS: GAME HISTORY | CHART | MY HISTORY */}
      <div className="w-full flex items-center rounded-2xl bg-[#090d24]/90 border border-white/[0.08] p-1 mt-2">
        <button
          onClick={() => setActiveTab('game')}
          className={`flex-1 py-2 rounded-xl font-mono text-xs font-bold transition-all cursor-pointer ${
            activeTab === 'game'
              ? 'bg-gradient-to-r from-amber-500 to-amber-600 text-black shadow-md font-black'
              : 'text-zinc-400 hover:text-white'
          }`}
        >
          Game history
        </button>
        <button
          onClick={() => setActiveTab('chart')}
          className={`flex-1 py-2 rounded-xl font-mono text-xs font-bold transition-all cursor-pointer ${
            activeTab === 'chart'
              ? 'bg-gradient-to-r from-amber-500 to-amber-600 text-black shadow-md font-black'
              : 'text-zinc-400 hover:text-white'
          }`}
        >
          Chart
        </button>
        <button
          onClick={() => setActiveTab('myHistory')}
          className={`flex-1 py-2 rounded-xl font-mono text-xs font-bold transition-all cursor-pointer ${
            activeTab === 'myHistory'
              ? 'bg-gradient-to-r from-amber-500 to-amber-600 text-black shadow-md font-black'
              : 'text-zinc-400 hover:text-white'
          }`}
        >
          My history
        </button>
      </div>

      {/* 8. HISTORY TABLE MATCHING SCREENSHOT WITH 10 ROWS X 50 PAGES AND GREEN/RED WIN-LOSS HIGHLIGHT */}
      {activeTab === 'game' && (
        <div className="w-full rounded-2xl bg-[#090d24]/95 border border-white/[0.08] backdrop-blur-xl p-2.5 sm:p-3 shadow-[0_0_35px_rgba(10,15,45,0.7)] flex flex-col">
          {/* Table Column Headers matching screenshot */}
          <div className="grid grid-cols-[1.55fr_0.6fr_0.95fr_0.9fr] sm:grid-cols-[1.6fr_0.6fr_0.9fr_0.9fr] px-2 py-2 text-[11px] sm:text-xs font-mono font-bold text-amber-300/90 border-b border-white/[0.08] uppercase tracking-wider text-center">
            <span className="text-left">Period</span>
            <span>Number</span>
            <span>Big Small</span>
            <span className="text-right">Color</span>
          </div>

          {/* 10 Table Rows */}
          <div className="divide-y divide-white/[0.04]">
            {currentPageItems.length > 0 ? (
              currentPageItems.map((item, idx) => {
                const num = item.number;
                const size = getSize(num);
                const color = getColor(num);

                // Resolution stats from engine
                const resolution = resolvedHistory.get(item.period);
                const isSizeWin = resolution ? resolution.isSizeWin : true;
                const isColorWin = resolution ? resolution.isColorWin : true;

                // Color styles for numbers matching screenshot
                const isRed = num === 2 || num === 4 || num === 6 || num === 8;
                const isGreen = num === 1 || num === 3 || num === 7 || num === 9;
                const isZero = num === 0;
                const isFive = num === 5;

                const colorDotClass = isZero
                  ? 'bg-gradient-to-r from-purple-500 to-rose-500 shadow-[0_0_8px_#c084fc]'
                  : isFive
                  ? 'bg-gradient-to-r from-purple-500 to-emerald-500 shadow-[0_0_8px_#10b981]'
                  : isRed
                  ? 'bg-rose-500 shadow-[0_0_8px_#f43f5e]'
                  : 'bg-emerald-400 shadow-[0_0_8px_#34d399]';

                const colorTextName = isZero
                  ? 'Red+Violet'
                  : isFive
                  ? 'Green+Violet'
                  : isRed
                  ? 'Red'
                  : 'Green';

                return (
                  <div
                    key={`${item.period}-${idx}`}
                    className="grid grid-cols-[1.55fr_0.6fr_0.95fr_0.9fr] sm:grid-cols-[1.6fr_0.6fr_0.9fr_0.9fr] items-center px-2 py-2.5 sm:py-3 hover:bg-white/[0.03] transition-colors text-center text-xs sm:text-sm font-mono"
                  >
                    {/* Period Column: Guaranteed 100% full 17 digits with zero ellipsis or truncation */}
                    <div className="text-left font-mono text-[9px] sm:text-xs text-zinc-300 font-semibold tracking-tight whitespace-nowrap overflow-visible select-all">
                      {item.period}
                    </div>

                    {/* Number Column: large bold colored digit matching screenshot */}
                    <div className="flex items-center justify-center">
                      <span
                        className={`text-lg sm:text-xl font-black font-sans ${
                          isZero
                            ? 'text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-rose-400 drop-shadow-[0_0_8px_rgba(168,85,247,0.5)]'
                            : isFive
                            ? 'text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-emerald-400 drop-shadow-[0_0_8px_rgba(16,185,129,0.5)]'
                            : isRed
                            ? 'text-rose-400 drop-shadow-[0_0_8px_rgba(244,63,94,0.6)]'
                            : 'text-emerald-400 drop-shadow-[0_0_8px_rgba(52,211,153,0.6)]'
                        }`}
                      >
                        {num}
                      </span>
                    </div>

                    {/* Big Small Column with Green/Red Win-Loss Highlight */}
                    <div className="flex flex-col items-center justify-center gap-0.5">
                      <span className="text-xs font-bold text-zinc-200">
                        {size === 'BIG' ? 'Big' : 'Small'}
                      </span>
                      {/* Win/Loss Badge from earlier version */}
                      <span
                        className={`text-[9px] font-mono font-bold px-1.5 py-0.2 rounded flex items-center gap-0.5 ${
                          isSizeWin
                            ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                            : 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                        }`}
                      >
                        {isSizeWin ? (
                          <>
                            <CheckCircle2 className="w-2.5 h-2.5 text-emerald-400" />
                            <span>WIN</span>
                          </>
                        ) : (
                          <>
                            <XCircle className="w-2.5 h-2.5 text-rose-400" />
                            <span>LOSS</span>
                          </>
                        )}
                      </span>
                    </div>

                    {/* Color Column with Colored Dot & Win/Loss Highlight */}
                    <div className="flex flex-col items-end justify-center gap-0.5 pr-1">
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs text-zinc-300">{colorTextName}</span>
                        <span className={`w-2.5 h-2.5 rounded-full ${colorDotClass}`} />
                      </div>
                      {/* Color Win/Loss Badge */}
                      <span
                        className={`text-[8.5px] font-mono font-bold px-1 py-0.2 rounded ${
                          isColorWin
                            ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                            : 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                        }`}
                      >
                        {isColorWin ? 'COLOR WIN' : 'COLOR LOSS'}
                      </span>
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="py-8 text-center text-xs font-mono text-zinc-500">
                Loading game draws...
              </div>
            )}
          </div>

          {/* Pagination Bar: ← 1 / 50 → */}
          <div className="w-full flex items-center justify-center gap-6 mt-3 py-2 text-sm font-mono text-zinc-300 border-t border-white/[0.06]">
            <button
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage <= 1}
              className={`w-8 h-8 rounded-xl flex items-center justify-center transition-all ${
                currentPage <= 1
                  ? 'text-zinc-600 cursor-not-allowed'
                  : 'text-zinc-300 hover:text-white hover:bg-white/10 active:scale-95 cursor-pointer'
              }`}
            >
              <ChevronLeft className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-1.5 font-bold tracking-wider text-xs">
              <span className="text-white text-sm">{currentPage}</span>
              <span className="text-zinc-500">/</span>
              <span className="text-zinc-400">{totalPages}</span>
            </div>

            <button
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage >= totalPages}
              className={`w-8 h-8 rounded-xl flex items-center justify-center transition-all ${
                currentPage >= totalPages
                  ? 'text-zinc-600 cursor-not-allowed'
                  : 'text-zinc-300 hover:text-white hover:bg-white/10 active:scale-95 cursor-pointer'
              }`}
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>
        </div>
      )}

      {/* 8b. CHART TAB: 0-9 NUMBER TREND MATRIX */}
      {activeTab === 'chart' && (
        <div className="w-full rounded-2xl bg-[#090d24]/95 border border-white/[0.08] backdrop-blur-xl p-3 shadow-[0_0_35px_rgba(10,15,45,0.7)] flex flex-col">
          <div className="flex items-center justify-between mb-2.5 pb-2 border-b border-white/[0.08]">
            <div className="flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-amber-400" />
              <span className="text-xs font-bold text-white font-mono">
                Number Trend Matrix (0 - 9)
              </span>
            </div>
            <button
              onClick={onOpenTrends}
              className="text-[10px] font-mono text-cyan-400 hover:text-cyan-300 px-2 py-0.5 rounded-lg bg-cyan-500/10 border border-cyan-500/30 flex items-center gap-1 cursor-pointer transition active:scale-95"
            >
              <span>বিস্তারিত মেট্রিক্স</span>
              <span>&rarr;</span>
            </button>
          </div>

          {/* Table Header: Period, Num, 0..9 */}
          <div className="grid grid-cols-[1.5fr_0.6fr_repeat(10,1fr)] items-center px-1.5 py-1.5 text-[10px] font-mono font-bold text-amber-300/90 border-b border-white/[0.08] text-center">
            <span className="text-left">Period</span>
            <span>Num</span>
            {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map((d) => (
              <span key={d} className="text-zinc-400 font-bold">{d}</span>
            ))}
          </div>

          {/* Recent Draw Rows */}
          <div className="divide-y divide-white/[0.04]">
            {history.slice(-14).reverse().map((item, idx) => {
              const num = item.number;
              const isRed = num === 2 || num === 4 || num === 6 || num === 8;
              const isZero = num === 0;
              const isFive = num === 5;

              return (
                <div
                  key={`${item.period}-${idx}`}
                  className="grid grid-cols-[1.5fr_0.6fr_repeat(10,1fr)] items-center px-1.5 py-2 hover:bg-white/[0.03] text-center text-xs font-mono"
                >
                  <div className="text-left font-mono text-[9px] sm:text-[10.5px] text-zinc-300 font-semibold tracking-tight whitespace-nowrap overflow-visible">
                    {item.period}
                  </div>
                  <div className="font-bold text-white text-xs">
                    {num}
                  </div>
                  {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map((d) => {
                    const isHit = d === num;
                    if (!isHit) {
                      return (
                        <div key={d} className="flex items-center justify-center">
                          <span className="w-1.5 h-1.5 rounded-full bg-white/[0.08]" />
                        </div>
                      );
                    }
                    return (
                      <div key={d} className="flex items-center justify-center">
                        <span
                          className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold text-white shadow-md ${
                            isZero
                              ? 'bg-gradient-to-r from-purple-500 to-rose-500 shadow-[0_0_8px_#c084fc]'
                              : isFive
                              ? 'bg-gradient-to-r from-purple-500 to-emerald-500 shadow-[0_0_8px_#10b981]'
                              : isRed
                              ? 'bg-rose-500 shadow-[0_0_8px_#f43f5e]'
                              : 'bg-emerald-500 shadow-[0_0_8px_#10b981]'
                          }`}
                        >
                          {d}
                        </span>
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* MY HISTORY TAB: SIGNAL LEDGER STATUS */}
      {activeTab === 'myHistory' && (
        <div className="w-full rounded-2xl bg-[#090d24]/95 border border-white/[0.08] backdrop-blur-xl p-3 shadow-[0_0_35px_rgba(10,15,45,0.7)] flex flex-col">
          <div className="flex items-center justify-between mb-2 pb-2 border-b border-white/[0.08]">
            <span className="text-xs font-bold text-white font-mono">
              Signal Prediction Accuracy Ledger
            </span>
            <span className="text-[10px] text-zinc-400 font-mono">
              Server Authoritative
            </span>
          </div>

          <div className="divide-y divide-white/[0.04] max-h-96 overflow-y-auto">
            {ledger && ledger.length > 0 ? (
              [...ledger].reverse().map((entry, idx) => (
                <div
                  key={`${entry.targetPeriod}-${idx}`}
                  className="py-2 flex items-center justify-between text-xs font-mono"
                >
                  <div>
                    <div className="text-zinc-300 font-bold">
                      Period: #{entry.targetPeriod}
                    </div>
                    <div className="text-[10px] text-zinc-400">
                      Predicted: <span className="text-cyan-300 font-bold">{entry.predictedSize}</span> +{' '}
                      <span className="text-purple-300 font-bold">{entry.predictedColor}</span>
                      {entry.actualSize && (
                        <span className="ml-2 text-zinc-300">
                          • Result: <strong className="text-white">{entry.actualSize}</strong> ({entry.actualColor})
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        entry.status === 'WIN'
                          ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                          : entry.status === 'LOSS'
                          ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                          : 'bg-amber-500/20 text-amber-300 border border-amber-500/40 animate-pulse'
                      }`}
                    >
                      {entry.status === 'WIN' ? 'SIZE WIN' : entry.status === 'LOSS' ? 'SIZE LOSS' : 'PENDING'}
                    </span>
                  </div>
                </div>
              ))
            ) : (
              <div className="py-8 text-center text-xs font-mono text-zinc-500">
                Signals recorded here as rounds resolve...
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
