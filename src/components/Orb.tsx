import React from 'react';
import { BallColor } from '../types';

interface OrbProps {
  number: number;
  color: BallColor;
}

export const Orb: React.FC<OrbProps> = ({ number, color }) => {
  // Styles based on Screenshot_20261003-184728:
  // 0: Red + Violet split diagonal
  // 5: Green + Violet split diagonal
  // 1, 3, 7, 9: Green
  // 2, 4, 6, 8: Red
  const isRedViolet = color === 'RED_VIOLET' || number === 0;
  const isGreenViolet = color === 'GREEN_VIOLET' || number === 5;

  let borderColor = 'rgba(34, 197, 94, 0.7)';
  let glow = '0 0 25px rgba(34, 197, 94, 0.4)';
  let bgGradient = 'radial-gradient(circle at 35% 35%, rgba(34, 197, 94, 0.3) 0%, rgba(18, 52, 43, 0.95) 75%)';
  let textColor = '#25c98e';

  if (isRedViolet) {
    borderColor = 'rgba(239, 68, 68, 0.8)';
    glow = '0 0 28px rgba(168, 85, 247, 0.5)';
    bgGradient =
      'linear-gradient(135deg, rgba(239, 68, 68, 0.45) 0%, rgba(239, 68, 68, 0.25) 48%, rgba(168, 85, 247, 0.25) 52%, rgba(168, 85, 247, 0.5) 100%), #140d1e';
    textColor = '#ffffff';
  } else if (isGreenViolet) {
    borderColor = 'rgba(34, 197, 94, 0.8)';
    glow = '0 0 28px rgba(168, 85, 247, 0.5)';
    bgGradient =
      'linear-gradient(135deg, rgba(34, 197, 94, 0.45) 0%, rgba(34, 197, 94, 0.25) 48%, rgba(168, 85, 247, 0.25) 52%, rgba(168, 85, 247, 0.5) 100%), #0c1c18';
    textColor = '#ffffff';
  } else if (color === 'RED') {
    borderColor = 'rgba(239, 68, 68, 0.7)';
    glow = '0 0 25px rgba(239, 68, 68, 0.4)';
    bgGradient = 'radial-gradient(circle at 35% 35%, rgba(239, 68, 68, 0.3) 0%, rgba(46, 16, 20, 0.95) 75%)';
    textColor = '#f87171';
  } else if (color === 'VIOLET') {
    borderColor = 'rgba(168, 85, 247, 0.7)';
    glow = '0 0 25px rgba(168, 85, 247, 0.4)';
    bgGradient = 'radial-gradient(circle at 35% 35%, rgba(168, 85, 247, 0.3) 0%, rgba(35, 14, 46, 0.95) 75%)';
    textColor = '#c084fc';
  }

  return (
    <div
      className="relative flex items-center justify-center w-[96px] h-[96px] rounded-full p-1.5 transition-all duration-300 shadow-xl"
      style={{
        background: isRedViolet
          ? 'linear-gradient(135deg, #ef4444 50%, #a855f7 50%)'
          : isGreenViolet
          ? 'linear-gradient(135deg, #22c55e 50%, #a855f7 50%)'
          : borderColor,
        boxShadow: glow,
      }}
    >
      <div
        className="w-full h-full rounded-full flex items-center justify-center relative overflow-hidden"
        style={{
          background: bgGradient,
        }}
      >
        {/* Dual diagonal overlay badge for 0 and 5 */}
        {isRedViolet && (
          <div
            className="absolute inset-0 pointer-events-none opacity-40"
            style={{
              background: 'linear-gradient(135deg, rgba(239, 68, 68, 0.8) 0%, rgba(239, 68, 68, 0.4) 48%, rgba(168, 85, 247, 0.4) 52%, rgba(168, 85, 247, 0.8) 100%)',
            }}
          />
        )}
        {isGreenViolet && (
          <div
            className="absolute inset-0 pointer-events-none opacity-40"
            style={{
              background: 'linear-gradient(135deg, rgba(34, 197, 94, 0.8) 0%, rgba(34, 197, 94, 0.4) 48%, rgba(168, 85, 247, 0.4) 52%, rgba(168, 85, 247, 0.8) 100%)',
            }}
          />
        )}

        {/* Specular ball reflection highlight */}
        <div className="absolute top-1.5 left-3.5 w-6 h-3 bg-white/30 rounded-full blur-[1px] transform -rotate-12 pointer-events-none" />

        {/* Digit */}
        <span
          className="text-4xl font-black tracking-tight font-mono select-none relative z-10"
          style={{
            color: textColor,
            textShadow: isRedViolet || isGreenViolet
              ? '0 2px 8px rgba(0,0,0,0.8), 0 0 12px rgba(168, 85, 247, 0.6)'
              : `0 2px 8px ${borderColor}`,
          }}
        >
          {number}
        </span>
      </div>
    </div>
  );
};
