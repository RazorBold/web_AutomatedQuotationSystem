import React, { useMemo, useState } from 'react';
import { FilePlus2, Search, SearchX } from 'lucide-react';
import { useStore } from '../store/AppStore';
import { can } from '../auth/permissions';
import { Button, EmptyState, Input, PageHeader, Panel, Segmented } from '../components/ui';
import { QuotationTable } from '../components/QuotationTable';
import type { Quotation } from '../types';
import { needsFollowUp } from '../utils/analytics';
import type { Route } from '../App';

type Filter = 'ALL' | 'PENDING_REVIEW' | 'PENDING_MANAGEMENT' | 'DONE' | 'REJECTED' | 'DRAFT' | 'REVISED' | 'FOLLOWUP';
const matches = (f: Filter, q: Quotation) =>
  f === 'ALL'
    ? q.status !== 'REVISED'
    : f === 'DONE'
      ? q.status === 'APPROVED' || q.status === 'PDF_SENT'
      : f === 'FOLLOWUP'
        ? needsFollowUp(q)
        : q.status === f;

export function QuotationsPage({ navigate }: { navigate: (r: Route) => void }) {
  const { currentUser, quotations } = useStore();
  const isReviewer = can(currentUser, 'quotation:review');
  const isManagement = currentUser?.role === 'MANAGEMENT';
  const [filter, setFilter] = useState<Filter>(isManagement ? 'PENDING_MANAGEMENT' : isReviewer ? 'PENDING_REVIEW' : 'ALL');
  const [query, setQuery] = useState('');

  const scoped = useMemo(
    () =>
      can(currentUser, 'quotation:view-all')
        ? quotations.filter(q => q.status !== 'DRAFT') // a Sales rep's unfinished revision stays private
        : quotations.filter(q => q.salesId === currentUser?.id),
    [quotations, currentUser]
  );
  const list = scoped.filter(q => {
    const t = query.trim().toLowerCase();
    return (
      matches(filter, q) &&
      (!t ||
        q.quotationNumber.toLowerCase().includes(t) ||
        q.customer.companyName.toLowerCase().includes(t) ||
        q.salesName.toLowerCase().includes(t))
    );
  });
  const count = (f: Filter) => scoped.filter(q => matches(f, q)).length;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={isReviewer ? 'Antrean review' : 'Penawaran saya'}
        description={
          isReviewer
            ? 'Semua pengajuan penawaran dari tim Sales. Buka untuk mengatur HPP, harga final, dan persetujuan.'
            : 'Pantau status setiap penawaran yang Anda ajukan.'
        }
        actions={
          can(currentUser, 'quotation:create') && (
            <Button variant="primary" icon={<FilePlus2 className="size-4" />} onClick={() => navigate({ view: 'create-quotation' })}>
              Buat penawaran
            </Button>
          )
        }
      />

      <Panel bodyClassName="">
        <div className="flex flex-col gap-3 border-b border-line px-5 py-3.5 lg:flex-row lg:items-center lg:justify-between">
          <div className="overflow-x-auto">
            <Segmented
              label="Filter status"
              value={filter}
              onChange={setFilter}
              options={[
                ...(isReviewer || count('PENDING_MANAGEMENT')
                  ? [{ value: 'PENDING_MANAGEMENT' as Filter, label: 'Menunggu Management', count: count('PENDING_MANAGEMENT') }]
                  : []),
                { value: 'PENDING_REVIEW', label: 'Menunggu review', count: count('PENDING_REVIEW') },
                { value: 'REJECTED', label: 'Perlu revisi', count: count('REJECTED') },
                ...(!isReviewer && count('DRAFT') ? [{ value: 'DRAFT' as Filter, label: 'Draf revisi', count: count('DRAFT') }] : []),
                ...(count('FOLLOWUP') ? [{ value: 'FOLLOWUP' as Filter, label: 'Perlu update', count: count('FOLLOWUP') }] : []),
                { value: 'DONE', label: 'Disetujui', count: count('DONE') },
                ...(count('REVISED') ? [{ value: 'REVISED' as Filter, label: 'Arsip revisi', count: count('REVISED') }] : []),
                { value: 'ALL', label: 'Semua', count: count('ALL') },
              ]}
            />
          </div>
          <div className="relative w-full lg:w-72">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-3" />
            <Input
              aria-label="Cari penawaran"
              placeholder="Cari nomor, customer, atau sales"
              value={query}
              onChange={e => setQuery(e.target.value)}
              className="pl-9"
            />
          </div>
        </div>
        {list.length ? (
          <QuotationTable
            quotations={list}
            onOpen={q => navigate({ view: 'quotation-detail', id: q.id })}
            showSales={isReviewer}
            showMargin={can(currentUser, 'cogs:view')}
          />
        ) : (
          <EmptyState
            icon={<SearchX className="size-5" />}
            title={query ? `Tidak ada hasil untuk “${query}”` : 'Belum ada penawaran di status ini'}
            description={query ? 'Coba nomor penawaran atau nama customer yang lain.' : 'Pilih status lain di atas untuk melihat penawaran lainnya.'}
            action={
              query ? (
                <Button size="sm" onClick={() => setQuery('')}>
                  Hapus pencarian
                </Button>
              ) : undefined
            }
          />
        )}
      </Panel>
    </div>
  );
}
