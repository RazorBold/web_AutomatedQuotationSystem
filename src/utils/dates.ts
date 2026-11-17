/**
 * Date helpers for analytics. Display strings in the app are Indonesian ("17 Nov 2026, 10.32");
 * analytics need real instants, so events carry an ISO timestamp and older data is parsed back.
 */
import type { QuotationEvent } from '../types';

const MONTHS: Record<string, number> = {
  jan: 0, feb: 1, mar: 2, apr: 3, mei: 4, may: 4, jun: 5, jul: 6, agu: 7, agt: 7, aug: 7, sep: 8, okt: 9, oct: 9, nov: 10, des: 11, dec: 11,
};

/** Jakarta is UTC+7 all year (no DST). */
const WIB_OFFSET_MS = 7 * 3600 * 1000;

/** "03 Nov 2026", "31 Okt 2026 16:15 WIB", "17 Nov 2026, 10.32" → Date (Jakarta time). */
export function parseIdDate(s: string | undefined | null): Date | null {
  if (!s) return null;
  if (/^\d{4}-\d{2}-\d{2}T/.test(s)) {
    const d = new Date(s);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  const m = s.match(/(\d{1,2})\s+([A-Za-z]{3})[a-z]*\.?\s+(\d{4})(?:,?\s+(\d{1,2})[:.](\d{2}))?/);
  if (!m) return null;
  const month = MONTHS[m[2]!.toLowerCase()];
  if (month === undefined) return null;
  const utc = Date.UTC(Number(m[3]), month, Number(m[1]), Number(m[4] ?? 9), Number(m[5] ?? 0)) - WIB_OFFSET_MS;
  return new Date(utc);
}

export const eventTime = (e: QuotationEvent): Date | null => (e.atIso ? new Date(e.atIso) : parseIdDate(e.at));

/** Working hours: Monday–Friday, 08:00–17:00 WIB (9 hours a day). */
export const WORK_START = 8;
export const WORK_END = 17;
export const HOURS_PER_WORKDAY = WORK_END - WORK_START;

/** Hours between two instants that fall inside working hours. */
export function businessHoursBetween(a: Date, b: Date): number {
  if (b <= a) return 0;
  // Work in "Jakarta wall-clock" by shifting to UTC+7 and using UTC getters.
  let t = a.getTime() + WIB_OFFSET_MS;
  const end = b.getTime() + WIB_OFFSET_MS;
  let ms = 0;
  // Bounded loop: one iteration per day.
  for (let guard = 0; t < end && guard < 3660; guard++) {
    const d = new Date(t);
    const dayStart = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
    const dow = d.getUTCDay();
    if (dow !== 0 && dow !== 6) {
      const ws = dayStart + WORK_START * 3600 * 1000;
      const we = dayStart + WORK_END * 3600 * 1000;
      const from = Math.max(t, ws);
      const to = Math.min(end, we);
      if (to > from) ms += to - from;
    }
    t = dayStart + 24 * 3600 * 1000;
  }
  return ms / 3600000;
}

/** "3 jam", "1,5 hari kerja" (9 working hours = 1 day). */
export function formatWorkDuration(hours: number): string {
  if (!Number.isFinite(hours)) return '–';
  if (hours < 1) return `${Math.max(1, Math.round(hours * 60))} menit`;
  if (hours < HOURS_PER_WORKDAY) return `${hours.toFixed(1).replace('.0', '').replace('.', ',')} jam`;
  const days = hours / HOURS_PER_WORKDAY;
  return `${days.toFixed(1).replace('.0', '').replace('.', ',')} hari kerja`;
}

export const daysBetween = (a: Date, b: Date) => (b.getTime() - a.getTime()) / 86400000;

/** "2026-11" for grouping, and its label "Nov 2026". */
export const monthKey = (d: Date) => {
  const j = new Date(d.getTime() + WIB_OFFSET_MS);
  return `${j.getUTCFullYear()}-${String(j.getUTCMonth() + 1).padStart(2, '0')}`;
};
export const monthLabel = (key: string) => {
  const [y, m] = key.split('-').map(Number);
  return new Date(Date.UTC(y!, m! - 1, 15)).toLocaleDateString('id-ID', { month: 'short', year: 'numeric', timeZone: 'UTC' });
};
