import React, { useState } from 'react';
import { DrawResult, Timeframe, BallColor } from '../types';
import { getColor, getSize, getDisplayColorName } from '../utils/engine';
import { Database, Plus, Trash2 } from 'lucide-react';

interface HistoryTimelineProps {
  history: DrawResult[];
  timeframe: Timeframe;
  isAdmin?: boolean;
  onAddResult: (num: number) => void;
  onClearHistory: () => void;
  onOpenSettings: () => void;
}

export const HistoryTimeline: React.FC<HistoryTimelineProps> = ({
  history,
  timeframe,
  isAdmin = false,
  onAddResult,
  onClearHistory,
  onOpenSettings,
}) => {
  const [showQuickAdd, setShowQuickAdd] = useState(false);
  const recentHistory = [...history].slice(-16).reverse();

  const renderBallBadge = (num: number, className = 'w-9 h-9 text-base') => {
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
        className={`${className} rounded-xl flex items-center justify-center font-mono font-black flex-shrink-0 shadow-sm relative overflow-hidden`}
        style={bgStyle}
      >
        <span className="relative z-10 drop-shadow-[0_1px_2px_rgba(0,0,0,0.6)]">{num}</span>
      </div>
    );
  };

  const getColorTextColor = (col: BallColor) => {
    switch (col) {
      case 'GREEN':
        return '#22c55e';
      case 'RED':
        return '#ef4444';
      case 'VIOLET':
        return '#c084fc';
      case 'RED_VIOLET':
        return '#f87171';
      case 'GREEN_VIOLET':
        return '#4ade80';
    }
  };

  return (
    <div className="w-full">
      {/* Section Header */}
      <div className="flex items-center justify-between mb-3 mt-4">
        <div>
          <h3 className="text-base font-bold text-[#e9fff4]">Recent history</h3>
          <p className="text-[11px] text-[#91aaa0] mt-0.5">
            {history.length
              ? `${history.length} valid results · showing latest 16`
              : 'No results loaded for this interval'}
          </p>
        </div>

        <div className="flex items-center gap-2">
          {isAdmin && history.length > 0 && (
            <button
              onClick={() => setShowQuickAdd(!showQuickAdd)}
              className="text-xs font-semibold px-2.5 py-1 rounded-lg border border-[#21483c] bg-[#14362e] text-[#25c98e] hover:bg-[#173d33] transition-colors flex items-center gap-1 cursor-pointer"
              title="Quickly record the outcome of the newest draw"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Log Draw</span>
            </button>
          )}
          <span className="text-[11px] font-extrabold tracking-wider text-[#25c98e] px-2 py-0.5 rounded bg-[#14362e] border border-[#21483c] font-mono">
            {timeframe}
          </span>
        </div>
      </div>

      {/* Quick Add Bar */}
      {showQuickAdd && (
        <div className="mb-3 p-3 rounded-xl bg-[#0c2822] border border-[#25c98e]/40 shadow-lg animate-fadeIn">
          <div className="text-[11px] font-bold text-[#91aaa0] mb-2 flex justify-between items-center">
            <span>Tap the number drawn in the latest round:</span>
            <button
              onClick={() => setShowQuickAdd(false)}
              className="text-xs text-[#91aaa0] hover:text-white cursor-pointer"
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

      {/* History Card List */}
      <div className="rounded-2xl border border-[#21483c] bg-[#0c2822] overflow-hidden divide-y divide-[#21483c]/60">
        {recentHistory.length === 0 ? (
          <div className="min-h-[140px] flex flex-col items-center justify-center gap-2.5 p-6 text-center">
            <Database className="w-6 h-6 text-[#91aaa0]" />
            <p className="text-xs text-[#91aaa0] max-w-xs">
              Waiting for live server draw or network sync...
            </p>
            <button
              onClick={onOpenSettings}
              className="mt-1 text-xs font-bold px-3 py-1.5 rounded-lg bg-[#14362e] text-[#25c98e] border border-[#21483c] hover:bg-[#173d33] transition-colors cursor-pointer"
            >
              Open History Settings
            </button>
          </div>
        ) : (
          recentHistory.map((item, index) => {
            const color = getColor(item.number);
            const size = getSize(item.number);
            const isLatest = index === 0;

            return (
              <div
                key={`${timeframe}-${item.period}`}
                className={`min-h-[58px] px-3.5 py-2.5 flex items-center gap-3 transition-colors hover:bg-[#14362e]/40 ${
                  isLatest ? 'bg-[#14362e]/20' : ''
                }`}
              >
                {/* Number Ball */}
                {renderBallBadge(item.number, 'w-9 h-9 text-base')}

                {/* Period & Details */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono font-bold text-[#e9fff4] truncate">
                      {item.period}
                    </span>
                    {isLatest && (
                      <span className="text-[9px] uppercase font-extrabold px-1.5 py-0.2 rounded bg-[#25c98e]/20 text-[#25c98e] border border-[#25c98e]/30">
                        Latest
                      </span>
                    )}
                  </div>
                  <div className="text-[11px] text-[#91aaa0] mt-0.5 tracking-tight flex items-center gap-1.5">
                    <span
                      className="font-bold"
                      style={{ color: size === 'BIG' ? '#f59e0b' : '#3b82f6' }}
                    >
                      {size}
                    </span>
                    <span>·</span>
                    <span
                      style={{ color: getColorTextColor(color) }}
                      className="font-semibold uppercase"
                    >
                      {getDisplayColorName(color)}
                    </span>
                  </div>
                </div>

                {/* Accent Color Line */}
                <div
                  className="w-1 h-6 rounded-full flex-shrink-0 opacity-85"
                  style={{
                    background:
                      color === 'RED_VIOLET'
                        ? 'linear-gradient(to bottom, #ef4444, #a855f7)'
                        : color === 'GREEN_VIOLET'
                        ? 'linear-gradient(to bottom, #22c55e, #a855f7)'
                        : color === 'GREEN'
                        ? '#22c55e'
                        : color === 'RED'
                        ? '#ef4444'
                        : '#a855f7',
                  }}
                />
              </div>
            );
          })
        )}
      </div>

      {history.length > 0 && (
        <div className="flex justify-between items-center mt-2 px-1 text-[11px] text-[#91aaa0]">
          <span>Official server-verified draw order (newest first)</span>
          {isAdmin && (
            <button
              onClick={onClearHistory}
              className="hover:text-[#ef6269] transition-colors flex items-center gap-1 cursor-pointer"
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
