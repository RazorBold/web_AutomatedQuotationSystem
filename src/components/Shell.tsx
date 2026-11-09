import React, { useState } from 'react';
import {
  BarChart3,
  Boxes,
  ClipboardList,
  FilePlus2,
  Home,
  LogOut,
  Menu,
  MessageSquarePlus,
  Percent,
  RotateCcw,
  Users,
  X,
} from 'lucide-react';
import { AgustaLogo } from './AgustaLogo';
import { NotificationBell, useArrivalAlerts } from './NotificationBell';
import { Avatar, IconButton, cx } from './ui';
import { useStore } from '../store/AppStore';
import { can, Permission, ROLE_META } from '../auth/permissions';
import type { Route, ViewId } from '../App';

interface NavItem {
  id: ViewId;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  show: (has: (p: Permission) => boolean) => boolean;
  count?: number;
}

export function Shell({ route, navigate, children }: { route: Route; navigate: (r: Route) => void; children: React.ReactNode }) {
  const { currentUser, quotations, customRequests, notifications, logout, resetDemoData } = useStore();
  const [mobileOpen, setMobileOpen] = useState(false);
  useArrivalAlerts(notifications, navigate);
  if (!currentUser) return null;

  const has = (p: Permission) => can(currentUser, p);
  const pendingReview = quotations.filter(q => q.status === 'PENDING_REVIEW').length;
  const needsRevision = quotations.filter(q => q.salesId === currentUser.id && q.status === 'REJECTED').length;
  const pendingPricing = customRequests.filter(r => r.status === 'PENDING_PRICING').length;

  const groups: { label: string; items: NavItem[] }[] = [
    {
      label: 'Pekerjaan',
      items: [
        { id: 'dashboard', label: 'Beranda', icon: Home, show: () => true },
        { id: 'create-quotation', label: 'Buat penawaran', icon: FilePlus2, show: h => h('quotation:create') },
        {
          id: 'quotations',
          label: has('quotation:review') ? 'Antrean review' : 'Penawaran saya',
          icon: ClipboardList,
          show: h => h('quotation:view-all') || h('quotation:view-own'),
          count: has('quotation:review') ? pendingReview : needsRevision,
        },
        {
          id: 'custom-requests',
          label: 'Barang custom',
          icon: MessageSquarePlus,
          show: h => h('custom-request:create') || h('custom-request:price'),
          count: has('custom-request:price') ? pendingPricing : undefined,
        },
      ],
    },
    {
      label: 'Data',
      items: [
        { id: 'catalog', label: 'Katalog produk', icon: Boxes, show: h => h('catalog:view') },
        { id: 'discount-rules', label: 'Aturan diskon', icon: Percent, show: h => h('discount-rules:edit') },
        { id: 'reports', label: 'Laporan margin', icon: BarChart3, show: h => h('reports:view') },
      ],
    },
    {
      label: 'Administrasi',
      items: [{ id: 'users', label: 'User & hak akses', icon: Users, show: h => h('users:manage') }],
    },
  ];

  const isActive = (id: ViewId) =>
    route.view === id || (id === 'quotations' && route.view === 'quotation-detail');

  const nav = (
    <nav className="flex flex-1 flex-col gap-6 overflow-y-auto px-3 py-2" aria-label="Navigasi utama">
      {groups.map(g => {
        const items = g.items.filter(i => i.show(has));
        if (!items.length) return null;
        return (
          <div key={g.label}>
            <p className="px-3 pb-1.5 text-xs font-medium text-ink-3">{g.label}</p>
            <ul className="flex flex-col gap-0.5">
              {items.map(item => {
                const active = isActive(item.id);
                const Icon = item.icon;
                return (
                  <li key={item.id}>
                    <button
                      onClick={() => {
                        navigate({ view: item.id });
                        setMobileOpen(false);
                      }}
                      aria-current={active ? 'page' : undefined}
                      className={cx(
                        'group flex h-9 w-full items-center gap-3 rounded-lg px-3 text-sm transition-colors cursor-pointer',
                        active
                          ? 'bg-brand-soft font-semibold text-brand-ink'
                          : 'font-medium text-ink-2 hover:bg-canvas hover:text-ink'
                      )}
                    >
                      <Icon className={cx('size-[18px] shrink-0', active ? 'text-brand' : 'text-ink-3 group-hover:text-ink-2')} />
                      <span className="flex-1 truncate text-left">{item.label}</span>
                      {!!item.count && (
                        <span
                          className={cx(
                            'min-w-5 rounded-full px-1.5 text-center text-[11px] font-bold tabular-nums leading-5',
                            active ? 'bg-brand text-white' : 'bg-ink/[0.07] text-ink-2'
                          )}
                        >
                          {item.count}
                        </span>
                      )}
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        );
      })}
    </nav>
  );

  const userCard = (
    <div className="border-t border-line p-3">
      <div className="flex items-center gap-3 rounded-lg px-2 py-2">
        <Avatar user={currentUser} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-[13px] font-semibold text-ink">{currentUser.name}</p>
          <p className="truncate text-xs text-ink-3">{ROLE_META[currentUser.role].label}</p>
        </div>
        <IconButton label="Keluar" onClick={logout}>
          <LogOut className="size-[18px]" />
        </IconButton>
      </div>
      {resetDemoData && (
        <button
          onClick={() => {
            if (window.confirm('Kembalikan semua data demo ke kondisi awal? Anda akan keluar dari sesi.')) void resetDemoData();
          }}
          className="mt-1 flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-xs text-ink-3 hover:text-ink-2 cursor-pointer"
        >
          <RotateCcw className="size-3.5" /> Reset data demo
        </button>
      )}
    </div>
  );

  return (
    <div className="flex h-screen overflow-hidden bg-canvas">
      {/* Desktop sidebar */}
      <aside className="hidden w-[248px] shrink-0 flex-col border-r border-line bg-surface lg:flex">
        <div className="pb-4 pl-6 pr-4 pt-6">
          <AgustaLogo size="md" />
          <div className="-mb-1 mt-1 flex items-center justify-between gap-2">
            <p className="text-xs text-ink-3">Portal penawaran</p>
            <NotificationBell navigate={navigate} placement="sidebar" />
          </div>
        </div>
        {nav}
        {userCard}
      </aside>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-40 lg:hidden" role="dialog" aria-modal="true" aria-label="Menu">
          <div className="absolute inset-0 bg-ink/30 animate-fade-in" onClick={() => setMobileOpen(false)} />
          <aside className="relative flex h-full w-[272px] flex-col bg-surface shadow-float animate-drawer-in">
            <div className="flex items-center justify-between px-5 pb-4 pt-5">
              <AgustaLogo size="sm" />
              <IconButton label="Tutup menu" onClick={() => setMobileOpen(false)}>
                <X className="size-5" />
              </IconButton>
            </div>
            {nav}
            {userCard}
          </aside>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-14 shrink-0 items-center justify-between border-b border-line bg-surface px-4 lg:hidden">
          <IconButton label="Buka menu" onClick={() => setMobileOpen(true)}>
            <Menu className="size-5" />
          </IconButton>
          <AgustaLogo size="sm" compact />
          <NotificationBell navigate={navigate} placement="header" />
        </header>
        <main className="flex-1 overflow-y-auto">
          <div className="w-full px-4 py-6 sm:px-8 sm:py-8">{children}</div>
        </main>
      </div>
    </div>
  );
}
