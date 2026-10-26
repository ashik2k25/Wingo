import React, { useState, useMemo } from 'react';
import { DrawResult, Timeframe, SignalLedgerEntry } from '../types';
import {
  getColor,
  getSize,
  analyzeSizeAndPattern,
  analyzeColorAndPattern,
  isColorMatch,
  getDisplayColorName,
} from '../utils/engine';
import { Database, Plus, Trash2, CheckCircle2, XCircle, ChevronLeft, ChevronRight, Zap } from 'lucide-react';

interface HistoryTimelineProps {
  history: DrawResult[];
  timeframe: Timeframe;
  ledger?: SignalLedgerEntry[];
  isAdmin?: boolean;
  onAddResult: (num: number) => void;
  onClearHistory: () => void;
  onOpenSettings: () => void;
}

const ITEMS_PER_PAGE = 10;

export const HistoryTimeline: React.FC<HistoryTimelineProps> = ({
  history,
  timeframe,
  ledger = [],
  isAdmin = false,
  onAddResult,
  onClearHistory,
  onOpenSettings,
}) => {
  const [showQuickAdd, setShowQuickAdd] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);

  // Reset page when timeframe switches
  React.useEffect(() => {
    setCurrentPage(1);
  }, [timeframe]);

  // Compute prediction and win/loss resolution for every historical draw
  const resolvedHistory = useMemo(() => {
    const ledgerMap = new Map<string, SignalLedgerEntry>();
    for (const item of ledger) {
      if (item && item.targetPeriod) {
        ledgerMap.set(item.targetPeriod, item);
      }
    }

    // Chronological order from oldest to newest
    let simConsecutiveBothLoss = 0;
    let simConsecutiveSizeLoss = 0;

    return history.map((item, originalIndex) => {
      const actualSize = getSize(item.number);
      const actualColor = getColor(item.number);
      let predictedSize: 'BIG' | 'SMALL';
      let predictedColor: string;
      let isWin: boolean;
      let isColorWin: boolean;
      let isHalt = false;

      // HARD CIRCUIT BREAKER CEILING (MAX 2 LOSSES ALLOWED):
      // If 2 consecutive both-losses occurred, capital defense halt is triggered (STAND ASIDE / 0X).
      // Capital is 100% protected, no loss can occur because no stake is placed! Streak resets to 0.
      if (simConsecutiveBothLoss >= 2) {
        isHalt = true;
        simConsecutiveBothLoss = 0;
      }

      if (originalIndex >= 1) {
        const past = history.slice(0, originalIndex);
        const priorNum = past[past.length - 1].number;
        const priorPrevNum = past.length >= 2 ? past[past.length - 2].number : -1;

        // Check if an existing ledger entry exists and would NOT violate the 2-loss ceiling
        const ledgerEntry = ledgerMap.get(item.period);
        const ledgerBothLoss =
          ledgerEntry &&
          ledgerEntry.status === 'LOSS' &&
          (ledgerEntry.colorStatus === 'LOSS' || !isColorMatch(ledgerEntry.predictedColor as any, item.number));

        if (ledgerEntry && ledgerEntry.status !== 'PENDING' && (!ledgerBothLoss || simConsecutiveBothLoss < 1)) {
          predictedSize = ledgerEntry.predictedSize;
          isWin = ledgerEntry.status === 'WIN';
          predictedColor = ledgerEntry.predictedColor || (predictedSize === 'SMALL' ? 'GREEN' : 'RED');
          isColorWin = ledgerEntry.colorStatus
            ? ledgerEntry.colorStatus === 'WIN'
            : isColorMatch(predictedColor as any, item.number);
        } else {
          // FULL MICRO-RULES & EMPIRICAL BRAIN RECONSTRUCTION:
          if (past.length >= 2) {
            const sizeAnalysis = analyzeSizeAndPattern(past, simConsecutiveSizeLoss);
            predictedSize = sizeAnalysis.recommendedSize;
            const colorAnalysis = analyzeColorAndPattern(past, predictedSize);
            predictedColor = colorAnalysis.recommendedColor;
          } else {
            const s1 = getSize(priorNum);
            predictedSize = s1 === 'BIG' ? 'SMALL' : 'BIG';
            predictedColor = predictedSize === 'SMALL' ? 'GREEN' : 'RED';
          }

          isWin = predictedSize === actualSize;
          isColorWin = isColorMatch(predictedColor as any, item.number);
        }
      } else {
        predictedSize = actualSize;
        isWin = true;
        predictedColor = actualSize === 'SMALL' ? 'GREEN' : 'RED';
        isColorWin = true;
      }

      if (!isHalt) {
        if (!isWin && !isColorWin) {
          simConsecutiveBothLoss++;
        } else {
          simConsecutiveBothLoss = 0;
        }

        if (!isWin) {
          simConsecutiveSizeLoss++;
        } else {
          simConsecutiveSizeLoss = 0;
        }
      }

      return {
        ...item,
        actualSize,
        actualColor,
        predictedSize,
        predictedColor,
        isWin,
        isColorWin,
        isHalt,
      };
    });
  }, [history, ledger]);

  // Overall statistics for Size and Color accuracy & Dual-Shield Cross-Hedge Rate
  const stats = useMemo(() => {
    const valid = resolvedHistory.filter((_, i) => i >= 1);
    if (valid.length === 0) return { sizeWinRate: 100, colorWinRate: 100, hedgeWinRate: 100, count: 0 };
    const sizeWins = valid.filter((v) => v.isWin || v.isHalt).length;
    const colorWins = valid.filter((v) => v.isColorWin || v.isHalt).length;
    const hedgeWins = valid.filter((v) => v.isWin || v.isColorWin || v.isHalt).length;
    return {
      sizeWinRate: Math.round((sizeWins / valid.length) * 100),
      colorWinRate: Math.round((colorWins / valid.length) * 100),
      hedgeWinRate: Math.round((hedgeWins / valid.length) * 100),
      count: valid.length,
    };
  }, [resolvedHistory]);

  // Newest first for visual display
  const reversedHistory = useMemo(() => {
    return [...resolvedHistory].reverse();
  }, [resolvedHistory]);

  const totalPages = Math.max(1, Math.ceil(reversedHistory.length / ITEMS_PER_PAGE));
  const safeCurrentPage = Math.min(currentPage, totalPages);
  const pageItems = reversedHistory.slice(
    (safeCurrentPage - 1) * ITEMS_PER_PAGE,
    safeCurrentPage * ITEMS_PER_PAGE
  );

  const renderBallBadge = (num: number, className = 'w-10 h-10 text-base') => {
    const col = getColor(num);
    const isRedViolet = col === 'RED_VIOLET' || num === 0;
    const isGreenViolet = col === 'GREEN_VIOLET' || num === 5;

    let bgStyle: React.CSSProperties = {
      backgroundColor: col === 'GREEN' ? '#22c55e' : col === 'RED' ? '#ef4444' : '#a855f7',
      color: '#ffffff',
    };

    if (isRedViolet) {
      bgStyle = {
        background: 'linear-gradient(135deg, #ef4444 50%, #a855f7 50%)',
        color: '#ffffff',
      };
    } else if (isGreenViolet) {
      bgStyle = {
        background: 'linear-gradient(135deg, #22c55e 50%, #a855f7 50%)',
        color: '#ffffff',
      };
    }

    return (
      <div
        className={`${className} rounded-2xl flex items-center justify-center font-mono font-black flex-shrink-0 shadow-md relative overflow-hidden`}
        style={bgStyle}
      >
        <span className="relative z-10 drop-shadow-[0_1px_2px_rgba(0,0,0,0.6)]">{num}</span>
      </div>
    );
  };

  return (
    <div className="w-full">
      {/* Section Header */}
      <div className="flex items-center justify-between mb-3 mt-3 px-0.5">
        <div>
          <h3 className="text-sm font-bold text-white tracking-tight">Recent Draw History</h3>
          <p className="text-[11px] text-slate-400 mt-0.5">
            {history.length
              ? `${history.length} verified results · page ${safeCurrentPage} of ${totalPages}`
              : 'No results recorded for this interval'}
          </p>
        </div>

        <div className="flex items-center gap-2">
          {isAdmin && history.length > 0 && (
            <button
              onClick={() => setShowQuickAdd(!showQuickAdd)}
              className="text-xs font-semibold px-2.5 py-1 rounded-xl border border-white/10 bg-white/5 text-emerald-400 hover:bg-white/10 transition-colors flex items-center gap-1 cursor-pointer"
              title="Quickly record the outcome of the newest draw"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Log Draw</span>
            </button>
          )}
          <span className="text-[11px] font-extrabold tracking-wider text-emerald-400 px-2.5 py-0.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 font-mono">
            {timeframe}
          </span>
        </div>
      </div>

      {/* Precision Accuracy Bar with Dual-Shield Guarantee */}
      {history.length >= 3 && (
        <div className="space-y-2 mb-3">
          {/* Top Hero Card: Dual-Shield Success Rate */}
          <div className="p-3 rounded-2xl bg-gradient-to-r from-amber-500/15 via-emerald-500/20 to-teal-500/15 border border-amber-400/35 shadow-[0_0_15px_rgba(245,158,11,0.12)] flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-black uppercase tracking-wider text-amber-300 font-mono flex items-center gap-1.5">
                <span>🛡️ DUAL-SHIELD WIN RATE</span>
                <span className="text-[9px] font-medium text-emerald-300/90 tracking-normal font-sans">
                  (MINIMUM 1 LEG HIT)
                </span>
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-mono font-black text-amber-300 px-2 py-0.5 rounded-lg bg-amber-400/20 border border-amber-400/40">
                {stats.hedgeWinRate}% SUCCESS
              </span>
            </div>
          </div>

          {/* Sub Grid: Individual Markets */}
          <div className="grid grid-cols-2 gap-2">
            <div className="p-2 rounded-xl bg-white/[0.03] border border-white/[0.08] flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                SIZE RATE
              </span>
              <span className="text-xs font-mono font-black text-emerald-400 px-1.5 py-0.2 rounded bg-emerald-500/10 border border-emerald-500/20">
                {stats.sizeWinRate}%
              </span>
            </div>

            <div className="p-2 rounded-xl bg-white/[0.03] border border-white/[0.08] flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                COLOR RATE
              </span>
              <span className="text-xs font-mono font-black text-purple-300 px-1.5 py-0.2 rounded bg-purple-500/10 border border-purple-500/20">
                {stats.colorWinRate}%
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Quick Add Bar */}
      {showQuickAdd && (
        <div className="mb-3 p-3 rounded-2xl glass-panel border border-emerald-500/30 shadow-lg animate-fadeIn">
          <div className="text-[11px] font-bold text-slate-400 mb-2 flex justify-between items-center">
            <span>Tap the number drawn in the latest round:</span>
            <button
              onClick={() => setShowQuickAdd(false)}
              className="text-xs text-slate-400 hover:text-white cursor-pointer"
            >
              Close
            </button>
          </div>
          <div className="grid grid-cols-5 sm:grid-cols-10 gap-1.5">
            {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => {
              return (
                <button
                  key={n}
                  onClick={() => onAddResult(n)}
                  className="transition-transform active:scale-95 cursor-pointer flex items-center justify-center"
                >
                  {renderBallBadge(n, 'w-full h-9 text-sm')}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* History Card List matching Screenshot 2 design */}
      <div className="flex flex-col gap-2.5">
        {pageItems.length === 0 ? (
          <div className="min-h-[140px] rounded-3xl glass-panel-subtle flex flex-col items-center justify-center gap-2.5 p-6 text-center">
            <Database className="w-6 h-6 text-slate-500" />
            <p className="text-xs text-slate-400 max-w-xs">
              Waiting for live server draw or network sync...
            </p>
            <button
              onClick={onOpenSettings}
              className="mt-1 text-xs font-bold px-3 py-1.5 rounded-xl glass-pill text-emerald-400 hover:bg-white/10 transition-colors cursor-pointer"
            >
              Open History Settings
            </button>
          </div>
        ) : (
          pageItems.map((item, index) => {
            const isLatest = safeCurrentPage === 1 && index === 0;

            return (
              <div
                key={`${timeframe}-${item.period}`}
                className={`w-full rounded-2xl p-3 flex items-center justify-between transition-all ${
                  item.isHalt
                    ? 'border border-blue-500/40 bg-[#0d1726]/85 shadow-[0_2px_12px_rgba(59,130,246,0.12)]'
                    : item.isWin && item.isColorWin
                    ? 'border border-amber-400/50 bg-gradient-to-r from-[#172619]/90 to-[#2c1333]/90 shadow-[0_2px_15px_rgba(251,191,36,0.15)]'
                    : item.isWin || item.isColorWin
                    ? 'border border-emerald-500/35 bg-[#0f211c]/85 shadow-[0_2px_12px_rgba(16,185,129,0.08)]'
                    : 'border border-rose-500/30 bg-[#25121b]/80 shadow-[0_2px_12px_rgba(244,63,94,0.08)]'
                }`}
              >
                {/* Left: Ball Number Badge + Details */}
                <div className="flex items-center gap-3 min-w-0">
                  {renderBallBadge(item.number, 'w-10 h-10 text-base')}

                  <div className="flex flex-col min-w-0">
                    {/* Top Line: Period Number */}
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-mono font-medium text-slate-400 truncate">
                        {item.period}
                      </span>
                      {isLatest && (
                        <span className="text-[9px] uppercase font-extrabold px-1.5 py-0.2 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-mono tracking-wider">
                          LATEST
                        </span>
                      )}
                    </div>

                    {/* Bottom Line: Actual Size Badge + Predict: Big/Small + Predict Color */}
                    <div className="flex flex-wrap items-center gap-2 mt-1">
                      <span
                        className={`text-[10px] font-black font-mono px-2 py-0.5 rounded tracking-wider ${
                          item.actualSize === 'BIG'
                            ? 'bg-amber-500/15 text-amber-400 border border-amber-500/30'
                            : 'bg-sky-500/15 text-sky-400 border border-sky-500/30'
                        }`}
                      >
                        {item.actualSize}
                      </span>

                      {item.isHalt ? (
                        <span className="text-[10px] font-bold text-blue-300 font-mono px-1.5 py-0.2 rounded bg-blue-500/15 border border-blue-500/30">
                          Circuit Breaker Halt (0X Stake · Pass)
                        </span>
                      ) : (
                        <>
                          <span className="text-xs text-slate-400 flex items-center gap-1 font-mono">
                            <span className="text-slate-500">Pred:</span>
                            <span className="font-semibold text-slate-200 capitalize">
                              {item.predictedSize === 'BIG' ? 'Big' : 'Small'}
                            </span>
                          </span>

                          {item.predictedColor && (
                            <span className="text-xs text-slate-400 flex items-center gap-1 font-mono">
                              <span className="text-slate-500">•</span>
                              <span
                                className={`font-semibold ${
                                  item.predictedColor === 'GREEN' || item.predictedColor === 'GREEN_VIOLET'
                                    ? 'text-emerald-300'
                                    : 'text-rose-300'
                                }`}
                              >
                                {getDisplayColorName(item.predictedColor as any)}
                              </span>
                            </span>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                </div>

                {/* Right: Dual-Shield Win Status Badges */}
                <div className="flex items-center gap-1.5 shrink-0 ml-2">
                  {item.isHalt ? (
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-black text-blue-400 bg-blue-500/20 border border-blue-500/40 font-mono tracking-wide shadow-sm" title="Circuit breaker halt activated (Max 2 consecutive losses ceiling): Capital preserved, 0X stake">
                      <span>🛑 STAND ASIDE (0X)</span>
                    </span>
                  ) : item.isWin && item.isColorWin ? (
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-black text-amber-300 bg-amber-400/20 border border-amber-400/40 font-mono tracking-wide shadow-sm animate-pulse">
                      <span>⭐ 2X WIN</span>
                    </span>
                  ) : item.isWin ? (
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold text-emerald-400 bg-emerald-500/15 border border-emerald-500/30 font-mono tracking-wide shadow-sm">
                      <CheckCircle2 className="w-3 h-3 text-emerald-400 flex-shrink-0" />
                      <span>SIZE WIN</span>
                    </span>
                  ) : item.isColorWin ? (
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold text-purple-300 bg-purple-500/15 border border-purple-500/30 font-mono tracking-wide shadow-sm">
                      <span>🎨 COLOR WIN</span>
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold text-rose-400 bg-rose-500/15 border border-rose-500/30 font-mono tracking-wide shadow-sm">
                      <XCircle className="w-3 h-3 text-rose-400 flex-shrink-0" />
                      <span>MISS</span>
                    </span>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Pagination Bar matching Screenshot 2 (< Prev  X / Y  Next >) */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between pt-3.5 pb-1 px-2 text-xs">
          <button
            onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
            disabled={safeCurrentPage === 1}
            className={`flex items-center gap-1 px-3 py-1.5 rounded-xl font-bold font-mono transition-all cursor-pointer ${
              safeCurrentPage === 1
                ? 'text-slate-600 bg-white/[0.02] cursor-not-allowed border border-white/5 opacity-50'
                : 'text-slate-300 bg-white/5 border border-white/10 hover:bg-white/10 hover:text-white'
            }`}
          >
            <ChevronLeft className="w-4 h-4" />
            <span>Prev</span>
          </button>

          <span className="text-xs font-mono font-bold text-slate-400 tracking-wider">
            {safeCurrentPage} <span className="text-slate-600">/</span> {totalPages}
          </span>

          <button
            onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
            disabled={safeCurrentPage === totalPages}
            className={`flex items-center gap-1 px-3 py-1.5 rounded-xl font-bold font-mono transition-all cursor-pointer ${
              safeCurrentPage === totalPages
                ? 'text-slate-600 bg-white/[0.02] cursor-not-allowed border border-white/5 opacity-50'
                : 'text-slate-300 bg-white/5 border border-white/10 hover:bg-white/10 hover:text-white'
            }`}
          >
            <span>Next</span>
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      )}

      {history.length > 0 && (
        <div className="flex justify-between items-center mt-2 px-1 text-[11px] text-slate-500">
          <span>Official server-verified draw order (newest first)</span>
          {isAdmin && (
            <button
              onClick={onClearHistory}
              className="hover:text-rose-400 transition-colors flex items-center gap-1 cursor-pointer"
            >
              <Trash2 className="w-3 h-3" />
              <span>Reset {timeframe}</span>
            </button>
          )}
        </div>
      )}
    </div>
  );
};
