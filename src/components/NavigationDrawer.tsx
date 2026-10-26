import React from 'react';
import { Timeframe, HighestLossRecord } from '../types';
import { TIMEFRAMES, TIMEFRAME_LABELS } from '../utils/engine';
import {
  X,
  Clock,
  TrendingUp,
  ShieldCheck,
  Layers,
  Volume2,
  VolumeX,
  Download,
  Sliders,
  CheckCircle2,
  Radio,
  Flame,
  ShieldAlert,
  BellRing,
  PhoneCall,
} from 'lucide-react';

interface NavigationDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  activeTimeframe: Timeframe;
  onSelectTimeframe: (tf: Timeframe) => void;
  serverSynced: boolean;
  soundOn: boolean;
  onToggleSound: () => void;
  onOpenGoldenHours: () => void;
  onOpenAlerts: () => void;
  onOpenTrends: () => void;
  onOpenShield: () => void;
  onOpenOverlay: () => void;
  onOpenSettings: () => void;
  onOpenDownload: () => void;
  highestLossRecords: Record<Timeframe, HighestLossRecord>;
}

export const NavigationDrawer: React.FC<NavigationDrawerProps> = ({
  isOpen,
  onClose,
  activeTimeframe,
  onSelectTimeframe,
  serverSynced,
  soundOn,
  onToggleSound,
  onOpenGoldenHours,
  onOpenAlerts,
  onOpenTrends,
  onOpenShield,
  onOpenOverlay,
  onOpenSettings,
  onOpenDownload,
  highestLossRecords,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/75 backdrop-blur-md animate-fadeIn">
      {/* Backdrop click to dismiss */}
      <div className="flex-1" onClick={onClose} />

      {/* Drawer Container */}
      <div className="w-full max-w-xs sm:max-w-sm h-full bg-[#0a0e27]/95 border-l border-white/10 shadow-[0_0_50px_rgba(0,163,255,0.2)] flex flex-col overflow-hidden text-zinc-200 animate-slideInRight font-sans">
        {/* Drawer Header */}
        <div className="px-5 py-4 border-b border-white/[0.08] flex items-center justify-between bg-gradient-to-r from-[#0d143b] to-[#070b1e]">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-cyan-500/20 border border-cyan-500/40 flex items-center justify-center text-cyan-400">
              <Radio className="w-3.5 h-3.5" />
            </div>
            <h3 className="text-sm font-bold tracking-wider uppercase text-white font-mono">
              System Menu
            </h3>
          </div>

          <button
            onClick={onClose}
            className="w-8 h-8 rounded-xl flex items-center justify-center text-zinc-400 hover:text-white hover:bg-white/10 transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Scrollable Menu Items */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {/* 1. Timeframe Selection */}
          <div className="space-y-1.5">
            <div className="text-[10px] font-mono font-bold uppercase tracking-wider text-cyan-400/80 px-1">
              Select Game Interval
            </div>
            <div className="grid grid-cols-2 gap-2">
              {TIMEFRAMES.map((tf) => {
                const isSelected = activeTimeframe === tf;
                return (
                  <button
                    key={tf}
                    onClick={() => {
                      onSelectTimeframe(tf);
                      onClose();
                    }}
                    className={`py-2 px-3 rounded-xl border font-mono text-xs font-bold transition-all flex items-center justify-between cursor-pointer ${
                      isSelected
                        ? 'border-cyan-400 bg-cyan-500/20 text-cyan-200 shadow-[0_0_15px_rgba(6,182,212,0.3)]'
                        : 'border-white/[0.06] bg-[#0c1233]/70 text-zinc-300 hover:border-white/20'
                    }`}
                  >
                    <span>{TIMEFRAME_LABELS[tf]}</span>
                    {isSelected && <span className="w-1.5 h-1.5 rounded-full bg-cyan-400" />}
                  </button>
                );
              })}
            </div>
          </div>

          {/* 2. 24-Hour Golden Sessions */}
          <div className="space-y-1.5">
            <button
              onClick={() => {
                onClose();
                onOpenGoldenHours();
              }}
              className="w-full p-3 rounded-2xl border border-amber-500/40 bg-gradient-to-r from-amber-950/40 to-[#1c1208]/60 hover:border-amber-400 transition flex items-center justify-between cursor-pointer shadow-sm group"
            >
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400">
                  <Clock className="w-4 h-4" />
                </div>
                <div className="text-left">
                  <div className="text-xs font-bold text-white font-mono flex items-center gap-1.5">
                    <span>Pure Golden Sessions</span>
                    <span className="text-[8.5px] px-1.5 py-0.2 rounded bg-emerald-500/20 text-emerald-300 font-bold border border-emerald-500/40">
                      1 MIN ONLY
                    </span>
                  </div>
                  <div className="text-[10px] text-amber-300/80">
                    4 Pure 5-min size win sessions (Exclusively for WinGo 1 Min)
                  </div>
                </div>
              </div>
              <span className="text-[9px] font-mono px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40">
                VIEW
              </span>
            </button>
          </div>

          {/* 2b. Golden Alert & Automation (Phone Call & Telegram Report) */}
          <div className="space-y-1.5">
            <button
              onClick={() => {
                onClose();
                onOpenAlerts();
              }}
              className="w-full p-3 rounded-2xl border border-cyan-500/40 bg-gradient-to-r from-cyan-950/40 to-[#08182b]/60 hover:border-cyan-400 transition flex items-center justify-between cursor-pointer shadow-sm group"
            >
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-cyan-500/20 border border-cyan-500/40 flex items-center justify-center text-cyan-400">
                  <BellRing className="w-4 h-4 animate-pulse" />
                </div>
                <div className="text-left">
                  <div className="text-xs font-bold text-white font-mono flex items-center gap-1.5">
                    <span>Alerts &amp; Automation</span>
                    <span className="text-[8.5px] px-1.5 py-0.2 rounded bg-cyan-500/20 text-cyan-300 font-bold border border-cyan-500/40">
                      UPDATE
                    </span>
                  </div>
                  <div className="text-[10px] text-cyan-300/80">
                    ১ মি. পূর্বে মিসড কল • টেলিগ্রাম ৫/৫ রিপোর্ট
                  </div>
                </div>
              </div>
              <span className="text-[9px] font-mono px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 border border-cyan-500/40">
                OPEN
              </span>
            </button>
          </div>

          {/* 3. Highest Size Loss Streak Tracker */}
          <div className="space-y-1.5">
            <button
              onClick={() => {
                onClose();
                onOpenGoldenHours();
              }}
              className="w-full p-3 rounded-2xl border border-red-500/40 bg-gradient-to-r from-red-950/40 to-[#1c080e]/60 hover:border-red-400 transition flex items-center justify-between cursor-pointer shadow-sm"
            >
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-red-500/20 border border-red-500/40 flex items-center justify-center text-red-400">
                  <ShieldAlert className="w-4 h-4" />
                </div>
                <div className="text-left">
                  <div className="text-xs font-bold text-white font-mono">
                    Max Loss Streak Record
                  </div>
                  <div className="text-[10px] text-zinc-400">
                    {TIMEFRAME_LABELS[activeTimeframe]}: {highestLossRecords[activeTimeframe]?.streak ?? 0} losses
                  </div>
                </div>
              </div>
              <span className="text-[9px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                24/7 SAVED
              </span>
            </button>
          </div>

          {/* 4. Trend Analysis & Missing Numbers */}
          <div className="space-y-1.5">
            <button
              onClick={() => {
                onClose();
                onOpenTrends();
              }}
              className="w-full p-3 rounded-2xl border border-white/[0.08] bg-[#0c1233]/70 hover:border-white/20 transition flex items-center justify-between cursor-pointer"
            >
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-purple-500/20 border border-purple-500/40 flex items-center justify-center text-purple-400">
                  <TrendingUp className="w-4 h-4" />
                </div>
                <div className="text-left">
                  <div className="text-xs font-bold text-white font-mono">
                    Trend Statistics Matrix
                  </div>
                  <div className="text-[10px] text-zinc-400">
                    Hot/Cold digits &amp; missing frequencies
                  </div>
                </div>
              </div>
              <span className="text-zinc-400 text-xs font-mono">&rarr;</span>
            </button>
          </div>

          {/* 5. Stealth Anti-Detection Protocol */}
          <div className="space-y-1.5">
            <button
              onClick={() => {
                onClose();
                onOpenShield();
              }}
              className="w-full p-3 rounded-2xl border border-white/[0.08] bg-[#0c1233]/70 hover:border-white/20 transition flex items-center justify-between cursor-pointer"
            >
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400">
                  <ShieldCheck className="w-4 h-4" />
                </div>
                <div className="text-left">
                  <div className="text-xs font-bold text-white font-mono">
                    Stealth Anti-Detection
                  </div>
                  <div className="text-[10px] text-zinc-400">
                    Cross-hedge sizing &amp; casino guard
                  </div>
                </div>
              </div>
              <span className="text-zinc-400 text-xs font-mono">&rarr;</span>
            </button>
          </div>

          {/* 6. Picture-in-Picture Floating Overlay */}
          <div className="space-y-1.5">
            <button
              onClick={() => {
                onClose();
                onOpenOverlay();
              }}
              className="w-full p-3 rounded-2xl border border-white/[0.08] bg-[#0c1233]/70 hover:border-white/20 transition flex items-center justify-between cursor-pointer"
            >
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-cyan-500/20 border border-cyan-500/40 flex items-center justify-center text-cyan-400">
                  <Layers className="w-4 h-4" />
                </div>
                <div className="text-left">
                  <div className="text-xs font-bold text-white font-mono">
                    Floating Mini-Overlay
                  </div>
                  <div className="text-[10px] text-zinc-400">
                    Picture-in-picture compact HUD
                  </div>
                </div>
              </div>
              <span className="text-cyan-400 text-xs font-mono">OPEN</span>
            </button>
          </div>

          {/* 7. Sound Effects Toggle */}
          <div className="space-y-1.5">
            <button
              onClick={onToggleSound}
              className="w-full p-3 rounded-2xl border border-white/[0.08] bg-[#0c1233]/70 hover:border-white/20 transition flex items-center justify-between cursor-pointer"
            >
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-blue-500/20 border border-blue-500/40 flex items-center justify-center text-blue-400">
                  {soundOn ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
                </div>
                <div className="text-left">
                  <div className="text-xs font-bold text-white font-mono">
                    Chime Audio Sound
                  </div>
                  <div className="text-[10px] text-zinc-400">
                    {soundOn ? 'Sound is Enabled' : 'Sound is Muted'}
                  </div>
                </div>
              </div>
              <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded ${soundOn ? 'bg-emerald-500/20 text-emerald-300' : 'bg-zinc-800 text-zinc-400'}`}>
                {soundOn ? 'ON' : 'OFF'}
              </span>
            </button>
          </div>

          {/* 8. Install App (PWA) */}
          <div className="space-y-1.5">
            <button
              onClick={() => {
                onClose();
                onOpenDownload();
              }}
              className="w-full p-3 rounded-2xl border border-white/[0.08] bg-[#0c1233]/70 hover:border-white/20 transition flex items-center justify-between cursor-pointer"
            >
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-teal-500/20 border border-teal-500/40 flex items-center justify-center text-teal-400">
                  <Download className="w-4 h-4" />
                </div>
                <div className="text-left">
                  <div className="text-xs font-bold text-white font-mono">
                    Install Number Shot Pro
                  </div>
                  <div className="text-[10px] text-zinc-400">
                    Download PWA to home screen
                  </div>
                </div>
              </div>
              <span className="text-zinc-400 text-xs font-mono">&rarr;</span>
            </button>
          </div>

          {/* 9. Admin Settings */}
          <div className="space-y-1.5">
            <button
              onClick={() => {
                onClose();
                onOpenSettings();
              }}
              className="w-full p-3 rounded-2xl border border-white/[0.08] bg-[#0c1233]/70 hover:border-white/20 transition flex items-center justify-between cursor-pointer"
            >
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-zinc-700/40 border border-zinc-600 flex items-center justify-center text-zinc-300">
                  <Sliders className="w-4 h-4" />
                </div>
                <div className="text-left">
                  <div className="text-xs font-bold text-white font-mono">
                    Admin API &amp; Bot Config
                  </div>
                  <div className="text-[10px] text-zinc-400">
                    Manage endpoints &amp; Telegram sync
                  </div>
                </div>
              </div>
              <span className="text-zinc-400 text-xs font-mono">&rarr;</span>
            </button>
          </div>
        </div>

        {/* Drawer Footer: Server Cloud Status */}
        <div className="p-3.5 border-t border-white/[0.08] bg-black/40 flex items-center justify-between text-xs font-mono">
          <div className="flex items-center gap-2">
            <span
              className={`w-2 h-2 rounded-full ${
                serverSynced ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400 animate-ping'
              }`}
            />
            <span className="text-zinc-400 text-[10px]">
              {serverSynced ? 'CLOUD 24/7 SYNCED' : 'RECONNECTING...'}
            </span>
          </div>
          <span className="text-[10px] text-zinc-500 font-bold">v3.5 PRO</span>
        </div>
      </div>
    </div>
  );
};
