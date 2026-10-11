import React from 'react';
import { BacktestResult } from '../types';
import { Activity, ShieldCheck } from 'lucide-react';

interface WalkForwardCheckProps {
  backtest: BacktestResult | null;
  historyLength: number;
}

export const WalkForwardCheck: React.FC<WalkForwardCheckProps> = ({
  backtest,
  historyLength,
}) => {
  return (
    <div className="rounded-3xl glass-panel-subtle p-4 sm:p-5 mt-2 transition-all">
      <div className="flex items-center gap-2 mb-2.5">
        <Activity className="w-4 h-4 text-emerald-400" />
        <h4 className="text-xs font-black tracking-widest uppercase text-white">
          Walk-Forward Historical Validation
        </h4>
      </div>

      {backtest ? (
        <div className="space-y-3">
          <p className="text-xs leading-relaxed text-slate-400">
            Validated against the latest <strong className="text-white font-mono">{backtest.samples}</strong> real draws without lookahead leakage:
          </p>

          <div className="grid grid-cols-3 gap-2.5 pt-1">
            {/* Number Hit Rate */}
            <div className="p-3 rounded-2xl border border-white/[0.06] bg-white/[0.02]">
              <div className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Number Hit</div>
              <div className="text-base font-extrabold text-white font-mono mt-0.5">
                {backtest.numberHits} / {backtest.samples}
              </div>
              <div className="text-[10px] font-bold text-emerald-400 mt-0.5 font-mono">
                {((backtest.numberHits / backtest.samples) * 100).toFixed(1)}% hit
              </div>
            </div>

            {/* Size Hit Rate */}
            <div className="p-3 rounded-2xl border border-white/[0.06] bg-white/[0.02]">
              <div className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Size Accuracy</div>
              <div className="text-base font-extrabold text-amber-300 font-mono mt-0.5">
                {backtest.sizeHits} / {backtest.samples}
              </div>
              <div className="text-[10px] font-bold text-amber-400 mt-0.5 font-mono">
                {((backtest.sizeHits / backtest.samples) * 100).toFixed(1)}% hit
              </div>
            </div>

            {/* Color Hit Rate */}
            <div className="p-3 rounded-2xl border border-white/[0.06] bg-white/[0.02]">
              <div className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Color Match</div>
              <div className="text-base font-extrabold text-sky-400 font-mono mt-0.5">
                {backtest.colorHits} / {backtest.samples}
              </div>
              <div className="text-[10px] font-bold text-sky-400 mt-0.5 font-mono">
                {((backtest.colorHits / backtest.samples) * 100).toFixed(1)}% hit
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1.5 pt-1 text-[11px] text-slate-500">
            <ShieldCheck className="w-3.5 h-3.5 text-amber-400 shrink-0" />
            <span>Past performance indicates statistical distribution, not outcome guarantee.</span>
          </div>
        </div>
      ) : (
        <p className="text-xs leading-relaxed text-slate-400">
          Historical backtest activates once at least 15 draws are collected (currently {historyLength}).
        </p>
      )}
    </div>
  );
};
