/**
 * Analytics for Management (R13/R14/R8): follow-up state, success rate, and how long quotations
 * spend in each stage. Pure functions over Quotation objects, unit-tested.
 */
import type { FollowUpStatus, LostReason, Quotation } from '../types';
import { businessHoursBetween, daysBetween, eventTime, HOURS_PER_WORKDAY, parseIdDate } from './dates';

export const FOLLOWUP_LABEL: Record<FollowUpStatus, string> = {
  WAITING: 'Menunggu keputusan customer',
  NEGOTIATION: 'Negosiasi',
  WON: 'Menang (PO)',
  LOST: 'Kalah',
  CANCELLED: 'Batal',
};
export const LOST_REASON_LABEL: Record<LostReason, string> = {
  PRICE: 'Harga',
  COMPETITOR: 'Kalah dari kompetitor',
  BUDGET: 'Anggaran customer',
  SPEC: 'Spesifikasi tidak sesuai',
  OTHER: 'Lainnya',
};

export const FINAL_OUTCOMES: FollowUpStatus[] = ['WON', 'LOST', 'CANCELLED'];
/** Sales should post an update at least this often (R13, default: weekly). */
export const FOLLOWUP_INTERVAL_DAYS = 7;
/** Review target (R8, default): 1 working day. */
export const REVIEW_SLA_HOURS = HOURS_PER_WORKDAY;

/** Quotations whose outcome is followed up: issued and not superseded by a revision. */
export const isTracked = (q: Quotation) => q.status === 'APPROVED' || q.status === 'PDF_SENT';
export const isClosed = (q: Quotation) => !!q.outcome && FINAL_OUTCOMES.includes(q.outcome);

/** When the quotation was approved (start of follow-up). */
export function issuedAt(q: Quotation): Date | null {
  if (q.reviewedAtIso) return new Date(q.reviewedAtIso);
  const ev = [...(q.history ?? [])].reverse().find(e => e.label.startsWith('Disetujui, PDF'));
  return (ev && eventTime(ev)) || parseIdDate(q.reviewedAt) || parseIdDate(q.date);
}

/** Last time something was recorded about the customer: latest update, else the approval. */
export function lastFollowUpAt(q: Quotation): Date | null {
  const last = q.followUps?.[q.followUps.length - 1];
  return last ? new Date(last.atIso) : issuedAt(q);
}

/** True when an open, issued quotation has had no update for a week. */
export function needsFollowUp(q: Quotation, now = new Date()): boolean {
  if (!isTracked(q) || isClosed(q)) return false;
  const last = lastFollowUpAt(q);
  return !last || daysBetween(last, now) >= FOLLOWUP_INTERVAL_DAYS;
}

// ───────────────────────────── Success rate (R14) ─────────────────────────────

export interface SuccessStats {
  /** Issued quotations considered. */
  total: number;
  won: number;
  lost: number;
  cancelled: number;
  /** Still waiting or negotiating. */
  open: number;
  /** won ÷ (won + lost + cancelled); null while nothing is decided. */
  rate: number | null;
  valueDecided: number;
  /** PO value when recorded, otherwise the quotation total. */
  valueWon: number;
  valueRate: number | null;
}

const headline = (q: Quotation) => (q.showTax === false ? q.subtotal : q.grandTotal);
export const wonValue = (q: Quotation) => q.followUps?.slice().reverse().find(f => f.status === 'WON')?.poValue || headline(q);

export function successStats(qs: Quotation[]): SuccessStats {
  const tracked = qs.filter(isTracked);
  const by = (s: FollowUpStatus) => tracked.filter(q => q.outcome === s);
  const won = by('WON');
  const decided = tracked.filter(isClosed);
  const valueDecided = decided.reduce((s, q) => s + headline(q), 0);
  const valueWon = won.reduce((s, q) => s + wonValue(q), 0);
  return {
    total: tracked.length,
    won: won.length,
    lost: by('LOST').length,
    cancelled: by('CANCELLED').length,
    open: tracked.length - decided.length,
    rate: decided.length ? won.length / decided.length : null,
    valueDecided,
    valueWon,
    valueRate: valueDecided ? Math.min(1, valueWon / valueDecided) : null,
  };
}

/** Success stats per group; a quotation may belong to several groups (e.g. several brands). */
export function successBy(qs: Quotation[], keys: (q: Quotation) => string[]): { key: string; stats: SuccessStats }[] {
  const groups = new Map<string, Quotation[]>();
  for (const q of qs.filter(isTracked)) for (const k of new Set(keys(q))) groups.set(k, [...(groups.get(k) ?? []), q]);
  return [...groups.entries()]
    .map(([key, list]) => ({ key, stats: successStats(list) }))
    .sort((a, b) => b.stats.total - a.stats.total || a.key.localeCompare(b.key));
}

export function lostReasons(qs: Quotation[]): { reason: LostReason; count: number }[] {
  const counts = new Map<LostReason, number>();
  for (const q of qs.filter(q => isTracked(q) && q.outcome === 'LOST')) {
    const r = q.followUps?.slice().reverse().find(f => f.status === 'LOST')?.lostReason ?? 'OTHER';
    counts.set(r, (counts.get(r) ?? 0) + 1);
  }
  return [...counts.entries()].map(([reason, count]) => ({ reason, count })).sort((a, b) => b.count - a.count);
}

// ───────────────────────────── Durations (R8) ─────────────────────────────

export interface QuotationDurations {
  /** Working hours from each submission to Sales Support's decision (approve / return / escalate). */
  review: number[];
  /** Working hours from forwarding to Management's decision. */
  management: number[];
  /** Working hours from approval to the WhatsApp send. */
  send: number[];
  /** Working hours from the first submission to the (last) approval. */
  total?: number;
  /** Still waiting: working hours since the current wait started (review or Management). */
  waitingHours?: number;
  waitingFor?: 'REVIEW' | 'MANAGEMENT';
}

const isSubmit = (l: string) => l.startsWith('Diajukan ke Sales Support') || l.startsWith('Direvisi dan diajukan ulang') || l.startsWith('Revisi dari');
const isReviewDecision = (l: string) => l.startsWith('Disetujui, PDF') || l.startsWith('Dikembalikan untuk revisi') || l.startsWith('Diteruskan ke Management');
const isMgmtDecision = (l: string) => l.startsWith('Disetujui Management') || l.startsWith('Dikembalikan Management');

export function quotationDurations(q: Quotation, now = new Date()): QuotationDurations {
  const events = (q.history ?? [])
    .map(e => ({ label: e.label, t: eventTime(e) }))
    .filter((e): e is { label: string; t: Date } => e.t !== null)
    .sort((a, b) => a.t.getTime() - b.t.getTime());
  const out: QuotationDurations = { review: [], management: [], send: [] };
  let reviewSince: Date | null = null;
  let mgmtSince: Date | null = null;
  let approvedAt: Date | null = null;
  let firstSubmit: Date | null = null;

  for (const e of events) {
    if (isSubmit(e.label)) {
      reviewSince = e.t;
      firstSubmit ??= e.t;
    } else if (isReviewDecision(e.label)) {
      if (reviewSince) out.review.push(businessHoursBetween(reviewSince, e.t));
      reviewSince = null;
      if (e.label.startsWith('Diteruskan ke Management')) mgmtSince = e.t;
      if (e.label.startsWith('Disetujui, PDF')) {
        approvedAt = e.t;
        if (firstSubmit) out.total = businessHoursBetween(firstSubmit, e.t);
      }
    } else if (isMgmtDecision(e.label)) {
      if (mgmtSince) out.management.push(businessHoursBetween(mgmtSince, e.t));
      mgmtSince = null;
      reviewSince = e.t; // back with Sales Support
    } else if (e.label.startsWith('Dikirim ke WhatsApp') && approvedAt) {
      out.send.push(businessHoursBetween(approvedAt, e.t));
      approvedAt = null;
    }
  }

  if (q.status === 'PENDING_REVIEW' && reviewSince) {
    out.waitingFor = 'REVIEW';
    out.waitingHours = businessHoursBetween(reviewSince, now);
  } else if (q.status === 'PENDING_MANAGEMENT' && mgmtSince) {
    out.waitingFor = 'MANAGEMENT';
    out.waitingHours = businessHoursBetween(mgmtSince, now);
  }
  return out;
}

export interface DurationStats {
  count: number;
  avg: number | null;
  median: number | null;
  /** Share of samples within `sla` hours (when given). */
  withinSla: number | null;
}

export function durationStats(samples: number[], sla?: number): DurationStats {
  const s = samples.filter(Number.isFinite).sort((a, b) => a - b);
  if (!s.length) return { count: 0, avg: null, median: null, withinSla: null };
  const mid = Math.floor(s.length / 2);
  return {
    count: s.length,
    avg: s.reduce((a, b) => a + b, 0) / s.length,
    median: s.length % 2 ? s[mid]! : (s[mid - 1]! + s[mid]!) / 2,
    withinSla: sla === undefined ? null : s.filter(x => x <= sla).length / s.length,
  };
}
