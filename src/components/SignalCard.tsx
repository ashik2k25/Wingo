import React, { useState } from 'react';
import { Signal, Timeframe, SourceMode } from '../types';
import { Orb } from './Orb';
import { CategoryBadge } from './CategoryBadge';
import { TIMEFRAME_LABELS, sharePercent, getColor, getDisplayColorName, isPeriodExpired } from '../utils/engine';
import { Radio, Minus, Zap, Info, AlertCircle, BarChart3, ChevronDown, ChevronUp, ShieldCheck, Sparkles, RefreshCw } from 'lucide-react';
import { playGenerateChime } from '../utils/audio';

interface SignalCardProps {
  signal: Signal | null;
  timeframe: Timeframe;
  historyLength: number;
  latestPeriod?: string | null;
  sourceMode: SourceMode;
  isFetching: boolean;
  errorMessage?: string;
  infoMessage?: string;
  updatedAt: string | null;
  onGenerate: () => void;
  onHide: () => void;
  onOpenShield?: () => void;
}

export const SignalCard: React.FC<SignalCardProps> = ({
  signal,
  timeframe,
  historyLength,
  latestPeriod,
  sourceMode,
  isFetching,
  errorMessage,
  infoMessage,
  updatedAt,
  onGenerate,
  onHide,
  onOpenShield,
}) => {
  const [showDist, setShowDist] = useState(false);
  const isResolving = Boolean(signal && latestPeriod && isPeriodExpired(signal.targetPeriod, latestPeriod));

  const getSubStatusText = () => {
    if (isResolving) return 'RESOLVING DRAW';
    if (errorMessage && sourceMode === 'api') return 'SYNC RECONNECTING';
    if (sourceMode === 'api') return 'CLOUD LIVE SYNC';
    if (sourceMode === 'manual') return 'MANUAL DATASET';
    if (sourceMode === 'simulated') return 'SIMULATED FEED';
    return 'STANDBY';
  };

  const handleGenerateClick = () => {
    playGenerateChime();
    onGenerate();
  };

  const formattedTime = updatedAt
    ? new Date(updatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
    : 'LIVE';

  return (
    <div className="w-full rounded-3xl glass-panel p-4 sm:p-5 relative overflow-hidden transition-all duration-300">
      {/* Ambient Aura Lighting Overlays */}
      <div className="absolute -top-24 left-1/2 -translate-x-1/2 w-72 h-36 bg-emerald-500/10 blur-3xl pointer-events-none rounded-full" />
      <div className="absolute top-1/2 -right-20 w-48 h-48 bg-purple-500/10 blur-3xl pointer-events-none rounded-full" />
      <div className="absolute -bottom-20 -left-20 w-48 h-48 bg-teal-500/10 blur-3xl pointer-events-none rounded-full" />

      {/* Classy Header */}
      <div className="flex items-center justify-between min-h-[44px] mb-3 relative z-10">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-emerald-400 to-teal-600 flex items-center justify-center text-[#051a14] shadow-lg shadow-emerald-500/20">
            <Radio className="w-4 h-4 animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-xs font-black tracking-widest uppercase text-white">
                VIP SIGNAL INTELLIGENCE
              </h3>
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
            </div>
            <p className="text-[9px] font-bold tracking-wider text-slate-400 uppercase mt-0.5">
              {getSubStatusText()} · {TIMEFRAME_LABELS[timeframe]}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          {onOpenShield && (
            <button
              onClick={onOpenShield}
              className="w-8 h-8 rounded-xl flex items-center justify-center text-emerald-400 hover:text-emerald-200 hover:bg-emerald-500/10 border border-emerald-500/20 transition-all cursor-pointer"
              title="Stealth Anti-Detection Guide"
            >
              <ShieldCheck className="w-4 h-4" />
            </button>
          )}

          <button
            onClick={onHide}
            className="w-8 h-8 rounded-xl flex items-center justify-center text-slate-400 hover:text-white hover:bg-white/5 border border-white/5 transition-all cursor-pointer"
            title="Minimize signal panel"
          >
            <Minus className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Main Signal Display Surface */}
      <div className="rounded-2xl glass-panel-subtle p-4 flex flex-col items-center relative z-10">
        {/* Round Meta Capsule */}
        <div className="w-full flex items-center justify-between pb-3 border-b border-white/[0.06]">
          <span className="text-[9px] font-extrabold tracking-widest uppercase text-slate-400 flex items-center gap-1">
            <Sparkles className="w-3 h-3 text-emerald-400" />
            <span>TARGET ROUND</span>
          </span>
          {isResolving ? (
            <span className="text-xs font-mono font-bold tracking-wider text-amber-300 bg-amber-400/10 px-2.5 py-0.5 rounded-lg border border-amber-400/20 flex items-center gap-1.5 animate-pulse">
              <RefreshCw className="w-3 h-3 animate-spin text-amber-400" />
              <span>SYNCING NEXT ROUND...</span>
            </span>
          ) : (
            <span className="text-xs font-mono font-bold tracking-wider text-amber-300 bg-amber-400/10 px-2.5 py-0.5 rounded-lg border border-amber-400/20">
              {signal?.targetPeriod || '—'}
            </span>
          )}
        </div>

        {/* Central Orb Display with Ambient Halo */}
        <div className="flex flex-col items-center py-4 relative">
          <div className="relative flex items-center justify-center">
            {/* Ambient Aura Halo Ring */}
            <div className="absolute inset-0 rounded-full bg-gradient-to-r from-emerald-500/20 to-purple-500/20 blur-xl scale-125 pointer-events-none" />

            {signal ? (
              <Orb number={signal.number} color={signal.color} />
            ) : (
              <div className="w-[96px] h-[96px] rounded-full border border-dashed border-white/20 bg-white/[0.02] flex items-center justify-center text-slate-400">
                {isFetching ? (
                  <div className="w-8 h-8 border-2 border-emerald-400 border-t-transparent rounded-full animate-spin" />
                ) : (
                  <span className="text-2xl font-mono font-bold text-slate-500">#</span>
                )}
              </div>
            )}
          </div>

          <span className="text-[9px] font-extrabold tracking-widest uppercase text-slate-400 mt-3 font-mono">
            {signal
              ? `${sharePercent(signal.numberShare)} STATISTICAL ACCURACY`
              : historyLength
              ? `${historyLength} DRAWS ANALYZED`
              : 'AWAITING DRAWS'}
          </span>
        </div>

        {/* Signal Badges (Size & Color) */}
        {signal ? (
          <div className="w-full flex flex-row gap-2.5 mt-1">
            <CategoryBadge
              label="SIZE PREDICTION"
              value={signal.size}
              share={signal.sizeShare}
              color={signal.size === 'BIG' ? '#f59e0b' : '#38bdf8'}
            />
            <CategoryBadge
              label="COLOR PREDICTION"
              value={getDisplayColorName(signal.color)}
              share={signal.colorShare}
              color={
                signal.color === 'GREEN' || signal.color === 'GREEN_VIOLET'
                  ? '#10b981'
                  : signal.color === 'RED' || signal.color === 'RED_VIOLET'
                  ? '#ef4444'
                  : '#a855f7'
              }
            />
          </div>
        ) : (
          <div className="py-2 text-center text-xs text-slate-400">
            {historyLength < 5
              ? `${Math.max(0, 5 - historyLength)} more results needed`
              : 'Connecting to live server draw stream...'}
          </div>
        )}

        {/* Clean Classy Recommended Play Capsule */}
        {signal && (
          <div className="w-full mt-3 space-y-2">
            <div className="p-3 rounded-2xl border border-white/[0.08] bg-white/[0.03] backdrop-blur-md flex items-center justify-between transition-all hover:border-emerald-500/30">
              <div className="flex items-center gap-2">
                <span className="text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-md bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  RECOMMENDED PLAY
                </span>
                <span className="text-xs sm:text-sm font-extrabold text-white font-mono">
                  {signal.primaryBet === 'COLOR'
                    ? `COLOR: ${getDisplayColorName(signal.color)}`
                    : `SIZE: ${signal.size}`}
                </span>
              </div>
              <span className="text-[9px] font-bold uppercase tracking-wider font-mono text-emerald-400/90">
                {signal.primaryBet === 'COLOR' ? 'SAFE HEDGE' : 'TREND ACTIVE'}
              </span>
            </div>

            {/* VIP Staking & Anti-Loss Circuit Breaker Bar */}
            <div className="grid grid-cols-2 gap-2">
              <div className="p-2.5 rounded-xl border border-white/[0.06] bg-black/30 flex items-center justify-between">
                <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                  STAKING LEVEL
                </span>
                <span
                  className={`text-[10px] font-black font-mono px-2 py-0.5 rounded-md ${
                    signal.consecutiveLosses && signal.consecutiveLosses >= 2
                      ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                      : signal.consecutiveLosses === 1
                      ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                      : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                  }`}
                >
                  {signal.stakingLevel || 'LEVEL 1 (1X)'}
                </span>
              </div>

              <div className="p-2.5 rounded-xl border border-white/[0.06] bg-black/30 flex items-center justify-between">
                <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                  CIRCUIT BREAKER
                </span>
                <span
                  className={`text-[10px] font-black font-mono px-2 py-0.5 rounded-md ${
                    signal.lossStreakPrevented
                      ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30 animate-pulse'
                      : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                  }`}
                >
                  {signal.consecutiveLosses && signal.consecutiveLosses >= 3
                    ? `EMERGENCY LOCK (${signal.consecutiveLosses}/3)`
                    : signal.consecutiveLosses && signal.consecutiveLosses >= 2
                    ? `LOCKED (RECOVERY)`
                    : signal.lossStreakPrevented
                    ? 'LOCKED (LEVEL 3)'
                    : `GUARD: ${signal.consecutiveLosses || 0}/3`}
                </span>
              </div>
            </div>

            {/* Subtle Classy Strategic Insight */}
            {signal.advisoryNote && (
              <div className="px-3 py-2 rounded-xl border border-white/[0.05] bg-white/[0.02] flex items-center justify-between text-[10px] text-slate-300">
                <span className="truncate pr-2">
                  <span className="text-emerald-400 font-bold mr-1.5">💡 INTEL:</span>
                  {signal.advisoryNote}
                </span>
                {signal.hedgeTip && (
                  <span className="text-amber-300 font-medium shrink-0">
                    {signal.hedgeTip}
                  </span>
                )}
              </div>
            )}
          </div>
        )}

        {/* Toggle Detailed Markov Digit Probabilities */}
        {signal && (
          <div className="w-full mt-3 pt-2 border-t border-white/[0.06]">
            <button
              onClick={() => setShowDist(!showDist)}
              className="w-full flex items-center justify-between text-[10px] font-bold text-slate-400 hover:text-white py-1 transition-colors cursor-pointer"
            >
              <span className="flex items-center gap-1.5">
                <BarChart3 className="w-3.5 h-3.5 text-emerald-400" />
                <span>0-9 Markov Probability Distribution</span>
              </span>
              {showDist ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            </button>

            {showDist && (
              <div className="grid grid-cols-10 gap-1 mt-2.5 pt-1 pb-1">
                {signal.numberDistribution.map((prob, digit) => {
                  const isTop = digit === signal.number;
                  const col = getColor(digit);
                  const barColor =
                    col === 'GREEN'
                      ? '#10b981'
                      : col === 'RED'
                      ? '#ef4444'
                      : col === 'RED_VIOLET'
                      ? '#f87171'
                      : col === 'GREEN_VIOLET'
                      ? '#34d399'
                      : '#a855f7';

                  return (
                    <div key={digit} className="flex flex-col items-center">
                      <div className="w-full h-12 bg-black/40 rounded-md relative flex items-end overflow-hidden p-0.5 border border-white/[0.04]">
                        <div
                          className="w-full rounded transition-all duration-500"
                          style={{
                            height: `${Math.min(100, Math.max(10, prob * 350))}%`,
                            backgroundColor: isTop ? barColor : `${barColor}55`,
                            boxShadow: isTop ? `0 0 10px ${barColor}` : 'none',
                          }}
                        />
                      </div>
                      <span className={`text-[10px] font-mono mt-1 ${isTop ? 'font-black text-emerald-400' : 'text-slate-400'}`}>
                        {digit}
                      </span>
                      <span className="text-[8px] font-mono text-slate-500">
                        {(prob * 100).toFixed(0)}%
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Info Notice */}
      {infoMessage && (
        <div className="rounded-xl border border-amber-400/30 bg-amber-400/10 px-3 py-2 flex items-start gap-2 mt-3 text-amber-200 text-xs">
          <Info className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
          <p className="leading-tight">{infoMessage}</p>
        </div>
      )}

      {/* Error Notice */}
      {errorMessage && (
        <div className="rounded-xl border border-rose-400/30 bg-rose-400/10 px-3 py-2 flex items-start gap-2 mt-3 text-rose-200 text-xs">
          <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
          <p className="leading-tight">{errorMessage}</p>
        </div>
      )}

      {/* Generate Button with Classy Aura Gradient */}
      <button
        onClick={handleGenerateClick}
        disabled={isFetching}
        className="w-full min-h-[46px] rounded-2xl bg-gradient-to-r from-emerald-500 via-teal-400 to-emerald-400 hover:from-emerald-400 hover:to-teal-300 active:scale-[0.99] text-[#051a14] font-black text-xs tracking-widest uppercase flex items-center justify-center gap-2 mt-3.5 shadow-lg shadow-emerald-500/25 transition-all cursor-pointer disabled:opacity-60 relative z-10"
      >
        <Zap className="w-4 h-4 fill-current" />
        <span>CALCULATE SIGNAL</span>
      </button>

      {/* Panel Footer */}
      <div className="flex items-center justify-between pt-3 text-[9px] font-bold text-slate-400 uppercase tracking-wider relative z-10">
        <div className="flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
          <span>
            {historyLength} DRAWS ANALYZED · {formattedTime}
          </span>
        </div>

        <span className="font-mono text-slate-400">{TIMEFRAME_LABELS[timeframe]}</span>
      </div>
    </div>
  );
};
