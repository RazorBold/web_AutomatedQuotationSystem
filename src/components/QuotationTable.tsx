import React from 'react';
import { ChevronRight } from 'lucide-react';
import type { Quotation } from '../types';
import { StatusBadge, cx } from './ui';
import { formatRupiah } from '../utils/quotationEngine';

export const MARGIN_FLOOR = 12;

export function MarginValue({ value, className }: { value: number; className?: string }) {
  const tone = value < MARGIN_FLOOR ? 'text-brand-strong' : value < 18 ? 'text-amber-700' : 'text-emerald-700';
  return (
    <span className={cx('font-semibold tabular-nums', tone, className)}>
      {value.toLocaleString('id-ID', { maximumFractionDigits: 1 })}%
    </span>
  );
}

/** Margin against the safety floor: a short track scaled to 40%, with the floor marked. */
export function MarginMeter({ value }: { value: number }) {
  const max = 40;
  const pct = Math.max(0, Math.min(100, (value / max) * 100));
  const floorPct = (MARGIN_FLOOR / max) * 100;
  const tone = value < MARGIN_FLOOR ? 'bg-brand' : value < 18 ? 'bg-amber-500' : 'bg-emerald-500';
  return (
    <span className="flex flex-col gap-1">
      <span className="flex items-baseline justify-between text-xs">
        <span className="text-ink-3">Margin</span>
        <MarginValue value={value} className="text-xs" />
      </span>
      <span className="relative h-1.5 rounded-full bg-canvas ring-1 ring-inset ring-line" role="img" aria-label={`Margin ${value.toLocaleString('id-ID')}%, batas ${MARGIN_FLOOR}%`}>
        <span className={cx('absolute inset-y-0 left-0 rounded-full', tone)} style={{ width: `${pct}%` }} />
        <span className="absolute -inset-y-0.5 w-px bg-ink/50" style={{ left: `${floorPct}%` }} />
      </span>
    </span>
  );
}

export function QuotationTable({
  quotations,
  onOpen,
  showSales,
  showMargin,
}: {
  quotations: Quotation[];
  onOpen: (q: Quotation) => void;
  showSales?: boolean;
  showMargin?: boolean;
}) {
  return (
    <>
      {/* Desktop table */}
      <table className="hidden w-full text-left text-sm md:table">
        <thead>
          <tr className="border-b border-line text-xs text-ink-3">
            <th className="px-5 py-3 font-medium">Penawaran</th>
            <th className="px-3 py-3 font-medium">Customer</th>
            {showSales && <th className="px-3 py-3 font-medium">Sales</th>}
            <th className="px-3 py-3 text-right font-medium">Nilai (inc. PPN)</th>
            {showMargin && <th className="px-3 py-3 text-right font-medium">Margin</th>}
            <th className="px-3 py-3 font-medium">Status</th>
            <th className="w-10" />
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {quotations.map(q => (
            <tr
              key={q.id}
              onClick={() => onOpen(q)}
              className="group cursor-pointer transition-colors hover:bg-canvas"
            >
              <td className="px-5 py-3.5">
                <button
                  onClick={e => {
                    e.stopPropagation();
                    onOpen(q);
                  }}
                  className="font-mono text-[13px] font-medium text-ink hover:text-link cursor-pointer"
                >
                  {q.quotationNumber}
                </button>
                <p className="text-xs text-ink-3">{q.date}</p>
              </td>
              <td className="px-3 py-3.5">
                <p className="font-semibold text-ink">{q.customer.companyName}</p>
                <p className="text-xs text-ink-3">{q.customer.city}</p>
              </td>
              {showSales && <td className="px-3 py-3.5 text-ink-2">{q.salesName}</td>}
              <td className="px-3 py-3.5 text-right font-semibold tabular-nums text-ink">{formatRupiah(q.grandTotal)}</td>
              {showMargin && (
                <td className="px-3 py-3.5 text-right">
                  <MarginValue value={q.grossMarginPercent} />
                </td>
              )}
              <td className="px-3 py-3.5">
                <StatusBadge status={q.status} />
              </td>
              <td className="pr-4">
                <ChevronRight className="size-4 text-ink-3 opacity-0 transition-opacity group-hover:opacity-100" />
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Mobile list */}
      <ul className="divide-y divide-line md:hidden">
        {quotations.map(q => (
          <li key={q.id}>
            <button onClick={() => onOpen(q)} className="flex w-full flex-col gap-1.5 px-4 py-3.5 text-left hover:bg-canvas cursor-pointer">
              <span className="flex items-center justify-between gap-3">
                <span className="font-mono text-[13px] text-ink-2">{q.quotationNumber}</span>
                <StatusBadge status={q.status} />
              </span>
              <span className="font-semibold text-ink">{q.customer.companyName}</span>
              <span className="flex items-center justify-between text-[13px]">
                <span className="text-ink-3">{showSales ? q.salesName : q.date}</span>
                <span className="font-semibold tabular-nums text-ink">{formatRupiah(q.grandTotal)}</span>
              </span>
            </button>
          </li>
        ))}
      </ul>
    </>
  );
}
