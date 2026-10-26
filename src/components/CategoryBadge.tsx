import React from 'react';
import { sharePercent } from '../utils/engine';

interface CategoryBadgeProps {
  label: string;
  value: string;
  share: number;
  color: string;
  badgeTag?: string;
}

export const CategoryBadge: React.FC<CategoryBadgeProps> = ({
  label,
  value,
  share,
  color,
  badgeTag,
}) => {
  return (
    <div className="flex-1 min-h-[76px] rounded-2xl border border-white/[0.08] bg-white/[0.03] backdrop-blur-md px-3.5 py-2.5 flex flex-col justify-between transition-all duration-300 hover:border-white/[0.15] hover:bg-white/[0.05] relative overflow-hidden group">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <span
            className="w-2 h-2 rounded-full shadow-[0_0_10px_currentColor] animate-pulse"
            style={{ backgroundColor: color, color }}
          />
          <span className="text-[10px] font-bold tracking-widest uppercase text-slate-400">
            {label}
          </span>
        </div>
        {badgeTag && (
          <span
            className="text-[9px] font-mono font-extrabold px-1.5 py-0.5 rounded-md border"
            style={{
              backgroundColor: `${color}18`,
              borderColor: `${color}40`,
              color: color,
            }}
          >
            {badgeTag}
          </span>
        )}
      </div>

      <div className="text-sm sm:text-base font-extrabold tracking-tight text-white mt-1 font-mono flex items-center justify-between">
        <span>{value}</span>
      </div>

      <div
        className="text-[10px] font-bold tracking-tight mt-0.5 font-mono flex items-center justify-between"
        style={{ color }}
      >
        <span>{sharePercent(share)} ACCURACY</span>
        <span className="text-[8px] text-slate-500 uppercase tracking-widest font-mono">CONFIRMED</span>
      </div>
    </div>
  );
};
