import React, { useEffect, useId, useRef } from 'react';
import { Archive, Armchair, CheckCircle2, ChevronLeft, Info, Loader2, Monitor, Package, Table2, X, XCircle } from 'lucide-react';
import type { CustomRequestStatus, QuotationStatus, UserProfile } from '../../types';
import { useStore } from '../../store/AppStore';

export const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(' ');

/* ───────────────────────── Button ───────────────────────── */

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: 'sm' | 'md';
  loading?: boolean;
  icon?: React.ReactNode;
}

const BTN_BASE =
  'inline-flex items-center justify-center gap-2 font-semibold whitespace-nowrap rounded-lg transition-colors duration-150 cursor-pointer disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-link';
const BTN_VARIANT: Record<ButtonVariant, string> = {
  primary: 'bg-brand text-white hover:bg-brand-strong active:bg-brand-strong',
  secondary: 'bg-surface text-ink border border-line-strong hover:bg-canvas hover:border-ink-3/40',
  ghost: 'text-ink-2 hover:text-ink hover:bg-ink/5',
  danger: 'bg-surface text-brand-strong border border-brand/30 hover:bg-brand-soft',
};
/** Same variants, re-mapped for use on the red page hero. */
const BTN_ON_BRAND: Record<ButtonVariant, string> = {
  primary: 'bg-white text-brand-strong hover:bg-brand-soft shadow-[0_1px_2px_rgb(80_8_12/0.25)] focus-visible:outline-white',
  secondary: 'bg-white/10 text-white ring-1 ring-inset ring-white/35 hover:bg-white/20 focus-visible:outline-white',
  ghost: 'text-white hover:bg-white/15 focus-visible:outline-white',
  danger: 'bg-white/10 text-white ring-1 ring-inset ring-white/35 hover:bg-white/20 focus-visible:outline-white',
};
const BTN_SIZE = { sm: 'h-8 px-3 text-[13px]', md: 'h-10 px-4 text-sm' };

/** True inside the red page hero; controls re-skin themselves for contrast. */
export const OnBrandContext = React.createContext(false);

export function Button({ variant = 'secondary', size = 'md', loading, icon, children, className, disabled, ...rest }: ButtonProps) {
  const onBrand = React.useContext(OnBrandContext);
  return (
    <button
      type="button"
      {...rest}
      disabled={disabled || loading}
      className={cx(BTN_BASE, onBrand ? BTN_ON_BRAND[variant] : BTN_VARIANT[variant], BTN_SIZE[size], className)}
    >
      {loading ? <Loader2 className="size-4 animate-spin" aria-hidden /> : icon}
      {children}
    </button>
  );
}

export function IconButton({
  label,
  children,
  className,
  ...rest
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { label: string }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      {...rest}
      className={cx(
        'inline-flex size-9 items-center justify-center rounded-lg text-ink-2 transition-colors hover:bg-ink/5 hover:text-ink cursor-pointer disabled:opacity-40',
        className
      )}
    >
      {children}
    </button>
  );
}

/* ───────────────────────── Status ───────────────────────── */

const TONE: Record<string, string> = {
  amber: 'bg-amber-50 text-amber-800 ring-amber-200',
  green: 'bg-emerald-50 text-emerald-800 ring-emerald-200',
  red: 'bg-red-50 text-red-800 ring-red-200',
  blue: 'bg-blue-50 text-blue-800 ring-blue-200',
  gray: 'bg-canvas text-ink-2 ring-line-strong',
};
const DOT: Record<string, string> = {
  amber: 'bg-amber-500',
  green: 'bg-emerald-500',
  red: 'bg-red-500',
  blue: 'bg-blue-500',
  gray: 'bg-ink-3',
};

export const STATUS_META: Record<QuotationStatus, { label: string; tone: keyof typeof TONE }> = {
  DRAFT: { label: 'Draf', tone: 'gray' },
  PENDING_REVIEW: { label: 'Menunggu review', tone: 'amber' },
  APPROVED: { label: 'Disetujui', tone: 'green' },
  REJECTED: { label: 'Perlu revisi', tone: 'red' },
  PDF_SENT: { label: 'Terkirim ke Sales', tone: 'blue' },
};

export const REQUEST_STATUS_META: Record<CustomRequestStatus, { label: string; tone: keyof typeof TONE }> = {
  PENDING_PRICING: { label: 'Menunggu harga', tone: 'amber' },
  PRICED: { label: 'Harga tersedia', tone: 'blue' },
  APPROVED: { label: 'Disetujui', tone: 'green' },
  REJECTED: { label: 'Tidak dapat diproses', tone: 'red' },
};

export function Badge({ tone = 'gray', children, className }: { tone?: keyof typeof TONE; children: React.ReactNode; className?: string }) {
  return (
    <span
      className={cx(
        'inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset whitespace-nowrap',
        TONE[tone],
        className
      )}
    >
      <span className={cx('size-1.5 rounded-full', DOT[tone])} aria-hidden />
      {children}
    </span>
  );
}

export function StatusBadge({ status }: { status: QuotationStatus }) {
  const m = STATUS_META[status];
  return <Badge tone={m.tone}>{m.label}</Badge>;
}

/* ───────────────────────── Form ───────────────────────── */

interface FieldProps {
  label: string;
  hint?: string;
  error?: string;
  optional?: boolean;
  children: (props: { id: string; 'aria-invalid'?: boolean; 'aria-describedby'?: string }) => React.ReactNode;
  className?: string;
}

export function Field({ label, hint, error, optional, children, className }: FieldProps) {
  const id = useId();
  const descId = `${id}-desc`;
  return (
    <div className={cx('flex flex-col gap-1.5', className)}>
      <label htmlFor={id} className="text-[13px] font-semibold text-ink">
        {label}
        {optional && <span className="ml-1 font-normal text-ink-3">(opsional)</span>}
      </label>
      {children({ id, 'aria-invalid': error ? true : undefined, 'aria-describedby': hint || error ? descId : undefined })}
      {(error || hint) && (
        <p id={descId} className={cx('text-xs', error ? 'text-brand-strong' : 'text-ink-3')}>
          {error || hint}
        </p>
      )}
    </div>
  );
}

const CONTROL =
  'w-full rounded-lg border border-line-strong bg-surface px-3 text-sm text-ink placeholder:text-ink-3 transition-colors hover:border-ink-3/60 focus:border-link focus:outline-none focus:ring-3 focus:ring-link/15 aria-invalid:border-brand aria-invalid:ring-brand/10 disabled:bg-canvas disabled:text-ink-3';

export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...rest }, ref) => <input ref={ref} {...rest} className={cx(CONTROL, 'h-10', className)} />
);
Input.displayName = 'Input';

export function Select({ className, children, ...rest }: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select {...rest} className={cx(CONTROL, 'h-10 pr-8 cursor-pointer', className)}>
      {children}
    </select>
  );
}

export function Textarea({ className, ...rest }: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...rest} className={cx(CONTROL, 'py-2.5 leading-relaxed', className)} />;
}

/* ───────────────────────── Layout ───────────────────────── */

/** Line work taken from the Agusta ball emblem, used large and faint on the red hero. */
export function HeroLines() {
  return (
    <svg
      aria-hidden
      viewBox="0 0 40 40"
      className="pointer-events-none absolute -right-28 -top-44 size-[560px] text-white opacity-[0.11] sm:-right-16"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
    >
      <circle cx="20" cy="20" r="18" strokeWidth="0.5" />
      <path d="M6 15.5c8 1.5 17.5-1 27-9" strokeWidth="0.6" />
      <path d="M3.5 23c11 1.5 23-2.5 33-13" strokeWidth="0.6" />
      <path d="M8 31.5c9.5 0 19.5-4.5 28.5-14" strokeWidth="0.6" />
      <path d="M17 2.5c-5 8-5.5 22 2.5 35" strokeWidth="0.6" />
    </svg>
  );
}

export function PageHeader({
  title,
  description,
  actions,
  back,
  meta,
  children,
}: {
  title: string;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  back?: { label: string; onClick: () => void };
  meta?: React.ReactNode;
  /** Extra content shown on the red hero below the title: stats, tabs, stepper. */
  children?: React.ReactNode;
}) {
  return (
    <header className="page-hero relative -mx-4 -mt-6 overflow-hidden bg-brand-deep px-4 pb-20 pt-7 text-white sm:-mx-8 sm:-mt-8 sm:px-8 sm:pt-9">
      <HeroLines />
      <OnBrandContext.Provider value={true}>
        <div className="relative">
          {back && (
            <button
              onClick={back.onClick}
              className="-ml-1 mb-2 inline-flex items-center gap-1 rounded-md px-1 py-0.5 text-[13px] font-medium text-white/90 hover:text-white cursor-pointer focus-visible:outline-white"
            >
              <ChevronLeft className="size-4" /> {back.label}
            </button>
          )}
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div className="min-w-0">
              <h1 className="text-[26px] font-semibold leading-tight text-white">{title}</h1>
              {meta && <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-[13px] text-white/90">{meta}</div>}
              {description && <p className="mt-1.5 max-w-[68ch] text-sm text-white/90">{description}</p>}
            </div>
            {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
          </div>
          {children && <div className="mt-7">{children}</div>}
        </div>
      </OnBrandContext.Provider>
    </header>
  );
}

/** Figures set directly on the red hero: big white numerals, no card chrome. */
export function HeroStats({ items }: { items: { label: string; value: React.ReactNode; hint?: string; flag?: string }[] }) {
  return (
    <dl className="grid grid-cols-2 gap-y-5 lg:grid-cols-4">
      {items.map((it, i) => (
        <div key={it.label} className={cx('min-w-0 pr-4', i % 2 === 1 && 'border-l border-white/20 pl-5', i >= 2 && 'lg:border-l lg:border-white/20 lg:pl-5')}>
          <dt className="flex items-center gap-2 text-[13px] text-white/90">
            {it.label}
            {it.flag && <span className="rounded-full bg-white px-2 py-px text-[11px] font-semibold text-brand-strong">{it.flag}</span>}
          </dt>
          <dd className="mt-1 break-words text-[20px] font-semibold sm:truncate sm:text-[28px] leading-tight tabular-nums text-white">{it.value}</dd>
          {it.hint && <p className="mt-0.5 text-xs text-white/85">{it.hint}</p>}
        </div>
      ))}
    </dl>
  );
}

export function Panel({
  title,
  description,
  actions,
  children,
  className,
  bodyClassName,
}: {
  title?: React.ReactNode;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  bodyClassName?: string;
}) {
  return (
    <section className={cx('rounded-[14px] border border-line/80 bg-surface shadow-card', className)}>
      {(title || actions) && (
        <header className="flex items-start justify-between gap-4 border-b border-line/70 px-5 py-4">
          <div className="min-w-0">
            {title && <h2 className="text-base font-semibold text-ink">{title}</h2>}
            {description && <p className="mt-0.5 text-[13px] text-ink-2">{description}</p>}
          </div>
          {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
        </header>
      )}
      <div className={cx(bodyClassName ?? 'p-5')}>{children}</div>
    </section>
  );
}

export function EmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center px-6 py-14 text-center">
      <div className="mb-4 flex size-11 items-center justify-center rounded-full bg-canvas text-ink-3">{icon}</div>
      <p className="text-[15px] font-semibold text-ink">{title}</p>
      <p className="mt-1 max-w-sm text-[13px] text-ink-2">{description}</p>
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function Avatar({ user, size = 'md' }: { user: Pick<UserProfile, 'avatar' | 'role' | 'name'>; size?: 'sm' | 'md' | 'lg' }) {
  const tone =
    user.role === 'SALES' ? 'bg-link-soft text-link-strong' : user.role === 'MANAGEMENT' ? 'bg-navy text-white' : 'bg-brand-soft text-brand-strong';
  const s = { sm: 'size-7 text-[11px]', md: 'size-9 text-xs', lg: 'size-12 text-sm' }[size];
  return (
    <span aria-hidden className={cx('inline-flex shrink-0 items-center justify-center rounded-full font-bold', tone, s)}>
      {user.avatar}
    </span>
  );
}

/* ───────────────────────── Overlays ───────────────────────── */

function useEscape(open: boolean, onClose: () => void) {
  useEffect(() => {
    if (!open) return;
    const h = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', h);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', h);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);
}

function useInitialFocus(open: boolean) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const prevFocus = document.activeElement as HTMLElement | null;
    const root = ref.current;
    const el =
      root?.querySelector<HTMLElement>('[data-autofocus]') ??
      root?.querySelector<HTMLElement>('input:not([type=hidden]):not([disabled]), select, textarea') ??
      root?.querySelector<HTMLElement>('button');
    el?.focus({ preventScroll: true });
    return () => prevFocus?.focus?.();
  }, [open]);
  return ref;
}

export function Drawer({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  width = 'max-w-lg',
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  width?: string;
}) {
  useEscape(open, onClose);
  const ref = useInitialFocus(open);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-40 flex justify-end" role="dialog" aria-modal="true" aria-label={title}>
      <div className="absolute inset-0 bg-ink/30 animate-fade-in" onClick={onClose} />
      <div ref={ref} className={cx('relative flex h-full w-full flex-col bg-surface shadow-float animate-drawer-in', width)}>
        <header className="flex items-start justify-between gap-4 border-b border-line px-6 py-5">
          <div>
            <h2 className="text-lg font-semibold text-ink">{title}</h2>
            {description && <p className="mt-0.5 text-[13px] text-ink-2">{description}</p>}
          </div>
          <IconButton label="Tutup" onClick={onClose}>
            <X className="size-5" />
          </IconButton>
        </header>
        <div className="flex-1 overflow-y-auto px-6 py-5">{children}</div>
        {footer && <footer className="flex justify-end gap-2 border-t border-line bg-canvas/60 px-6 py-4">{footer}</footer>}
      </div>
    </div>
  );
}

export function Dialog({
  open,
  onClose,
  title,
  children,
  footer,
  width = 'max-w-md',
  bare,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  width?: string;
  bare?: boolean;
}) {
  useEscape(open, onClose);
  const ref = useInitialFocus(open);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto p-4 sm:items-center" role="dialog" aria-modal="true" aria-label={title}>
      <div className="fixed inset-0 bg-ink/40 animate-fade-in" onClick={onClose} />
      <div ref={ref} className={cx('relative w-full animate-dialog-in', width, !bare && 'rounded-xl bg-surface shadow-float')}>
        {bare ? (
          children
        ) : (
          <>
            <header className="flex items-start justify-between gap-4 px-6 pt-5">
              <h2 className="text-lg font-semibold text-ink">{title}</h2>
              <IconButton label="Tutup" onClick={onClose} className="-mr-2 -mt-1">
                <X className="size-5" />
              </IconButton>
            </header>
            <div className="px-6 py-4">{children}</div>
            {footer && <footer className="flex justify-end gap-2 border-t border-line px-6 py-4">{footer}</footer>}
          </>
        )}
      </div>
    </div>
  );
}

export function Toaster() {
  const { toasts, dismissToast } = useStore();
  return (
    <div className="pointer-events-none fixed inset-x-0 top-4 z-[60] flex flex-col items-center gap-2 px-4 sm:items-end sm:pr-6" aria-live="polite">
      {toasts.map(t => (
        <div
          key={t.id}
          className="pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-xl border border-line bg-surface px-4 py-3 text-sm text-ink shadow-float animate-toast-in"
        >
          {t.tone === 'success' ? (
            <CheckCircle2 className="mt-0.5 size-[18px] shrink-0 text-emerald-600" />
          ) : t.tone === 'error' ? (
            <XCircle className="mt-0.5 size-[18px] shrink-0 text-brand" />
          ) : (
            <Info className="mt-0.5 size-[18px] shrink-0 text-link" />
          )}
          <p className="flex-1 leading-snug">{t.message}</p>
          <button onClick={() => dismissToast(t.id)} className="-mr-1 rounded p-0.5 text-ink-3 hover:text-ink cursor-pointer" aria-label="Tutup notifikasi">
            <X className="size-4" />
          </button>
        </div>
      ))}
    </div>
  );
}

/* ───────────────────────── Misc ───────────────────────── */

export function Segmented<T extends string>({
  value,
  onChange,
  options,
  label,
}: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: string; count?: number }[];
  label: string;
}) {
  const onBrand = React.useContext(OnBrandContext);
  return (
    <div
      role="tablist"
      aria-label={label}
      className={cx('inline-flex self-start rounded-lg p-0.5', onBrand ? 'bg-brand-ink/35' : 'border border-line bg-canvas')}
    >
      {options.map(o => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            role="tab"
            aria-selected={active}
            onClick={() => onChange(o.value)}
            className={cx(
              'inline-flex h-8 items-center gap-1.5 rounded-md px-3 text-[13px] font-semibold transition-colors cursor-pointer',
              onBrand
                ? active
                  ? 'bg-white text-brand-strong shadow-[0_1px_2px_rgb(80_8_12/0.25)] focus-visible:outline-white'
                  : 'text-white hover:bg-white/10 focus-visible:outline-white'
                : active
                  ? 'bg-surface text-ink shadow-[0_1px_2px_rgb(20_24_33/0.08)]'
                  : 'text-ink-2 hover:text-ink'
            )}
          >
            {o.label}
            {o.count !== undefined && (
              <span className={cx('tabular-nums text-xs', onBrand ? (active ? 'text-brand' : 'text-white/85') : active ? 'text-ink-2' : 'text-ink-3')}>{o.count}</span>
            )}
          </button>
        );
      })}
    </div>
  );
}

function placeholderIcon(hint: string) {
  const h = hint.toLowerCase();
  if (/aio|pc|komputer|laptop|monitor/.test(h)) return Monitor;
  if (/meja|table|desk/.test(h)) return Table2;
  if (/lemari|arsip|cabinet|locker|rak/.test(h)) return Archive;
  if (/kursi|chair/.test(h)) return Armchair;
  return Package;
}

export function ProductImage({ src, alt, className, hint }: { src: string; alt: string; className?: string; hint?: string }) {
  const [failed, setFailed] = React.useState(false);
  const Icon = placeholderIcon(hint ?? alt);
  return (
    <div className={cx('flex items-center justify-center overflow-hidden bg-white', className)}>
      {failed || !src ? (
        <span className="flex size-full items-center justify-center bg-canvas text-ink-3/70" title="Foto produk belum tersedia">
          <Icon className="size-[38%] max-h-12 max-w-12" strokeWidth={1.25} aria-hidden />
        </span>
      ) : (
        <img src={src} alt={alt} loading="lazy" onError={() => setFailed(true)} className="h-full w-full object-contain" />
      )}
    </div>
  );
}
