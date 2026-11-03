import React from 'react';

interface ProductAssetThumbProps {
  category: string;
  name: string;
  src?: string;
  className?: string;
}

export const ProductAssetThumb: React.FC<ProductAssetThumbProps> = ({
  category,
  name,
  src,
  className = 'w-full h-full object-contain',
}) => {
  const isAio = category.toUpperCase().includes('AIO') || name.toUpperCase().includes('AIO') || name.toUpperCase().includes('LENOVO') || name.toUpperCase().includes('ACER');
  const isTable = category.toUpperCase().includes('MEJA') || name.toUpperCase().includes('MEJA') || name.toUpperCase().includes('BOARDROOM');
  const isCabinet = category.toUpperCase().includes('LEMARI') || name.toUpperCase().includes('LEMARI') || name.toUpperCase().includes('ARSIP');

  return (
    <div className={`relative flex items-center justify-center bg-slate-50 rounded-lg p-2 overflow-hidden ${className}`}>
      {/* If external image fails or in hermetic sandbox, show crisp SVG product illustration */}
      {isAio ? (
        <svg viewBox="0 0 120 100" fill="none" className="w-full h-full max-h-36 max-w-40 drop-shadow-sm">
          {/* Monitor Screen */}
          <rect x="15" y="10" width="90" height="56" rx="4" fill="#0F172A" stroke="#334155" strokeWidth="2" />
          <rect x="18" y="13" width="84" height="50" rx="2" fill="#1E293B" />
          {/* Windows / OS Graphic gradient */}
          <path d="M40 25 L58 22 L58 37 L40 37 Z" fill="#38BDF8" fillOpacity="0.8" />
          <path d="M62 21 L80 18 L80 37 L62 37 Z" fill="#0EA5E9" />
          <path d="M40 40 L58 40 L58 55 L40 52 Z" fill="#0284C7" />
          <path d="M62 40 L80 40 L80 57 L62 54 Z" fill="#0369A1" />
          {/* Webcam */}
          <circle cx="60" cy="11.5" r="1.5" fill="#EF4444" />
          {/* Stand */}
          <path d="M57 66 L57 80 L63 80 L63 66 Z" fill="#475569" />
          <rect x="42" y="80" width="36" height="4" rx="2" fill="#334155" />
          {/* Keyboard & Mouse */}
          <rect x="25" y="86" width="50" height="8" rx="2" fill="#64748B" />
          <rect x="80" y="86" width="10" height="8" rx="3" fill="#64748B" />
        </svg>
      ) : isTable ? (
        <svg viewBox="0 0 120 90" fill="none" className="w-full h-full max-h-36 max-w-40 drop-shadow-sm">
          {/* Table Top */}
          <polygon points="10,35 110,35 100,50 20,50" fill="#92400E" stroke="#78350F" strokeWidth="1.5" />
          <polygon points="20,50 100,50 100,55 20,55" fill="#78350F" />
          {/* Metal Legs */}
          <line x1="24" y1="55" x2="20" y2="80" stroke="#334155" strokeWidth="4" strokeLinecap="round" />
          <line x1="96" y1="55" x2="100" y2="80" stroke="#334155" strokeWidth="4" strokeLinecap="round" />
          <line x1="30" y1="55" x2="28" y2="76" stroke="#475569" strokeWidth="3" />
          <line x1="90" y1="55" x2="92" y2="76" stroke="#475569" strokeWidth="3" />
          {/* Cable Grommet */}
          <rect x="52" y="38" width="16" height="4" rx="1" fill="#1E293B" />
        </svg>
      ) : isCabinet ? (
        <svg viewBox="0 0 100 110" fill="none" className="w-full h-full max-h-36 max-w-32 drop-shadow-sm">
          {/* Steel Cabinet Body */}
          <rect x="20" y="10" width="60" height="90" rx="3" fill="#E2E8F0" stroke="#64748B" strokeWidth="2" />
          {/* Upper Glass Sliding Doors */}
          <rect x="24" y="14" width="25" height="38" rx="1" fill="#BAE6FD" fillOpacity="0.4" stroke="#94A3B8" strokeWidth="1" />
          <rect x="51" y="14" width="25" height="38" rx="1" fill="#BAE6FD" fillOpacity="0.4" stroke="#94A3B8" strokeWidth="1" />
          {/* Lower Solid Steel Doors */}
          <rect x="24" y="56" width="25" height="38" rx="1" fill="#CBD5E1" stroke="#94A3B8" strokeWidth="1" />
          <rect x="51" y="56" width="25" height="38" rx="1" fill="#CBD5E1" stroke="#94A3B8" strokeWidth="1" />
          {/* Handles */}
          <rect x="44" y="30" width="3" height="8" rx="1" fill="#475569" />
          <rect x="53" y="30" width="3" height="8" rx="1" fill="#475569" />
          <rect x="44" y="70" width="3" height="8" rx="1" fill="#475569" />
          <rect x="53" y="70" width="3" height="8" rx="1" fill="#475569" />
        </svg>
      ) : (
        /* Ergonomic Mesh Office Chair (Indachi Filmore / Vino) */
        <svg viewBox="0 0 100 120" fill="none" className="w-full h-full max-h-40 max-w-36 drop-shadow-sm">
          {/* Headrest */}
          <rect x="36" y="8" width="28" height="12" rx="4" fill="#DC2626" stroke="#991B1B" strokeWidth="1" />
          <path d="M50 20 L50 26" stroke="#334155" strokeWidth="3" />
          {/* Mesh Backrest with curve */}
          <path
            d="M30 26 C30 26 28 42 32 60 C33 64 67 64 68 60 C72 42 70 26 70 26 Z"
            fill="#EF4444"
            fillOpacity="0.85"
            stroke="#991B1B"
            strokeWidth="1.5"
          />
          {/* Lumbar Support Strap */}
          <rect x="31" y="44" width="38" height="6" rx="2" fill="#1E293B" />
          {/* Seat Cushion */}
          <path
            d="M24 64 C24 62 76 62 76 64 C76 72 72 74 50 74 C28 74 24 72 24 64 Z"
            fill="#B91C1C"
            stroke="#7F1D1D"
            strokeWidth="1.5"
          />
          {/* Armrests */}
          <path d="M22 46 L22 62" stroke="#334155" strokeWidth="3" strokeLinecap="round" />
          <rect x="18" y="44" width="8" height="4" rx="2" fill="#1E293B" />
          <path d="M78 46 L78 62" stroke="#334155" strokeWidth="3" strokeLinecap="round" />
          <rect x="74" y="44" width="8" height="4" rx="2" fill="#1E293B" />
          {/* Gas Lift Cylinder */}
          <rect x="47" y="74" width="6" height="18" fill="#475569" />
          {/* 5-Star Chrome Base */}
          <circle cx="50" cy="92" r="4" fill="#94A3B8" />
          <line x1="50" y1="92" x2="22" y2="104" stroke="#94A3B8" strokeWidth="3.5" strokeLinecap="round" />
          <line x1="50" y1="92" x2="78" y2="104" stroke="#94A3B8" strokeWidth="3.5" strokeLinecap="round" />
          <line x1="50" y1="92" x2="50" y2="110" stroke="#94A3B8" strokeWidth="3.5" strokeLinecap="round" />
          <line x1="50" y1="92" x2="32" y2="112" stroke="#94A3B8" strokeWidth="3.5" strokeLinecap="round" />
          <line x1="50" y1="92" x2="68" y2="112" stroke="#94A3B8" strokeWidth="3.5" strokeLinecap="round" />
          {/* Wheels / Castors */}
          <circle cx="22" cy="106" r="3" fill="#1E293B" />
          <circle cx="78" cy="106" r="3" fill="#1E293B" />
          <circle cx="50" cy="112" r="3" fill="#1E293B" />
          <circle cx="32" cy="114" r="3" fill="#1E293B" />
          <circle cx="68" cy="114" r="3" fill="#1E293B" />
        </svg>
      )}
    </div>
  );
};
