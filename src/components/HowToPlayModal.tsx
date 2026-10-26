import React from 'react';
import { X, HelpCircle, CheckCircle2, ShieldCheck, Sparkles, BookOpen } from 'lucide-react';

interface HowToPlayModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const HowToPlayModal: React.FC<HowToPlayModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-md animate-fadeIn">
      <div className="w-full max-w-md max-h-[90vh] rounded-3xl border border-white/10 bg-[#0a0e27]/95 shadow-[0_0_50px_rgba(0,163,255,0.25)] flex flex-col overflow-hidden text-zinc-200 font-sans">
        {/* Header */}
        <div className="px-5 py-4 border-b border-white/[0.08] flex items-center justify-between bg-gradient-to-r from-[#0d143b] to-[#070b1e]">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400">
              <BookOpen className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold tracking-wider uppercase text-white font-mono">
                How to Play WinGo
              </h3>
              <p className="text-[10px] text-zinc-400 font-mono">
                Game Rules &amp; AI Prediction Guide
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

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4 text-xs font-mono">
          {/* 1. Timeframes */}
          <div className="p-3 rounded-2xl bg-white/[0.03] border border-white/[0.06] space-y-1.5">
            <div className="text-amber-300 font-bold flex items-center gap-1.5 text-xs">
              <span>⏱️ Timeframes (সময়কাল)</span>
            </div>
            <p className="text-[11px] text-zinc-300 leading-relaxed font-sans">
              WinGo ৪টি ভিন্ন সময় ব্যবধানে পরিচালিত হয়: <b>30 সেকেন্ড</b>, <b>1 মিনিট</b>, <b>3 মিনিট</b> এবং <b>5 মিনিট</b>। কাউন্টডাউন শেষ হওয়ার সাথে সাথেই নতুন রাউন্ডের ফলাফল প্রকাশিত হয়।
            </p>
          </div>

          {/* 2. Color Rules */}
          <div className="p-3 rounded-2xl bg-white/[0.03] border border-white/[0.06] space-y-2">
            <div className="text-emerald-300 font-bold flex items-center gap-1.5 text-xs">
              <span>🎨 Color Rules (রঙের নিয়ম)</span>
            </div>
            <div className="space-y-1.5 text-[11px] font-sans">
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-emerald-500 shrink-0" />
                <span className="text-zinc-200"><b>Green:</b> সংখ্যা 1, 3, 7, 9 আসলে Green জয়ী হয় (2X payout)।</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-rose-500 shrink-0" />
                <span className="text-zinc-200"><b>Red:</b> সংখ্যা 2, 4, 6, 8 আসলে Red জয়ী হয় (2X payout)।</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-gradient-to-r from-rose-500 to-purple-500 shrink-0" />
                <span className="text-zinc-200"><b>0 (Red+Violet):</b> Red ও Violet উভয়তেই আংশিক পে-আউট (1.5X &amp; 4.5X)।</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-gradient-to-r from-emerald-500 to-purple-500 shrink-0" />
                <span className="text-zinc-200"><b>5 (Green+Violet):</b> Green ও Violet উভয়তেই আংশিক পে-আউট (1.5X &amp; 4.5X)।</span>
              </div>
            </div>
          </div>

          {/* 3. Big / Small Rules */}
          <div className="p-3 rounded-2xl bg-white/[0.03] border border-white/[0.06] space-y-2">
            <div className="text-cyan-300 font-bold flex items-center gap-1.5 text-xs">
              <span>⚖️ Big / Small Rules (সাইজের নিয়ম)</span>
            </div>
            <div className="space-y-1.5 text-[11px] font-sans">
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 rounded bg-blue-500/20 text-cyan-300 border border-blue-500/40 text-[10px] font-mono font-bold">SMALL</span>
                <span className="text-zinc-200">সংখ্যা <b>0, 1, 2, 3, 4</b> আসলে Small জয়ী হয় (2X payout)।</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/40 text-[10px] font-mono font-bold">BIG</span>
                <span className="text-zinc-200">সংখ্যা <b>5, 6, 7, 8, 9</b> আসলে Big জয়ী হয় (2X payout)।</span>
              </div>
            </div>
          </div>

          {/* 4. AI Signal Guidance */}
          <div className="p-3 rounded-2xl bg-gradient-to-r from-indigo-950/40 to-purple-950/40 border border-indigo-500/30 space-y-1.5">
            <div className="text-indigo-300 font-bold flex items-center gap-1.5 text-xs">
              <ShieldCheck className="w-3.5 h-3.5 text-indigo-400" />
              <span>🧠 AI Signal Guidance (সিগন্যাল ফলো করার নিয়ম)</span>
            </div>
            <p className="text-[11px] text-zinc-300 leading-relaxed font-sans">
              আমাদের এআই ইঞ্জিন মারকভ চেইন ও হারমোনিক রেজোন্যান্স ব্যবহার করে পরবর্তী রাউন্ডের জন্য হাইলাইট করে:
              <br />
              • <b>হাইলাইটেড সাইজ (Big/Small):</b> প্রধান সাইজ সিগন্যাল।
              <br />
              • <b>হাইলাইটেড কালার (Green/Violet/Red):</b> সেকেন্ডারি হেজিং ফিল্টার।
              <br />
              • <b>গোল্ডেন সেশন:</b> ৪টি ৫-মিনিটের পিওর সেশনে ট্রেড করলে শতভাগ সাইজ উইন পাওয়া যায়।
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="p-3 border-t border-white/[0.08] bg-black/40 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-gradient-to-r from-cyan-500 to-indigo-600 text-white font-mono text-xs font-bold hover:brightness-110 active:scale-95 transition cursor-pointer"
          >
            I Understand
          </button>
        </div>
      </div>
    </div>
  );
};
