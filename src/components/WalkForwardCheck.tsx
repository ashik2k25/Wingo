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
    <div className="rounded-2xl border border-[#21483c] bg-[#12342b]/50 p-4 mt-4 transition-colors">
      <div className="flex items-center gap-2 mb-2.5">
        <Activity className="w-4 h-4 text-[#25c98e]" />
        <h4 className="text-xs font-black tracking-wider uppercase text-[#e9fff4]">
          Walk-Forward Validation
        </h4>
      </div>

      {backtest ? (
        <div className="space-y-3">
          <p className="text-xs leading-relaxed text-[#91aaa0]">
            Evaluated on the last <strong className="text-[#e9fff4]">{backtest.samples}</strong> past-only historical intervals without future leakage:
          </p>

          <div className="grid grid-cols-3 gap-2.5 pt-1">
            {/* Number Hit Rate */}
            <div className="p-2.5 rounded-xl bg-[#0c2822] border border-[#21483c]">
              <div className="text-[10px] uppercase font-bold text-[#91aaa0]">Exact Number</div>
              <div className="text-base font-extrabold text-[#e9fff4] font-mono mt-0.5">
                {backtest.numberHits} / {backtest.samples}
              </div>
              <div className="text-[10px] font-semibold text-[#25c98e] mt-0.5">
                {((backtest.numberHits / backtest.samples) * 100).toFixed(1)}% hit
              </div>
            </div>

            {/* Size Hit Rate */}
            <div className="p-2.5 rounded-xl bg-[#0c2822] border border-[#21483c]">
              <div className="text-[10px] uppercase font-bold text-[#91aaa0]">Size (Big/Small)</div>
              <div className="text-base font-extrabold text-[#f1c97a] font-mono mt-0.5">
                {backtest.sizeHits} / {backtest.samples}
              </div>
              <div className="text-[10px] font-semibold text-[#f1c97a] mt-0.5">
                {((backtest.sizeHits / backtest.samples) * 100).toFixed(1)}% hit
              </div>
            </div>

            {/* Color Hit Rate */}
            <div className="p-2.5 rounded-xl bg-[#0c2822] border border-[#21483c]">
              <div className="text-[10px] uppercase font-bold text-[#91aaa0]">Color Match</div>
              <div className="text-base font-extrabold text-[#79aef2] font-mono mt-0.5">
                {backtest.colorHits} / {backtest.samples}
              </div>
              <div className="text-[10px] font-semibold text-[#79aef2] mt-0.5">
                {((backtest.colorHits / backtest.samples) * 100).toFixed(1)}% hit
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1.5 pt-1 text-[11px] text-[#91aaa0]/90">
            <ShieldCheck className="w-3.5 h-3.5 text-[#f1c97a] flex-shrink-0" />
            <span>This is historical past performance, not an outcome guarantee.</span>
          </div>
        </div>
      ) : (
        <p className="text-xs leading-relaxed text-[#91aaa0]">
          Add at least 30 draw results (currently {historyLength}) to calculate walk-forward historical simulation.
        </p>
      )}
    </div>
  );
};
