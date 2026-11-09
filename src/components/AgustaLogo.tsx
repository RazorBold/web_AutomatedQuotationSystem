import React from 'react';

interface AgustaLogoProps {
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  /** Hide the "Business & Office Equipment" line (e.g. compact headers). */
  compact?: boolean;
}

/**
 * Wordmark approximating the public agusta.co.id lockup: red swirl ball,
 * heavy oblique red wordmark, navy descriptor line.
 */
export function AgustaLogo({ size = 'md', className = '', compact = false }: AgustaLogoProps) {
  const s = {
    sm: { mark: 22, word: 'text-[17px]', sub: 'text-[7.5px]' },
    md: { mark: 28, word: 'text-[22px]', sub: 'text-[9px]' },
    lg: { mark: 40, word: 'text-[32px]', sub: 'text-[12px]' },
  }[size];

  return (
    <span className={`inline-flex items-center gap-1.5 select-none ${className}`} aria-label="Agusta Business & Office Equipment">
      <svg width={s.mark} height={s.mark} viewBox="0 0 40 40" aria-hidden className="shrink-0">
        <circle cx="20" cy="20" r="18" fill="#D6202A" />
        <path d="M6 15.5c8 1.5 17.5-1 27-9" stroke="#fff" strokeWidth="2.4" fill="none" strokeLinecap="round" />
        <path d="M3.5 23c11 1.5 23-2.5 33-13" stroke="#fff" strokeWidth="2.4" fill="none" strokeLinecap="round" />
        <path d="M8 31.5c9.5 0 19.5-4.5 28.5-14" stroke="#fff" strokeWidth="2.4" fill="none" strokeLinecap="round" />
        <path d="M17 2.5c-5 8-5.5 22 2.5 35" stroke="#fff" strokeWidth="2.4" fill="none" strokeLinecap="round" />
      </svg>
      <span className="flex flex-col leading-none">
        <span
          className={`${s.word} font-extrabold italic text-brand`}
          style={{ letterSpacing: '-0.02em', transform: 'skewX(-6deg)' }}
        >
          AGUSTA
        </span>
        {!compact && (
          <span className={`${s.sub} mt-[2px] font-bold italic text-navy`} style={{ letterSpacing: '0.01em' }}>
            Business &amp; Office Equipment
          </span>
        )}
      </span>
    </span>
  );
}
