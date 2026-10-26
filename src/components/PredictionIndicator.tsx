import React from 'react';
import { Signal, Timeframe } from '../types';
import { Maximize2, LayoutGrid, Sparkles } from 'lucide-react';

interface PredictionIndicatorProps {
  signal: Signal | null;
  timeframe: Timeframe;
  latestPeriod?: string | null;
  isResolving?: boolean;
}

export const PredictionIndicator: React.FC<PredictionIndicatorProps> = ({
  signal,
  timeframe,
  latestPeriod,
  isResolving = false,
}) => {
  // If signal is null, render a balanced placeholder
  const predictedNum = signal ? (signal.number < 10 ? `0${signal.number}` : `${signal.number}`) : '07';
  const predictedSize = signal?.size || 'BIG';
  const predictedColor = signal?.color || 'RED';

  // Format display color name
  const isRed = predictedColor === 'RED' || predictedColor === 'RED_VIOLET';
  const isGreen = predictedColor === 'GREEN' || predictedColor === 'GREEN_VIOLET';
  const isViolet = predictedColor === 'VIOLET';

  const colorDisplayName = isViolet ? 'Violet' : isRed ? 'Red' : isGreen ? 'Green' : 'Red';
  const sizeDisplayName = predictedSize === 'BIG' ? 'Big' : 'Small';

  return (
    <div className="w-full flex justify-center px-4 my-2 animate-fadeIn">
      <div className="w-full max-w-sm rounded-3xl border border-white/10 bg-[#0d122b]/85 backdrop-blur-2xl p-6 sm:p-7 shadow-[0_0_40px_rgba(15,23,66,0.8)] relative flex flex-col items-center overflow-hidden">
        {/* Subtle Ambient Radial Lights */}
        <div className="absolute -top-12 left-1/2 -translate-x-1/2 w-48 h-28 bg-purple-600/15 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-10 left-1/2 -translate-x-1/2 w-48 h-24 bg-blue-600/15 rounded-full blur-3xl pointer-events-none" />

        {/* Target Period Subtle Tag */}
        {signal?.targetPeriod && (
          <div className="text-[10px] font-mono text-zinc-400/80 mb-2 tracking-wider flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
            <span>Target Period: {signal.targetPeriod}</span>
            {isResolving && (
              <span className="text-[9px] px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-300 font-bold border border-amber-500/30">
                RESOLVING
              </span>
            )}
          </div>
        )}

        {/* Center Glowing Neon Ring & Target Number */}
        <div className="my-3 relative flex items-center justify-center">
          {/* Animated Neon Halo */}
          <div className="w-36 h-36 sm:w-40 sm:h-40 rounded-full p-[3px] bg-gradient-to-tr from-cyan-400 via-indigo-500 to-fuchsia-500 shadow-[0_0_35px_rgba(0,163,255,0.4),inset_0_0_20px_rgba(168,85,247,0.3)] flex items-center justify-center">
            {/* Inner Dark Glass Orb */}
            <div className="w-full h-full rounded-full bg-[#0a0e27] flex items-center justify-center border border-white/10 shadow-inner">
              <span className="text-5xl sm:text-6xl font-black font-sans text-white tracking-tight drop-shadow-[0_0_20px_rgba(255,255,255,0.6)]">
                {predictedNum}
              </span>
            </div>
          </div>
        </div>

        {/* Bottom Capsules: Color & Size (matching Image 1 exactly) */}
        <div className="w-full grid grid-cols-2 gap-3 mt-4">
          {/* Left: Color Capsule */}
          <div
            className={`py-2.5 px-3 rounded-2xl flex items-center justify-center gap-2 font-mono text-xs font-bold transition-all shadow-md ${
              isRed
                ? 'bg-[#2a0e14]/80 border border-red-500/50 text-red-200 shadow-[0_0_15px_rgba(239,68,68,0.25)]'
                : isGreen
                ? 'bg-[#0e2a18]/80 border border-emerald-500/50 text-emerald-200 shadow-[0_0_15px_rgba(16,185,129,0.25)]'
                : 'bg-[#220e2a]/80 border border-purple-500/50 text-purple-200 shadow-[0_0_15px_rgba(168,85,247,0.25)]'
            }`}
          >
            <span>Color: {colorDisplayName}</span>
            <span
              className={`w-3 h-3 rounded-full shrink-0 shadow-sm ${
                isRed
                  ? 'bg-red-500 shadow-[0_0_8px_#ef4444]'
                  : isGreen
                  ? 'bg-emerald-400 shadow-[0_0_8px_#10b981]'
                  : 'bg-purple-400 shadow-[0_0_8px_#c084fc]'
              }`}
            />
          </div>

          {/* Right: Size Capsule */}
          <div
            className={`py-2.5 px-3 rounded-2xl flex items-center justify-center gap-2 font-mono text-xs font-bold transition-all shadow-md ${
              predictedSize === 'BIG'
                ? 'bg-[#181a42]/85 border border-indigo-500/50 text-indigo-200 shadow-[0_0_15px_rgba(99,102,241,0.25)]'
                : 'bg-[#0e2038]/85 border border-cyan-500/50 text-cyan-200 shadow-[0_0_15px_rgba(6,182,212,0.25)]'
            }`}
          >
            <span>Size: {sizeDisplayName}</span>
            {predictedSize === 'BIG' ? (
              <Maximize2 className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
            ) : (
              <LayoutGrid className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
