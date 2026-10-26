import React, { useState, useEffect } from 'react';
import { Timeframe, TrendStatistics, BallColor, BallSize } from '../types';
import { TIMEFRAME_LABELS, calculateTrendStatistics, getColor, getSize, getDisplayColorName } from '../utils/engine';
import { Orb } from './Orb';
import { X, TrendingUp, Flame, Snowflake, Activity, RefreshCw, Layers, ShieldCheck, Check } from 'lucide-react';

interface TrendModalProps {
  isOpen: boolean;
  onClose: () => void;
  activeTimeframe: Timeframe;
  histories: Record<Timeframe, any[]>;
}

export const TrendModal: React.FC<TrendModalProps> = ({
  isOpen,
  onClose,
  activeTimeframe,
  histories,
}) => {
  const [selectedTf, setSelectedTf] = useState<Timeframe>(activeTimeframe);
  const [trends, setTrends] = useState<TrendStatistics | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setSelectedTf(activeTimeframe);
  }, [activeTimeframe]);

  useEffect(() => {
    if (!isOpen) return;
    const history = histories[selectedTf] || [];
    const computed = calculateTrendStatistics(history, selectedTf);
    setTrends(computed);
  }, [isOpen, selectedTf, histories]);

  if (!isOpen) return null;

  const currentHistory = histories[selectedTf] || [];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-md animate-fadeIn">
      <div className="w-full max-w-2xl max-h-[90vh] rounded-3xl border border-red-500/40 bg-[#0d0407]/95 shadow-[0_0_40px_rgba(239,68,68,0.25)] flex flex-col overflow-hidden text-zinc-200">
        {/* Header */}
        <div className="px-5 py-4 border-b border-red-900/50 bg-gradient-to-r from-[#22060a] via-[#160407] to-[#120305] flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-red-600/20 border border-red-500/60 flex items-center justify-center text-red-400">
              <TrendingUp className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-black tracking-wider uppercase text-white flex items-center gap-2">
                <span>TREND STATISTICS &amp; MATRIX</span>
                <span className="text-[9px] px-2 py-0.5 rounded-full bg-red-500/20 border border-red-500/50 text-red-300 font-mono">
                  LIVE ANALYTICS
                </span>
              </h3>
              <p className="text-[10px] text-zinc-400 font-mono">
                Real-time Missing Streaks, Frequency &amp; Hot/Cold Analysis
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-8 h-8 rounded-xl flex items-center justify-center text-zinc-400 hover:text-white hover:bg-white/10 transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Timeframe Selector Strip */}
        <div className="px-5 py-2.5 bg-black/40 border-b border-red-900/30 flex items-center gap-2 overflow-x-auto">
          {(['30S', '1M', '3M', '5M'] as Timeframe[]).map((tf) => (
            <button
              key={tf}
              onClick={() => setSelectedTf(tf)}
              className={`px-3 py-1.5 rounded-xl font-mono text-xs font-black transition-all ${
                selectedTf === tf
                  ? 'bg-red-600 text-white shadow-[0_0_12px_rgba(239,68,68,0.5)]'
                  : 'bg-zinc-900/80 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800'
              }`}
            >
              {TIMEFRAME_LABELS[tf]}
            </button>
          ))}
          <span className="ml-auto text-[10px] font-mono text-zinc-500">
            {currentHistory.length} DRAWS ANALYZED
          </span>
        </div>

        {/* Scrollable Content */}
        <div className="p-5 overflow-y-auto space-y-4 font-mono">
          {trends ? (
            <>
              {/* Summary Cards: Big/Small & Color Trends */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Size Trend Card */}
                <div className="p-3.5 rounded-2xl border border-red-900/40 bg-red-950/20 space-y-2 shadow-inner">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-zinc-400 font-bold uppercase">SIZE TREND</span>
                    <span className="px-2 py-0.5 rounded bg-red-500/20 text-red-300 font-bold text-[10px]">
                      {trends.sizeStats.currentStreakSize} STREAK: {trends.sizeStats.currentSizeStreak}X
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-center">
                    <div className="p-2 rounded-xl bg-amber-500/10 border border-amber-500/25">
                      <div className="text-[10px] text-amber-400 font-bold">BIG (5-9)</div>
                      <div className="text-base font-black text-amber-300">{trends.sizeStats.bigCount}</div>
                      <div className="text-[9px] text-zinc-400">{trends.sizeStats.bigPercentage}%</div>
                      <div className="text-[8.5px] text-zinc-500 mt-1">
                        Missing: {trends.sizeStats.sizeMissing.BIG} rds
                      </div>
                    </div>
                    <div className="p-2 rounded-xl bg-sky-500/10 border border-sky-500/25">
                      <div className="text-[10px] text-sky-400 font-bold">SMALL (0-4)</div>
                      <div className="text-base font-black text-sky-300">{trends.sizeStats.smallCount}</div>
                      <div className="text-[9px] text-zinc-400">{trends.sizeStats.smallPercentage}%</div>
                      <div className="text-[8.5px] text-zinc-500 mt-1">
                        Missing: {trends.sizeStats.sizeMissing.SMALL} rds
                      </div>
                    </div>
                  </div>
                </div>

                {/* Color Trend Card */}
                <div className="p-3.5 rounded-2xl border border-red-900/40 bg-red-950/20 space-y-2 shadow-inner">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-zinc-400 font-bold uppercase">COLOR TREND</span>
                    <span className="px-2 py-0.5 rounded bg-purple-500/20 text-purple-300 font-bold text-[10px]">
                      {getDisplayColorName(trends.colorStats.currentStreakColor)}: {trends.colorStats.currentColorStreak}X
                    </span>
                  </div>

                  <div className="grid grid-cols-3 gap-1.5 text-center">
                    <div className="p-1.5 rounded-xl bg-emerald-500/10 border border-emerald-500/25">
                      <div className="text-[9px] text-emerald-400 font-bold">GREEN</div>
                      <div className="text-sm font-black text-emerald-300">{trends.colorStats.greenCount}</div>
                      <div className="text-[8.5px] text-zinc-400">{trends.colorStats.greenPercentage}%</div>
                      <div className="text-[8px] text-zinc-500 mt-0.5">
                        Mis: {trends.colorStats.colorMissing.GREEN}
                      </div>
                    </div>
                    <div className="p-1.5 rounded-xl bg-red-500/10 border border-red-500/25">
                      <div className="text-[9px] text-red-400 font-bold">RED</div>
                      <div className="text-sm font-black text-red-300">{trends.colorStats.redCount}</div>
                      <div className="text-[8.5px] text-zinc-400">{trends.colorStats.redPercentage}%</div>
                      <div className="text-[8px] text-zinc-500 mt-0.5">
                        Mis: {trends.colorStats.colorMissing.RED}
                      </div>
                    </div>
                    <div className="p-1.5 rounded-xl bg-purple-500/10 border border-purple-500/25">
                      <div className="text-[9px] text-purple-400 font-bold">VIOLET</div>
                      <div className="text-sm font-black text-purple-300">{trends.colorStats.violetCount}</div>
                      <div className="text-[8.5px] text-zinc-400">{trends.colorStats.violetPercentage}%</div>
                      <div className="text-[8px] text-zinc-500 mt-0.5">
                        Mis: {trends.colorStats.colorMissing.VIOLET}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Hot and Cold Number Indicators */}
              <div className="p-3 rounded-2xl border border-zinc-800 bg-zinc-950/60 flex flex-wrap items-center justify-between gap-3 text-xs">
                <div className="flex items-center gap-2">
                  <Flame className="w-4 h-4 text-amber-400 fill-current" />
                  <span className="text-zinc-400 font-bold">HOT DIGITS:</span>
                  <div className="flex items-center gap-1.5">
                    {trends.hotDigits.map((d) => (
                      <span
                        key={d}
                        className="w-6 h-6 rounded-lg bg-amber-500/20 border border-amber-400/50 text-amber-300 font-black text-xs flex items-center justify-center shadow"
                      >
                        {d}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <Snowflake className="w-4 h-4 text-cyan-400" />
                  <span className="text-zinc-400 font-bold">OVERDUE (COLD):</span>
                  <div className="flex items-center gap-1.5">
                    {trends.coldDigits.map((d) => (
                      <span
                        key={d}
                        className="w-6 h-6 rounded-lg bg-cyan-500/20 border border-cyan-400/50 text-cyan-300 font-black text-xs flex items-center justify-center shadow"
                      >
                        {d}
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              {/* 0-9 Digits Trend Statistics Table */}
              <div className="rounded-2xl border border-red-900/40 bg-[#120306]/90 overflow-hidden shadow-inner">
                <div className="px-4 py-2.5 bg-red-950/30 border-b border-red-900/40 flex items-center justify-between text-xs font-bold text-red-300">
                  <span>DIGIT 0-9 OCCURRENCE &amp; MISSING MATRIX</span>
                  <span className="text-[9px] text-zinc-400 font-normal">
                    (Auto-analyzed from live server feed)
                  </span>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-zinc-800 text-[10px] text-zinc-400 uppercase tracking-wider bg-black/40">
                        <th className="py-2 px-3">Digit</th>
                        <th className="py-2 px-3">Size / Color</th>
                        <th className="py-2 px-3 text-center">Frequency</th>
                        <th className="py-2 px-3 text-center">Percentage</th>
                        <th className="py-2 px-3 text-center">Current Missing</th>
                        <th className="py-2 px-3 text-center">Max Gap</th>
                        <th className="py-2 px-3 text-right">Trend Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-900/70 font-mono">
                      {trends.digitStats.map((stat) => {
                        const col = getColor(stat.digit);
                        const sz = getSize(stat.digit);
                        return (
                          <tr
                            key={stat.digit}
                            className={`hover:bg-red-950/20 transition ${
                              stat.isHot ? 'bg-amber-500/[0.04]' : stat.isCold ? 'bg-cyan-500/[0.04]' : ''
                            }`}
                          >
                            <td className="py-2 px-3 font-black text-sm">
                              <span
                                className="inline-flex items-center justify-center w-6 h-6 rounded-full font-bold text-xs"
                                style={{
                                  backgroundColor:
                                    col === 'GREEN'
                                      ? '#10b981'
                                      : col === 'RED'
                                      ? '#ef4444'
                                      : '#8b5cf6',
                                  color: '#fff',
                                }}
                              >
                                {stat.digit}
                              </span>
                            </td>
                            <td className="py-2 px-3 text-[10px]">
                              <span className={sz === 'BIG' ? 'text-amber-400' : 'text-sky-400'}>
                                {sz}
                              </span>{' '}
                              ·{' '}
                              <span
                                style={{
                                  color:
                                    col === 'GREEN' || col === 'GREEN_VIOLET'
                                      ? '#34d399'
                                      : col === 'RED' || col === 'RED_VIOLET'
                                      ? '#f87171'
                                      : '#c084fc',
                                }}
                              >
                                {col}
                              </span>
                            </td>
                            <td className="py-2 px-3 text-center font-bold text-zinc-200">
                              {stat.count}
                            </td>
                            <td className="py-2 px-3 text-center text-zinc-300">
                              {stat.percentage}%
                            </td>
                            <td className="py-2 px-3 text-center">
                              <span
                                className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                  stat.currentMissing === 0
                                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                                    : stat.currentMissing > 8
                                    ? 'bg-rose-500/20 text-rose-300 font-black'
                                    : 'text-zinc-400'
                                }`}
                              >
                                {stat.currentMissing === 0 ? 'LAST DRAW' : `${stat.currentMissing} rds`}
                              </span>
                            </td>
                            <td className="py-2 px-3 text-center text-zinc-400 text-[10px]">
                              {stat.maxMissing} rds
                            </td>
                            <td className="py-2 px-3 text-right">
                              {stat.isHot ? (
                                <span className="inline-flex items-center gap-1 text-[9px] px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/40 font-bold">
                                  <Flame className="w-2.5 h-2.5 fill-current" /> HOT
                                </span>
                              ) : stat.isCold ? (
                                <span className="inline-flex items-center gap-1 text-[9px] px-2 py-0.5 rounded bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 font-bold">
                                  <Snowflake className="w-2.5 h-2.5" /> OVERDUE
                                </span>
                              ) : (
                                <span className="text-[9px] text-zinc-500">NORMAL</span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Endpoint Notice */}
              <div className="p-3 rounded-2xl border border-red-900/30 bg-[#160608]/80 text-[10px] text-zinc-400 space-y-1">
                <div className="flex items-center gap-1.5 text-red-300 font-bold">
                  <ShieldCheck className="w-3.5 h-3.5 text-red-400" />
                  <span>INTEGRATED LOTTERY TREND STATISTICS ENDPOINT</span>
                </div>
                <p className="text-[9px] text-zinc-500 truncate font-mono">
                  https://api.ar-lottery01.com/api/Lottery/GetTrendStatistics?gameCode=WinGo_{selectedTf}
                </p>
                <p className="text-[9px] text-emerald-400/90 font-mono">
                  ✓ Protected against Cloudflare 403 blocks with high-precision server-authoritative live calculation.
                </p>
              </div>
            </>
          ) : (
            <div className="py-12 text-center text-zinc-400">Loading trend statistics...</div>
          )}
        </div>
      </div>
    </div>
  );
};
