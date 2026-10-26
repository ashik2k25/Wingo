import React, { useState } from 'react';
import { ShieldCheck, X, AlertTriangle, EyeOff, Wifi, Zap, CheckCircle2 } from 'lucide-react';

interface AntiDetectionModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const AntiDetectionModal: React.FC<AntiDetectionModalProps> = ({ isOpen, onClose }) => {
  const [currentLossStep, setCurrentLossStep] = useState(0);
  const [airplaneDone, setAirplaneDone] = useState(false);

  if (!isOpen) return null;

  // Non-linear decoy staking schedule
  const decoySchedule = [
    { step: 0, label: 'Base Recon Stake', primary: 25, hedgeColor: 0, total: 25 },
    { step: 1, label: 'Dual-Shield Recovery (1.8x)', primary: 35, hedgeColor: 15, total: 50 },
    { step: 2, label: 'Asymmetric Decoy (2.4x)', primary: 75, hedgeColor: 45, total: 120 },
    { step: 3, label: 'Terminal Defense Lock (3.1x)', primary: 160, hedgeColor: 90, total: 250 },
    { step: 4, label: '🛑 CIRCUIT BREAKER HALT', primary: 0, hedgeColor: 0, total: 0 },
  ];

  const currentStake = decoySchedule[currentLossStep] || decoySchedule[0];

  return (
    <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4">
      <div className="w-full max-w-lg rounded-3xl liquid-glass border border-emerald-500/30 p-5 sm:p-6 text-slate-100 shadow-2xl relative max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-white/10">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-extrabold tracking-tight text-white flex items-center gap-2">
                <span>Stealth Anti-Detection Protocol</span>
                <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-md bg-emerald-400 text-slate-950 font-mono">
                  ACTIVE
                </span>
              </h3>
              <p className="text-[11px] text-slate-400">Platform RMS Countermeasures & Session Disconnect Guide</p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-8 h-8 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-slate-400 hover:text-white transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Core Intelligence Notice */}
        <div className="mt-4 p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-300">
          <div className="flex items-start gap-2.5">
            <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5 text-amber-400" />
            <div className="text-xs leading-relaxed">
              <span className="font-extrabold block text-sm mb-1 text-amber-200">
                How Platform RMS Systems Track Predictable Betting Patterns
              </span>
              <p className="text-slate-200 text-[11px]">
                Gaming servers employ automated <b>Risk Management Systems (RMS)</b> that monitor linear martingale doubling (e.g. 1X ➔ 2X ➔ 4X ➔ 8X). Adhering to the following three protocols completely neutralizes tracking signatures.
              </p>
            </div>
          </div>
        </div>

        {/* 3 Golden Stealth Rules */}
        <div className="mt-4 space-y-3">
          {/* Rule 1: Ghost Mode (Skip Rounds) */}
          <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/10">
            <div className="flex items-center gap-2.5 text-emerald-400 mb-1.5">
              <EyeOff className="w-4 h-4" />
              <h4 className="text-xs font-black uppercase tracking-wider font-mono">
                1. Ghost Protocol (Standby Observation)
              </h4>
            </div>
            <p className="text-xs text-slate-300 leading-relaxed">
              Following a major profit hit or 2 consecutive draw evaluations, <b>stand aside for 1-2 rounds with 0 active stake</b>. Without capital on the table, automated RMS heuristics detach and internal session tracking resets to neutral.
            </p>
          </div>

          {/* Rule 2: IP & Session Reset (Airplane Mode) */}
          <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/10">
            <div className="flex items-center justify-between mb-1.5">
              <div className="flex items-center gap-2.5 text-emerald-400">
                <Wifi className="w-4 h-4" />
                <h4 className="text-xs font-black uppercase tracking-wider font-mono">
                  2. Network Session Reset (IP Renewal)
                </h4>
              </div>
              <button
                onClick={() => setAirplaneDone(!airplaneDone)}
                className={`text-[10px] font-bold px-2 py-0.5 rounded-lg border transition-all cursor-pointer ${
                  airplaneDone
                    ? 'bg-emerald-500/20 border-emerald-500 text-emerald-300'
                    : 'bg-white/5 border-white/10 text-slate-400'
                }`}
              >
                {airplaneDone ? '✓ IP Renewed' : 'Mark IP Reset'}
              </button>
            </div>
            <p className="text-xs text-slate-300 leading-relaxed">
              Gaming providers link session cookies with your public IP address. Toggling <b>Airplane Mode for 10 seconds</b> on your mobile device forces carrier CGNAT IP reassignment, completely disconnecting persistent telemetry footprints.
            </p>
          </div>

          {/* Rule 3: Anti-Martingale Decoy Calculator */}
          <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/10">
            <div className="flex items-center gap-2.5 text-emerald-400 mb-2">
              <Zap className="w-4 h-4" />
              <h4 className="text-xs font-black uppercase tracking-wider font-mono">
                3. Decoy Staking Protocol (Non-Linear Capital Preservation)
              </h4>
            </div>
            <p className="text-xs text-slate-400 mb-3">
              Avoid naive linear progression. Employ non-linear asymmetric decoy sizing with Dual-Shield coverage:
            </p>

            {/* Interactive Step Selector */}
            <div className="flex items-center justify-between gap-1.5 mb-3 bg-black/40 p-1.5 rounded-xl border border-white/10">
              {[0, 1, 2, 3, 4].map((step) => (
                <button
                  key={step}
                  onClick={() => setCurrentLossStep(step)}
                  className={`flex-1 py-1.5 rounded-lg text-[10px] font-bold font-mono transition-all cursor-pointer ${
                    currentLossStep === step
                      ? 'bg-emerald-400 text-slate-950 shadow-sm'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  {step === 0 ? 'Base' : step === 4 ? '🛑 Halt' : `Step ${step}`}
                </button>
              ))}
            </div>

            {/* Current Step Recommendation */}
            <div className="p-3 rounded-xl bg-black/40 border border-white/10 flex flex-col gap-1.5">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-amber-300 font-mono">
                  Method: {currentStake.label}
                </span>
                <span className="text-xs font-mono font-black text-emerald-400">
                  Total: {currentStake.total} units
                </span>
              </div>
              {currentLossStep === 4 ? (
                <p className="text-[11px] text-rose-400 font-bold font-mono">
                  🛑 Circuit breaker engaged. Stand aside for this round.
                </p>
              ) : currentStake.hedgeColor > 0 ? (
                <p className="text-[11px] text-slate-300 font-mono">
                  Primary Size: <b>{currentStake.primary} units</b> + Color Hedge: <b>{currentStake.hedgeColor} units</b>
                </p>
              ) : (
                <p className="text-[11px] text-slate-300 font-mono">
                  Single Leg: <b>{currentStake.primary} units</b> (Non-linear base entry)
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Engineering Realism Confirmation */}
        <div className="mt-4 p-3.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            <span className="text-xs font-bold text-white">
              Defense Protocol Active: Countermeasures engaged
            </span>
          </div>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-xl bg-emerald-400 text-slate-950 text-xs font-black hover:bg-emerald-300 transition-colors cursor-pointer"
          >
            Dismiss
          </button>
        </div>
      </div>
    </div>
  );
};
