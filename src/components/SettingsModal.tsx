import React, { useState, useEffect } from 'react';
import { Timeframe } from '../types';
import { TIMEFRAMES, TIMEFRAME_LABELS } from '../utils/engine';
import {
  X,
  Lock,
  Unlock,
  Shield,
  Check,
  AlertCircle,
  RefreshCw,
  KeyRound,
  Globe,
  Send,
  Bot,
  ExternalLink,
  CheckCircle2,
  Cloud,
  Clock,
  Copy,
  Terminal,
  Zap,
  Cpu,
} from 'lucide-react';

interface SettingsModalProps {
  isOpen: boolean;
  activeTimeframe: Timeframe;
  endpoints: Record<Timeframe, string>;
  isAdmin: boolean;
  onClose: () => void;
  onAdminLogin: (passcode: string) => Promise<boolean>;
  onAdminLogout: () => void;
  onSaveEndpoints: (newEndpoints: Record<Timeframe, string>) => Promise<boolean>;
  onResetServerTimeframe?: (tf: Timeframe) => Promise<boolean>;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  activeTimeframe,
  endpoints,
  isAdmin,
  onClose,
  onAdminLogin,
  onAdminLogout,
  onSaveEndpoints,
}) => {
  const [activeTab, setActiveTab] = useState<'scheduler' | 'telegram' | 'feeds'>('scheduler');
  const [localEndpoints, setLocalEndpoints] = useState<Record<Timeframe, string>>(endpoints);
  const [passcode, setPasscode] = useState('');
  const [authError, setAuthError] = useState<string | null>(null);
  const [isVerifying, setIsVerifying] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Telegram VIP Bot state
  const [tgChatId, setTgChatId] = useState('');
  const [tgEnabled, setTgEnabled] = useState(true);
  const [tgTimeframes, setTgTimeframes] = useState<Record<Timeframe, boolean>>({
    '30S': true,
    '1M': true,
    '3M': true,
    '5M': true,
  });
  const [tgTesting, setTgTesting] = useState(false);
  const [tgTestMessage, setTgTestMessage] = useState<string | null>(null);
  const [tgTestError, setTgTestError] = useState<string | null>(null);
  const [tgSaveSuccess, setTgSaveSuccess] = useState(false);

  // Cloud Scheduler status state
  const [cronStatus, setCronStatus] = useState<{
    active: boolean;
    totalTicks: number;
    lastTickTime: number;
    lastTickAgoSec: number | null;
    cronEndpoint: string;
    gcloudCommand: string;
    cloudRunAlwaysOnCommand: string;
  } | null>(null);
  const [isTriggeringCron, setIsTriggeringCron] = useState(false);
  const [cronTriggerResult, setCronTriggerResult] = useState<string | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  // Get current site URL origin
  const currentOrigin = typeof window !== 'undefined' ? window.location.origin : '';
  const cronEndpointUrl = `${currentOrigin}/api/cron/tick`;

  const gcloudSchedulerCmd = `gcloud scheduler jobs create http wingo-telegram-bot-sync \\
  --location=asia-east1 \\
  --schedule="* * * * *" \\
  --uri="${cronEndpointUrl}" \\
  --http-method=GET \\
  --time-zone="Asia/Dhaka"`;

  const gcloudRunWarmCmd = `gcloud run services update $(gcloud run services list --format="value(SERVICE)" | head -n 1) \\
  --min-instances=1 \\
  --no-cpu-throttling \\
  --region=asia-east1`;

  // Load status and settings on open
  useEffect(() => {
    if (!isOpen) return;

    // Load Telegram config
    fetch('/api/telegram/config')
      .then((r) => r.json())
      .then((data) => {
        if (data) {
          if (data.chatId) setTgChatId(data.chatId);
          if (typeof data.enabled === 'boolean') setTgEnabled(data.enabled);
          if (data.timeframes) setTgTimeframes(data.timeframes);
        }
      })
      .catch(() => {});

    // Load Cloud Scheduler status
    fetch('/api/cron/status')
      .then((r) => r.json())
      .then((data) => {
        if (data) setCronStatus(data);
      })
      .catch(() => {});
  }, [isOpen]);

  if (!isOpen) return null;

  const handleCopy = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2500);
  };

  const handleTriggerCronTick = async () => {
    setIsTriggeringCron(true);
    setCronTriggerResult(null);
    try {
      const res = await fetch('/api/cron/tick');
      const data = await res.json();
      if (res.ok && data.success) {
        setCronTriggerResult(
          `✓ Success: 4 Timeframes synced, Cloud Run active, ${data.subscribersCount} Telegram subscribers notified.`
        );
        // Refresh status
        fetch('/api/cron/status')
          .then((r) => r.json())
          .then((d) => setCronStatus(d))
          .catch(() => {});
      } else {
        setCronTriggerResult('⚠ Received response but error reported.');
      }
    } catch {
      setCronTriggerResult('⚠ Failed to reach server cron endpoint.');
    } finally {
      setIsTriggeringCron(false);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!passcode.trim()) return;
    setIsVerifying(true);
    setAuthError(null);
    try {
      const ok = await onAdminLogin(passcode);
      if (ok) {
        setPasscode('');
      } else {
        setAuthError('Incorrect passcode. Please try again.');
      }
    } catch {
      setAuthError('Failed to connect to verification server.');
    } finally {
      setIsVerifying(false);
    }
  };

  const handleSaveEndpoints = async () => {
    for (const tf of TIMEFRAMES) {
      const url = localEndpoints[tf]?.trim() || '';
      if (!url.startsWith('https://')) {
        setAuthError(`${TIMEFRAME_LABELS[tf]} history URL must start with https://`);
        return;
      }
    }

    setIsSaving(true);
    setAuthError(null);
    try {
      const ok = await onSaveEndpoints(localEndpoints);
      if (ok) {
        setSaveSuccess(true);
        setTimeout(() => setSaveSuccess(false), 2500);
      } else {
        setAuthError('Failed to save settings on server.');
      }
    } catch (err: any) {
      setAuthError(err?.message || 'Server error saving settings.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveTelegram = async () => {
    try {
      const res = await fetch('/api/telegram/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chatId: tgChatId.trim(),
          enabled: tgEnabled,
          timeframes: tgTimeframes,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setTgSaveSuccess(true);
        setTimeout(() => setTgSaveSuccess(false), 2500);
      }
    } catch {
      setTgTestError('Failed to save Telegram configuration.');
    }
  };

  const handleTestTelegram = async () => {
    setTgTesting(true);
    setTgTestMessage(null);
    setTgTestError(null);
    try {
      const res = await fetch('/api/telegram/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chatId: tgChatId.trim() }),
      });
      const data = await res.json();
      if (data.success) {
        setTgTestMessage('Signal sent to Telegram successfully! Check your bot/channel.');
      } else {
        setTgTestError(data.error || 'Failed to send signal to Telegram.');
      }
    } catch {
      setTgTestError('Network error connecting to Telegram service.');
    } finally {
      setTgTesting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/85 backdrop-blur-md animate-fadeIn">
      <div className="w-full max-w-2xl max-h-[92vh] flex flex-col rounded-3xl border border-white/10 bg-[#070b10] shadow-[0_20px_50px_rgba(0,0,0,0.8)] overflow-hidden">
        {/* Header */}
        <div className="px-5 py-4 flex items-center justify-between border-b border-white/10 bg-[#0b1017]">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center bg-gradient-to-br from-emerald-500/20 to-cyan-500/10 border border-emerald-500/30 text-emerald-400">
              <Zap className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-extrabold text-white tracking-tight flex items-center gap-2">
                <span>System Cloud Control</span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                  24/7 ACTIVE
                </span>
              </h2>
              <p className="text-[11px] text-slate-400 mt-0.5">
                Google Cloud Run • Cloud Scheduler Keepalive • Telegram VIP Bot
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-9 h-9 rounded-xl flex items-center justify-center text-slate-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation Tabs Rail */}
        <div className="px-5 pt-3 pb-2 border-b border-white/10 bg-[#090d13] flex gap-2 overflow-x-auto">
          <button
            onClick={() => setActiveTab('scheduler')}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
              activeTab === 'scheduler'
                ? 'bg-gradient-to-r from-emerald-500/20 to-cyan-500/20 text-emerald-300 border border-emerald-500/40 shadow-sm'
                : 'text-slate-400 hover:text-slate-200 hover:bg-white/5 border border-transparent'
            }`}
          >
            <Cloud className="w-3.5 h-3.5" />
            <span>24/7 Cloud Scheduler</span>
          </button>

          <button
            onClick={() => setActiveTab('telegram')}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
              activeTab === 'telegram'
                ? 'bg-gradient-to-r from-emerald-500/20 to-cyan-500/20 text-emerald-300 border border-emerald-500/40 shadow-sm'
                : 'text-slate-400 hover:text-slate-200 hover:bg-white/5 border border-transparent'
            }`}
          >
            <Bot className="w-3.5 h-3.5" />
            <span>Telegram VIP Bot</span>
          </button>

          <button
            onClick={() => setActiveTab('feeds')}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
              activeTab === 'feeds'
                ? 'bg-gradient-to-r from-emerald-500/20 to-cyan-500/20 text-emerald-300 border border-emerald-500/40 shadow-sm'
                : 'text-slate-400 hover:text-slate-200 hover:bg-white/5 border border-transparent'
            }`}
          >
            <Globe className="w-3.5 h-3.5" />
            <span>Lottery Feeds & Admin</span>
          </button>
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4 text-xs">
          {authError && (
            <div className="p-3 rounded-2xl bg-rose-500/15 border border-rose-500/30 flex items-start gap-2 text-rose-300">
              <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <span>{authError}</span>
            </div>
          )}

          {saveSuccess && (
            <div className="p-3 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 flex items-center gap-2 text-emerald-300">
              <Check className="w-4 h-4 flex-shrink-0" />
              <span>Server endpoints successfully updated and broadcast worldwide!</span>
            </div>
          )}

          {/* TAB 1: 24/7 CLOUD SCHEDULER & CLOUD RUN */}
          {activeTab === 'scheduler' && (
            <div className="space-y-4">
              {/* Cloud Status Banner */}
              <div className="p-4 rounded-2xl bg-gradient-to-br from-emerald-500/10 via-cyan-500/5 to-transparent border border-emerald-500/25 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-xl bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 flex items-center justify-center">
                      <Cpu className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="text-xs font-black text-white uppercase tracking-wider">
                        Cloud Run 24/7 Keepalive Engine
                      </h4>
                      <p className="text-[11px] text-slate-400">
                        Zero Downtime • Offline Auto-Dispatch • Background Keepalive
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 text-[10px] font-bold font-mono">
                      <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                      <span>{cronStatus?.active ? 'WARM & ACTIVE' : 'ALWAYS READY'}</span>
                    </span>
                  </div>
                </div>

                <p className="text-[11px] text-slate-300 leading-relaxed">
                  গুগল ক্লাউড রানে কোনো রিকোয়েস্ট না থাকলে কন্টেইনার স্লিপ মোডে চলে যায়। <strong>Google Cloud Scheduler</strong> বা যেকোনো ওয়েব ক্রন দিয়ে নিচের এন্ডপয়েন্টে প্রতি ১ মিনিটে পিং পাঠালে সার্ভার ২৪ ঘণ্টা সজাগ থাকবে এবং আপনার কম্পিউটার/মোবাইল অফলাইন থাকলেও টেলিগ্রামে একটানা সিগন্যাল যেতে থাকবে।
                </p>
              </div>

              {/* Endpoint URL Box */}
              <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/10 space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-[11px] font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-cyan-400" />
                    <span>Cloud Scheduler Target URL</span>
                  </label>
                  <span className="text-[10px] text-emerald-400 font-mono">HTTP GET / POST (200 OK)</span>
                </div>

                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    readOnly
                    value={cronEndpointUrl}
                    className="flex-1 h-10 px-3 rounded-xl bg-black/40 border border-white/10 text-xs font-mono text-emerald-300 select-all focus:outline-none"
                  />
                  <button
                    onClick={() => handleCopy(cronEndpointUrl, 'cronUrl')}
                    className="h-10 px-3.5 rounded-xl bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/30 text-emerald-300 font-bold text-xs transition-all cursor-pointer flex items-center gap-1.5"
                  >
                    {copiedKey === 'cronUrl' ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copiedKey === 'cronUrl' ? 'Copied' : 'Copy'}</span>
                  </button>
                  <button
                    onClick={handleTriggerCronTick}
                    disabled={isTriggeringCron}
                    className="h-10 px-4 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 font-black text-xs uppercase tracking-wider transition-all disabled:opacity-50 cursor-pointer flex items-center gap-1.5"
                  >
                    {isTriggeringCron ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Zap className="w-3.5 h-3.5" />}
                    <span>Test Ping</span>
                  </button>
                </div>

                {cronTriggerResult && (
                  <div className="p-2.5 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-[11px] font-medium">
                    {cronTriggerResult}
                  </div>
                )}
              </div>

              {/* Ready-to-Run gcloud CLI Command */}
              <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/10 space-y-2.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Terminal className="w-4 h-4 text-emerald-400" />
                    <span className="text-xs font-bold text-white uppercase tracking-wider">
                      Option A: Google Cloud Scheduler CLI Command
                    </span>
                  </div>
                  <button
                    onClick={() => handleCopy(gcloudSchedulerCmd, 'gcloudScheduler')}
                    className="px-2.5 py-1 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-[11px] font-bold text-slate-300 flex items-center gap-1 transition-colors cursor-pointer"
                  >
                    {copiedKey === 'gcloudScheduler' ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                    <span>{copiedKey === 'gcloudScheduler' ? 'Copied' : 'Copy Command'}</span>
                  </button>
                </div>

                <p className="text-[11px] text-slate-400">
                  Google Cloud Shell বা টার্মিনালে নিচের কমান্ডটি একবার পেস্ট করে এন্টার দিন। প্রতি ১ মিনিট পরপর ক্রন স্বয়ংক্রিয়ভাবে জব এক্সিকিউট করবে:
                </p>

                <pre className="p-3 rounded-xl bg-black/60 border border-white/10 text-[11px] font-mono text-slate-300 overflow-x-auto whitespace-pre leading-relaxed select-all">
                  {gcloudSchedulerCmd}
                </pre>
              </div>

              {/* Cloud Run Always-On CPU Command */}
              <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/10 space-y-2.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Cpu className="w-4 h-4 text-cyan-400" />
                    <span className="text-xs font-bold text-white uppercase tracking-wider">
                      Cloud Run Always-On (Never Sleep) Mode
                    </span>
                  </div>
                  <button
                    onClick={() => handleCopy(gcloudRunWarmCmd, 'gcloudWarm')}
                    className="px-2.5 py-1 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-[11px] font-bold text-slate-300 flex items-center gap-1 transition-colors cursor-pointer"
                  >
                    {copiedKey === 'gcloudWarm' ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                    <span>{copiedKey === 'gcloudWarm' ? 'Copied' : 'Copy Command'}</span>
                  </button>
                </div>

                <p className="text-[11px] text-slate-400">
                  কন্টেইনারকে ২৪/৭ জাগিয়ে রাখতে ক্লাউড রান সার্ভিসে <code>min-instances=1</code> ও <code>no-cpu-throttling</code> অন করতে এই কমান্ড ব্যবহার করুন:
                </p>

                <pre className="p-3 rounded-xl bg-black/60 border border-white/10 text-[11px] font-mono text-slate-300 overflow-x-auto whitespace-pre leading-relaxed select-all">
                  {gcloudRunWarmCmd}
                </pre>
              </div>

              {/* Option B: Free Web Cron (No Terminal Needed) */}
              <div className="p-4 rounded-2xl bg-gradient-to-br from-white/[0.04] to-transparent border border-white/10 space-y-2">
                <span className="text-xs font-bold text-emerald-400 uppercase tracking-wider block">
                  Option B: Free Web Cron (কোনো কমান্ড বা টার্মিনাল ছাড়া)
                </span>
                <p className="text-[11px] text-slate-300 leading-relaxed">
                  আপনার কাছে GCP টার্মিনাল না থাকলে একদম বিনামূল্যে <strong>cron-job.org</strong> অথবা <strong>uptimerobot.com</strong>-এ গিয়ে একটি ফ্রি জব তৈরি করুন:
                </p>
                <div className="p-3 rounded-xl bg-black/40 border border-white/5 space-y-1.5 text-[11px] text-slate-300">
                  <div>১. ক্রন জব URL: <code className="text-emerald-300 font-mono">{cronEndpointUrl}</code></div>
                  <div>২. শিডিউল (Schedule): <strong>Every 1 minute (* * * * *)</strong></div>
                  <div>৩. রিকোয়েস্ট মেথড: <strong>GET</strong></div>
                  <div>৪. সেভ দিন—সার্ভার আর কখনো অফলাইন বা স্লিপ হবে না!</div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: TELEGRAM VIP BOT */}
          {activeTab === 'telegram' && (
            <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/10 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center border border-emerald-500/30">
                    <Bot className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="text-xs font-black text-white uppercase tracking-wider flex items-center gap-1.5">
                      <span>Telegram VIP Bot</span>
                      <span className="text-[9px] px-1.5 py-0.2 rounded-full bg-emerald-500/20 text-emerald-300 font-bold border border-emerald-500/30">
                        MULTI-SUBSCRIBER
                      </span>
                    </h4>
                    <span className="text-[10px] text-slate-400">
                      Bot: <strong>John Wick VIP</strong> (<code>@johnwickvip_bot</code>)
                    </span>
                  </div>
                </div>

                <a
                  href="https://t.me/johnwickvip_bot"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-2.5 py-1 rounded-lg bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/30 text-[10px] font-bold text-emerald-300 flex items-center gap-1 transition-colors"
                >
                  <span>Open Bot</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
              </div>

              {/* Status indicator */}
              <div className="p-2.5 rounded-xl bg-black/40 border border-white/10 flex items-center justify-between">
                <span className="text-[11px] text-slate-400">Connection Status:</span>
                {tgChatId ? (
                  <span className="text-[10px] font-bold text-emerald-400 flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Linked (Target ID: {tgChatId})</span>
                  </span>
                ) : (
                  <span className="text-[10px] font-bold text-amber-300 flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping" />
                    <span>Waiting for /start in Telegram</span>
                  </span>
                )}
              </div>

              {/* Instructions */}
              <div className="p-3 rounded-xl bg-white/[0.02] border border-white/5 text-[11px] text-slate-300 space-y-1 leading-relaxed">
                <span className="font-bold text-white block mb-1">
                  টেলিগ্রাম চ্যানেলে সিগন্যাল সেটআপের সহজ নিয়ম:
                </span>
                <p>১. টেলিগ্রামে গিয়ে <strong className="text-emerald-400">@johnwickvip_bot</strong> সার্চ করে <strong>Start</strong> চাপুন।</p>
                <p>২. অথবা আপনার VIP চ্যানেল/গ্রুপে বটটিকে <strong>Admin</strong> হিসেবে অ্যাড করুন।</p>
                <p>৩. বটটি অটোমেটিক সাবস্ক্রাইবার স্টোরে সেভ হয়ে যাবে এবং ২৪/৭ প্রতি রাউন্ডের সিগন্যাল পোস্ট করবে।</p>
              </div>

              {/* Chat ID Input & Test Button */}
              <div className="space-y-2 pt-1">
                <div className="flex flex-col sm:flex-row gap-2">
                  <input
                    type="text"
                    placeholder="Telegram Chat ID or Channel (e.g. -100... or @channel)"
                    value={tgChatId}
                    onChange={(e) => setTgChatId(e.target.value)}
                    className="flex-1 h-9 px-3 rounded-xl bg-black/40 border border-white/10 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-emerald-500/50"
                  />
                  <button
                    type="button"
                    onClick={handleSaveTelegram}
                    className="h-9 px-3.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-white font-bold text-xs transition-colors cursor-pointer"
                  >
                    Save Target
                  </button>
                  <button
                    type="button"
                    disabled={tgTesting || !tgChatId.trim()}
                    onClick={handleTestTelegram}
                    className="h-9 px-4 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 font-black text-xs uppercase tracking-wider transition-colors disabled:opacity-50 cursor-pointer flex items-center justify-center gap-1.5"
                  >
                    {tgTesting ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                    <span>Test Signal</span>
                  </button>
                </div>

                {tgSaveSuccess && (
                  <div className="text-[11px] text-emerald-400 font-bold">
                    ✓ Telegram Chat ID saved and activated in persistent store!
                  </div>
                )}
                {tgTestMessage && (
                  <div className="p-2.5 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-[11px] font-bold">
                    ✓ {tgTestMessage}
                  </div>
                )}
                {tgTestError && (
                  <div className="p-2.5 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-300 text-[11px]">
                    ⚠ {tgTestError}
                  </div>
                )}

                {/* Broadcast Timeframe Selection */}
                <div className="pt-2">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1.5">
                    বটে যে মোডগুলোর সিগন্যাল পোস্ট হবে:
                  </span>
                  <div className="grid grid-cols-4 gap-1.5">
                    {TIMEFRAMES.map((tf) => (
                      <button
                        key={tf}
                        type="button"
                        onClick={() =>
                          setTgTimeframes({ ...tgTimeframes, [tf]: !tgTimeframes[tf] })
                        }
                        className={`h-8 rounded-lg font-mono text-[10px] font-black transition-colors border cursor-pointer ${
                          tgTimeframes[tf]
                            ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-300'
                            : 'bg-black/30 border-white/10 text-slate-500'
                        }`}
                      >
                        {tf}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: LOTTERY FEEDS & ADMIN */}
          {activeTab === 'feeds' && (
            <div className="space-y-4">
              {/* Admin vs Viewer Status Banner */}
              {!isAdmin ? (
                <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/10 flex flex-col gap-3">
                  <div className="flex items-start gap-2.5">
                    <Shield className="w-5 h-5 text-emerald-400 flex-shrink-0 mt-0.5" />
                    <div>
                      <h4 className="text-xs font-bold text-white uppercase tracking-wider">
                        Public Viewer Mode Active
                      </h4>
                      <p className="text-[11px] text-slate-400 mt-1 leading-relaxed">
                        সকল ডিভাইসে সিগন্যাল সার্ভার থেকে অটোমেটিক ও একক সেন্ট্রাল টাইমে সিঙ্ক হচ্ছে। অ্যাডমিন পাসকোড দিয়ে এন্ডপয়েন্ট এডিট আনলক করতে পারবেন।
                      </p>
                    </div>
                  </div>

                  {/* Passcode Input */}
                  <form onSubmit={handleLogin} className="mt-1 pt-3 border-t border-white/10 flex flex-col sm:flex-row gap-2">
                    <div className="relative flex-1">
                      <KeyRound className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                      <input
                        type="password"
                        placeholder="Enter Admin Passcode (e.g. wingo786)"
                        value={passcode}
                        onChange={(e) => setPasscode(e.target.value)}
                        className="w-full h-10 pl-9 pr-3 rounded-xl bg-black/40 border border-white/10 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-emerald-500/50"
                      />
                    </div>
                    <button
                      type="submit"
                      disabled={isVerifying || !passcode.trim()}
                      className="h-10 px-4 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 font-black text-xs uppercase tracking-wider transition-colors disabled:opacity-50 cursor-pointer flex items-center justify-center gap-1.5"
                    >
                      {isVerifying ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Unlock className="w-4 h-4" />}
                      <span>Unlock Admin</span>
                    </button>
                  </form>
                </div>
              ) : (
                <div className="p-4 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <Shield className="w-5 h-5 text-emerald-400" />
                    <div>
                      <span className="text-xs font-extrabold text-emerald-300 uppercase tracking-wider block">
                        Admin Authenticated
                      </span>
                      <span className="text-[11px] text-slate-400">
                        You have master control to update endpoints and lottery mirrors.
                      </span>
                    </div>
                  </div>
                  <button
                    onClick={onAdminLogout}
                    className="h-8 px-3 rounded-lg bg-rose-500/15 hover:bg-rose-500/25 border border-rose-500/30 text-xs font-bold text-rose-300 transition-colors cursor-pointer"
                  >
                    Log Out
                  </button>
                </div>
              )}

              {/* Endpoints List */}
              <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/10 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Globe className="w-4 h-4 text-emerald-400" />
                    <h4 className="text-xs font-extrabold text-white uppercase tracking-wider">
                      Live Lottery Feed Endpoints
                    </h4>
                  </div>
                  {!isAdmin && (
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-white/5 text-slate-400 border border-white/10 flex items-center gap-1">
                      <Lock className="w-3 h-3" /> Read-Only
                    </span>
                  )}
                </div>

                <div className="space-y-2.5 pt-1">
                  {TIMEFRAMES.map((tf) => (
                    <div key={tf} className="space-y-1">
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="font-bold text-white font-mono">
                          {tf === '30S' ? 'WinGo 30 SEC' : `WinGo ${tf.replace('M', ' MIN')}`}
                        </span>
                        {activeTimeframe === tf && (
                          <span className="text-[9px] uppercase font-extrabold px-1.5 py-0.2 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                            Selected Tab
                          </span>
                        )}
                      </div>
                      <input
                        type="text"
                        disabled={!isAdmin}
                        value={localEndpoints[tf] || ''}
                        onChange={(e) =>
                          setLocalEndpoints({ ...localEndpoints, [tf]: e.target.value })
                        }
                        className={`w-full h-9 px-3 rounded-xl border text-[11px] font-mono transition-colors ${
                          isAdmin
                            ? 'bg-black/40 border-white/10 text-white focus:border-emerald-500/50'
                            : 'bg-black/20 border-white/5 text-slate-500 cursor-not-allowed'
                        }`}
                      />
                    </div>
                  ))}
                </div>

                {isAdmin && (
                  <div className="pt-2 flex justify-end">
                    <button
                      onClick={handleSaveEndpoints}
                      disabled={isSaving}
                      className="h-10 px-5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 font-black text-xs uppercase tracking-wider transition-colors disabled:opacity-50 cursor-pointer flex items-center gap-1.5"
                    >
                      {isSaving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                      <span>Save to Server</span>
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-white/10 bg-[#090d13] flex justify-between items-center text-[11px] text-slate-400">
          <span className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
            <span>Cloud Authority Engine</span>
          </span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 font-bold text-xs text-white transition-colors cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
