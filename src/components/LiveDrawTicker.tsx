import React, { useEffect, useState } from 'react';
import { Timeframe } from '../types';
import { TIMEFRAME_SECONDS } from '../utils/engine';
import { Clock } from 'lucide-react';
import { playTickSound } from '../utils/audio';

interface LiveDrawTickerProps {
  timeframe: Timeframe;
  onRoundExpire?: () => void;
}

export const LiveDrawTicker: React.FC<LiveDrawTickerProps> = ({
  timeframe,
  onRoundExpire,
}) => {
  const periodDuration = TIMEFRAME_SECONDS[timeframe] || 60;
  const [secondsRemaining, setSecondsRemaining] = useState<number>(() => {
    const now = Math.floor(Date.now() / 1000);
    const rem = periodDuration - (now % periodDuration);
    return rem === 0 ? periodDuration : rem;
  });

  const lastRoundRef = React.useRef<number>(Math.floor(Date.now() / 1000 / periodDuration));
  const onRoundExpireRef = React.useRef(onRoundExpire);
  onRoundExpireRef.current = onRoundExpire;

  useEffect(() => {
    const update = () => {
      const now = Math.floor(Date.now() / 1000);
      const rem = periodDuration - (now % periodDuration);
      setSecondsRemaining(rem);

      const roundIndex = Math.floor(now / periodDuration);
      if (roundIndex > lastRoundRef.current) {
        lastRoundRef.current = roundIndex;
        // Schedule sync after 2.5s to let the site publish the round result
        setTimeout(() => {
          onRoundExpireRef.current?.();
        }, 2500);
      } else if (rem <= 5 && rem > 0) {
        playTickSound();
      }
    };

    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, [timeframe, periodDuration]);

  const progress = ((periodDuration - secondsRemaining) / periodDuration) * 100;
  const minutes = Math.floor(secondsRemaining / 60);
  const seconds = secondsRemaining % 60;
  const timeFormatted = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  const isUrgent = secondsRemaining <= 5;

  return (
    <div className="flex items-center gap-2.5 px-3 py-1.5 rounded-lg bg-[#0c2822] border border-[#21483c] text-xs">
      <div className="flex items-center gap-1.5 text-[#91aaa0]">
        <Clock className="w-3.5 h-3.5 text-[#25c98e]" />
        <span className="text-[10px] font-bold tracking-wider uppercase">Next Draw</span>
      </div>

      <div
        className={`font-mono font-extrabold text-sm transition-colors tabular-nums ${
          isUrgent ? 'text-[#f15c66] animate-pulse' : 'text-[#f1c97a]'
        }`}
      >
        {timeFormatted}
      </div>

      <div className="w-14 h-1.5 bg-[#14362e] rounded-full overflow-hidden ml-1 hidden sm:block">
        <div
          className={`h-full transition-all duration-1000 ${
            isUrgent ? 'bg-[#f15c66]' : 'bg-[#25c98e]'
          }`}
          style={{ width: `${progress}%` }}
        />
      </div>
    </div>
  );
};
