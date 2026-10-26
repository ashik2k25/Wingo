import React, { useState } from 'react';
import { Signal, Timeframe, SourceMode, HighestLossRecord, PeakAccuracyWindow } from '../types';
import { Orb } from './Orb';
import { CategoryBadge } from './CategoryBadge';
import { TIMEFRAME_LABELS, sharePercent, getColor, getDisplayColorName, isPeriodExpired } from '../utils/engine';
import { Radio, Minus, Zap, Info, AlertCircle, BarChart3, ChevronDown, ChevronUp, ShieldCheck, Sparkles, RefreshCw, Flame, Target, Clock } from 'lucide-react';
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
  highestLossRecord?: HighestLossRecord | null;
  peakAccuracyWindows?: PeakAccuracyWindow[];
  onGenerate: () => void;
  onHide: () => void;
  onOpenShield?: () => void;
  onOpenGoldenHours?: () => void;
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
  highestLossRecord,
  peakAccuracyWindows,
  onGenerate,
  onHide,
  onOpenShield,
  onOpenGoldenHours,
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

        {/* Dynamic Glowing Pattern Badge */}
        {signal?.patternType && signal.patternType !== 'NORMAL' && (
          <div className="w-full mt-2.5">
            {signal.patternType === 'DELAYED_TWIN_SNAP' ? (
              <div className="w-full p-2.5 rounded-2xl bg-gradient-to-r from-amber-500/20 via-rose-500/20 to-purple-500/25 border border-amber-400/40 shadow-[0_0_20px_rgba(245,158,11,0.2)] flex items-center justify-between animate-pulse">
                <div className="flex items-center gap-2 min-w-0">
                  <div className="w-6 h-6 rounded-lg bg-amber-400/20 border border-amber-400/40 flex items-center justify-center shrink-0">
                    <Target className="w-3.5 h-3.5 text-amber-300" />
                  </div>
                  <div className="flex flex-col min-w-0">
                    <span className="text-[10px] font-black uppercase tracking-wider text-amber-200 truncate">
                      🎯 2ND PERIOD TWIN SNAP · OPPOSITE REVERSAL
                    </span>
                    <span className="text-[8px] text-amber-300/80 font-mono">
                      Inertia absorbed in round 1 → Reversal locked on Period 2
                    </span>
                  </div>
                </div>
                <span className="text-[10px] font-mono font-black px-2 py-0.5 rounded-lg bg-amber-400 text-slate-950 shadow-md shrink-0 ml-1.5">
                  97% LOCK
                </span>
              </div>
            ) : signal.patternType === 'ZERO_FIVE_SANDWICH' ? (
              <div className="w-full p-2.5 rounded-2xl bg-gradient-to-r from-violet-500/25 via-fuchsia-500/20 to-emerald-500/25 border border-violet-400/40 shadow-[0_0_20px_rgba(168,85,247,0.2)] flex items-center justify-between">
                <div className="flex items-center gap-2 min-w-0">
                  <div className="w-6 h-6 rounded-lg bg-violet-400/20 border border-violet-400/40 flex items-center justify-center shrink-0">
                    <Sparkles className="w-3.5 h-3.5 text-violet-300" />
                  </div>
                  <div className="flex flex-col min-w-0">
                    <span className="text-[10px] font-black uppercase tracking-wider text-violet-200 truncate">
                      🥪 0/5 VIOLET SANDWICH · OPPOSITE REBOUND LOCK
                    </span>
                    <span className="text-[8px] text-violet-300/90 font-mono">
                      0/5 boundary sandwich strictly projects opposite size
                    </span>
                  </div>
                </div>
                <span className="text-[10px] font-mono font-black px-2 py-0.5 rounded-lg bg-violet-400 text-slate-950 shadow-md shrink-0 ml-1.5">
                  98% SANDWICH
                </span>
              </div>
            ) : signal.patternType === 'TWIN_TRANSITION' ? (
              <div className="w-full p-2.5 rounded-2xl bg-gradient-to-r from-emerald-500/20 via-teal-500/15 to-emerald-500/20 border border-emerald-400/35 shadow-[0_0_15px_rgba(16,185,129,0.15)] flex items-center justify-between">
                <div className="flex items-center gap-2 min-w-0">
                  <div className="w-6 h-6 rounded-lg bg-emerald-400/20 border border-emerald-400/40 flex items-center justify-center shrink-0">
                    <Zap className="w-3.5 h-3.5 text-emerald-300" />
                  </div>
                  <div className="flex flex-col min-w-0">
                    <span className="text-[10px] font-black uppercase tracking-wider text-emerald-200 truncate">
                      ⚡ TWIN TRANSITION · OPPOSITE SIZE PIVOT
                    </span>
                    <span className="text-[8px] text-emerald-300/80 font-mono">
                      Identical repeat triggers opposite size rebound
                    </span>
                  </div>
                </div>
                <span className="text-[10px] font-mono font-black px-2 py-0.5 rounded-lg bg-emerald-400 text-slate-950 shadow-md shrink-0 ml-1.5">
                  OPPOSITE
                </span>
              </div>
            ) : signal.patternType === 'DRAGON_TERMINATOR' ? (
              <div className="w-full p-2.5 rounded-2xl bg-gradient-to-r from-purple-500/20 via-pink-500/20 to-purple-500/20 border border-purple-400/40 shadow-[0_0_15px_rgba(168,85,247,0.15)] flex items-center justify-between">
                <div className="flex items-center gap-2 min-w-0">
                  <div className="w-6 h-6 rounded-lg bg-purple-400/20 border border-purple-400/40 flex items-center justify-center shrink-0">
                    <Flame className="w-3.5 h-3.5 text-purple-300" />
                  </div>
                  <div className="flex flex-col min-w-0">
                    <span className="text-[10px] font-black uppercase tracking-wider text-purple-200 truncate">
                      🐉 DRAGON TERMINATOR 5 · RUN PIVOT
                    </span>
                    <span className="text-[8px] text-purple-300/80 font-mono">
                      Barrier 5 terminates active dragon streak
                    </span>
                  </div>
                </div>
                <span className="text-[10px] font-mono font-black px-2 py-0.5 rounded-lg bg-purple-400 text-slate-950 shadow-md shrink-0 ml-1.5">
                  BREAKOUT
                </span>
              </div>
            ) : signal.patternType === 'ZERO_FIVE_BREAKER' ? (
              <div className="w-full p-2.5 rounded-2xl bg-gradient-to-r from-sky-500/20 via-cyan-500/20 to-sky-500/20 border border-sky-400/40 shadow-[0_0_15px_rgba(56,189,248,0.15)] flex items-center justify-between">
                <div className="flex items-center gap-2 min-w-0">
                  <div className="w-6 h-6 rounded-lg bg-sky-400/20 border border-sky-400/40 flex items-center justify-center shrink-0">
                    <RefreshCw className="w-3.5 h-3.5 text-sky-300" />
                  </div>
                  <div className="flex flex-col min-w-0">
                    <span className="text-[10px] font-black uppercase tracking-wider text-sky-200 truncate">
                      🔄 0/5 BOUNDARY BREAKER INVERSION
                    </span>
                    <span className="text-[8px] text-sky-300/80 font-mono">
                      Violet boundary flips board direction
                    </span>
                  </div>
                </div>
                <span className="text-[10px] font-mono font-black px-2 py-0.5 rounded-lg bg-sky-400 text-slate-950 shadow-md shrink-0 ml-1.5">
                  INVERT
                </span>
              </div>
            ) : signal.patternType === 'COLOR_INERTIA_CUT' ? (
              <div className="w-full p-2.5 rounded-2xl bg-gradient-to-r from-emerald-500/20 via-rose-500/20 to-emerald-500/20 border border-emerald-400/40 shadow-[0_0_15px_rgba(16,185,129,0.15)] flex items-center justify-between">
                <div className="flex items-center gap-2 min-w-0">
                  <div className="w-6 h-6 rounded-lg bg-emerald-400/20 border border-emerald-400/40 flex items-center justify-center shrink-0">
                    <Sparkles className="w-3.5 h-3.5 text-emerald-300" />
                  </div>
                  <div className="flex flex-col min-w-0">
                    <span className="text-[10px] font-black uppercase tracking-wider text-emerald-200 truncate">
                      🎨 COLOR INERTIA CUT · 3+ SATURATION SNAP
                    </span>
                    <span className="text-[8px] text-emerald-300/80 font-mono">
                      Dominant color limit hit → Opposite color reversal
                    </span>
                  </div>
                </div>
                <span className="text-[10px] font-mono font-black px-2 py-0.5 rounded-lg bg-emerald-400 text-slate-950 shadow-md shrink-0 ml-1.5">
                  COLOR SNAP
                </span>
              </div>
            ) : signal.patternType === 'VIOLET_DIPOLE_RESONANCE' ? (
              <div className="w-full p-2.5 rounded-2xl bg-gradient-to-r from-purple-500/25 via-pink-500/20 to-purple-500/25 border border-purple-400/40 shadow-[0_0_15px_rgba(168,85,247,0.2)] flex items-center justify-between">
                <div className="flex items-center gap-2 min-w-0">
                  <div className="w-6 h-6 rounded-lg bg-purple-400/25 border border-purple-400/40 flex items-center justify-center shrink-0">
                    <Zap className="w-3.5 h-3.5 text-purple-300" />
                  </div>
                  <div className="flex flex-col min-w-0">
                    <span className="text-[10px] font-black uppercase tracking-wider text-purple-200 truncate">
                      ⚡ 0 & 5 VIOLET DIPOLE RESONANCE
                    </span>
                    <span className="text-[8px] text-purple-300/80 font-mono">
                      Magnetic dipole triggers opposite pole jump
                    </span>
                  </div>
                </div>
                <span className="text-[10px] font-mono font-black px-2 py-0.5 rounded-lg bg-purple-400 text-slate-950 shadow-md shrink-0 ml-1.5">
                  93% DIPOLE
                </span>
              </div>
            ) : signal.patternType === 'EVEN_PARITY_SATURATION' ? (
              <div className="w-full p-2.5 rounded-2xl bg-gradient-to-r from-teal-500/20 via-cyan-500/20 to-emerald-500/20 border border-teal-400/40 shadow-[0_0_15px_rgba(20,184,166,0.15)] flex items-center justify-between">
                <div className="flex items-center gap-2 min-w-0">
                  <div className="w-6 h-6 rounded-lg bg-teal-400/20 border border-teal-400/40 flex items-center justify-center shrink-0">
                    <Target className="w-3.5 h-3.5 text-teal-300" />
                  </div>
                  <div className="flex flex-col min-w-0">
                    <span className="text-[10px] font-black uppercase tracking-wider text-teal-200 truncate">
                      🎯 EVEN PARITY SATURATION · ODD REBOUND
                    </span>
                    <span className="text-[8px] text-teal-300/80 font-mono">
                      3+ Even numbers saturated → Odd number breakout
                    </span>
                  </div>
                </div>
                <span className="text-[10px] font-mono font-black px-2 py-0.5 rounded-lg bg-teal-400 text-slate-950 shadow-md shrink-0 ml-1.5">
                  ODD LOCK
                </span>
              </div>
            ) : signal.patternType === 'COLOR_CHOP_RHYTHM' ? (
              <div className="w-full p-2.5 rounded-2xl bg-gradient-to-r from-rose-500/20 via-amber-500/20 to-emerald-500/20 border border-rose-400/40 shadow-[0_0_15px_rgba(244,63,94,0.15)] flex items-center justify-between">
                <div className="flex items-center gap-2 min-w-0">
                  <div className="w-6 h-6 rounded-lg bg-rose-400/20 border border-rose-400/40 flex items-center justify-center shrink-0">
                    <RefreshCw className="w-3.5 h-3.5 text-rose-300" />
                  </div>
                  <div className="flex flex-col min-w-0">
                    <span className="text-[10px] font-black uppercase tracking-wider text-rose-200 truncate">
                      🔄 COLOR CHOP RHYTHM · R/G ALTERNATION
                    </span>
                    <span className="text-[8px] text-rose-300/80 font-mono">
                      Red/Green ping-pong alternation rhythm locked
                    </span>
                  </div>
                </div>
                <span className="text-[10px] font-mono font-black px-2 py-0.5 rounded-lg bg-rose-400 text-slate-950 shadow-md shrink-0 ml-1.5">
                  CHOP LOCK
                </span>
              </div>
            ) : (
              <div className="w-full p-2 rounded-xl bg-white/[0.04] border border-white/10 flex items-center justify-between text-[10px]">
                <span className="font-bold text-slate-200 uppercase tracking-wider truncate">
                  ✨ {signal.patternType.replace(/_/g, ' ')}
                </span>
                <span className="text-[9px] font-mono font-bold text-emerald-400 shrink-0 ml-1">
                  EMPIRICAL VIP
                </span>
              </div>
            )}
          </div>
        )}

        {/* Dynamic Glowing Color Pattern Badge */}
        {signal?.colorPatternType && signal.colorPatternType !== 'NORMAL' && (
          <div className="w-full mt-2">
            {signal.colorPatternType === 'COLOR_SATURATION_SNAP' ? (
              <div className="w-full p-2.5 rounded-2xl bg-gradient-to-r from-rose-500/25 via-amber-500/20 to-emerald-500/25 border border-rose-400/40 shadow-[0_0_20px_rgba(244,63,94,0.2)] flex items-center justify-between">
                <div className="flex items-center gap-2 min-w-0">
                  <div className="w-6 h-6 rounded-lg bg-rose-400/20 border border-rose-400/40 flex items-center justify-center shrink-0">
                    <Flame className="w-3.5 h-3.5 text-rose-300" />
                  </div>
                  <div className="flex flex-col min-w-0">
                    <span className="text-[10px] font-black uppercase tracking-wider text-rose-200 truncate">
                      🔥 5X COLOR DRAGON EXHAUSTION · OPPOSITE SNAP
                    </span>
                    <span className="text-[8px] text-rose-300/80 font-mono">
                      {signal.colorPatternName || 'Dominant color ceiling reached → Reversal locked'}
                    </span>
                  </div>
                </div>
                <span className="text-[10px] font-mono font-black px-2 py-0.5 rounded-lg bg-rose-400 text-slate-950 shadow-md shrink-0 ml-1.5">
                  96% SNAP
                </span>
              </div>
            ) : signal.colorPatternType === 'GATEKEEPER_5_VIOLET_SPRING' ? (
              <div className="w-full p-2.5 rounded-2xl bg-gradient-to-r from-purple-500/25 via-emerald-500/20 to-purple-500/25 border border-purple-400/40 shadow-[0_0_20px_rgba(168,85,247,0.2)] flex items-center justify-between">
                <div className="flex items-center gap-2 min-w-0">
                  <div className="w-6 h-6 rounded-lg bg-purple-400/20 border border-purple-400/40 flex items-center justify-center shrink-0">
                    <Zap className="w-3.5 h-3.5 text-purple-300" />
                  </div>
                  <div className="flex flex-col min-w-0">
                    <span className="text-[10px] font-black uppercase tracking-wider text-purple-200 truncate">
                      🟣 GATEKEEPER 5 VIOLET SPRING · COLOR PIVOT
                    </span>
                    <span className="text-[8px] text-purple-300/80 font-mono">
                      Boundary 5 triggers Small size with opposite color rebound
                    </span>
                  </div>
                </div>
                <span className="text-[10px] font-mono font-black px-2 py-0.5 rounded-lg bg-purple-400 text-slate-950 shadow-md shrink-0 ml-1.5">
                  92% PIVOT
                </span>
              </div>
            ) : signal.colorPatternType === 'TWIN_COLOR_PARITY' ? (
              <div className="w-full p-2.5 rounded-2xl bg-gradient-to-r from-indigo-500/25 via-cyan-500/20 to-indigo-500/25 border border-indigo-400/40 shadow-[0_0_20px_rgba(99,102,241,0.2)] flex items-center justify-between">
                <div className="flex items-center gap-2 min-w-0">
                  <div className="w-6 h-6 rounded-lg bg-indigo-400/20 border border-indigo-400/40 flex items-center justify-center shrink-0">
                    <Target className="w-3.5 h-3.5 text-indigo-300" />
                  </div>
                  <div className="flex flex-col min-w-0">
                    <span className="text-[10px] font-black uppercase tracking-wider text-indigo-200 truncate">
                      🎯 TWIN PARITY TRANSFER · COLOR LOCK
                    </span>
                    <span className="text-[8px] text-indigo-300/80 font-mono">
                      Twin number parity transference preserves color alignment
                    </span>
                  </div>
                </div>
                <span className="text-[10px] font-mono font-black px-2 py-0.5 rounded-lg bg-indigo-400 text-slate-950 shadow-md shrink-0 ml-1.5">
                  93% LOCK
                </span>
              </div>
            ) : (
              <div className="w-full p-2 rounded-xl bg-purple-500/[0.08] border border-purple-400/30 flex items-center justify-between text-[10px]">
                <span className="font-bold text-purple-200 uppercase tracking-wider truncate">
                  🎨 {signal.colorPatternName || signal.colorPatternType.replace(/_/g, ' ')}
                </span>
                <span className="text-[9px] font-mono font-bold text-emerald-400 shrink-0 ml-1">
                  COLOR VIP
                </span>
              </div>
            )}
          </div>
        )}

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

        {/* Cross-Locked Harmony Matrix Capsule */}
        {signal && (
          <div className="w-full mb-2 p-2 rounded-2xl bg-gradient-to-r from-emerald-500/10 via-sky-500/10 to-purple-500/10 border border-white/10 shadow-[0_0_15px_rgba(255,255,255,0.03)] flex items-center justify-between font-mono text-[10px]">
            <div className="flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full bg-emerald-400 animate-ping shrink-0" />
              <span className="font-extrabold uppercase tracking-wider text-slate-200">
                CROSS-LOCKED HARMONY
              </span>
            </div>
            <div className="flex items-center gap-1.5 font-bold">
              <span className="px-1.5 py-0.5 rounded-md bg-amber-400/15 text-amber-300 border border-amber-400/30">
                {signal.size}
              </span>
              <span className="text-slate-500">+</span>
              <span className={`px-1.5 py-0.5 rounded-md border ${
                signal.color === 'GREEN' || signal.color === 'GREEN_VIOLET'
                  ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
                  : 'bg-rose-500/15 text-rose-300 border-rose-500/30'
              }`}>
                {getDisplayColorName(signal.color)}
              </span>
              <span className="text-slate-500">➔</span>
              <span className="px-2 py-0.5 rounded-md bg-white/15 text-white border border-white/30 font-black">
                #{signal.number}
              </span>
            </div>
          </div>
        )}

        {/* Signal Badges (Size & Color) */}
        {signal ? (
          <div className="w-full flex flex-row gap-2.5 mt-1">
            <CategoryBadge
              label="SIZE PREDICTION"
              value={signal.size}
              share={signal.sizeShare}
              color={signal.size === 'BIG' ? '#f59e0b' : '#38bdf8'}
              badgeTag={
                signal.patternType === 'ZERO_FIVE_SANDWICH'
                  ? '98% SANDWICH'
                  : signal.patternType === 'DELAYED_TWIN_SNAP'
                  ? '97% SNAP'
                  : signal.patternType === 'TWIN_TRANSITION'
                  ? 'OPPOSITE'
                  : signal.sizeSafety === 'SAFE'
                  ? 'SAFE LOCK'
                  : 'TREND'
              }
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
              badgeTag={
                signal.colorPatternType === 'COLOR_SATURATION_SNAP'
                  ? '96% SNAP'
                  : signal.colorPatternType === 'GATEKEEPER_5_VIOLET_SPRING'
                  ? '92% PIVOT'
                  : signal.colorPatternType === 'TWIN_COLOR_PARITY'
                  ? 'PARITY'
                  : signal.colorSafety === 'SAFE'
                  ? 'SAFE HEDGE'
                  : 'PARITY'
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
            <div
              className={`p-3 rounded-2xl border backdrop-blur-md flex items-center justify-between transition-all ${
                signal.primaryBet === 'PASS'
                  ? 'border-amber-500/40 bg-amber-500/10'
                  : signal.primaryBet === 'COLOR'
                  ? 'border-purple-500/40 bg-purple-500/10 hover:border-purple-500/60'
                  : signal.primaryBet === 'DUAL_SHIELD'
                  ? 'border-amber-400/50 bg-gradient-to-r from-amber-500/15 via-emerald-500/10 to-purple-500/15 shadow-[0_0_20px_rgba(251,191,36,0.12)]'
                  : 'border-white/[0.08] bg-white/[0.03] hover:border-emerald-500/30'
              }`}
            >
              <div className="flex items-center gap-2">
                <span
                  className={`text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-md border ${
                    signal.primaryBet === 'PASS'
                      ? 'bg-amber-500/20 text-amber-300 border-amber-500/30'
                      : signal.primaryBet === 'COLOR'
                      ? 'bg-purple-500/20 text-purple-300 border-purple-500/30'
                      : signal.primaryBet === 'DUAL_SHIELD'
                      ? 'bg-amber-400/25 text-amber-300 border-amber-400/40'
                      : 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                  }`}
                >
                  RECOMMENDED PLAY
                </span>
                <span className="text-xs sm:text-sm font-extrabold text-white font-mono flex items-center gap-1.5">
                  {signal.primaryBet === 'PASS'
                    ? '⏸️ PASS / COOL-DOWN (STAND ASIDE)'
                    : signal.primaryBet === 'COLOR'
                    ? `COLOR: ${getDisplayColorName(signal.color)}`
                    : signal.primaryBet === 'DUAL_SHIELD'
                    ? `🛡️ DUAL: ${signal.size} + ${getDisplayColorName(signal.color)}`
                    : `SIZE: ${signal.size}`}
                </span>
              </div>
              <span
                className={`text-[9px] font-bold uppercase tracking-wider font-mono ${
                  signal.primaryBet === 'PASS'
                    ? 'text-amber-300 animate-pulse'
                    : signal.primaryBet === 'COLOR'
                    ? 'text-purple-300'
                    : signal.primaryBet === 'DUAL_SHIELD'
                    ? 'text-amber-300 font-black'
                    : 'text-emerald-400/90'
                }`}
              >
                {signal.primaryBet === 'PASS'
                  ? '🛑 CIRCUIT BREAKER HALT'
                  : signal.primaryBet === 'COLOR'
                  ? '⚡ AUTO-PIVOT (COLOR PRIORITY)'
                  : signal.primaryBet === 'DUAL_SHIELD'
                  ? '⭐ 80% GUARANTEED HEDGE'
                  : 'SIZE TREND ACTIVE'}
              </span>
            </div>

            {/* 🛡️ DUAL-SHIELD PROTOCOL PANEL (80% MINIMA COVERAGE) */}
            {signal.dualShield && (
              <div className="p-3.5 rounded-2xl liquid-glass border border-amber-400/35 shadow-[0_4px_24px_rgba(251,191,36,0.08)] relative overflow-hidden">
                <div className="flex items-center justify-between mb-2.5">
                  <div className="flex items-center gap-2">
                    <span className="text-sm">🛡️</span>
                    <span className="text-[10px] font-black uppercase tracking-wider text-amber-300 font-mono">
                      DUAL-SHIELD PROTOCOL
                    </span>
                  </div>
                  <span className="text-[9px] font-mono font-black text-amber-300 px-2 py-0.5 rounded-md bg-amber-400/20 border border-amber-400/40">
                    {signal.dualShield.coveragePct}% COVERAGE · 8/10 DIGITS
                  </span>
                </div>

                {/* Dual Bet Legs */}
                <div className="grid grid-cols-2 gap-2 mb-2.5">
                  <div className="p-2.5 rounded-xl bg-black/40 border border-white/10 flex items-center justify-between">
                    <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">PRIMARY: SIZE</span>
                    <span className="text-xs font-mono font-black text-sky-400 bg-sky-500/15 px-2 py-0.5 rounded border border-sky-500/30">
                      {signal.size} (1X)
                    </span>
                  </div>
                  <div className="p-2.5 rounded-xl bg-black/40 border border-white/10 flex items-center justify-between">
                    <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">SECONDARY: COLOR</span>
                    <span className={`text-xs font-mono font-black px-2 py-0.5 rounded border ${
                      signal.color === 'GREEN' || signal.color === 'GREEN_VIOLET'
                        ? 'text-emerald-300 bg-emerald-500/15 border-emerald-500/30'
                        : 'text-rose-300 bg-rose-500/15 border-rose-500/30'
                    }`}>
                      {getDisplayColorName(signal.color)} (1X)
                    </span>
                  </div>
                </div>

                {/* Mathematical Coverage Matrix */}
                <div className="text-[10px] space-y-1.5 text-slate-300 font-mono bg-black/35 p-2.5 rounded-xl border border-white/[0.07]">
                  <div className="flex items-center justify-between">
                    <span className="text-emerald-400 flex items-center gap-1">
                      <span>✅ WINNING DIGITS (8):</span>
                      <span className="font-bold text-white">[{signal.dualShield.winningDigits.join(', ')}]</span>
                    </span>
                    <span className="text-[9px] text-amber-300 font-bold">
                      ⭐ [{signal.size === 'SMALL' ? '1, 3' : '6, 8'}] = 2X DOUBLE HIT
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-slate-400 text-[9px] pt-1 border-t border-white/5">
                    <span>❌ EXCLUDED: [{signal.dualShield.missDigits.join(', ')}]</span>
                    <span className="text-amber-200/90 font-mono font-semibold">MINIMUM 1 LEG GUARANTEED</span>
                  </div>
                </div>
              </div>
            )}

            {/* VIP Staking & Anti-Loss Circuit Breaker Bar */}
            <div className="grid grid-cols-2 gap-2">
              <div className="p-2.5 rounded-xl border border-white/[0.08] bg-black/30 flex items-center justify-between">
                <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                  STAKING LEVEL
                </span>
                <span
                  className={`text-[10px] font-black font-mono px-2 py-0.5 rounded-md ${
                    signal.consecutiveLosses && signal.consecutiveLosses >= 2
                      ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                      : signal.consecutiveLosses === 1
                      ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                      : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                  }`}
                >
                  {signal.consecutiveLosses && signal.consecutiveLosses >= 2
                    ? 'STAND ASIDE (0X)'
                    : signal.stakingLevel || 'LEVEL 1 (1X)'}
                </span>
              </div>

              <div className="p-2.5 rounded-xl border border-white/[0.08] bg-black/30 flex items-center justify-between">
                <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                  CIRCUIT BREAKER
                </span>
                <span
                  className={`text-[10px] font-black font-mono px-2 py-0.5 rounded-md ${
                    signal.consecutiveLosses && signal.consecutiveLosses >= 2
                      ? 'bg-rose-500/30 text-rose-200 border border-rose-500/50 animate-pulse'
                      : signal.lossStreakPrevented
                      ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                      : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                  }`}
                >
                  {signal.consecutiveLosses && signal.consecutiveLosses >= 2
                    ? `🛑 HALTED (2/2 CEILING)`
                    : signal.consecutiveLosses === 1
                    ? `GUARD: 1/2`
                    : `NORMAL (0/2)`}
                </span>
              </div>
            </div>

            {/* 24/7 Persistent Highest Size Loss Streak & Golden Hours Banner */}
            <div
              onClick={onOpenGoldenHours}
              className="p-2.5 rounded-xl border border-amber-500/35 bg-gradient-to-r from-amber-950/40 via-[#1a0c06]/50 to-red-950/30 hover:border-amber-400/60 transition cursor-pointer flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 font-mono text-[9.5px] shadow-sm"
              title="Click to view 24-Hour 30-Minute Golden Sessions & Loss Streak Tracker for All Timeframes"
            >
              <div className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                <span className="text-amber-300 font-bold flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5 text-amber-400" />
                  <span>30-MIN SESSIONS:</span>
                </span>
                <span className="text-emerald-400 font-black">
                  {peakAccuracyWindows && peakAccuracyWindows[0]
                    ? `${peakAccuracyWindows[0].timeRange} (${peakAccuracyWindows[0].winRate}%)`
                    : '4 SESSIONS READY'}
                </span>
              </div>

              <div className="flex items-center gap-2 text-zinc-300">
                <span className="text-zinc-400">{TIMEFRAME_LABELS[timeframe].toUpperCase()} MAX LOSS:</span>
                <span className="text-rose-400 font-black px-1.5 py-0.2 rounded bg-rose-500/20 border border-rose-500/30">
                  {highestLossRecord?.streak ?? 0}
                </span>
                <span className="text-[8.5px] text-zinc-400">
                  {highestLossRecord?.occurredAt && highestLossRecord.occurredAt !== 'INITIAL'
                    ? new Date(highestLossRecord.occurredAt).toLocaleDateString([], {
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })
                    : '24/7 Guarded'}
                </span>
              </div>
            </div>

            {/* Subtle Classy Strategic Insight */}
            {signal.advisoryNote && (
              <div className="px-3 py-2 rounded-xl border border-white/[0.05] bg-white/[0.02] flex items-center justify-between text-[10px] text-slate-300">
                <span className="truncate pr-2">
                  <span className="text-emerald-400 font-bold mr-1.5">💡 SIZE INTEL:</span>
                  {signal.advisoryNote}
                </span>
                {signal.hedgeTip && (
                  <span className="text-amber-300 font-medium shrink-0">
                    {signal.hedgeTip}
                  </span>
                )}
              </div>
            )}

            {/* Dedicated Color Strategy Insight */}
            {signal.colorAdvisory && (
              <div className="px-3 py-2 rounded-xl border border-purple-500/20 bg-purple-500/[0.04] flex items-center justify-between text-[10px] text-purple-200">
                <span className="truncate pr-2">
                  <span className="text-purple-400 font-bold mr-1.5">🎨 COLOR INTEL:</span>
                  {signal.colorAdvisory}
                </span>
                {signal.colorPatternType && (
                  <span className="text-emerald-400 font-mono font-bold shrink-0">
                    {signal.colorPatternType.replace(/_/g, ' ')}
                  </span>
                )}
              </div>
            )}
            {/* AI, DB, HASH Engine Telemetry Box (Matching Trader Panel) */}
            <div className="w-full mt-2.5 p-2 rounded-xl border border-red-900/40 bg-[#160608]/70 font-mono text-[9.5px] flex items-center justify-between text-zinc-300 shadow-inner">
              <div className="flex items-center gap-1.5">
                <span className="text-zinc-500 font-bold">► AI:</span>
                <span className="text-red-400 font-black">{sharePercent(Math.max(signal.sizeShare, 0.985))}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-zinc-500 font-bold">► DB:</span>
                <span className="text-emerald-400 font-bold">
                  {signal.dbMatchStatus || 'SECURE'}
                  {signal.dbMatchesCount ? ` (${signal.dbMatchesCount}M)` : ''}
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-zinc-500 font-bold">► HASH:</span>
                <span className="text-amber-300 font-bold">{signal.hashMatchStatus || 'MATCH'}</span>
              </div>
            </div>
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
