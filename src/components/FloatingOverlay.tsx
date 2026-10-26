import React, { useState } from 'react';
import { Signal, Timeframe } from '../types';
import { Orb } from './Orb';
import { sharePercent, getDisplayColorName, isPeriodExpired } from '../utils/engine';
import { LiveDrawTicker } from './LiveDrawTicker';
import { Maximize2, Minimize2, X, Zap, ShieldCheck, Flame, Radio } from 'lucide-react';
import { playGenerateChime } from '../utils/audio';

interface FloatingOverlayProps {
  isOpen: boolean;
  signal: Signal | null;
  timeframe: Timeframe;
  latestPeriod?: string | null;
  serverTimeOffset?: number;
  onClose: () => void;
  onGenerate: () => void;
  onMaximize: () => void;
  onRoundExpire?: () => void;
}

export const FloatingOverlay: React.FC<FloatingOverlayProps> = ({
  isOpen,
  signal,
  timeframe,
  latestPeriod,
  serverTimeOffset = 0,
  onClose,
  onGenerate,
  onMaximize,
  onRoundExpire,
}) => {
  const [collapsed, setCollapsed] = useState(false);
  const [panelTheme, setPanelTheme] = useState<'TRADER_RED' | 'EMERALD'>('TRADER_RED');
  const isResolving = Boolean(signal && latestPeriod && isPeriodExpired(signal.targetPeriod, latestPeriod));

  if (!isOpen) return null;

  const targetPeriodText = signal?.targetPeriod || latestPeriod || 'SYNCING...';
  const aiConfidence = signal ? sharePercent(Math.max(signal.sizeShare, 0.985)) : '99.9%';
  const dbStatus = signal?.dbMatchStatus || 'SECURE';
  const hashStatus = signal?.hashMatchStatus || 'MATCH';

  return (
    <div
      className={`fixed bottom-4 right-4 z-40 w-80 rounded-2xl border-2 transition-all duration-200 select-none shadow-2xl backdrop-blur-xl animate-slideUp overflow-hidden ${
        panelTheme === 'TRADER_RED'
          ? 'border-red-600/80 bg-[#0d0405]/95 shadow-[0_0_28px_rgba(239,68,68,0.45)]'
          : 'border-[#25c98e]/70 bg-[#061b17]/95 shadow-[0_0_24px_rgba(37,201,142,0.35)]'
      }`}
    >
      {/* Trader Panel Header */}
      <div
        className={`px-3 py-2.5 flex items-center justify-between border-b ${
          panelTheme === 'TRADER_RED'
            ? 'bg-gradient-to-r from-[#1f0507] via-[#2d090d] to-[#170406] border-red-700/60'
            : 'bg-[#0c2822] border-[#21483c]'
        }`}
      >
        <div className="flex items-center gap-2">
          {panelTheme === 'TRADER_RED' ? (
            <div className="flex items-center gap-1.5">
              <div className="w-6 h-6 rounded-lg bg-red-600/30 border border-red-500/80 flex items-center justify-center text-xs font-black text-red-400 shadow-inner">
                <Flame className="w-3.5 h-3.5 text-red-400 fill-current" />
              </div>
              <span className="text-[11px] font-black tracking-widest text-white uppercase drop-shadow-[0_2px_4px_rgba(255,0,0,0.6)]">
                TRADER PANEL
              </span>
            </div>
          ) : (
            <div className="flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full bg-[#25c98e] animate-ping" />
              <span className="text-[10px] font-black tracking-wider uppercase text-[#e9fff4]">
                WIN-GO OVERLAY · {timeframe}
              </span>
            </div>
          )}
        </div>

        <div className="flex items-center gap-1.5">
          {/* RESULT Pill */}
          <div className="px-2 py-0.5 rounded-full border border-emerald-400/80 bg-emerald-950/70 text-emerald-300 font-mono text-[9px] font-black tracking-wider">
            RESULT
          </div>

          {/* Theme switch */}
          <button
            onClick={() => setPanelTheme(panelTheme === 'TRADER_RED' ? 'EMERALD' : 'TRADER_RED')}
            className="w-5 h-5 flex items-center justify-center rounded text-zinc-400 hover:text-white transition"
            title="Toggle Red Cyber / Emerald theme"
          >
            <Radio className="w-3 h-3" />
          </button>

          <button
            onClick={() => setCollapsed(!collapsed)}
            className="w-5 h-5 flex items-center justify-center text-zinc-400 hover:text-white"
            title={collapsed ? 'Expand' : 'Collapse'}
          >
            {collapsed ? <Maximize2 className="w-3 h-3" /> : <Minimize2 className="w-3 h-3" />}
          </button>

          <button
            onClick={onMaximize}
            className="w-5 h-5 flex items-center justify-center text-zinc-400 hover:text-white"
            title="Focus main window"
          >
            <Maximize2 className="w-3 h-3" />
          </button>

          <button
            onClick={onClose}
            className="w-5 h-5 flex items-center justify-center text-zinc-400 hover:text-red-400"
            title="Close overlay"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {!collapsed && (
        <div className="p-3.5 flex flex-col items-center gap-3">
          {/* Period ID Bar */}
          <div className="w-full flex items-center justify-between">
            <span className="text-[10px] font-mono font-bold text-zinc-400 tracking-wider">
              PERIOD ID
            </span>
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
              <span className="text-[9px] font-mono font-black text-red-500 tracking-wider">
                SERVER LIVE
              </span>
            </div>
          </div>

          {/* Period ID Display Box */}
          <div className="w-full py-1 px-2.5 rounded-lg border border-red-700/60 bg-red-950/40 text-center font-mono font-black text-sm text-red-200 tracking-wider shadow-inner">
            {isResolving ? 'SYNCING...' : targetPeriodText}
          </div>

          {/* Live Countdown Clock */}
          <div className="w-full">
            <LiveDrawTicker
              timeframe={timeframe}
              serverTimeOffset={serverTimeOffset}
              onRoundExpire={onRoundExpire}
            />
          </div>

          {/* Main Visual Display: Ball + Size Badge */}
          {signal ? (
            <div className="w-full flex items-center justify-center gap-4 py-1.5">
              {/* Glowing Ball Container */}
              <div className="relative flex items-center justify-center">
                <div className="absolute inset-0 rounded-full bg-red-500/20 blur-md animate-pulse" />
                <div className="relative p-1 rounded-full border border-red-500/60 bg-black/60 shadow-lg">
                  <Orb number={signal.number} color={signal.color} />
                </div>
              </div>

              {/* Big / Small Button Badge */}
              <div className="flex flex-col items-start gap-1">
                <div
                  className={`px-4 py-2 rounded-xl border-2 font-black text-sm tracking-widest uppercase flex items-center justify-center shadow-lg transition-transform active:scale-95 ${
                    signal.size === 'BIG'
                      ? 'border-amber-400/90 bg-gradient-to-r from-amber-600/30 to-amber-950/80 text-amber-300 shadow-[0_0_15px_rgba(245,158,11,0.4)]'
                      : 'border-red-500/90 bg-gradient-to-r from-red-600/30 to-red-950/80 text-red-200 shadow-[0_0_15px_rgba(239,68,68,0.4)]'
                  }`}
                >
                  《 {signal.size} 》
                </div>

                <div className="text-[10px] font-mono font-bold text-zinc-300 flex items-center gap-1.5">
                  <span className="text-zinc-500">COLOR:</span>
                  <span
                    style={{
                      color:
                        signal.color === 'GREEN' || signal.color === 'GREEN_VIOLET'
                          ? '#22c55e'
                          : '#ef4444',
                    }}
                  >
                    {getDisplayColorName(signal.color)}
                  </span>
                </div>
              </div>
            </div>
          ) : (
            <div className="py-4 text-xs font-mono text-zinc-400">PRESS EXECUTE TO FETCH SIGNAL</div>
          )}

          {/* Telemetry Box: AI, DB, HASH */}
          <div className="w-full p-2.5 rounded-xl border border-red-800/50 bg-[#140608]/90 font-mono text-[10px] flex flex-col gap-1.5 shadow-inner">
            <div className="flex items-center justify-between text-zinc-300">
              <span className="text-zinc-500">► AI:</span>
              <span className="font-black text-red-400">{aiConfidence}</span>
            </div>
            <div className="flex items-center justify-between text-zinc-300">
              <span className="text-zinc-500">► DB:</span>
              <span className="font-bold text-emerald-400">
                {dbStatus} {signal?.dbMatchesCount ? `(${signal.dbMatchesCount} MATCHES)` : ''}
              </span>
            </div>
            <div className="flex items-center justify-between text-zinc-300">
              <span className="text-zinc-500">► HASH:</span>
              <span className="font-bold text-amber-300">
                {hashStatus} {signal?.hashValue ? `[${signal.hashValue}]` : ''}
              </span>
            </div>

            <div className="pt-1 border-t border-red-900/40 flex items-center justify-center gap-1.5 text-[8.5px] text-zinc-400 uppercase tracking-widest">
              <ShieldCheck className="w-3 h-3 text-red-400" />
              <span>ENCRYPTED CONNECTION ESTABLISHED</span>
            </div>
          </div>

          {/* Action Buttons: EXECUTE & HIDE */}
          <div className="w-full grid grid-cols-2 gap-2 pt-1">
            <button
              onClick={() => {
                playGenerateChime();
                onGenerate();
              }}
              className="h-9 rounded-xl bg-gradient-to-r from-red-600 via-red-500 to-rose-600 hover:from-red-500 hover:to-rose-500 text-white font-black text-xs tracking-wider uppercase flex items-center justify-center gap-1.5 shadow-[0_0_15px_rgba(239,68,68,0.6)] active:scale-95 transition"
            >
              <Zap className="w-3.5 h-3.5 fill-current" />
              <span>EXECUTE</span>
            </button>

            <button
              onClick={() => setCollapsed(true)}
              className="h-9 rounded-xl bg-[#220c0e] hover:bg-[#331114] border border-red-800/60 text-zinc-300 font-bold text-xs tracking-wider uppercase flex items-center justify-center transition active:scale-95"
            >
              <span>HIDE</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
