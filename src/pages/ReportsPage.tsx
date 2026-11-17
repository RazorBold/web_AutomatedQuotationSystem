import React, { useState } from 'react';
import { useStore } from '../store/AppStore';
import { HeroStats, PageHeader, Panel, Segmented } from '../components/ui';
import { MarginValue, QuotationTable } from '../components/QuotationTable';
import { OutcomeBadge } from '../components/FollowUpPanel';
import { formatRupiah, normalizeBrand } from '../utils/quotationEngine';
import {
  FOLLOWUP_INTERVAL_DAYS,
  LOST_REASON_LABEL,
  REVIEW_SLA_HOURS,
  durationStats,
  isTracked,
  issuedAt,
  lostReasons,
  needsFollowUp,
  quotationDurations,
  successBy,
  successStats,
  type DurationStats,
  type SuccessStats,
} from '../utils/analytics';
import { formatWorkDuration, monthKey, monthLabel } from '../utils/dates';
import type { CustomerCategory, Quotation } from '../types';
import type { Route } from '../App';

const SEGMENT_LABEL: Record<CustomerCategory, string> = {
  CORPORATE: 'Korporasi',
  BUMN_GOV: 'BUMN / Pemerintah',
  EDUCATION: 'Pendidikan',
  RETAIL: 'Retail',
};

type Tab = 'MARGIN' | 'SUCCESS' | 'DURATION';

const pct = (v: number | null) => (v === null ? '–' : `${(v * 100).toLocaleString('id-ID', { maximumFractionDigits: 0 })}%`);
const dur = (h: number | null) => (h === null ? '–' : formatWorkDuration(h));

export function ReportsPage({ navigate }: { navigate: (r: Route) => void }) {
  const [tab, setTab] = useState<Tab>('MARGIN');
  const open = (q: Quotation) => navigate({ view: 'quotation-detail', id: q.id });

  const tabs = (
    <Segmented<Tab>
      label="Jenis laporan"
      value={tab}
      onChange={setTab}
      options={[
        { value: 'MARGIN', label: 'Margin' },
        { value: 'SUCCESS', label: 'Success rate' },
        { value: 'DURATION', label: 'Lama penawaran' },
      ]}
    />
  );

  if (tab === 'SUCCESS') return <SuccessReport tabs={tabs} open={open} />;
  if (tab === 'DURATION') return <DurationReport tabs={tabs} open={open} />;
  return <MarginReport tabs={tabs} open={open} />;
}

interface TabProps {
  tabs: React.ReactNode;
  open: (q: Quotation) => void;
}

// ───────────────────────────── Margin ─────────────────────────────

function aggregate(list: Quotation[]) {
  const done = list.filter(isTracked);
  const subtotal = done.reduce((s, q) => s + q.subtotal, 0);
  const cogs = done.reduce((s, q) => s + q.totalCogs, 0);
  return {
    count: list.length,
    issued: done.length,
    value: done.reduce((s, q) => s + q.grandTotal, 0),
    subtotal,
    cogs,
    profit: subtotal - cogs,
    margin: subtotal ? ((subtotal - cogs) / subtotal) * 100 : 0,
  };
}

function MarginReport({ tabs, open }: TabProps) {
  const { quotations, users } = useStore();
  const all = aggregate(quotations);

  const bySales = users
    .filter(u => u.role === 'SALES')
    .map(u => ({ u, a: aggregate(quotations.filter(q => q.salesId === u.id)) }))
    .filter(x => x.a.count > 0 || x.u.status === 'ACTIVE')
    .sort((a, b) => b.a.value - a.a.value);

  const bySegment = [
    ...(Object.keys(SEGMENT_LABEL) as CustomerCategory[]).map(s => ({
      s: s as string,
      label: SEGMENT_LABEL[s],
      a: aggregate(quotations.filter(q => q.customer.category === s)),
    })),
    { s: 'NONE', label: 'Tanpa segmen', a: aggregate(quotations.filter(q => !q.customer.category)) },
  ].filter(x => x.a.count > 0);

  const marginTable = (rows: { key: string; label: React.ReactNode; a: ReturnType<typeof aggregate> }[], first: string) => (
    <table className="w-full min-w-[480px] text-left text-[13px]">
      <thead>
        <tr className="border-b border-line text-xs text-ink-3">
          <th className="px-5 py-2.5 font-medium">{first}</th>
          <th className="px-3 py-2.5 text-right font-medium">Disetujui</th>
          <th className="px-3 py-2.5 text-right font-medium">Nilai terbit</th>
          <th className="px-5 py-2.5 text-right font-medium">Margin</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-line">
        {rows.map(({ key, label, a }) => (
          <tr key={key}>
            <td className="whitespace-nowrap px-5 py-3 font-semibold text-ink">{label}</td>
            <td className="px-3 py-3 text-right whitespace-nowrap tabular-nums text-ink-2">
              {a.issued}/{a.count}
            </td>
            <td className="px-3 py-3 text-right whitespace-nowrap font-semibold tabular-nums">{formatRupiah(a.value)}</td>
            <td className="px-5 py-3 text-right">{a.issued ? <MarginValue value={a.margin} /> : <span className="text-ink-3">–</span>}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Laporan"
        description="Margin dihitung dari penawaran yang sudah disetujui, memakai nilai sebelum PPN. Total penawaran memakai nilai dengan PPN."
      >
        <div className="flex flex-col gap-6">
          {tabs}
          <HeroStats
            items={[
              { label: 'Nilai penawaran terbit', value: formatRupiah(all.value), hint: `${all.issued} dari ${all.count} penawaran` },
              { label: 'Total HPP', value: formatRupiah(all.cogs), hint: 'Modal yang terikat' },
              { label: 'Laba kotor', value: formatRupiah(all.profit), hint: 'Sebelum biaya operasional' },
              { label: 'Margin kotor', value: `${all.margin.toLocaleString('id-ID', { maximumFractionDigits: 1 })}%`, hint: 'Rata-rata tertimbang' },
            ]}
          />
        </div>
      </PageHeader>

      <div className="grid gap-6 xl:grid-cols-2">
        <Panel title="Per sales" bodyClassName="overflow-x-auto">
          {marginTable(
            bySales.map(({ u, a }) => ({
              key: u.id,
              a,
              label: (
                <>
                  {u.name}
                  {u.status === 'INACTIVE' && <span className="ml-2 text-xs font-normal text-ink-3">nonaktif</span>}
                </>
              ),
            })),
            'Sales'
          )}
        </Panel>
        <Panel title="Per segmen customer" bodyClassName="overflow-x-auto">
          {marginTable(
            bySegment.map(({ s, label, a }) => ({ key: s, label, a })),
            'Segmen'
          )}
        </Panel>
      </div>

      <Panel title="Penawaran terbit" description="Diurutkan dari margin terendah." bodyClassName="">
        <QuotationTable
          quotations={quotations.filter(isTracked).sort((a, b) => a.grossMarginPercent - b.grossMarginPercent)}
          onOpen={open}
          showSales
          showMargin
        />
      </Panel>
    </div>
  );
}

// ───────────────────────────── Success rate (R14) ─────────────────────────────

function RateBar({ value }: { value: number | null }) {
  if (value === null) return <span className="text-ink-3">–</span>;
  return (
    <span className="inline-flex items-center justify-end gap-2">
      <span className="hidden h-1.5 w-16 overflow-hidden rounded-full bg-line sm:block" aria-hidden>
        <span className="block h-full rounded-full bg-emerald-600" style={{ width: `${Math.round(value * 100)}%` }} />
      </span>
      <span className="w-10 text-right font-semibold tabular-nums text-ink">{pct(value)}</span>
    </span>
  );
}

function SuccessTable({ first, rows }: { first: string; rows: { key: string; label: React.ReactNode; stats: SuccessStats }[] }) {
  if (!rows.length) return <p className="px-5 py-6 text-[13px] text-ink-3">Belum ada penawaran terbit.</p>;
  return (
    <table className="w-full min-w-[560px] text-left text-[13px]">
      <thead>
        <tr className="border-b border-line text-xs text-ink-3">
          <th className="px-5 py-2.5 font-medium">{first}</th>
          <th className="px-3 py-2.5 text-right font-medium">Terbit</th>
          <th className="px-3 py-2.5 text-right font-medium">Menang / kalah / batal</th>
          <th className="px-3 py-2.5 text-right font-medium">Nilai menang</th>
          <th className="px-5 py-2.5 text-right font-medium">Success rate</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-line">
        {rows.map(({ key, label, stats: s }) => (
          <tr key={key}>
            <td className="whitespace-nowrap px-5 py-3 font-semibold text-ink">{label}</td>
            <td className="px-3 py-3 text-right whitespace-nowrap tabular-nums text-ink-2">
              {s.total}
              {s.open > 0 && <span className="block text-xs text-ink-3">{s.open} berjalan</span>}
            </td>
            <td className="px-3 py-3 text-right whitespace-nowrap tabular-nums text-ink-2">
              <span className="text-emerald-700">{s.won}</span> / <span className="text-red-700">{s.lost}</span> / {s.cancelled}
            </td>
            <td className="px-3 py-3 text-right whitespace-nowrap font-semibold tabular-nums">{formatRupiah(s.valueWon)}</td>
            <td className="px-5 py-3 text-right">
              <RateBar value={s.rate} />
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function SuccessReport({ tabs, open }: TabProps) {
  const { quotations, users, products } = useStore();
  const live = quotations.filter(q => q.status !== 'REVISED');
  const all = successStats(live);
  const brandOf = new Map(products.map(p => [p.id, normalizeBrand(p.brand)]));

  const bySales = successBy(live, q => [q.salesId]).map(({ key, stats }) => ({
    key,
    stats,
    label: users.find(u => u.id === key)?.name ?? live.find(q => q.salesId === key)?.salesName ?? key,
  }));
  const byBrand = successBy(live, q => q.items.map(i => brandOf.get(i.productId) || 'Tanpa merek')).map(({ key, stats }) => ({ key, stats, label: key }));
  const bySegment = successBy(live, q => [q.customer.category ?? 'NONE']).map(({ key, stats }) => ({
    key,
    stats,
    label: SEGMENT_LABEL[key as CustomerCategory] ?? 'Tanpa segmen',
  }));
  const byMonth = successBy(live, q => {
    const d = issuedAt(q);
    return d ? [monthKey(d)] : [];
  })
    .sort((a, b) => b.key.localeCompare(a.key))
    .map(({ key, stats }) => ({ key, stats, label: monthLabel(key) }));

  const reasons = lostReasons(live);
  const reasonTotal = reasons.reduce((s, r) => s + r.count, 0);
  const stale = live.filter(q => needsFollowUp(q));

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Laporan"
        description="Success rate = penawaran menang dibagi penawaran yang sudah ada keputusan (menang, kalah, atau batal). Sumbernya update mingguan dari Sales."
      >
        <div className="flex flex-col gap-6">
          {tabs}
          <HeroStats
            items={[
              { label: 'Success rate', value: pct(all.rate), hint: `${all.won} menang dari ${all.won + all.lost + all.cancelled} keputusan` },
              { label: 'Nilai menang', value: formatRupiah(all.valueWon), hint: `${pct(all.valueRate)} dari nilai yang diputuskan` },
              { label: 'Masih berjalan', value: all.open, hint: 'Menunggu keputusan / negosiasi' },
              {
                label: 'Tanpa update',
                value: stale.length,
                hint: `Lebih dari ${FOLLOWUP_INTERVAL_DAYS} hari`,
                flag: stale.length ? 'Tagih' : undefined,
              },
            ]}
          />
        </div>
      </PageHeader>

      <div className="grid gap-6 xl:grid-cols-2">
        <Panel title="Per sales" bodyClassName="overflow-x-auto">
          <SuccessTable first="Sales" rows={bySales} />
        </Panel>
        <Panel title="Per merek" description="Satu penawaran dihitung di setiap merek yang ada di dalamnya." bodyClassName="overflow-x-auto">
          <SuccessTable first="Merek" rows={byBrand} />
        </Panel>
        <Panel title="Per segmen customer" bodyClassName="overflow-x-auto">
          <SuccessTable first="Segmen" rows={bySegment} />
        </Panel>
        <Panel title="Per bulan terbit" bodyClassName="overflow-x-auto">
          <SuccessTable first="Bulan" rows={byMonth} />
        </Panel>
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
        <Panel title="Alasan kalah">
          {reasons.length === 0 ? (
            <p className="text-[13px] text-ink-3">Belum ada penawaran yang kalah.</p>
          ) : (
            <ul className="space-y-3">
              {reasons.map(r => (
                <li key={r.reason} className="text-[13px]">
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="font-semibold text-ink">{LOST_REASON_LABEL[r.reason]}</span>
                    <span className="tabular-nums text-ink-2">
                      {r.count} · {pct(r.count / reasonTotal)}
                    </span>
                  </div>
                  <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-line" aria-hidden>
                    <div className="h-full rounded-full bg-red-600" style={{ width: `${(r.count / reasonTotal) * 100}%` }} />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel title="Belum ada update" description={`Penawaran terbit tanpa kabar lebih dari ${FOLLOWUP_INTERVAL_DAYS} hari.`} bodyClassName="">
          {stale.length === 0 ? (
            <p className="px-5 py-6 text-[13px] text-ink-3">Semua penawaran berjalan sudah di-update minggu ini.</p>
          ) : (
            <ul className="divide-y divide-line">
              {stale.map(q => (
                <li key={q.id}>
                  <button onClick={() => open(q)} className="flex w-full flex-wrap items-center justify-between gap-2 px-5 py-3 text-left text-[13px] hover:bg-canvas cursor-pointer">
                    <span className="min-w-0">
                      <span className="font-semibold text-ink">{q.customer.companyName}</span>
                      <span className="ml-2 font-mono text-ink-3">{q.quotationNumber}</span>
                    </span>
                    <span className="flex items-center gap-2 text-ink-2">
                      <OutcomeBadge q={q} />
                      {q.salesName}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>
    </div>
  );
}

// ───────────────────────────── Lama penawaran (R8) ─────────────────────────────

function DurationRow({ label, s, sla }: { label: React.ReactNode; s: DurationStats; sla?: boolean }) {
  return (
    <tr>
      <td className="whitespace-nowrap px-5 py-3 font-semibold text-ink">{label}</td>
      <td className="px-3 py-3 text-right whitespace-nowrap tabular-nums text-ink-2">{s.count}</td>
      <td className="px-3 py-3 text-right whitespace-nowrap tabular-nums">{dur(s.avg)}</td>
      <td className="px-3 py-3 text-right whitespace-nowrap tabular-nums">{dur(s.median)}</td>
      <td className="px-5 py-3 text-right whitespace-nowrap tabular-nums">{sla ? <RateBar value={s.withinSla} /> : <span className="text-ink-3">–</span>}</td>
    </tr>
  );
}

const DURATION_HEAD = (first: string) => (
  <thead>
    <tr className="border-b border-line text-xs text-ink-3">
      <th className="px-5 py-2.5 font-medium">{first}</th>
      <th className="px-3 py-2.5 text-right font-medium">Sampel</th>
      <th className="px-3 py-2.5 text-right font-medium">Rata-rata</th>
      <th className="px-3 py-2.5 text-right font-medium">Median</th>
      <th className="px-5 py-2.5 text-right font-medium">≤ 1 hari kerja</th>
    </tr>
  </thead>
);

function DurationReport({ tabs, open }: TabProps) {
  const { quotations } = useStore();
  const now = new Date();
  const rows = quotations.map(q => ({ q, d: quotationDurations(q, now) }));

  const review = durationStats(rows.flatMap(r => r.d.review), REVIEW_SLA_HOURS);
  const management = durationStats(rows.flatMap(r => r.d.management));
  const send = durationStats(rows.flatMap(r => r.d.send));
  const total = durationStats(rows.flatMap(r => (r.d.total === undefined ? [] : [r.d.total])));

  const reviewers = new Map<string, number[]>();
  for (const { q, d } of rows) {
    if (!q.reviewedBy || !d.review.length) continue;
    reviewers.set(q.reviewedBy, [...(reviewers.get(q.reviewedBy) ?? []), ...d.review]);
  }
  const byReviewer = [...reviewers.entries()]
    .map(([name, samples]) => ({ name, s: durationStats(samples, REVIEW_SLA_HOURS) }))
    .sort((a, b) => (a.s.avg ?? 0) - (b.s.avg ?? 0));

  const waiting = rows
    .filter(r => r.d.waitingHours !== undefined)
    .sort((a, b) => b.d.waitingHours! - a.d.waitingHours!);
  const overdue = waiting.filter(r => r.d.waitingFor === 'REVIEW' && r.d.waitingHours! > REVIEW_SLA_HOURS).length;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Laporan"
        description="Dihitung dalam jam kerja: Senin–Jumat 08.00–17.00 WIB (1 hari kerja = 9 jam). Target review Sales Support: 1 hari kerja."
      >
        <div className="flex flex-col gap-6">
          {tabs}
          <HeroStats
            items={[
              { label: 'Review Sales Support', value: dur(review.avg), hint: `Rata-rata · ${pct(review.withinSla)} tepat waktu` },
              { label: 'Keputusan Management', value: dur(management.avg), hint: `${management.count} eskalasi` },
              { label: 'Ajukan sampai terbit', value: dur(total.avg), hint: `Rata-rata · ${total.count} penawaran` },
              { label: 'Sedang menunggu', value: waiting.length, hint: 'Review atau Management', flag: overdue ? `${overdue} lewat target` : undefined },
            ]}
          />
        </div>
      </PageHeader>

      <div className="grid gap-6 xl:grid-cols-2">
        <Panel title="Per tahap" bodyClassName="overflow-x-auto">
          <table className="w-full min-w-[520px] text-left text-[13px]">
            {DURATION_HEAD('Tahap')}
            <tbody className="divide-y divide-line">
              <DurationRow label="Diajukan → keputusan Sales Support" s={review} sla />
              <DurationRow label="Diteruskan → keputusan Management" s={management} />
              <DurationRow label="Disetujui → dikirim ke WhatsApp" s={send} />
              <DurationRow label="Diajukan pertama → terbit" s={total} />
            </tbody>
          </table>
        </Panel>
        <Panel title="Review per Sales Support" bodyClassName="overflow-x-auto">
          {byReviewer.length === 0 ? (
            <p className="px-5 py-6 text-[13px] text-ink-3">Belum ada penawaran yang direview.</p>
          ) : (
            <table className="w-full min-w-[520px] text-left text-[13px]">
              {DURATION_HEAD('Sales Support')}
              <tbody className="divide-y divide-line">
                {byReviewer.map(({ name, s }) => (
                  <DurationRow key={name} label={name} s={s} sla />
                ))}
              </tbody>
            </table>
          )}
        </Panel>
      </div>

      <Panel title="Sedang menunggu" description="Diurutkan dari yang paling lama menunggu." bodyClassName="">
        {waiting.length === 0 ? (
          <p className="px-5 py-6 text-[13px] text-ink-3">Tidak ada penawaran yang menunggu review.</p>
        ) : (
          <ul className="divide-y divide-line">
            {waiting.map(({ q, d }) => {
              const late = d.waitingFor === 'REVIEW' && d.waitingHours! > REVIEW_SLA_HOURS;
              return (
                <li key={q.id}>
                  <button onClick={() => open(q)} className="flex w-full flex-wrap items-center justify-between gap-2 px-5 py-3 text-left text-[13px] hover:bg-canvas cursor-pointer">
                    <span className="min-w-0">
                      <span className="font-semibold text-ink">{q.customer.companyName}</span>
                      <span className="ml-2 font-mono text-ink-3">{q.quotationNumber}</span>
                      <span className="ml-2 text-ink-3">· {q.salesName}</span>
                    </span>
                    <span className="flex items-center gap-2">
                      <span className="text-ink-3">{d.waitingFor === 'MANAGEMENT' ? 'Di Management' : 'Di Sales Support'}</span>
                      <span className={late ? 'font-semibold tabular-nums text-red-700' : 'font-semibold tabular-nums text-ink'}>{formatWorkDuration(d.waitingHours!)}</span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </Panel>
    </div>
  );
}
