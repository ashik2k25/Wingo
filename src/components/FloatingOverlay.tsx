import React, { useState } from 'react';
import { Signal, Timeframe } from '../types';
import { Orb } from './Orb';
import { TIMEFRAME_LABELS, sharePercent, getDisplayColorName } from '../utils/engine';
import { LiveDrawTicker } from './LiveDrawTicker';
import { Maximize2, Minimize2, X, Zap } from 'lucide-react';
import { playGenerateChime } from '../utils/audio';

interface FloatingOverlayProps {
  isOpen: boolean;
  signal: Signal | null;
  timeframe: Timeframe;
  onClose: () => void;
  onGenerate: () => void;
  onMaximize: () => void;
  onRoundExpire?: () => void;
}

export const FloatingOverlay: React.FC<FloatingOverlayProps> = ({
  isOpen,
  signal,
  timeframe,
  onClose,
  onGenerate,
  onMaximize,
  onRoundExpire,
}) => {
  const [collapsed, setCollapsed] = useState(false);

  if (!isOpen) return null;

  return (
    <div className="fixed bottom-4 right-4 z-40 w-72 rounded-2xl border-2 border-[#25c98e]/60 bg-[#061b17]/95 shadow-2xl backdrop-blur-md overflow-hidden transition-all animate-slideUp">
      {/* Title bar */}
      <div className="px-3 py-2 bg-[#0c2822] border-b border-[#21483c] flex items-center justify-between cursor-move">
        <div className="flex items-center gap-1.5">
          <div className="w-2 h-2 rounded-full bg-[#25c98e] animate-ping" />
          <span className="text-[10px] font-black tracking-wider uppercase text-[#e9fff4]">
            WIN-GO OVERLAY · {timeframe}
          </span>
        </div>

        <div className="flex items-center gap-1">
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="w-5 h-5 flex items-center justify-center text-[#91aaa0] hover:text-white"
            title={collapsed ? 'Expand' : 'Collapse'}
          >
            {collapsed ? <Maximize2 className="w-3 h-3" /> : <Minimize2 className="w-3 h-3" />}
          </button>
          <button
            onClick={onMaximize}
            className="w-5 h-5 flex items-center justify-center text-[#91aaa0] hover:text-white"
            title="Focus main window"
          >
            <Maximize2 className="w-3 h-3" />
          </button>
          <button
            onClick={onClose}
            className="w-5 h-5 flex items-center justify-center text-[#91aaa0] hover:text-[#ef6269]"
            title="Close overlay"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {!collapsed && (
        <div className="p-3 flex flex-col items-center gap-2.5">
          {/* Ticker & Round */}
          <div className="w-full flex items-center justify-between text-[10px] font-mono">
            <span className="text-[#91aaa0]">ROUND:</span>
            <span className="font-bold text-[#f1c97a]">{signal?.targetPeriod || '—'}</span>
          </div>

          <div className="w-full">
            <LiveDrawTicker timeframe={timeframe} onRoundExpire={onRoundExpire} />
          </div>

          {/* Mini Signal Orb & Stats */}
          {signal ? (
            <div className="w-full flex items-center justify-around py-1">
              <div className="scale-75 origin-center">
                <Orb number={signal.number} color={signal.color} />
              </div>

              <div className="flex flex-col gap-1 text-right">
                <div
                  className="text-xs font-mono font-black"
                  style={{ color: signal.size === 'BIG' ? '#f59e0b' : '#3b82f6' }}
                >
                  {signal.size}
                  <span className="text-[9px] font-normal text-[#91aaa0] ml-1">
                    ({sharePercent(signal.sizeShare)})
                  </span>
                </div>
                <div
                  className="text-xs font-mono font-black"
                  style={{
                    color:
                      signal.color === 'GREEN' || signal.color === 'GREEN_VIOLET'
                        ? '#22c55e'
                        : signal.color === 'RED' || signal.color === 'RED_VIOLET'
                        ? '#ef4444'
                        : '#a855f7',
                  }}
                >
                  {getDisplayColorName(signal.color)}
                  <span className="text-[9px] font-normal text-[#91aaa0] ml-1">
                    ({sharePercent(signal.colorShare)})
                  </span>
                </div>
                <div className="text-[10px] font-mono text-[#25c98e]">
                  {sharePercent(signal.numberShare)} share
                </div>
              </div>
            </div>
          ) : (
            <div className="py-2 text-[11px] text-[#91aaa0]">No active signal</div>
          )}

          <button
            onClick={() => {
              playGenerateChime();
              onGenerate();
            }}
            className="w-full h-8 rounded-lg bg-[#25c98e] hover:bg-[#28d59b] text-[#04221a] font-extrabold text-[10px] tracking-wider uppercase flex items-center justify-center gap-1.5 shadow-md"
          >
            <Zap className="w-3.5 h-3.5 fill-current" />
            <span>CALCULATE SIGNAL</span>
          </button>
        </div>
      )}
    </div>
  );
};
