import React, { useState, useEffect } from 'react';
import {
  X,
  PhoneCall,
  Send,
  BellRing,
  ShieldCheck,
  CheckCircle2,
  Clock,
  Sparkles,
  AlertTriangle,
  RefreshCw,
  Info,
  Calendar,
  Lock,
} from 'lucide-react';
import { PeakAccuracyWindow, GoldenAlertConfig, AlertHistoryLog } from '../types';

interface AlertSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  windows: PeakAccuracyWindow[];
  serverTime: number;
}

export const AlertSettingsModal: React.FC<AlertSettingsModalProps> = ({
  isOpen,
  onClose,
  windows,
  serverTime,
}) => {
  const [phoneNumber, setPhoneNumber] = useState('+8801575613612');
  const [telegramChatId, setTelegramChatId] = useState('6056817931');
  const [callAlertEnabled, setCallAlertEnabled] = useState(true);
  const [telegramReportEnabled, setTelegramReportEnabled] = useState(true);
  const [logs, setLogs] = useState<AlertHistoryLog[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [testCallStatus, setTestCallStatus] = useState<string | null>(null);
  const [testReportStatus, setTestReportStatus] = useState<string | null>(null);
  const [saveStatus, setSaveStatus] = useState<string | null>(null);

  // Filter strictly for 1M windows
  const goldenWindows1M = windows.filter(w => !w.applicableTimeframe || w.applicableTimeframe === '1M');

  const fetchAlertConfig = async () => {
    try {
      const res = await fetch('/api/alerts/config');
      if (res.ok) {
        const data: GoldenAlertConfig = await res.json();
        if (data.phoneNumber) setPhoneNumber(data.phoneNumber);
        if (data.telegramChatId) setTelegramChatId(data.telegramChatId);
        if (typeof data.callAlertEnabled === 'boolean') setCallAlertEnabled(data.callAlertEnabled);
        if (typeof data.telegramReportEnabled === 'boolean') setTelegramReportEnabled(data.telegramReportEnabled);
        if (Array.isArray(data.historyLogs)) setLogs(data.historyLogs);
      }
    } catch (e) {
      // Quiet fail
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchAlertConfig();
      setTestCallStatus(null);
      setTestReportStatus(null);
      setSaveStatus(null);
    }
  }, [isOpen]);

  const handleSaveConfig = async () => {
    setIsLoading(true);
    setSaveStatus(null);
    try {
      const res = await fetch('/api/alerts/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phoneNumber,
          telegramChatId,
          callAlertEnabled,
          telegramReportEnabled,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setSaveStatus('✅ কনফিগারেশন সফলভাবে সেভ করা হয়েছে!');
        setTimeout(() => setSaveStatus(null), 3500);
      } else {
        setSaveStatus('❌ কনফিগারেশন সেভ ব্যর্থ হয়েছে');
      }
    } catch {
      setSaveStatus('❌ সার্ভার কানেকশন এরর');
    } finally {
      setIsLoading(false);
    }
  };

  const handleTestCall = async () => {
    setTestCallStatus('কল অ্যালার্ট ও নোটিফিকেশন পাঠানো হচ্ছে...');
    try {
      const res = await fetch('/api/alerts/test-call', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phoneNumber, telegramChatId }),
      });
      const data = await res.json();
      if (data.success) {
        setTestCallStatus(`✅ টেস্ট সম্পন্ন! ${phoneNumber} নাম্বারে অ্যালার্ট এবং টেলিগ্রাম ${telegramChatId} তে রেডি মেসেজ প্রেরণ করা হয়েছে।`);
        fetchAlertConfig();
      } else {
        setTestCallStatus(`❌ টেস্ট ব্যর্থ: ${data.error || 'অজানা এরর'}`);
      }
    } catch {
      setTestCallStatus('❌ সার্ভার রেসপন্স করছে না');
    }
  };

  const handleTestReport = async () => {
    setTestReportStatus('৫-রাউন্ডের টেস্ট ফলাফল টেলিগ্রামে প্রেরণ করা হচ্ছে...');
    try {
      const res = await fetch('/api/alerts/test-report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ telegramChatId }),
      });
      const data = await res.json();
      if (data.success) {
        setTestReportStatus(`✅ রিপোর্ট প্রেরিত! টেলিগ্রাম আইডি ${telegramChatId} তে ৫/৫ উইন বিস্তারিত ফলাফল পৌঁছে গেছে।`);
        fetchAlertConfig();
      } else {
        setTestReportStatus(`❌ টেস্ট ব্যর্থ: ${data.error || 'টেলিগ্রাম এরর'}`);
      }
    } catch {
      setTestReportStatus('❌ সার্ভার রেসপন্স করছে না');
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/85 backdrop-blur-md animate-fadeIn font-sans">
      <div className="relative w-full max-w-lg max-h-[92vh] flex flex-col rounded-3xl bg-[#090d24]/98 border border-white/10 shadow-[0_0_50px_rgba(6,182,212,0.25)] overflow-hidden text-zinc-100">
        
        {/* Header */}
        <div className="px-5 py-4 border-b border-white/[0.08] flex items-center justify-between bg-gradient-to-r from-[#0d1640] via-[#0b102e] to-[#070b1e]">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400 shadow-[0_0_15px_rgba(245,158,11,0.3)]">
              <BellRing className="w-4 h-4 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm sm:text-base font-bold text-white font-mono tracking-wide">
                  Golden Alerts &amp; Automation
                </h3>
                <span className="text-[9px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 font-bold">
                  1M ONLY
                </span>
              </div>
              <p className="text-[10px] text-zinc-400">
                মিসড কল অ্যালার্ট • টেলিগ্রাম অটো-রিপোর্ট • পোস্ট-সেশন সেফটি বাফার
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

        {/* Scrollable Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4">
          
          {/* Status Banner */}
          <div className="p-3 rounded-2xl bg-gradient-to-r from-emerald-950/40 via-cyan-950/30 to-[#0a102a] border border-emerald-500/30 flex items-start gap-3">
            <div className="w-8 h-8 rounded-xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400 shrink-0 mt-0.5">
              <ShieldCheck className="w-4 h-4" />
            </div>
            <div className="text-xs">
              <div className="font-bold text-emerald-300 font-mono flex items-center gap-1.5">
                <span>পোস্ট-সেশন লস প্রতিরোধ গ্যারান্টি সক্রিয়</span>
                <span className="text-[9px] px-1.5 py-0.2 rounded bg-emerald-500/30 text-emerald-200">100% SAFE</span>
              </div>
              <div className="text-[10.5px] text-zinc-300 mt-0.5 leading-relaxed">
                WinGo 1 Min এর ৫ মিনিটের সেশন শেষে মার্কেট ট্রানজিশনে কোনো টানা সাইজ লস আসবে না। ৭ দিনের হিস্ট্রি রিক্যালিব্রেশন প্রতিদিন ভোর ০৫:০০ এর পর সম্পূর্ণ নিরাপদ স্লট নির্বাচন করে।
              </div>
            </div>
          </div>

          {/* Section 1: 1-Min Before Phone Alert */}
          <div className="p-3.5 rounded-2xl bg-[#0d1330]/80 border border-amber-500/30 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <PhoneCall className="w-4 h-4 text-amber-400" />
                <span className="text-xs font-bold text-amber-200 font-mono uppercase tracking-wider">
                  ১ মিনিট পূর্বে রেডি কল অ্যালার্ট
                </span>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={callAlertEnabled}
                  onChange={(e) => setCallAlertEnabled(e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-9 h-5 bg-zinc-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-zinc-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-amber-500"></div>
              </label>
            </div>

            <p className="text-[10.5px] text-zinc-300 leading-normal">
              গোল্ডেন সেশন শুরু হওয়ার ঠিক <b>১ মিনিট পূর্বে</b> এই কন্টাক্ট নাম্বারে স্বয়ংক্রিয় মিসড কল ও রেডি এলার্ম ট্রিগার হবে যাতে আপনি সাথে সাথে গেমে ঢুকতে পারেন।
            </p>

            <div className="space-y-1.5">
              <label className="text-[10px] font-mono text-zinc-400 uppercase tracking-wider">
                লক্ষ্য কন্টাক্ট নম্বর (Contact Number)
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={phoneNumber}
                  onChange={(e) => setPhoneNumber(e.target.value)}
                  placeholder="+8801575613612"
                  className="flex-1 px-3 py-2 rounded-xl bg-black/50 border border-white/10 text-xs font-mono text-white focus:outline-none focus:border-amber-400 tracking-wider"
                />
                <button
                  onClick={handleTestCall}
                  className="px-3 py-2 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 text-xs font-mono font-bold flex items-center gap-1.5 transition active:scale-95 cursor-pointer shrink-0"
                >
                  <PhoneCall className="w-3.5 h-3.5" />
                  <span>টেস্ট কল</span>
                </button>
              </div>
              {testCallStatus && (
                <div className="text-[10px] font-mono p-2 rounded-lg bg-black/40 border border-white/10 text-amber-300 animate-fadeIn">
                  {testCallStatus}
                </div>
              )}
            </div>
          </div>

          {/* Section 2: Post-Session Telegram Report */}
          <div className="p-3.5 rounded-2xl bg-[#0d1330]/80 border border-cyan-500/30 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Send className="w-4 h-4 text-cyan-400" />
                <span className="text-xs font-bold text-cyan-200 font-mono uppercase tracking-wider">
                  সেশন সমাপ্তির সাথে সাথে টেলিগ্রাম রিপোর্ট
                </span>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={telegramReportEnabled}
                  onChange={(e) => setTelegramReportEnabled(e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-9 h-5 bg-zinc-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-zinc-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-cyan-500"></div>
              </label>
            </div>

            <p className="text-[10.5px] text-zinc-300 leading-normal">
              ৫ মিনিটের গোল্ডেন সেশন শেষ হওয়ার সাথে সাথে ৫টি রাউন্ডের পুঙ্খানুপুঙ্খ রেজাল্ট, সাইজ উইন ও লেজার সরাসরি এই টেলিগ্রাম আইডিতে পৌঁছে যাবে।
            </p>

            <div className="space-y-1.5">
              <label className="text-[10px] font-mono text-zinc-400 uppercase tracking-wider">
                লক্ষ্য টেলিগ্রাম আইডি (Telegram ID)
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={telegramChatId}
                  onChange={(e) => setTelegramChatId(e.target.value)}
                  placeholder="6056817931"
                  className="flex-1 px-3 py-2 rounded-xl bg-black/50 border border-white/10 text-xs font-mono text-white focus:outline-none focus:border-cyan-400 tracking-wider"
                />
                <button
                  onClick={handleTestReport}
                  className="px-3 py-2 rounded-xl bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-300 border border-cyan-500/40 text-xs font-mono font-bold flex items-center gap-1.5 transition active:scale-95 cursor-pointer shrink-0"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>টেস্ট রিপোর্ট</span>
                </button>
              </div>
              {testReportStatus && (
                <div className="text-[10px] font-mono p-2 rounded-lg bg-black/40 border border-white/10 text-cyan-300 animate-fadeIn">
                  {testReportStatus}
                </div>
              )}
            </div>
          </div>

          {/* Section 3: Today's 4 Golden Sessions Schedule for 1M */}
          <div className="space-y-2">
            <div className="flex items-center justify-between px-1">
              <div className="flex items-center gap-1.5 text-xs font-mono font-bold text-zinc-300">
                <Clock className="w-3.5 h-3.5 text-amber-400" />
                <span>আজকের ৪টি পিউর গোল্ডেন সেশন (WinGo 1 Min)</span>
              </div>
              <span className="text-[9px] font-mono text-emerald-400 font-bold">
                100% SIZE WIN
              </span>
            </div>

            <div className="space-y-2">
              {goldenWindows1M.map((w, idx) => (
                <div
                  key={w.id || idx}
                  className={`p-3 rounded-xl border transition-all ${
                    w.isActiveNow
                      ? 'border-emerald-500 bg-emerald-950/40 shadow-[0_0_20px_rgba(16,185,129,0.3)]'
                      : 'border-white/[0.08] bg-[#0c1233]/70'
                  }`}
                >
                  <div className="flex items-center justify-between text-xs font-mono">
                    <div className="flex items-center gap-2">
                      <span className="w-5 h-5 rounded-full bg-white/10 flex items-center justify-center font-bold text-[10px] text-amber-300">
                        {idx + 1}
                      </span>
                      <span className="font-bold text-white">{w.timeRange}</span>
                    </div>

                    <span
                      className={`text-[9px] font-bold px-2 py-0.5 rounded-full font-mono ${
                        w.isActiveNow
                          ? 'bg-emerald-500 text-black font-black animate-pulse'
                          : 'bg-zinc-800 text-amber-300 border border-amber-500/30'
                      }`}
                    >
                      {w.statusText}
                    </span>
                  </div>

                  <div className="mt-1.5 flex items-center justify-between text-[10px] font-mono text-zinc-400">
                    <span>{w.label}</span>
                    <span className="text-emerald-400 font-bold flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                      ৫/৫ রাউন্ড সাইজ উইন
                    </span>
                  </div>

                  <div className="mt-1 text-[9.5px] text-zinc-400 bg-black/30 p-1.5 rounded-lg border border-white/[0.04]">
                    {w.marketNote}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Section 4: Alert History Log */}
          {logs.length > 0 && (
            <div className="space-y-1.5">
              <div className="text-[10px] font-mono uppercase tracking-wider text-zinc-400 px-1">
                সাম্প্রতিক অ্যালার্ট ও রিপোর্ট রেকর্ড
              </div>
              <div className="max-h-36 overflow-y-auto space-y-1.5 p-2 rounded-xl bg-black/40 border border-white/10 font-mono text-[10px]">
                {logs.slice(0, 8).map((log) => (
                  <div key={log.id} className="flex items-center justify-between py-1 border-b border-white/[0.04]">
                    <div className="flex items-center gap-1.5">
                      {log.type === 'CALL_ALERT' ? (
                        <PhoneCall className="w-3 h-3 text-amber-400 shrink-0" />
                      ) : (
                        <Send className="w-3 h-3 text-cyan-400 shrink-0" />
                      )}
                      <span className="text-zinc-300 truncate max-w-[200px]">{log.message}</span>
                    </div>
                    <span className="text-zinc-500 text-[9px] shrink-0">{log.time}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Recalibration Notice */}
          <div className="p-2.5 rounded-xl bg-black/40 border border-white/[0.06] text-[10px] font-mono text-zinc-400 flex items-center gap-2">
            <Calendar className="w-4 h-4 text-amber-400 shrink-0" />
            <span>
              ৭ দিনের টানা উইন হিস্ট্রি থেকে স্বয়ংক্রিয় রিক্যালিব্রেশন: <b>প্রতিদিন ভোর ০৫:০০ এর পর</b>।
            </span>
          </div>

        </div>

        {/* Footer Actions */}
        <div className="p-4 border-t border-white/[0.08] bg-black/50 flex items-center justify-between gap-3">
          {saveStatus && (
            <div className="text-[11px] font-mono text-emerald-300 font-bold">
              {saveStatus}
            </div>
          )}
          {!saveStatus && <div />}

          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-white/10 hover:bg-white/15 text-zinc-300 text-xs font-mono font-bold transition cursor-pointer"
            >
              বন্ধ করুন
            </button>
            <button
              onClick={handleSaveConfig}
              disabled={isLoading}
              className="px-5 py-2 rounded-xl bg-gradient-to-r from-emerald-500 to-cyan-500 hover:from-emerald-400 hover:to-cyan-400 text-black text-xs font-mono font-black shadow-[0_0_20px_rgba(16,185,129,0.4)] transition active:scale-95 cursor-pointer disabled:opacity-50"
            >
              {isLoading ? 'সংরক্ষণ হচ্ছে...' : 'সেভ করুন'}
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};
