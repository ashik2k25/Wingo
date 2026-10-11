import React from 'react';
import { sharePercent } from '../utils/engine';

interface CategoryBadgeProps {
  label: string;
  value: string;
  share: number;
  color: string;
}

export const CategoryBadge: React.FC<CategoryBadgeProps> = ({
  label,
  value,
  share,
  color,
}) => {
  return (
    <div className="flex-1 min-h-[76px] rounded-2xl border border-white/[0.08] bg-white/[0.03] backdrop-blur-md px-3.5 py-2.5 flex flex-col justify-between transition-all duration-300 hover:border-white/[0.15] hover:bg-white/[0.05]">
      <div className="flex items-center gap-1.5">
        <span
          className="w-1.5 h-1.5 rounded-full shadow-[0_0_8px_currentColor]"
          style={{ backgroundColor: color, color }}
        />
        <span className="text-[10px] font-bold tracking-widest uppercase text-slate-400">
          {label}
        </span>
      </div>

      <div className="text-sm sm:text-base font-extrabold tracking-tight text-white mt-0.5 font-mono">
        {value}
      </div>

      <div
        className="text-[10px] font-bold tracking-tight mt-0.5 font-mono"
        style={{ color }}
      >
        {sharePercent(share)} probability
      </div>
    </div>
  );
};
