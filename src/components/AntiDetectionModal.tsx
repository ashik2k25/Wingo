import React, { useState } from 'react';
import { ShieldCheck, ShieldAlert, Wifi, RefreshCw, X, AlertTriangle, EyeOff, Zap, CheckCircle2, ChevronRight } from 'lucide-react';

interface AntiDetectionModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const AntiDetectionModal: React.FC<AntiDetectionModalProps> = ({ isOpen, onClose }) => {
  const [baseUnit, setBaseUnit] = useState<number>(20);
  const [currentLossStep, setCurrentLossStep] = useState<number>(0);
  const [airplaneDone, setAirplaneDone] = useState<boolean>(false);

  if (!isOpen) return null;

  // Non-linear stealth decoy sizing calculator
  // Prevents the casino RMS from detecting predictable linear doubling (25 -> 50 -> 100 -> 200)
  const getStealthStake = (step: number) => {
    switch (step) {
      case 0:
        return { primary: baseUnit, hedgeColor: 0, total: baseUnit, label: 'Base Recon Unit' };
      case 1:
        return { primary: Math.round(baseUnit * 2.1), hedgeColor: 0, total: Math.round(baseUnit * 2.1), label: 'Stealth Bump' };
      case 2:
        return {
          primary: Math.round(baseUnit * 3.5),
          hedgeColor: Math.round(baseUnit * 1.2),
          total: Math.round(baseUnit * 4.7),
          label: 'Split Dual Hedge (Evades Single-Size Trap)',
        };
      case 3:
        return {
          primary: Math.round(baseUnit * 6.5),
          hedgeColor: Math.round(baseUnit * 2.5),
          total: Math.round(baseUnit * 9.0),
          label: 'Decoy Distribution (Break Flagging)',
        };
      case 4:
        return {
          primary: 0,
          hedgeColor: 0,
          total: 0,
          label: '🛑 GHOST MODE (MANDATORY SKIP ROUND)',
        };
      default:
        return {
          primary: 0,
          hedgeColor: 0,
          total: 0,
          label: '🛑 GHOST MODE (MANDATORY SKIP ROUND)',
        };
    }
  };

  const currentStake = getStealthStake(currentLossStep);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="w-full max-w-lg rounded-3xl border border-[#21483c] bg-[#08221c] p-5 sm:p-6 shadow-2xl relative max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-[#21483c]">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-[#25c98e]/20 border border-[#25c98e]/40 flex items-center justify-center text-[#25c98e]">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-extrabold tracking-tight text-[#e9fff4] flex items-center gap-2">
                <span>Stealth Anti-Detection Shield</span>
                <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded bg-[#25c98e] text-[#04221a]">
                  ACTIVE
                </span>
              </h3>
              <p className="text-[11px] text-[#91aaa0]">সাইটের অ্যালগরিদম ট্র্যাকিং ও ফাঁদ এড়ানোর গাইড</p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-8 h-8 rounded-xl bg-[#0e3027] border border-[#21483c] flex items-center justify-center text-[#91aaa0] hover:text-[#e9fff4] transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Core Truth Notice */}
        <div className="mt-4 p-3.5 rounded-2xl bg-[#f59e0b]/10 border border-[#f59e0b]/30 text-[#f59e0b]">
          <div className="flex items-start gap-2.5">
            <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5 text-[#f59e0b]" />
            <div className="text-xs leading-relaxed">
              <span className="font-extrabold block text-sm mb-1 text-[#f1c97a]">
                💡 ক্যাসিনো সাইট কীভাবে প্লেয়ারকে "Mark / Target" করে?
              </span>
              <p className="text-[#e9fff4]/90 text-[11px]">
                আপনার পর্যবেক্ষণ <b>শতভাগ বাস্তবসম্মত</b>। DX WIN বা WinGo সাইটগুলো সেন্ট্রাল <b>RMS (Risk Management System)</b> ব্যবহার করে। যখন কোনো প্লেয়ার বড় উইন পায় (যেমন +৳১,৯৬০ বা +৳৩,২৩৪) এবং সাথে সাথে লিনিয়ার দ্বিগুণ বেট (৳২৫ ➔ ৳৫১ ➔ ৳১০২ ➔ ৳২০৫) চালায়, সাইটের সিস্টেম তখন ওই প্লেয়ারকে অ্যালগরিদমিক ট্র্যাপে ফেলে। নিচে দেওয়া ৩টি কৌশল মেনে চললে সাইট আপনাকে কখনোই টার্গেট করতে পারবে না:
              </p>
            </div>
          </div>
        </div>

        {/* 3 Golden Stealth Rules */}
        <div className="mt-4 space-y-3">
          {/* Rule 1: Ghost Mode (Skip Rounds) */}
          <div className="p-4 rounded-2xl bg-[#0c2822] border border-[#21483c]">
            <div className="flex items-center gap-2.5 text-[#25c98e] mb-1.5">
              <EyeOff className="w-4 h-4" />
              <h4 className="text-xs font-black uppercase tracking-wider">
                ১. ঘোস্ট মোড (উইনের পর ১-২ রাউন্ড স্কিপ করা)
              </h4>
            </div>
            <p className="text-xs text-[#91aaa0] leading-relaxed">
              বড় কোনো প্রফিট পাওয়ার পর বা টানা ২টি লস হলে <b>পরবর্তী ১টি বা ২টি রাউন্ডে ০ টাকা বেট করুন (শুধু পেপার বেট বা পর্যবেক্ষণ)</b>। যখন টেবিলে আপনার কোনো টাকা থাকে না, সাইটের রিস্ক অ্যালগরিদম আপনাকে আর টার্গেট করতে পারে না এবং সেশন ট্র্যাপ রিসেট হয়ে যায়।
            </p>
          </div>

          {/* Rule 2: IP & Session Reset (Airplane Mode) */}
          <div className="p-4 rounded-2xl bg-[#0c2822] border border-[#21483c]">
            <div className="flex items-center justify-between mb-1.5">
              <div className="flex items-center gap-2.5 text-[#25c98e]">
                <Wifi className="w-4 h-4" />
                <h4 className="text-xs font-black uppercase tracking-wider">
                  ২. আইপি ও ডিভাইস সেশন ক্লকিং (IP Reset)
                </h4>
              </div>
              <button
                onClick={() => setAirplaneDone(!airplaneDone)}
                className={`text-[10px] font-bold px-2 py-0.5 rounded-lg border transition-all ${
                  airplaneDone
                    ? 'bg-[#25c98e]/20 border-[#25c98e] text-[#25c98e]'
                    : 'bg-[#14362e] border-[#21483c] text-[#91aaa0]'
                }`}
              >
                {airplaneDone ? '✓ আইপি রিসেট সম্পন্ন' : 'রিসেট চিহ্নিত করুন'}
              </button>
            </div>
            <p className="text-xs text-[#91aaa0] leading-relaxed">
              ক্যাসিনো সাইট আপনার মোবাইল আইপি (IP address) ও ব্রাউজার সেশন ট্র্যাক করে। যখনই দেখবেন উল্টো ড্র আসছে, মোবাইলের <b>এয়ারপ্লেন মোড (Flight Mode) ১০ সেকেন্ড অন করে অফ করুন</b>। এতে মোবাইল নেটওয়ার্কের নতুন CGNAT IP অ্যাসাইন হবে এবং সাইটের ট্র্যাকিং সম্পূর্ণ বিচ্ছিন্ন হয়ে যাবে।
            </p>
          </div>

          {/* Rule 3: Anti-Martingale Decoy Calculator */}
          <div className="p-4 rounded-2xl bg-[#0c2822] border border-[#21483c]">
            <div className="flex items-center gap-2.5 text-[#25c98e] mb-2">
              <Zap className="w-4 h-4" />
              <h4 className="text-xs font-black uppercase tracking-wider">
                ৩. স্টেলথ বেটিং ক্যালকুলেটর (ডিকয় মানি ম্যানেজমেন্ট)
              </h4>
            </div>
            <p className="text-xs text-[#91aaa0] mb-3">
              অন্ধভাবে দ্বিগুণ (২৫ ➔ ৫১ ➔ ১০২ ➔ ২০৫ ➔ ৪১০ ➔ ৮২০) করলে সাইটের বট তাৎক্ষণিক ধরে ফেলে। নিচের ডিকয় মডেল অনুসরণ করুন:
            </p>

            {/* Interactive Step Selector */}
            <div className="flex items-center justify-between gap-1.5 mb-3 bg-[#061b17] p-1.5 rounded-xl border border-[#21483c]">
              {[0, 1, 2, 3, 4].map((step) => (
                <button
                  key={step}
                  onClick={() => setCurrentLossStep(step)}
                  className={`flex-1 py-1.5 rounded-lg text-[10px] font-bold font-mono transition-all ${
                    currentLossStep === step
                      ? 'bg-[#25c98e] text-[#04221a] shadow-sm'
                      : 'text-[#91aaa0] hover:text-[#e9fff4]'
                  }`}
                >
                  {step === 0 ? 'বেস' : step === 4 ? '🛑 স্কিপ' : `স্টেপ ${step}`}
                </button>
              ))}
            </div>

            {/* Current Step Recommendation */}
            <div className="p-3 rounded-xl bg-[#061b17] border border-[#21483c]/80 flex flex-col gap-1.5">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-[#f1c97a]">
                  পদ্ধতি: {currentStake.label}
                </span>
                <span className="text-xs font-mono font-black text-[#25c98e]">
                  মোট: ৳{currentStake.total}
                </span>
              </div>
              {currentLossStep === 4 ? (
                <p className="text-[11px] text-[#ef6269] font-bold">
                  🛑 এই রাউন্ডে ১ টাকাও বেট করবেন না! সেশন ব্রেক দিতে ১ রাউন্ড স্কিপ করুন।
                </p>
              ) : currentStake.hedgeColor > 0 ? (
                <p className="text-[11px] text-[#91aaa0]">
                  👉 সাইজ বেট: <b>৳{currentStake.primary}</b> + কালার হেজ (Red/Green): <b>৳{currentStake.hedgeColor}</b>
                </p>
              ) : (
                <p className="text-[11px] text-[#91aaa0]">
                  👉 একক বেট: <b>৳{currentStake.primary}</b> (নন-লিনিয়ার ডিকয় অ্যামাউন্ট)
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Engineering Realism Confirmation */}
        <div className="mt-4 p-3.5 rounded-2xl bg-[#12342b] border border-[#25c98e]/30 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-[#25c98e]" />
            <span className="text-xs font-bold text-[#e9fff4]">
              প্রতিরক্ষা সক্রিয়: সাইটের ট্র্যাকিং এড়াতে প্রস্তুত
            </span>
          </div>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-xl bg-[#25c98e] text-[#04221a] text-xs font-black hover:bg-[#1eb57d] transition-colors"
          >
            বুঝেছি
          </button>
        </div>
      </div>
    </div>
  );
};
