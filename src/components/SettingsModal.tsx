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
  onResetServerTimeframe,
}) => {
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

  // Load Telegram settings from server
  useEffect(() => {
    if (!isOpen) return;
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
  }, [isOpen]);

  if (!isOpen) return null;

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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
      <div className="w-full max-w-xl max-h-[92vh] flex flex-col rounded-3xl border border-[#21483c] bg-[#061b17] shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="px-5 py-4 flex items-center justify-between border-b border-[#21483c] bg-[#0c2822]">
          <div className="flex items-center gap-2.5">
            <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${isAdmin ? 'bg-[#25c98e] text-[#04221a]' : 'bg-[#14362e] text-[#91aaa0]'}`}>
              {isAdmin ? <Unlock className="w-4 h-4" /> : <Lock className="w-4 h-4" />}
            </div>
            <div>
              <h2 className="text-base font-extrabold text-[#e9fff4] tracking-tight">
                {isAdmin ? 'Admin Console & Telegram Bot' : 'Live Feed Status & VIP Bot'}
              </h2>
              <p className="text-[11px] text-[#91aaa0] mt-0.5">
                {isAdmin ? 'Full administrative control unlocked' : 'Public viewer mode · Single cloud authority'}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-9 h-9 rounded-xl flex items-center justify-center text-[#91aaa0] hover:text-[#e9fff4] hover:bg-[#14362e] transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4 text-xs">
          {authError && (
            <div className="p-3 rounded-xl bg-[#ef6269]/15 border border-[#ef6269]/40 flex items-start gap-2 text-[#ef6269]">
              <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <span>{authError}</span>
            </div>
          )}

          {saveSuccess && (
            <div className="p-3 rounded-xl bg-[#25c98e]/15 border border-[#25c98e]/40 flex items-center gap-2 text-[#25c98e]">
              <Check className="w-4 h-4 flex-shrink-0" />
              <span>Server endpoints successfully updated and broadcast to all devices!</span>
            </div>
          )}

          {/* TELEGRAM VIP BOT BROADCAST SECTION */}
          <div className="p-4 rounded-2xl bg-[#0c2822] border border-[#25c98e]/40 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-[#25c98e] text-[#04221a] flex items-center justify-center">
                  <Bot className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-xs font-black text-[#e9fff4] uppercase tracking-wider flex items-center gap-1.5">
                    <span>Telegram VIP Bot</span>
                    <span className="text-[9px] px-1.5 py-0.2 rounded bg-[#25c98e] text-[#04221a] font-bold">
                      LIVE SYNC
                    </span>
                  </h4>
                  <span className="text-[10px] text-[#91aaa0]">
                    Bot Name: <strong>John Wick VIP</strong> (<code>@johnwickvip_bot</code>)
                  </span>
                </div>
              </div>

              <a
                href="https://t.me/johnwickvip_bot"
                target="_blank"
                rel="noopener noreferrer"
                className="px-2.5 py-1 rounded-lg bg-[#14362e] hover:bg-[#173d33] border border-[#21483c] text-[10px] font-bold text-[#25c98e] flex items-center gap-1 transition-colors"
              >
                <span>Open Bot</span>
                <ExternalLink className="w-3 h-3" />
              </a>
            </div>

            {/* Status indicator */}
            <div className="p-2.5 rounded-xl bg-[#061b17] border border-[#21483c] flex items-center justify-between">
              <span className="text-[11px] text-[#91aaa0]">Connection Status:</span>
              {tgChatId ? (
                <span className="text-[10px] font-bold text-[#25c98e] flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>Linked (Chat ID: {tgChatId})</span>
                </span>
              ) : (
                <span className="text-[10px] font-bold text-[#f1c97a] flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-[#f1c97a] animate-ping" />
                  <span>Waiting for /start in Telegram</span>
                </span>
              )}
            </div>

            {/* Quick Setup Instructions */}
            <div className="p-3 rounded-xl bg-[#14362e]/50 border border-[#21483c] text-[11px] text-[#91aaa0] space-y-1 leading-relaxed">
              <span className="font-bold text-[#e9fff4] block mb-1">
                টেলিগ্রামে অটো সিগন্যাল চালু করার নিয়ম:
              </span>
              <p>১. টেলিগ্রামে গিয়ে <strong className="text-[#25c98e]">@johnwickvip_bot</strong> সার্চ করে <strong>Start</strong> চাপুন।</p>
              <p>২. অথবা আপনার VIP চ্যানেল/গ্রুপে বটটিকে <strong>Admin</strong> হিসেবে অ্যাড করুন।</p>
              <p>৩. বটটি অটোমেটিক চ্যাট ডিটেক্ট করে নেবে এবং প্রতি রাউন্ডের আগে লাইভ সিগন্যাল পোস্ট করবে!</p>
            </div>

            {/* Chat ID Input & Test Button */}
            <div className="space-y-2 pt-1">
              <div className="flex flex-col sm:flex-row gap-2">
                <input
                  type="text"
                  placeholder="Telegram Chat ID or Channel (e.g. -100... or @channel)"
                  value={tgChatId}
                  onChange={(e) => setTgChatId(e.target.value)}
                  className="flex-1 h-9 px-3 rounded-xl bg-[#061b17] border border-[#21483c] text-xs text-[#e9fff4] placeholder:text-[#91aaa0]/50 focus:outline-none focus:border-[#25c98e]"
                />
                <button
                  type="button"
                  onClick={handleSaveTelegram}
                  className="h-9 px-3.5 rounded-xl bg-[#14362e] hover:bg-[#173d33] border border-[#25c98e]/40 text-[#25c98e] font-bold text-xs transition-colors cursor-pointer"
                >
                  Save ID
                </button>
                <button
                  type="button"
                  disabled={tgTesting || !tgChatId.trim()}
                  onClick={handleTestTelegram}
                  className="h-9 px-4 rounded-xl bg-[#25c98e] hover:bg-[#28d59b] text-[#04221a] font-black text-xs uppercase tracking-wider transition-colors disabled:opacity-50 cursor-pointer flex items-center justify-center gap-1.5"
                >
                  {tgTesting ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                  <span>Test Signal</span>
                </button>
              </div>

              {/* Feedback messages */}
              {tgSaveSuccess && (
                <div className="text-[11px] text-[#25c98e] font-bold">
                  ✓ Telegram Chat ID saved and activated!
                </div>
              )}
              {tgTestMessage && (
                <div className="p-2.5 rounded-xl bg-[#25c98e]/15 border border-[#25c98e]/40 text-[#25c98e] text-[11px] font-bold">
                  ✓ {tgTestMessage}
                </div>
              )}
              {tgTestError && (
                <div className="p-2.5 rounded-xl bg-[#ef6269]/15 border border-[#ef6269]/40 text-[#ef6269] text-[11px]">
                  ⚠ {tgTestError}
                </div>
              )}

              {/* Broadcast Timeframe Selection */}
              <div className="pt-2">
                <span className="text-[10px] font-bold text-[#91aaa0] uppercase tracking-wider block mb-1.5">
                  বটে যে মোডগুলোর সিগন্যাল যাবে:
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
                          ? 'bg-[#25c98e]/20 border-[#25c98e] text-[#25c98e]'
                          : 'bg-[#061b17] border-[#21483c] text-[#91aaa0]'
                      }`}
                    >
                      {tf}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Admin vs Viewer Status Banner */}
          {!isAdmin ? (
            <div className="p-4 rounded-2xl bg-[#0c2822] border border-[#21483c] flex flex-col gap-3">
              <div className="flex items-start gap-2.5">
                <Shield className="w-5 h-5 text-[#25c98e] flex-shrink-0 mt-0.5" />
                <div>
                  <h4 className="text-xs font-bold text-[#e9fff4] uppercase tracking-wider">
                    Public Viewer Mode Active
                  </h4>
                  <p className="text-[11px] text-[#91aaa0] mt-1 leading-relaxed">
                    সকল ভিজিটর ও ডিভাইসের জন্য সিগন্যাল সার্ভার থেকে অটোমেটিক ও হুবহু একই টাইমে সিঙ্ক হচ্ছে। অ্যাডমিন পাসকোড দিয়ে সেটিং আনলক করতে পারবেন।
                  </p>
                </div>
              </div>

              {/* Passcode Input */}
              <form onSubmit={handleLogin} className="mt-1 pt-3 border-t border-[#21483c]/50 flex flex-col sm:flex-row gap-2">
                <div className="relative flex-1">
                  <KeyRound className="w-4 h-4 text-[#91aaa0] absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="password"
                    placeholder="Enter Admin Passcode (e.g. wingo786)"
                    value={passcode}
                    onChange={(e) => setPasscode(e.target.value)}
                    className="w-full h-10 pl-9 pr-3 rounded-xl bg-[#061b17] border border-[#21483c] text-xs text-[#e9fff4] placeholder:text-[#91aaa0]/50 focus:outline-none focus:border-[#25c98e]"
                  />
                </div>
                <button
                  type="submit"
                  disabled={isVerifying || !passcode.trim()}
                  className="h-10 px-4 rounded-xl bg-[#25c98e] hover:bg-[#28d59b] text-[#04221a] font-black text-xs uppercase tracking-wider transition-colors disabled:opacity-50 cursor-pointer flex items-center justify-center gap-1.5"
                >
                  {isVerifying ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Unlock className="w-4 h-4" />}
                  <span>Unlock Admin</span>
                </button>
              </form>
            </div>
          ) : (
            <div className="p-4 rounded-2xl bg-[#14362e] border border-[#25c98e]/40 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <Shield className="w-5 h-5 text-[#25c98e]" />
                <div>
                  <span className="text-xs font-extrabold text-[#25c98e] uppercase tracking-wider block">
                    Admin Authenticated
                  </span>
                  <span className="text-[11px] text-[#91aaa0]">
                    You have master control to update endpoints and lottery mirrors.
                  </span>
                </div>
              </div>
              <button
                onClick={onAdminLogout}
                className="h-8 px-3 rounded-lg bg-[#0c2822] hover:bg-[#173d33] border border-[#21483c] text-xs font-bold text-[#ef6269] transition-colors cursor-pointer"
              >
                Log Out
              </button>
            </div>
          )}

          {/* Endpoints List */}
          <div className="p-4 rounded-2xl bg-[#0c2822] border border-[#21483c] space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Globe className="w-4 h-4 text-[#25c98e]" />
                <h4 className="text-xs font-extrabold text-[#e9fff4] uppercase tracking-wider">
                  Live Lottery Feed Endpoints
                </h4>
              </div>
              {!isAdmin && (
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-[#14362e] text-[#91aaa0] border border-[#21483c] flex items-center gap-1">
                  <Lock className="w-3 h-3" /> Read-Only
                </span>
              )}
            </div>

            <p className="text-[11px] text-[#91aaa0]">
              The server continuously fetches from these official draw feeds and distributes identical signals to all users worldwide and to the Telegram VIP bot.
            </p>

            <div className="space-y-2.5 pt-1">
              {TIMEFRAMES.map((tf) => (
                <div key={tf} className="space-y-1">
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="font-bold text-[#e9fff4] font-mono">
                      {tf === '30S' ? 'WinGo 30 SEC' : `WinGo ${tf.replace('M', ' MIN')}`}
                    </span>
                    {activeTimeframe === tf && (
                      <span className="text-[9px] uppercase font-extrabold px-1.5 py-0.2 rounded bg-[#25c98e]/20 text-[#25c98e] border border-[#25c98e]/30">
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
                        ? 'bg-[#061b17] border-[#21483c] text-[#e9fff4] focus:border-[#25c98e]'
                        : 'bg-[#061b17]/60 border-[#21483c]/60 text-[#91aaa0] cursor-not-allowed'
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
                  className="h-10 px-5 rounded-xl bg-[#25c98e] hover:bg-[#28d59b] text-[#04221a] font-black text-xs uppercase tracking-wider transition-colors disabled:opacity-50 cursor-pointer flex items-center gap-1.5"
                >
                  {isSaving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                  <span>Save to Server</span>
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-[#21483c] bg-[#0c2822] flex justify-between items-center text-[11px] text-[#91aaa0]">
          <span>Protected Server Authority</span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-xl bg-[#14362e] hover:bg-[#173d33] border border-[#21483c] font-bold text-xs text-[#e9fff4] transition-colors cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
