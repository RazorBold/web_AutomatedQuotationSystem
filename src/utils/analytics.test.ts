import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { FollowUp, Quotation } from '../types';
import { businessHoursBetween, formatWorkDuration, parseIdDate } from './dates';
import { durationStats, lostReasons, needsFollowUp, quotationDurations, successBy, successStats } from './analytics';

const wib = (s: string) => new Date(`${s}+07:00`);

test('parses Indonesian display dates as Jakarta time', () => {
  assert.equal(parseIdDate('17 Nov 2026, 10.32')?.toISOString(), '2026-11-17T03:32:00.000Z');
  assert.equal(parseIdDate('31 Okt 2026 16:15 WIB')?.toISOString(), '2026-10-31T09:15:00.000Z');
  assert.equal(parseIdDate('03 Nov 2026')?.toISOString(), '2026-11-03T02:00:00.000Z'); // date only → 09:00
  assert.equal(parseIdDate('kemarin'), null);
});

test('business hours count Mon–Fri 08:00–17:00 only', () => {
  // Monday 16:00 → Tuesday 10:00 = 1 + 2 hours
  assert.equal(businessHoursBetween(wib('2026-11-16T16:00:00'), wib('2026-11-17T10:00:00')), 3);
  // Friday 16:00 → Monday 09:00 = 1 + 1 hours (weekend skipped)
  assert.equal(businessHoursBetween(wib('2026-11-13T16:00:00'), wib('2026-11-16T09:00:00')), 2);
  // Evening to next morning before work = 0
  assert.equal(businessHoursBetween(wib('2026-11-16T19:00:00'), wib('2026-11-17T07:00:00')), 0);
  assert.equal(formatWorkDuration(13.5), '1,5 hari kerja');
  assert.equal(formatWorkDuration(3), '3 jam');
});

const ev = (label: string, iso: string) => ({ at: '', atIso: wib(iso).toISOString(), by: 'x', label });
const fu = (status: FollowUp['status'], iso: string, extra: Partial<FollowUp> = {}): FollowUp => ({
  id: iso, status, note: '', by: 'Ismi', at: '', atIso: wib(iso).toISOString(), ...extra,
});
const quo = (over: Partial<Quotation>): Quotation => ({
  id: Math.random().toString(36), quotationNumber: 'Q', date: '', validUntil: '', status: 'PDF_SENT',
  customer: { companyName: 'PT', contactPerson: 'A', phone: '', email: '', address: '', city: '' },
  salesId: 's1', salesName: 'Ismi', salesPhone: '', items: [], subtotal: 10_000_000, taxRatePercent: 11, taxAmount: 1_100_000,
  grandTotal: 11_100_000, totalCogs: 0, grossProfit: 0, grossMarginPercent: 0, salesNotes: '', ...over,
});

test('weekly follow-up: due after 7 days without an update, not when closed', () => {
  const now = wib('2026-11-20T10:00:00');
  const approved = { reviewedAtIso: wib('2026-11-10T10:00:00').toISOString() };
  assert.equal(needsFollowUp(quo({ ...approved }), now), true);
  assert.equal(needsFollowUp(quo({ ...approved, followUps: [fu('NEGOTIATION', '2026-11-18T09:00:00')] }), now), false);
  assert.equal(needsFollowUp(quo({ ...approved, outcome: 'WON', followUps: [fu('WON', '2026-11-11T09:00:00')] }), now), false);
  assert.equal(needsFollowUp(quo({ ...approved, status: 'PENDING_REVIEW' }), now), false);
});

test('success rate per count and per value; PO value wins over the quotation total', () => {
  const qs = [
    quo({ outcome: 'WON', followUps: [fu('WON', '2026-11-12T09:00:00', { poValue: 9_000_000 })] }),
    quo({ outcome: 'LOST', followUps: [fu('LOST', '2026-11-12T09:00:00', { lostReason: 'PRICE' })] }),
    quo({ outcome: 'LOST', followUps: [fu('LOST', '2026-11-12T09:00:00', { lostReason: 'PRICE' })] }),
    quo({ outcome: 'CANCELLED' }),
    quo({ outcome: 'NEGOTIATION' }),
    quo({ status: 'REVISED', outcome: 'WON' }), // superseded version: ignored
  ];
  const s = successStats(qs);
  assert.equal(s.total, 5);
  assert.equal(`${s.won}/${s.lost}/${s.cancelled}/${s.open}`, '1/2/1/1');
  assert.equal(s.rate, 0.25);
  assert.equal(s.valueWon, 9_000_000);
  assert.equal(s.valueDecided, 4 * 11_100_000);
  assert.deepEqual(lostReasons(qs), [{ reason: 'PRICE', count: 2 }]);
  const bySales = successBy([...qs, quo({ salesName: 'Bayu', outcome: 'WON' })], q => [q.salesName]);
  assert.deepEqual(bySales.map(r => `${r.key}:${r.stats.won}/${r.stats.total}`), ['Ismi:1/5', 'Bayu:1/1']);
});

test('durations per stage, including an escalation round and the WhatsApp send', () => {
  const q = quo({
    status: 'PDF_SENT',
    history: [
      ev('Diajukan ke Sales Support', '2026-11-16T09:00:00'), // Mon
      ev('Diteruskan ke Management', '2026-11-16T13:00:00'), // review 4h
      ev('Disetujui Management', '2026-11-17T10:00:00'), // management 4h + 2h = 6h
      ev('Disetujui, PDF diterbitkan', '2026-11-17T11:00:00'), // review again 1h
      ev('Dikirim ke WhatsApp Sales', '2026-11-17T11:30:00'), // send 0.5h
    ],
  });
  const d = quotationDurations(q);
  assert.deepEqual(d.review, [4, 1]);
  assert.deepEqual(d.management, [6]);
  assert.deepEqual(d.send, [0.5]);
  assert.equal(d.total, 11);
  const waiting = quotationDurations(quo({ status: 'PENDING_REVIEW', history: [ev('Diajukan ke Sales Support', '2026-11-16T09:00:00')] }), wib('2026-11-17T09:00:00'));
  assert.equal(`${waiting.waitingFor}:${waiting.waitingHours}`, 'REVIEW:9');
  const st = durationStats([4, 1, 12], 9);
  assert.equal(st.median, 4);
  assert.equal(st.withinSla, 2 / 3);
});
