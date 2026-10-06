import React, { useState } from 'react';
import { Timeframe } from '../types';
import { TIMEFRAMES, TIMEFRAME_LABELS } from '../utils/engine';
import { X, Lock, Unlock, Shield, Check, AlertCircle, RefreshCw, KeyRound, Globe } from 'lucide-react';

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
    // Validate HTTPS for all endpoints
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
                {isAdmin ? 'Admin Console & Endpoints' : 'Live Feed Status & Security'}
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
                    সকল ভিজিটর ও ডিভাইসের জন্য সিগন্যাল সার্ভার থেকে অটোমেটিক ও হুবহু একই টাইমে সিঙ্ক হচ্ছে। পাবলিক ইউজাররা সিগন্যাল বা হিস্টোরি পরিবর্তন করতে পারবে না। শুধুমাত্র অ্যাডমিন পাসকোড দিয়ে সেটিং পরিবর্তন করা যাবে।
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
              The server continuously fetches from these official draw feeds and distributes identical signals to all users worldwide.
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
