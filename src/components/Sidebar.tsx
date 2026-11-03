import React from 'react';
import {
  LayoutDashboard,
  FilePlus2,
  FileText,
  Boxes,
  MessageSquarePlus,
  Inbox,
  Tags,
  PercentCircle,
  BarChart3,
  Users2,
  ArrowRightLeft,
  ChevronRight,
  ShieldCheck,
  UserCheck,
} from 'lucide-react';
import { AgustaLogo } from './AgustaLogo';
import { UserProfile, UserRole } from '../types';

interface SidebarProps {
  currentRole: UserRole;
  currentUser: UserProfile;
  currentView: string;
  onNavigate: (view: string) => void;
  onSwitchRole: () => void;
  pendingReviewCount: number;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentRole,
  currentUser,
  currentView,
  onNavigate,
  onSwitchRole,
  pendingReviewCount,
}) => {
  const isSales = currentRole === 'SALES';

  interface NavItem {
    id: string;
    label: string;
    icon: React.ComponentType<{ className?: string }>;
    highlight?: boolean;
    badge?: number;
  }

  const salesNavItems: NavItem[] = [
    { id: 'dashboard', label: 'Beranda', icon: LayoutDashboard },
    { id: 'create-quotation', label: 'Buat Penawaran', icon: FilePlus2, highlight: true },
    { id: 'quotation-history', label: 'Riwayat Penawaran', icon: FileText },
    { id: 'catalog', label: 'Katalog Produk', icon: Boxes },
    { id: 'custom-request', label: 'Request Custom', icon: MessageSquarePlus },
  ];

  const supportNavItems: NavItem[] = [
    { id: 'support-dashboard', label: 'Beranda', icon: LayoutDashboard },
    {
      id: 'support-reviews',
      label: 'Pengajuan Penawaran',
      icon: Inbox,
      badge: pendingReviewCount > 0 ? pendingReviewCount : undefined,
    },
    { id: 'catalog-pricing', label: 'Katalog & Harga (HPP)', icon: Tags },
    { id: 'discount-rules', label: 'Aturan Diskon', icon: PercentCircle },
    { id: 'reports', label: 'Laporan & Margin', icon: BarChart3 },
    { id: 'users', label: 'Manajemen User', icon: Users2 },
  ];

  const items = isSales ? salesNavItems : supportNavItems;

  return (
    <aside className="w-64 bg-[#0F172A] text-slate-200 flex flex-col shrink-0 min-h-screen border-r border-slate-800 select-none">
      {/* Brand Header */}
      <div className="p-5 border-b border-slate-800/80">
        <AgustaLogo variant="white" size="sm" />
      </div>

      {/* Role Indicator Banner */}
      <div className="px-5 pt-4 pb-2">
        <div className="flex items-center justify-between text-xs">
          <span className="font-semibold tracking-wider text-slate-400 uppercase text-[11px] flex items-center gap-1.5">
            {isSales ? (
              <>
                <UserCheck className="w-3.5 h-3.5 text-blue-400" />
                PORTAL SALES
              </>
            ) : (
              <>
                <ShieldCheck className="w-3.5 h-3.5 text-red-400" />
                PORTAL SALES SUPPORT
              </>
            )}
          </span>
          <button
            onClick={onSwitchRole}
            title="Klik untuk beralih mode Sales / Sales Support"
            className="flex items-center gap-1 text-[11px] text-slate-400 hover:text-white px-2 py-0.5 rounded bg-slate-800/60 hover:bg-slate-700 transition-colors"
          >
            <ArrowRightLeft className="w-3 h-3 text-red-400" />
            Switch
          </button>
        </div>
      </div>

      {/* Navigation Menu */}
      <nav className="flex-1 px-3 py-3 space-y-1 overflow-y-auto">
        {items.map(item => {
          const Icon = item.icon;
          const isActive = currentView === item.id;

          return (
            <button
              key={item.id}
              onClick={() => onNavigate(item.id)}
              className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-lg text-sm font-medium transition-all ${
                isActive
                  ? 'bg-red-600 text-white shadow-md shadow-red-600/30'
                  : 'text-slate-300 hover:text-white hover:bg-slate-800/70'
              }`}
            >
              <div className="flex items-center gap-3">
                <Icon className={`w-4 h-4 ${isActive ? 'text-white' : 'text-slate-400'}`} />
                <span>{item.label}</span>
              </div>

              {item.badge !== undefined && (
                <span className="bg-amber-500 text-slate-950 font-bold text-xs px-2 py-0.5 rounded-full shadow-sm">
                  {item.badge}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      {/* Role Switch Callout Banner */}
      <div className="p-3 mx-3 mb-3 bg-slate-800/60 rounded-lg border border-slate-700/60 text-xs text-slate-300">
        <div className="flex items-center justify-between font-semibold text-white mb-1">
          <span>Mode Akses (RBAC)</span>
          <span className={`px-1.5 py-0.2 rounded text-[10px] font-bold ${isSales ? 'bg-blue-900/60 text-blue-300' : 'bg-red-900/60 text-red-300'}`}>
            {isSales ? 'Sales' : 'Support'}
          </span>
        </div>
        <p className="text-[11px] text-slate-400 leading-relaxed">
          {isSales
            ? 'COGS & Modal tersembunyi. Fokus pembuatan surat penawaran harga.'
            : 'COGS/HPP dapat diedit, approval penawaran, & terbitkan PDF resmi.'}
        </p>
        <button
          onClick={onSwitchRole}
          className="mt-2 w-full py-1.5 px-2 bg-slate-700 hover:bg-slate-600 text-white rounded text-[11px] font-medium flex items-center justify-center gap-1.5 transition-colors"
        >
          <ArrowRightLeft className="w-3 h-3 text-red-400" />
          Ganti ke {isSales ? 'Sales Support' : 'Sales'}
        </button>
      </div>

      {/* User Profile Footer */}
      <div className="p-4 border-t border-slate-800 bg-slate-950/60 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-slate-700 text-white flex items-center justify-center font-bold text-xs border border-slate-600">
            {currentUser.avatar}
          </div>
          <div className="flex flex-col">
            <span className="text-sm font-semibold text-white leading-tight">
              {currentUser.name}
            </span>
            <span className="text-xs text-slate-400">
              {isSales ? 'Sales' : 'Sales Support'}
            </span>
          </div>
        </div>
        <ChevronRight className="w-4 h-4 text-slate-500" />
      </div>
    </aside>
  );
};
