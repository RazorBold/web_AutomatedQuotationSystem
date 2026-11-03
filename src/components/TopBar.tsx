import React from 'react';
import { Bell, Search, ShieldAlert, User, ArrowRightLeft } from 'lucide-react';
import { UserProfile, UserRole } from '../types';

interface TopBarProps {
  title: string;
  subtitle?: string;
  currentRole: UserRole;
  currentUser: UserProfile;
  onSwitchRole: () => void;
  unreadCount?: number;
}

export const TopBar: React.FC<TopBarProps> = ({
  title,
  subtitle,
  currentRole,
  currentUser,
  onSwitchRole,
  unreadCount = 1,
}) => {
  const isSales = currentRole === 'SALES';

  return (
    <header className="h-16 bg-white border-b border-slate-200 px-6 flex items-center justify-between shrink-0 select-none">
      {/* Title & Context */}
      <div>
        <h1 className="text-xl font-bold text-slate-900 tracking-tight">{title}</h1>
        {subtitle && <p className="text-xs text-slate-500 mt-0.5">{subtitle}</p>}
      </div>

      {/* Right controls */}
      <div className="flex items-center gap-4">
        {/* Role Indicator Badge & Switcher */}
        <div className="flex items-center gap-2 bg-slate-100 p-1.5 rounded-lg border border-slate-200 text-xs">
          <div className="flex items-center gap-1.5 px-2 py-0.5 rounded font-medium text-slate-700">
            {isSales ? (
              <span className="w-2 h-2 rounded-full bg-blue-500" />
            ) : (
              <span className="w-2 h-2 rounded-full bg-red-500" />
            )}
            <span>
              Role: <strong className="text-slate-900">{isSales ? 'Sales (Ismi Putri)' : 'Sales Support (Rizki Saputra)'}</strong>
            </span>
          </div>

          <button
            onClick={onSwitchRole}
            className="flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded bg-white text-slate-800 shadow-xs border border-slate-200 hover:bg-slate-50 hover:text-red-600 transition-colors cursor-pointer"
            title="Klik untuk simulasi beralih peran Sales / Sales Support"
          >
            <ArrowRightLeft className="w-3.5 h-3.5 text-red-600" />
            <span>Switch Role</span>
          </button>
        </div>

        {/* Notifications */}
        <div className="relative">
          <button
            aria-label="Notifikasi sistem"
            className="w-9 h-9 rounded-lg border border-slate-200 flex items-center justify-center text-slate-600 hover:text-slate-900 hover:bg-slate-50 transition-colors relative cursor-pointer"
          >
            <Bell className="w-4 h-4" />
            {unreadCount > 0 && (
              <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-600 text-white text-[10px] font-bold rounded-full flex items-center justify-center ring-2 ring-white">
                {unreadCount}
              </span>
            )}
          </button>
        </div>
      </div>
    </header>
  );
};
