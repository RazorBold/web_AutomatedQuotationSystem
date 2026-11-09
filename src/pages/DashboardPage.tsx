import React from 'react';
import { ArrowUpRight, FilePlus2, FileText, Inbox, PackageSearch } from 'lucide-react';
import { useStore } from '../store/AppStore';
import { can } from '../auth/permissions';
import { Button, EmptyState, HeroStats, PageHeader, Panel, StatusBadge } from '../components/ui';
import { MarginMeter, MARGIN_FLOOR, QuotationTable } from '../components/QuotationTable';
import { formatRupiah } from '../utils/quotationEngine';
import type { Route } from '../App';

function greeting() {
  const h = new Date().getHours();
  if (h < 11) return 'Selamat pagi';
  if (h < 15) return 'Selamat siang';
  if (h < 19) return 'Selamat sore';
  return 'Selamat malam';
}

function Initials({ name }: { name: string }) {
  const text = name
    .replace(/^(PT|CV|UD)\s+/i, '')
    .split(/\s+/)
    .slice(0, 2)
    .map(w => w[0])
    .join('')
    .toUpperCase();
  return (
    <span aria-hidden className="hidden size-10 shrink-0 sm:flex items-center justify-center rounded-lg bg-brand-soft text-[13px] font-bold text-brand-ink">
      {text}
    </span>
  );
}

export function DashboardPage({ navigate }: { navigate: (r: Route) => void }) {
  const { currentUser, quotations, customRequests } = useStore();
  if (!currentUser) return null;
  const firstName = currentUser.name.split(' ')[0];
  const isReviewer = can(currentUser, 'quotation:review');
  const open = (id: string) => navigate({ view: 'quotation-detail', id });

  const approvedValue = (list: typeof quotations) =>
    formatRupiah(list.filter(q => q.status === 'APPROVED' || q.status === 'PDF_SENT').reduce((s, q) => s + q.grandTotal, 0));

  if (!isReviewer) {
    const mine = quotations.filter(q => q.salesId === currentUser.id);
    const rejected = mine.filter(q => q.status === 'REJECTED');
    const ready = mine.filter(q => q.status === 'APPROVED' || q.status === 'PDF_SENT');

    return (
      <div className="flex flex-col gap-6">
        <PageHeader
          title={`${greeting()}, ${firstName}`}
          description="Lanjutkan penawaran yang perlu Anda tindak lanjuti, atau mulai yang baru."
          actions={
            <Button variant="primary" icon={<FilePlus2 className="size-4" />} onClick={() => navigate({ view: 'create-quotation' })}>
              Buat penawaran
            </Button>
          }
        >
          <HeroStats
            items={[
              { label: 'Menunggu review', value: mine.filter(q => q.status === 'PENDING_REVIEW').length },
              { label: 'Perlu revisi', value: rejected.length, flag: rejected.length ? 'Tindak lanjuti' : undefined },
              { label: 'PDF siap dikirim', value: ready.length },
              { label: 'Nilai disetujui', value: approvedValue(mine) },
            ]}
          />
        </PageHeader>

        <div className="grid gap-6 xl:grid-cols-[3fr_2fr]">
          <Panel title="Perlu tindakan Anda" bodyClassName="">
            {rejected.length + ready.length === 0 ? (
              <EmptyState
                icon={<Inbox className="size-5" />}
                title="Tidak ada yang menunggu Anda"
                description="Penawaran yang dikembalikan atau PDF yang sudah terbit akan muncul di sini."
              />
            ) : (
              <ul className="divide-y divide-line">
                {rejected.map(q => (
                  <li key={q.id} className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-semibold text-ink">{q.customer.companyName}</span>
                        <StatusBadge status={q.status} />
                      </div>
                      <p className="mt-1 text-[13px] text-ink-2">
                        <span className="font-medium text-ink">{q.reviewedBy}:</span> {q.rejectionReason}
                      </p>
                    </div>
                    <Button size="sm" variant="secondary" onClick={() => navigate({ view: 'create-quotation', id: q.id })}>
                      Revisi penawaran
                    </Button>
                  </li>
                ))}
                {ready.map(q => (
                  <li key={q.id} className="flex items-center justify-between gap-3 px-5 py-4">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-semibold text-ink">{q.customer.companyName}</span>
                        <StatusBadge status={q.status} />
                      </div>
                      <p className="mt-0.5 text-[13px] text-ink-3">
                        <span className="font-mono">{q.quotationNumber}</span> · {formatRupiah(q.grandTotal)}
                      </p>
                    </div>
                    <Button size="sm" variant="ghost" icon={<FileText className="size-4" />} onClick={() => open(q.id)}>
                      Lihat PDF
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </Panel>

          <Panel title="Tidak menemukan produk?">
            <p className="text-[13px] leading-relaxed text-ink-2">
              Ajukan spesifikasi barang di luar katalog. Sales Support akan menghitung HPP dan harga jualnya, lalu barang bisa
              dipakai di penawaran.
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              <Button size="sm" icon={<PackageSearch className="size-4" />} onClick={() => navigate({ view: 'catalog' })}>
                Cari di katalog
              </Button>
              <Button size="sm" variant="ghost" onClick={() => navigate({ view: 'custom-requests' })}>
                Ajukan barang custom
              </Button>
            </div>
          </Panel>
        </div>

        <Panel
          title="Penawaran terbaru"
          bodyClassName=""
          actions={
            <Button size="sm" variant="ghost" onClick={() => navigate({ view: 'quotations' })}>
              Lihat semua
            </Button>
          }
        >
          {mine.length ? (
            <QuotationTable quotations={mine.slice(0, 5)} onOpen={q => open(q.id)} />
          ) : (
            <EmptyState
              icon={<FileText className="size-5" />}
              title="Belum ada penawaran"
              description="Penawaran pertama Anda akan tampil di sini setelah diajukan."
              action={
                <Button variant="primary" size="sm" onClick={() => navigate({ view: 'create-quotation' })}>
                  Buat penawaran
                </Button>
              }
            />
          )}
        </Panel>
      </div>
    );
  }

  // Sales Support / Management
  const queue = quotations.filter(q => q.status === 'PENDING_REVIEW');
  const belowFloor = queue.filter(q => q.grossMarginPercent < MARGIN_FLOOR);
  const pricing = customRequests.filter(r => r.status === 'PENDING_PRICING');
  const toSend = quotations.filter(q => q.status === 'APPROVED');
  const activity = quotations
    .flatMap(q => (q.history ?? []).map(h => ({ ...h, q })))
    .slice(-50)
    .reverse()
    .slice(0, 6);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={`${greeting()}, ${firstName}`}
        description={
          queue.length
            ? `${queue.length} penawaran menunggu review Anda.`
            : 'Antrean review kosong. Semua pengajuan sudah ditangani.'
        }
        actions={
          queue.length > 0 && (
            <Button variant="primary" onClick={() => open(queue[queue.length - 1]!.id)}>
              Mulai review
            </Button>
          )
        }
      >
        <HeroStats
          items={[
            { label: 'Menunggu review', value: queue.length },
            { label: `Margin di bawah ${MARGIN_FLOOR}%`, value: belowFloor.length, flag: belowFloor.length ? 'Perlu dicek' : undefined },
            { label: 'Disetujui, belum dikirim', value: toSend.length },
            { label: 'Nilai disetujui', value: approvedValue(quotations) },
          ]}
        />
      </PageHeader>

      <div className="grid gap-6 xl:grid-cols-[2fr_1fr]">
        <Panel title="Antrean review" description="Yang paling lama menunggu ada di atas." bodyClassName="" className="self-start">
          {queue.length === 0 ? (
            <EmptyState icon={<Inbox className="size-5" />} title="Antrean kosong" description="Pengajuan baru dari Sales akan muncul di sini." />
          ) : (
            <ul className="divide-y divide-line">
              {[...queue].reverse().map(q => (
                <li key={q.id}>
                  <button
                    onClick={() => open(q.id)}
                    className="group flex w-full items-center gap-4 px-5 py-4 text-left transition-colors hover:bg-canvas cursor-pointer"
                  >
                    <Initials name={q.customer.companyName} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-semibold text-ink group-hover:text-brand-ink">{q.customer.companyName}</span>
                      <span className="block truncate text-[13px] text-ink-3">
                        <span className="font-mono">{q.quotationNumber}</span> · {q.salesName} · {q.items.length} item
                      </span>
                    </span>
                    <span className="hidden w-40 shrink-0 md:block">
                      <MarginMeter value={q.grossMarginPercent} />
                    </span>
                    <span className="shrink-0 text-right sm:w-36">
                      <span className="block font-semibold tabular-nums text-ink">{formatRupiah(q.grandTotal)}</span>
                      <span className="block text-xs text-ink-3">{q.date}</span>
                    </span>
                    <ArrowUpRight className="hidden size-4 shrink-0 text-ink-3 transition-colors group-hover:text-brand sm:block" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <div className="flex flex-col gap-6">
          <Panel
            title="Barang custom"
            description={pricing.length ? `${pricing.length} menunggu perhitungan harga` : 'Semua request sudah diberi harga'}
            actions={
              <Button size="sm" variant="ghost" onClick={() => navigate({ view: 'custom-requests' })}>
                Buka
              </Button>
            }
            bodyClassName=""
          >
            {pricing.length > 0 && (
              <ul className="divide-y divide-line">
                {pricing.slice(0, 3).map(r => (
                  <li key={r.id} className="px-5 py-3">
                    <p className="line-clamp-1 text-[13px] font-semibold text-ink">{r.productName}</p>
                    <p className="text-xs text-ink-3">
                      {r.salesName} · {r.estimatedQty} unit · target {formatRupiah(r.targetPricePerUnit)}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </Panel>

          <Panel title="Aktivitas terakhir" bodyClassName="px-5 py-3">
            <ol className="relative ml-1 border-l border-line py-1">
              {activity.map((a, i) => (
                <li key={i} className="relative py-2.5 pl-5">
                  <span aria-hidden className={`absolute -left-[4.5px] top-[15px] size-2 rounded-full ring-2 ring-surface ${i === 0 ? 'bg-brand' : 'bg-line-strong'}`} />
                  <button onClick={() => open(a.q.id)} className="text-left text-[13px] font-medium text-ink hover:text-link cursor-pointer">
                    {a.q.customer.companyName}
                  </button>
                  <p className="text-xs text-ink-2">{a.label}</p>
                  <p className="text-xs text-ink-3">
                    {a.by} · {a.at}
                  </p>
                </li>
              ))}
            </ol>
          </Panel>
        </div>
      </div>
    </div>
  );
}
