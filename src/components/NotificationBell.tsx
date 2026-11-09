import React, { useEffect, useRef, useState } from 'react';
import { Bell, BellRing, CheckCheck, FileCheck2, FileClock, FileX2, PackageCheck, PackagePlus, PackageX, Tags } from 'lucide-react';
import type { AppNotification, NotificationType } from '../types';
import { useStore } from '../store/AppStore';
import type { Route } from '../App';
import { cx } from './ui';

const ICON: Record<NotificationType, { icon: React.ComponentType<{ className?: string; strokeWidth?: number }>; tone: string }> = {
  QUOTATION_SUBMITTED: { icon: FileClock, tone: 'bg-amber-50 text-amber-700' },
  QUOTATION_RESUBMITTED: { icon: FileClock, tone: 'bg-amber-50 text-amber-700' },
  QUOTATION_APPROVED: { icon: FileCheck2, tone: 'bg-emerald-50 text-emerald-700' },
  QUOTATION_REJECTED: { icon: FileX2, tone: 'bg-red-50 text-red-700' },
  CUSTOM_REQUEST_SUBMITTED: { icon: PackagePlus, tone: 'bg-amber-50 text-amber-700' },
  CUSTOM_REQUEST_PRICED: { icon: Tags, tone: 'bg-blue-50 text-blue-700' },
  CUSTOM_REQUEST_APPROVED: { icon: PackageCheck, tone: 'bg-emerald-50 text-emerald-700' },
  CUSTOM_REQUEST_REJECTED: { icon: PackageX, tone: 'bg-red-50 text-red-700' },
};

function timeAgo(iso: string): string {
  const s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return 'baru saja';
  if (s < 3600) return `${Math.floor(s / 60)} menit lalu`;
  if (s < 86400) return `${Math.floor(s / 3600)} jam lalu`;
  if (s < 7 * 86400) return `${Math.floor(s / 86400)} hari lalu`;
  return new Date(iso).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' });
}

const routeFor = (n: AppNotification): Route =>
  n.quotationId ? { view: 'quotation-detail', id: n.quotationId } : { view: 'custom-requests' };

/** Announces notifications that arrive while the app is open: a toast, or a desktop notification when the tab is hidden. */
export function useArrivalAlerts(notifications: AppNotification[], navigate: (r: Route) => void) {
  const { notify } = useStore();
  const seen = useRef<Set<string> | null>(null);
  useEffect(() => {
    if (seen.current === null) {
      seen.current = new Set(notifications.map(n => n.id)); // don't announce what was there at sign-in
      return;
    }
    const fresh = notifications.filter(n => !n.read && !seen.current!.has(n.id));
    notifications.forEach(n => seen.current!.add(n.id));
    if (!fresh.length) return;
    if (document.hidden && typeof Notification !== 'undefined' && Notification.permission === 'granted') {
      for (const n of fresh.slice(0, 3)) {
        try {
          const desktop = new Notification(n.title, { body: n.body, tag: n.id, icon: '/favicon.svg' });
          desktop.onclick = () => {
            window.focus();
            navigate(routeFor(n));
          };
        } catch {
          /* some browsers only allow notifications from a service worker */
        }
      }
    } else {
      notify(fresh.length === 1 ? `${fresh[0]!.title}: ${fresh[0]!.body}` : `${fresh.length} notifikasi baru`, 'info');
    }
  }, [notifications, navigate, notify]);
}

export function NotificationBell({ navigate, placement }: { navigate: (r: Route) => void; placement: 'sidebar' | 'header' }) {
  const { notifications, unreadCount, markNotificationsRead } = useStore();
  const [open, setOpen] = useState(false);
  const [permission, setPermission] = useState(() => (typeof Notification === 'undefined' ? 'unsupported' : Notification.permission));
  const wrap = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (wrap.current && !wrap.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const openItem = (n: AppNotification) => {
    if (!n.read) void markNotificationsRead([n.id]);
    setOpen(false);
    navigate(routeFor(n));
  };

  const label = unreadCount ? `Notifikasi, ${unreadCount} belum dibaca` : 'Notifikasi';

  return (
    <div ref={wrap} className="relative">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        aria-label={label}
        aria-expanded={open}
        aria-haspopup="dialog"
        className={cx(
          'relative flex size-9 items-center justify-center rounded-lg text-ink-2 transition-colors hover:bg-canvas hover:text-ink cursor-pointer',
          'focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-link/25',
          open && 'bg-canvas text-ink'
        )}
      >
        {unreadCount ? <BellRing className="size-[19px]" strokeWidth={1.75} /> : <Bell className="size-[19px]" strokeWidth={1.75} />}
        {unreadCount > 0 && (
          <span className="absolute -right-0.5 -top-0.5 min-w-[18px] rounded-full bg-brand px-1 text-center text-[10.5px] font-bold leading-[18px] text-white ring-2 ring-surface tabular-nums">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div
          role="dialog"
          aria-label="Notifikasi"
          className={cx(
            'z-50 flex max-h-[min(560px,calc(100vh-6rem))] flex-col overflow-hidden rounded-xl border border-line bg-surface shadow-float animate-fade-in',
            placement === 'sidebar' ? 'absolute left-full top-0 ml-3 w-[380px]' : 'fixed inset-x-3 top-16 sm:left-auto sm:right-4 sm:w-[380px]'
          )}
        >
          <div className="flex items-center justify-between gap-3 border-b border-line px-4 py-3">
            <p className="text-sm font-semibold text-ink">
              Notifikasi {unreadCount > 0 && <span className="font-normal text-ink-3">· {unreadCount} belum dibaca</span>}
            </p>
            {unreadCount > 0 && (
              <button
                onClick={() => void markNotificationsRead()}
                className="inline-flex items-center gap-1 rounded text-xs font-medium text-link hover:text-link-strong cursor-pointer focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-link/25"
              >
                <CheckCheck className="size-3.5" /> Tandai semua dibaca
              </button>
            )}
          </div>

          {notifications.length === 0 ? (
            <div className="px-6 py-10 text-center">
              <Bell className="mx-auto size-6 text-ink-3/70" strokeWidth={1.5} aria-hidden />
              <p className="mt-2 text-[13px] font-medium text-ink">Belum ada notifikasi</p>
              <p className="mt-0.5 text-xs text-ink-3">Pengajuan, persetujuan, dan revisi yang melibatkan Anda akan muncul di sini.</p>
            </div>
          ) : (
            <ul className="flex-1 divide-y divide-line overflow-y-auto">
              {notifications.map(n => {
                const { icon: Icon, tone } = ICON[n.type] ?? ICON.QUOTATION_SUBMITTED;
                return (
                  <li key={n.id}>
                    <button
                      onClick={() => openItem(n)}
                      className={cx(
                        'flex w-full gap-3 px-4 py-3 text-left transition-colors hover:bg-canvas cursor-pointer focus-visible:bg-canvas focus-visible:outline-none',
                        !n.read && 'bg-link-soft/30'
                      )}
                    >
                      <span className={cx('flex size-8 shrink-0 items-center justify-center rounded-full', tone)}>
                        <Icon className="size-4" strokeWidth={1.75} />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className={cx('block text-[13px] leading-snug text-ink', !n.read && 'font-semibold')}>{n.title}</span>
                        <span className="mt-0.5 line-clamp-2 block text-xs leading-relaxed text-ink-2">{n.body}</span>
                        <span className="mt-1 block text-[11px] text-ink-3" title={n.createdAt}>
                          {timeAgo(n.createdAtIso)}
                        </span>
                      </span>
                      {!n.read && <span className="mt-1.5 size-2 shrink-0 rounded-full bg-link" aria-label="Belum dibaca" />}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}

          {permission === 'default' && (
            <div className="border-t border-line bg-canvas px-4 py-2.5">
              <button
                onClick={() => Notification.requestPermission().then(setPermission)}
                className="text-xs font-medium text-link hover:text-link-strong cursor-pointer"
              >
                Aktifkan notifikasi desktop saat portal tidak sedang dibuka
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
