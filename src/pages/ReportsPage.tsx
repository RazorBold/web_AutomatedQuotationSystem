import React from 'react';
import { useStore } from '../store/AppStore';
import { HeroStats, PageHeader, Panel } from '../components/ui';
import { MarginValue, QuotationTable } from '../components/QuotationTable';
import { formatRupiah } from '../utils/quotationEngine';
import type { CustomerCategory, Quotation } from '../types';
import type { Route } from '../App';

const SEGMENT_LABEL: Record<CustomerCategory, string> = {
  CORPORATE: 'Korporasi',
  BUMN_GOV: 'BUMN / Pemerintah',
  EDUCATION: 'Pendidikan',
  RETAIL: 'Retail',
};

const issued = (q: Quotation) => q.status === 'APPROVED' || q.status === 'PDF_SENT';

function aggregate(list: Quotation[]) {
  const done = list.filter(issued);
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

export function ReportsPage({ navigate }: { navigate: (r: Route) => void }) {
  const { quotations, users } = useStore();
  const all = aggregate(quotations);

  const bySales = users
    .filter(u => u.role === 'SALES')
    .map(u => ({ u, a: aggregate(quotations.filter(q => q.salesId === u.id)) }))
    .filter(x => x.a.count > 0 || x.u.status === 'ACTIVE')
    .sort((a, b) => b.a.value - a.a.value);

  const bySegment = (Object.keys(SEGMENT_LABEL) as CustomerCategory[])
    .map(s => ({ s, a: aggregate(quotations.filter(q => q.customer.category === s)) }))
    .filter(x => x.a.count > 0);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Laporan margin"
        description="Dihitung dari penawaran yang sudah disetujui. Margin memakai nilai sebelum PPN, total penawaran memakai nilai dengan PPN."
      >
        <HeroStats
          items={[
            { label: 'Nilai penawaran terbit', value: formatRupiah(all.value), hint: `${all.issued} dari ${all.count} penawaran` },
            { label: 'Total HPP', value: formatRupiah(all.cogs), hint: 'Modal yang terikat' },
            { label: 'Laba kotor', value: formatRupiah(all.profit), hint: 'Sebelum biaya operasional' },
            { label: 'Margin kotor', value: `${all.margin.toLocaleString('id-ID', { maximumFractionDigits: 1 })}%`, hint: 'Rata-rata tertimbang' },
          ]}
        />
      </PageHeader>

      <div className="grid gap-6 xl:grid-cols-2">
        <Panel title="Per sales" bodyClassName="overflow-x-auto">
          <table className="w-full min-w-[480px] text-left text-[13px]">
            <thead>
              <tr className="border-b border-line text-xs text-ink-3">
                <th className="px-5 py-2.5 font-medium">Sales</th>
                <th className="px-3 py-2.5 text-right font-medium">Disetujui</th>
                <th className="px-3 py-2.5 text-right font-medium">Nilai terbit</th>
                <th className="px-5 py-2.5 text-right font-medium">Margin</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {bySales.map(({ u, a }) => (
                <tr key={u.id}>
                  <td className="px-5 py-3 font-semibold text-ink">
                    {u.name}
                    {u.status === 'INACTIVE' && <span className="ml-2 text-xs font-normal text-ink-3">nonaktif</span>}
                  </td>
                  <td className="px-3 py-3 text-right tabular-nums text-ink-2">
                    {a.issued}/{a.count}
                  </td>
                  <td className="px-3 py-3 text-right font-semibold tabular-nums">{formatRupiah(a.value)}</td>
                  <td className="px-5 py-3 text-right">{a.issued ? <MarginValue value={a.margin} /> : <span className="text-ink-3">–</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Panel>

        <Panel title="Per segmen customer" bodyClassName="overflow-x-auto">
          <table className="w-full min-w-[480px] text-left text-[13px]">
            <thead>
              <tr className="border-b border-line text-xs text-ink-3">
                <th className="px-5 py-2.5 font-medium">Segmen</th>
                <th className="px-3 py-2.5 text-right font-medium">Disetujui</th>
                <th className="px-3 py-2.5 text-right font-medium">Nilai terbit</th>
                <th className="px-5 py-2.5 text-right font-medium">Margin</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {bySegment.map(({ s, a }) => (
                <tr key={s}>
                  <td className="px-5 py-3 font-semibold text-ink">{SEGMENT_LABEL[s]}</td>
                  <td className="px-3 py-3 text-right tabular-nums text-ink-2">
                    {a.issued}/{a.count}
                  </td>
                  <td className="px-3 py-3 text-right font-semibold tabular-nums">{formatRupiah(a.value)}</td>
                  <td className="px-5 py-3 text-right">{a.issued ? <MarginValue value={a.margin} /> : <span className="text-ink-3">–</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Panel>
      </div>

      <Panel title="Penawaran terbit" description="Diurutkan dari margin terendah." bodyClassName="">
        <QuotationTable
          quotations={quotations.filter(issued).sort((a, b) => a.grossMarginPercent - b.grossMarginPercent)}
          onOpen={q => navigate({ view: 'quotation-detail', id: q.id })}
          showSales
          showMargin
        />
      </Panel>
    </div>
  );
}
