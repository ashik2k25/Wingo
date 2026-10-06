import React, { useState } from 'react';
import { Signal, Timeframe, SourceMode } from '../types';
import { Orb } from './Orb';
import { CategoryBadge } from './CategoryBadge';
import { TIMEFRAME_LABELS, sharePercent, getColor, getDisplayColorName } from '../utils/engine';
import { Radio, Minus, Zap, Info, AlertCircle, BarChart3, ChevronDown, ChevronUp } from 'lucide-react';
import { playGenerateChime } from '../utils/audio';

interface SignalCardProps {
  signal: Signal | null;
  timeframe: Timeframe;
  historyLength: number;
  sourceMode: SourceMode;
  isFetching: boolean;
  errorMessage?: string;
  infoMessage?: string;
  updatedAt: string | null;
  onGenerate: () => void;
  onHide: () => void;
}

export const SignalCard: React.FC<SignalCardProps> = ({
  signal,
  timeframe,
  historyLength,
  sourceMode,
  isFetching,
  errorMessage,
  infoMessage,
  updatedAt,
  onGenerate,
  onHide,
}) => {
  const [showDist, setShowDist] = useState(false);

  const getSubStatusText = () => {
    if (errorMessage && sourceMode === 'api') return 'FEED UPDATE FAILED';
    if (sourceMode === 'api') return 'FEED CONNECTED';
    if (sourceMode === 'manual') return 'MANUAL HISTORY';
    if (sourceMode === 'simulated') return 'SIMULATED DATASET';
    return 'WAITING FOR HISTORY';
  };

  const handleGenerateClick = () => {
    playGenerateChime();
    onGenerate();
  };

  const formattedTime = updatedAt
    ? new Date(updatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
    : 'NOT SYNCED';

  return (
    <div className="w-full rounded-3xl border border-[#21483c] bg-[#0c2822] p-4 sm:p-5 shadow-2xl relative overflow-hidden transition-all duration-300">
      {/* Decorative ambient top glow */}
      <div className="absolute -top-16 left-1/2 -translate-x-1/2 w-48 h-24 bg-[#25c98e]/10 blur-3xl pointer-events-none rounded-full" />

      {/* Header */}
      <div className="flex items-center justify-between min-h-[44px] mb-3">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-[#25c98e] flex items-center justify-center text-[#04221a] shadow-sm">
            <Radio className="w-4 h-4 animate-pulse" />
          </div>
          <div>
            <h3 className="text-xs font-black tracking-widest uppercase text-[#e9fff4]">
              SIGNAL PANEL
            </h3>
            <p className="text-[9px] font-bold tracking-wider text-[#91aaa0] uppercase mt-0.5">
              {getSubStatusText()}
            </p>
          </div>
        </div>

        <button
          onClick={onHide}
          className="w-8 h-8 rounded-lg flex items-center justify-center text-[#91aaa0] hover:text-[#e9fff4] hover:bg-[#14362e] transition-colors"
          title="Minimize signal panel"
        >
          <Minus className="w-4 h-4" />
        </button>
      </div>

      {/* Main Signal Display Surface */}
      <div className="rounded-2xl bg-[#061b17] border border-[#21483c]/80 p-4 flex flex-col items-center">
        {/* Round Meta */}
        <div className="w-full flex items-center justify-between pb-3 border-b border-[#21483c]/50">
          <span className="text-[9px] font-extrabold tracking-widest uppercase text-[#91aaa0]">
            TARGET ROUND
          </span>
          <span className="text-xs font-mono font-bold tracking-wider text-[#f1c97a]">
            {signal?.targetPeriod || '—'}
          </span>
        </div>

        {/* Orb Section */}
        <div className="flex flex-col items-center py-4">
          {signal ? (
            <Orb number={signal.number} color={signal.color} />
          ) : (
            <div className="w-[92px] h-[92px] rounded-full border border-dashed border-[#21483c] bg-[#12342b]/40 flex items-center justify-center text-[#91aaa0]">
              {isFetching ? (
                <div className="w-8 h-8 border-2 border-[#25c98e] border-t-transparent rounded-full animate-spin" />
              ) : (
                <span className="text-2xl font-mono font-bold text-[#91aaa0]/60">#</span>
              )}
            </div>
          )}

          <span className="text-[9px] font-extrabold tracking-widest uppercase text-[#91aaa0] mt-3 font-mono">
            {signal
              ? `${sharePercent(signal.numberShare)} MODEL SHARE`
              : historyLength
              ? `${historyLength} RESULTS LOADED`
              : 'HISTORY NEEDED'}
          </span>
        </div>

        {/* Signal Badges */}
        {signal ? (
          <div className="w-full flex flex-row gap-2.5 mt-1">
            <CategoryBadge
              label="SIZE"
              value={signal.size}
              share={signal.sizeShare}
              color={signal.size === 'BIG' ? '#f59e0b' : '#3b82f6'}
            />
            <CategoryBadge
              label="COLOR"
              value={getDisplayColorName(signal.color)}
              share={signal.colorShare}
              color={
                signal.color === 'GREEN' || signal.color === 'GREEN_VIOLET'
                  ? '#22c55e'
                  : signal.color === 'RED' || signal.color === 'RED_VIOLET'
                  ? '#ef4444'
                  : '#a855f7'
              }
            />
          </div>
        ) : (
          <div className="py-2 text-center text-xs text-[#91aaa0]">
            {historyLength < 5
              ? `${Math.max(0, 5 - historyLength)} more results needed`
              : 'Waiting for live server sync...'}
          </div>
        )}

        {/* Toggle Detailed Digit Probabilities */}
        {signal && (
          <div className="w-full mt-3 pt-2 border-t border-[#21483c]/50">
            <button
              onClick={() => setShowDist(!showDist)}
              className="w-full flex items-center justify-between text-[10px] font-bold text-[#91aaa0] hover:text-[#e9fff4] py-1 cursor-pointer"
            >
              <span className="flex items-center gap-1.5">
                <BarChart3 className="w-3.5 h-3.5 text-[#25c98e]" />
                <span>0-9 Markov Probability Distribution</span>
              </span>
              {showDist ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            </button>

            {showDist && (
              <div className="grid grid-cols-10 gap-1 mt-2 pt-1 pb-1">
                {signal.numberDistribution.map((prob, digit) => {
                  const isTop = digit === signal.number;
                  const col = getColor(digit);
                  const barColor =
                    col === 'GREEN'
                      ? '#22c55e'
                      : col === 'RED'
                      ? '#ef4444'
                      : col === 'RED_VIOLET'
                      ? '#f87171'
                      : col === 'GREEN_VIOLET'
                      ? '#4ade80'
                      : '#a855f7';

                  return (
                    <div key={digit} className="flex flex-col items-center">
                      <div className="w-full h-12 bg-[#0c2822] rounded-md relative flex items-end overflow-hidden p-0.5">
                        <div
                          className="w-full rounded transition-all duration-500"
                          style={{
                            height: `${Math.min(100, Math.max(10, prob * 350))}%`,
                            backgroundColor: isTop ? barColor : `${barColor}66`,
                          }}
                        />
                      </div>
                      <span className={`text-[10px] font-mono mt-1 ${isTop ? 'font-black text-[#25c98e]' : 'text-[#91aaa0]'}`}>
                        {digit}
                      </span>
                      <span className="text-[8px] font-mono text-[#91aaa0]/80">
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
        <div className="rounded-xl border border-[#f1c97a]/40 bg-[#f1c97a]/10 px-3 py-2 flex items-start gap-2 mt-3">
          <Info className="w-4 h-4 text-[#f1c97a] flex-shrink-0 mt-0.5" />
          <p className="text-xs text-[#f1c97a] leading-tight">{infoMessage}</p>
        </div>
      )}

      {/* Error Notice */}
      {errorMessage && (
        <div className="rounded-xl border border-[#ef6269]/40 bg-[#ef6269]/10 px-3 py-2 flex items-start gap-2 mt-3">
          <AlertCircle className="w-4 h-4 text-[#ef6269] flex-shrink-0 mt-0.5" />
          <p className="text-xs text-[#ef6269] leading-tight">{errorMessage}</p>
        </div>
      )}

      {/* Generate Button */}
      <button
        onClick={handleGenerateClick}
        disabled={isFetching}
        className="w-full min-h-[48px] rounded-xl bg-[#25c98e] hover:bg-[#28d59b] active:scale-[0.99] text-[#04221a] font-black text-xs tracking-widest uppercase flex items-center justify-center gap-2 mt-3.5 shadow-lg shadow-[#25c98e]/20 transition-all cursor-pointer disabled:opacity-60"
      >
        <Zap className="w-4 h-4 fill-current" />
        <span>GENERATE SIGNAL</span>
      </button>

      {/* Panel Footer */}
      <div className="flex items-center justify-between pt-3 text-[9px] font-bold text-[#91aaa0] uppercase tracking-wider">
        <div className="flex items-center gap-1.5">
          <span
            className={`w-1.5 h-1.5 rounded-full ${
              sourceMode === 'none' ? 'bg-[#f1c97a]' : 'bg-[#25c98e]'
            }`}
          />
          <span>
            {historyLength} DRAWS · {formattedTime}
          </span>
        </div>

        <span className="font-mono">{TIMEFRAME_LABELS[timeframe]}</span>
      </div>
    </div>
  );
};
