import React from 'react';
import { Target, Menu } from 'lucide-react';

interface HeaderProps {
  onOpenMenu: () => void;
  serverSynced?: boolean;
}

export const Header: React.FC<HeaderProps> = ({ onOpenMenu, serverSynced = true }) => {
  return (
    <header className="w-full flex items-center justify-between py-3 px-1 animate-fadeIn">
      {/* Brand: Target Icon + Title */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-indigo-950 via-[#0d1430] to-[#16123a] border border-indigo-400/30 flex items-center justify-center shadow-[0_0_15px_rgba(99,102,241,0.35)] relative">
          <Target className="w-5 h-5 text-white" strokeWidth={2.2} />
          {serverSynced && (
            <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-emerald-400 border border-[#060818] animate-pulse" />
          )}
        </div>
        <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white font-sans drop-shadow-[0_2px_10px_rgba(255,255,255,0.15)]">
          Number Shot Pro
        </h1>
      </div>

      {/* Hamburger Menu Button */}
      <button
        onClick={onOpenMenu}
        aria-label="Open menu"
        className="w-10 h-10 rounded-xl bg-white/[0.04] hover:bg-white/[0.1] border border-white/10 flex items-center justify-center text-white transition-all cursor-pointer shadow-sm active:scale-95"
      >
        <Menu className="w-6 h-6 text-white" strokeWidth={2.2} />
      </button>
    </header>
  );
};
