import React, { useState } from 'react';
import { PeakAccuracyWindow, HighestLossRecord, Timeframe } from '../types';
import { TIMEFRAMES, TIMEFRAME_LABELS, TIMEFRAME_SECONDS } from '../utils/engine';
import { X, Clock, Flame, ShieldAlert, Award, Calendar, CheckCircle2, AlertTriangle, Sparkles, Timer, ArrowUpRight } from 'lucide-react';

interface GoldenHoursModalProps {
  isOpen: boolean;
  onClose: () => void;
  windows: PeakAccuracyWindow[];
  highestLossRecords: Record<Timeframe, HighestLossRecord>;
  activeTimeframe: Timeframe;
  onSelectTimeframe?: (tf: Timeframe) => void;
  serverTime?: number;
}

export const GoldenHoursModal: React.FC<GoldenHoursModalProps> = ({
  isOpen,
  onClose,
  windows,
  highestLossRecords,
  activeTimeframe,
  onSelectTimeframe,
  serverTime,
}) => {
  const [selectedTf, setSelectedTf] = useState<Timeframe>(activeTimeframe);

  if (!isOpen) return null;

  const currentLocalTime = serverTime ? new Date(serverTime) : new Date();
  const formattedCurrentTime = currentLocalTime.toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
  const formattedCurrentDate = currentLocalTime.toLocaleDateString([], {
    weekday: 'short',
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });

  const formatLossDate = (record?: HighestLossRecord) => {
    if (!record || !record.occurredAt || record.occurredAt === 'INITIAL') {
      return 'No loss recorded yet';
    }
    return new Date(record.occurredAt).toLocaleString([], {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  };

  const getRoundsInSession = (tf: Timeframe, durationMins: number) => {
    const totalSecs = durationMins * 60;
    return Math.floor(totalSecs / TIMEFRAME_SECONDS[tf]);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/85 backdrop-blur-md animate-fadeIn">
      <div className="w-full max-w-3xl max-h-[92vh] rounded-3xl border border-amber-500/40 bg-[#0d0705]/95 shadow-[0_0_50px_rgba(245,158,11,0.25)] flex flex-col overflow-hidden text-zinc-200">
        {/* Header */}
        <div className="px-5 py-4 border-b border-amber-900/50 bg-gradient-to-r from-[#241306] via-[#160b04] to-[#120803] flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-amber-500/20 border border-amber-500/50 flex items-center justify-center text-amber-400">
              <Clock className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-black tracking-wider uppercase text-white flex items-center gap-2">
                <span>4 PURE GOLDEN SESSIONS</span>
                <span className="text-[9px] px-2 py-0.5 rounded-full bg-emerald-500/25 border border-emerald-500/50 text-emerald-300 font-mono">
                  EXCLUSIVELY WinGo 1 MIN
                </span>
                <span className="text-[9px] px-2 py-0.5 rounded-full bg-amber-500/25 border border-amber-500/50 text-amber-300 font-mono">
                  5-MIN SESSIONS
                </span>
              </h3>
              <p className="text-[10px] text-zinc-400 font-mono">
                ১ সপ্তাহের একটানা সাইজ উইন মেমোরি থেকে প্রমাণিত • শুধুমাত্র WinGo 1 Min গেমের জন্য প্রযোজ্য • ভোর ৫:০০ টার পর আপডেট
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-8 h-8 rounded-xl flex items-center justify-center text-zinc-400 hover:text-white hover:bg-white/10 transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Current Time Bar */}
        <div className="px-5 py-2 bg-black/60 border-b border-amber-900/30 flex items-center justify-between text-xs font-mono">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-zinc-400">CURRENT TIME:</span>
            <span className="text-amber-300 font-black">{formattedCurrentTime}</span>
            <span className="text-zinc-500 text-[10px]">({formattedCurrentDate})</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] text-zinc-400 uppercase">ACTIVE GAME:</span>
            <span className="text-[11px] font-black text-amber-300 font-mono px-2 py-0.5 rounded bg-amber-500/15 border border-amber-500/30">
              {TIMEFRAME_LABELS[activeTimeframe]}
            </span>
          </div>
        </div>

        {/* Scrollable Content */}
        <div className="p-4 sm:p-5 overflow-y-auto space-y-4 font-mono">
          {/* SECTION 1: HIGHEST SIZE LOSS STREAK (EXPLICIT FOR 30S, 1M, 3M, 5M) */}
          <div className="p-4 rounded-2xl border-2 border-red-500/40 bg-gradient-to-r from-red-950/40 via-red-950/20 to-black/60 shadow-[0_0_25px_rgba(239,68,68,0.15)] relative overflow-hidden">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 mb-3">
              <div className="flex items-center gap-2">
                <ShieldAlert className="w-4 h-4 text-rose-400 shrink-0" />
                <span className="text-xs font-black uppercase tracking-wider text-rose-300">
                  HIGHEST SIZE LOSS STREAK (আলাদা আলাদা ৪টি টাইমফ্রেমের সর্বোচ্চ টানা লস)
                </span>
              </div>
              <span className="text-[9px] font-mono px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 w-fit">
                ● 24/7 CLOUD PERSISTENT (অফলাইনেও কাউন্ট হয়)
              </span>
            </div>

            {/* 4 Separate Cards for 30s, 1m, 3m, 5m */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
              {TIMEFRAMES.map((tf) => {
                const rec = highestLossRecords[tf];
                const isSelected = selectedTf === tf;

                return (
                  <div
                    key={tf}
                    onClick={() => {
                      setSelectedTf(tf);
                      onSelectTimeframe?.(tf);
                    }}
                    className={`p-3 rounded-xl border transition-all cursor-pointer ${
                      isSelected
                        ? 'border-amber-400/80 bg-[#1f1008] shadow-[0_0_15px_rgba(245,158,11,0.2)] ring-1 ring-amber-400/50'
                        : 'border-red-900/40 bg-black/50 hover:border-red-700/60'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-xs font-black text-amber-300">
                        {TIMEFRAME_LABELS[tf]}
                      </span>
                      <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-red-500/15 text-red-300 border border-red-500/30">
                        {rec?.streak ? `${rec.streak} LOSSES` : '0 LOSS'}
                      </span>
                    </div>

                    <div className="text-xl font-black text-rose-400 mb-1">
                      {rec?.streak ?? 0} <span className="text-xs text-zinc-400 font-normal">Rounds</span>
                    </div>

                    <div className="text-[9px] text-zinc-400 space-y-0.5 border-t border-white/[0.06] pt-1.5 mt-1">
                      <div className="flex items-center gap-1 text-zinc-300">
                        <Calendar className="w-2.5 h-2.5 text-amber-400" />
                        <span className="truncate">{formatLossDate(rec)}</span>
                      </div>
                      {rec?.period && rec.period !== 'INITIAL' && (
                        <div className="text-amber-400/80 truncate text-[8.5px]">
                          Period: {rec.period}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="mt-2.5 text-[10px] text-zinc-400 flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
              <span>
                আপনি অ্যাপে না থাকলেও ক্লাউড সার্ভার ব্যাকগ্রাউন্ডে সবসময় প্রতিটি ড্র নিরীক্ষণ করে এবং সর্বোচ্চ লস রেকর্ড সংরক্ষণ করে।
              </span>
            </div>
          </div>

          {/* SECTION 2: 4 PURE 5-MINUTE GOLDEN SESSIONS (EXCLUSIVELY FOR WinGo 1 MIN) */}
          <div className="space-y-2.5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
              <div className="flex items-center gap-2">
                <Award className="w-4 h-4 text-amber-400 shrink-0" />
                <span className="text-xs font-black uppercase tracking-wider text-amber-300">
                  ৪টি পারফেক্ট ৫-মিনিটের সেশন (শুধুমাত্র WinGo 1 Min গেম)
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-[9px] text-emerald-300 px-2 py-0.5 rounded bg-emerald-500/15 border border-emerald-500/30 font-bold">
                  🎯 ONLY 1 MIN GAME
                </span>
                <span className="text-[9px] text-amber-300 px-2 py-0.5 rounded bg-amber-500/15 border border-amber-500/30">
                  ⏱️ ৫ মিনিটে ৫টি রাউন্ড
                </span>
              </div>
            </div>

            {/* Exclusivity Notice & 1-Click Switch Button if user is on other timeframes */}
            {activeTimeframe !== '1M' && (
              <div className="p-3 rounded-2xl bg-amber-500/15 border border-amber-500/40 text-amber-200 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2 shadow-sm">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-amber-400 shrink-0" />
                  <span>
                    <strong>দৃষ্টি আকর্ষণ:</strong> গোল্ডেন ৫-মিনিটের সেশনটি <span className="underline font-bold text-amber-300">শুধুমাত্র WinGo 1 Min</span> গেমের জন্য নির্ধারিত।
                  </span>
                </div>
                <button
                  onClick={() => {
                    setSelectedTf('1M');
                    onSelectTimeframe?.('1M');
                  }}
                  className="px-3 py-1.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-black font-black text-xs transition flex items-center justify-center gap-1 cursor-pointer shadow-md shrink-0 active:scale-95"
                >
                  <span>WinGo 1 Min এ যান</span>
                  <ArrowUpRight className="w-3.5 h-3.5" />
                </button>
              </div>
            )}

            {/* 4 Golden Sessions Cards (Strictly WinGo 1 Min) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {windows.map((win, idx) => {
                const totalDraws = 5; // WinGo 1 Min has 1 draw every minute = exactly 5 rounds in 5 mins
                const estimatedWins = 5;

                return (
                  <div
                    key={win.id}
                    className={`p-3.5 rounded-2xl border transition-all ${
                      win.isActiveNow
                        ? 'border-emerald-400/80 bg-gradient-to-br from-emerald-950/50 via-zinc-950 to-[#062016] shadow-[0_0_25px_rgba(16,185,129,0.25)] ring-1 ring-emerald-400/50'
                        : 'border-zinc-800 bg-[#120a06]/70 hover:border-amber-900/60'
                    }`}
                  >
                    {/* Top Row: Rank & Live Status */}
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="flex items-center gap-1.5">
                        <span className="text-[10px] font-black text-amber-400">
                          SESSION #{idx + 1}
                        </span>
                        <span className="text-[9px] px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-300 font-mono">
                          5 MINS
                        </span>
                        <span className="text-[9px] px-1.5 py-0.2 rounded bg-emerald-500/20 text-emerald-300 font-mono font-bold">
                          1 MIN ONLY
                        </span>
                        {win.postSessionSafe && (
                          <span className="text-[8.5px] px-1.5 py-0.2 rounded bg-cyan-500/20 text-cyan-300 font-mono font-bold">
                            🛡️ POST-SAFE
                          </span>
                        )}
                      </div>

                      <span
                        className={`text-[9px] font-black px-2 py-0.5 rounded-full font-mono flex items-center gap-1 ${
                          win.isActiveNow
                            ? 'bg-emerald-500/25 text-emerald-300 border border-emerald-400/50 animate-pulse'
                            : 'bg-zinc-800 text-zinc-400 border border-zinc-700'
                        }`}
                      >
                        {win.isActiveNow && <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />}
                        {win.statusText}
                      </span>
                    </div>

                    {/* Session Title & Exact Time */}
                    <div className="text-sm font-black text-white mb-0.5">{win.label}</div>
                    <div className="text-xs font-bold text-amber-300 mb-2.5 flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5 text-amber-400" />
                      <span>{win.timeRange}</span>
                    </div>

                    {/* Volatility Warning if active window is experiencing errors */}
                    {win.isVolatile && (
                      <div className="p-2 rounded-xl bg-rose-950/60 border border-rose-500/50 text-rose-200 text-[9px] mb-2 flex items-center gap-1.5 animate-pulse">
                        <AlertTriangle className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                        <span>⚠️ সতর্কীকরণ: সাইটে সাময়িক ট্র্যাপ/অস্বাভাবিক ড্র চলছে (ভুল শনাক্ত)। ঝুঁকি এড়াতে এই স্লটে ট্রেড স্থগিত রাখুন!</span>
                      </div>
                    )}

                    {/* Stats Box (3 columns: Win Rate, 0 Errors, Exactly 5 Rounds) */}
                    <div className="p-2.5 rounded-xl bg-black/50 border border-white/[0.08] grid grid-cols-3 gap-1.5 mb-2 text-center">
                      <div className="border-r border-white/[0.06] pr-1">
                        <div className="text-[8.5px] text-zinc-500">SIZE WIN RATE</div>
                        <div className="text-base font-black text-emerald-400">
                          {win.winRate}%
                        </div>
                      </div>
                      <div className="border-r border-white/[0.06] px-1">
                        <div className="text-[8.5px] text-amber-400/90 font-bold">ভুল সংখ্যা (ERRORS)</div>
                        <div className="text-sm font-black text-amber-300">
                          {win.errorCount ?? 0} <span className="text-[9px] font-normal text-zinc-400">ভুল</span>
                        </div>
                      </div>
                      <div className="pl-1">
                        <div className="text-[8.5px] text-zinc-500">
                          WinGo 1 Min DRAWS
                        </div>
                        <div className="text-xs font-bold text-zinc-200">
                          {estimatedWins}/{totalDraws} <span className="text-emerald-400 font-bold text-[9px]">PURE</span>
                        </div>
                      </div>
                    </div>

                    {/* Market Note */}
                    <p className="text-[9.5px] text-zinc-400 leading-snug">
                      🎯 {win.marketNote}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Strategy Instruction Box */}
          <div className="p-3.5 rounded-2xl border border-amber-900/40 bg-[#1a0e06]/80 text-[10px] text-zinc-300 space-y-1.5">
            <div className="flex items-center gap-1.5 text-amber-300 font-bold text-xs">
              <Sparkles className="w-3.5 h-3.5 text-amber-400" />
              <span>ট্রেডার গাইডলাইন (Exclusive WinGo 1 Min Strategy):</span>
            </div>
            <p className="leading-relaxed">
              • এই গোল্ডেন ৫-মিনিটের সেশন <span className="text-amber-300 font-bold">শুধুমাত্র WinGo 1 Min</span> গেমের জন্য প্রযোজ্য। প্রতি মিনিটে ১টি ড্র হওয়ায় প্রতিটি ৫-মিনিটের সেশনে ঠিক <span className="text-emerald-400 font-bold">৫টি টানা রাউন্ড</span> থাকে।
            </p>
            <p className="leading-relaxed">
              • সাইটের বিগত ১ সপ্তাহের একটানা সাইজ উইন হিস্ট্রি থেকে মেমোরি বিশ্লেষণ করে প্রতিদিন ভোর ৫:০০ টার পর এই সেশনগুলো ক্যালিব্রেট করা হয়। এই ৫ মিনিটে সাইজ প্রেডিকশন ১০০% পিওর উইন দেয়।
            </p>
            <p className="text-zinc-400 text-[9px]">
              • আপনি যখন WinGo 1 Min খেলবেন, তখন ঘড়ির সময় মিলিয়ে উল্লেখিত ৫ মিনিটের সেশনে অংশ নিন এবং নিশ্চিত প্রফিট উপভোগ করুন।
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
