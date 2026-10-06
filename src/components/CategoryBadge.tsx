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
    <div className="flex-1 min-h-[72px] rounded-xl border border-[#21483c] bg-[#12342b]/60 px-3.5 py-2.5 flex flex-col justify-between transition-colors hover:border-[#25c98e]/40">
      <div className="flex items-center gap-1.5">
        <span
          className="w-1.5 h-1.5 rounded-full"
          style={{ backgroundColor: color }}
        />
        <span className="text-[10px] font-extrabold tracking-wider text-[#91aaa0]">
          {label}
        </span>
      </div>

      <div className="text-sm font-extrabold tracking-tight text-[#e9fff4] mt-1 font-mono">
        {value}
      </div>

      <div
        className="text-[10px] font-semibold tracking-tight mt-0.5"
        style={{ color }}
      >
        {sharePercent(share)} model share
      </div>
    </div>
  );
};
