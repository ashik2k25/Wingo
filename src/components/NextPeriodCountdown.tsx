import React, { useState, useEffect } from 'react';
import { Timeframe } from '../types';
import { TIMEFRAME_SECONDS } from '../utils/engine';

interface NextPeriodCountdownProps {
  timeframe: Timeframe;
  targetPeriod?: string | null;
  serverTimeOffset?: number;
  onExpire?: () => void;
}

export const NextPeriodCountdown: React.FC<NextPeriodCountdownProps> = ({
  timeframe,
  targetPeriod,
  serverTimeOffset = 0,
  onExpire,
}) => {
  const [timeLeft, setTimeLeft] = useState<{ hours: number; minutes: number; seconds: number }>({
    hours: 0,
    minutes: 0,
    seconds: 0,
  });

  useEffect(() => {
    const periodSec = TIMEFRAME_SECONDS[timeframe] || 60;

    const updateTimer = () => {
      const nowMs = Date.now() + serverTimeOffset;
      const nowSec = Math.floor(nowMs / 1000);
      const remaining = periodSec - (nowSec % periodSec);

      const hours = Math.floor(remaining / 3600);
      const minutes = Math.floor((remaining % 3600) / 60);
      const seconds = remaining % 60;

      setTimeLeft({ hours, minutes, seconds });

      if (remaining === periodSec || remaining <= 1) {
        onExpire?.();
      }
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, [timeframe, serverTimeOffset, onExpire]);

  const pad = (n: number) => (n < 10 ? `0${n}` : `${n}`);

  return (
    <div className="w-full flex justify-center px-4 my-3 animate-fadeIn">
      <div className="w-full max-w-sm rounded-2xl border border-cyan-500/40 bg-[#091026]/90 backdrop-blur-xl px-6 py-3.5 shadow-[0_0_30px_rgba(0,163,255,0.22)] text-center relative overflow-hidden group">
        {/* Ambient Top Glow */}
        <div className="absolute -top-10 left-1/2 -translate-x-1/2 w-44 h-16 bg-cyan-500/20 rounded-full blur-2xl pointer-events-none" />

        {/* Header Label */}
        <div className="text-[11px] font-medium tracking-wide text-cyan-300/80 mb-1 font-sans flex items-center justify-center gap-1.5">
          <span>Next period time</span>
          {targetPeriod && (
            <span className="text-[9px] font-mono text-cyan-400/60 bg-cyan-950/60 px-1.5 py-0.2 rounded border border-cyan-500/20">
              #{targetPeriod.slice(-5)}
            </span>
          )}
        </div>

        {/* Digital Time Numbers */}
        <div className="text-3xl sm:text-4xl font-black font-mono tracking-wider text-white drop-shadow-[0_0_15px_rgba(255,255,255,0.4)] flex items-center justify-center gap-2">
          <span>{pad(timeLeft.hours)}</span>
          <span className="text-cyan-400 animate-pulse">:</span>
          <span>{pad(timeLeft.minutes)}</span>
          <span className="text-cyan-400 animate-pulse">:</span>
          <span className="text-cyan-300">{pad(timeLeft.seconds)}</span>
        </div>

        {/* Units Labels */}
        <div className="grid grid-cols-3 text-[9px] font-mono tracking-widest text-cyan-400/70 mt-1 uppercase">
          <span>HRS</span>
          <span>MINS</span>
          <span>SECS</span>
        </div>
      </div>
    </div>
  );
};
