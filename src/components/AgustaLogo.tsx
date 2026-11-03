import React from 'react';

interface AgustaLogoProps {
  variant?: 'light' | 'dark' | 'white';
  className?: string;
  size?: 'sm' | 'md' | 'lg';
}

export const AgustaLogo: React.FC<AgustaLogoProps> = ({
  variant = 'light',
  className = '',
  size = 'md',
}) => {
  const isWhite = variant === 'white';
  const subtitleColor = isWhite ? 'text-slate-300' : 'text-slate-700';
  const textColor = isWhite ? 'text-white' : 'text-red-600';

  const sizeStyles = {
    sm: { icon: 'w-7 h-7', title: 'text-base', sub: 'text-[9px]' },
    md: { icon: 'w-9 h-9', title: 'text-xl', sub: 'text-[10px]' },
    lg: { icon: 'w-12 h-12', title: 'text-2xl', sub: 'text-xs' },
  }[size];

  return (
    <div className={`flex items-center gap-3 select-none ${className}`}>
      {/* Red Geometric / Swirl Emblem matching the Agusta Brand */}
      <div className={`relative ${sizeStyles.icon} shrink-0`}>
        <svg
          viewBox="0 0 100 100"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className="w-full h-full drop-shadow-sm"
        >
          {/* Outer circle ring */}
          <circle cx="50" cy="50" r="44" stroke="#DC2626" strokeWidth="5" />
          {/* Dynamic turbine / gear petals */}
          <path
            d="M50 14C50 14 62 32 62 50C62 68 50 86 50 86C50 86 38 68 38 50C38 32 50 14 50 14Z"
            fill="#DC2626"
          />
          <path
            d="M14 50C14 50 32 62 50 62C68 62 86 50 86 50C86 50 68 38 50 38C32 38 14 50 14 50Z"
            fill="#DC2626"
          />
          <circle cx="50" cy="50" r="16" fill="#DC2626" />
          <circle cx="50" cy="50" r="8" fill={isWhite ? '#0F172A' : '#FFFFFF'} />
          <path
            d="M24 24L76 76"
            stroke={isWhite ? '#0F172A' : '#FFFFFF'}
            strokeWidth="3"
            strokeLinecap="round"
          />
          <path
            d="M76 24L24 76"
            stroke={isWhite ? '#0F172A' : '#FFFFFF'}
            strokeWidth="3"
            strokeLinecap="round"
          />
        </svg>
      </div>

      <div className="flex flex-col leading-tight">
        <span
          className={`font-black tracking-wider ${textColor} ${sizeStyles.title}`}
          style={{ letterSpacing: '0.04em' }}
        >
          AGUSTA
        </span>
        <span
          className={`font-semibold tracking-tight uppercase italic ${subtitleColor} ${sizeStyles.sub}`}
        >
          Business & Office Equipment
        </span>
      </div>
    </div>
  );
};
