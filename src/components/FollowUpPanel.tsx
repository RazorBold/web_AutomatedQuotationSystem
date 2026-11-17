import React, { useState } from 'react';
import { CalendarClock } from 'lucide-react';
import type { FollowUpStatus, LostReason, Quotation } from '../types';
import { errorMessage, useStore } from '../store/AppStore';
import { can } from '../auth/permissions';
import { FOLLOWUP_INTERVAL_DAYS, FOLLOWUP_LABEL, LOST_REASON_LABEL, lastFollowUpAt, needsFollowUp } from '../utils/analytics';
import { formatRupiah } from '../utils/quotationEngine';
import { RupiahInput } from './DiscountInput';
import { Badge, Button, Field, Panel, Select, Textarea } from './ui';

const TONE: Record<FollowUpStatus, 'gray' | 'amber' | 'green' | 'red' | 'blue'> = {
  WAITING: 'gray',
  NEGOTIATION: 'blue',
  WON: 'green',
  LOST: 'red',
  CANCELLED: 'gray',
};

export function OutcomeBadge({ q }: { q: Quotation }) {
  if (!q.outcome) return null;
  return <Badge tone={TONE[q.outcome]}>{FOLLOWUP_LABEL[q.outcome]}</Badge>;
}

/**
 * R13: what happened with the customer after the PDF went out. Sales posts an update at least
 * weekly until the quotation is won, lost or cancelled; the history feeds the success-rate report.
 */
export function FollowUpPanel({ q }: { q: Quotation }) {
  const { currentUser, addQuotationFollowUp, notify } = useStore();
  const canUpdate = can(currentUser, 'quotation:review') || (currentUser?.role === 'SALES' && q.salesId === currentUser.id);
  const [status, setStatus] = useState<FollowUpStatus>(q.outcome && q.outcome !== 'WAITING' ? q.outcome : 'NEGOTIATION');
  const [note, setNote] = useState('');
  const [poValue, setPoValue] = useState(0);
  const [lostReason, setLostReason] = useState<LostReason>('PRICE');
  const [saving, setSaving] = useState(false);
  const due = needsFollowUp(q);
  const last = lastFollowUpAt(q);
  const updates = [...(q.followUps ?? [])].reverse();

  const save = async () => {
    setSaving(true);
    try {
      await addQuotationFollowUp(q.id, {
        status,
        note,
        poValue: status === 'WON' ? poValue || undefined : undefined,
        lostReason: status === 'LOST' ? lostReason : undefined,
      });
      notify('Update penawaran disimpan.');
      setNote('');
      setPoValue(0);
    } catch (e) {
      notify(errorMessage(e), 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Panel title="Perkembangan penawaran" description={`Update minimal setiap ${FOLLOWUP_INTERVAL_DAYS} hari sampai menang, kalah, atau batal.`} actions={<OutcomeBadge q={q} />}>
      {due && (
        <p className="mb-3 flex items-start gap-2 rounded-lg bg-amber-50 px-3 py-2 text-[13px] text-amber-900">
          <CalendarClock className="mt-0.5 size-4 shrink-0" />
          Belum ada update sejak {last ? last.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' }) : 'penawaran terbit'}.
        </p>
      )}

      {updates.length > 0 ? (
        <ol className="mb-4 space-y-2.5">
          {updates.map(f => (
            <li key={f.id} className="rounded-lg bg-canvas px-3 py-2 text-[13px]">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="font-semibold text-ink">{FOLLOWUP_LABEL[f.status]}</span>
                <span className="text-xs text-ink-3">
                  {f.by} · {f.at}
                </span>
              </div>
              {f.status === 'WON' && f.poValue ? <p className="mt-0.5 tabular-nums text-emerald-800">Nilai PO {formatRupiah(f.poValue)}</p> : null}
              {f.status === 'LOST' && f.lostReason && <p className="mt-0.5 text-red-800">Alasan: {LOST_REASON_LABEL[f.lostReason]}</p>}
              {f.note && <p className="mt-0.5 leading-relaxed text-ink-2">{f.note}</p>}
            </li>
          ))}
        </ol>
      ) : (
        <p className="mb-4 text-[13px] text-ink-3">Belum ada update dari Sales.</p>
      )}

      {canUpdate && (
        <div className="flex flex-col gap-3 border-t border-line pt-4">
          <Field label="Status terbaru">
            {p => (
              <Select {...p} value={status} onChange={e => setStatus(e.target.value as FollowUpStatus)}>
                {(Object.keys(FOLLOWUP_LABEL) as FollowUpStatus[]).map(s => (
                  <option key={s} value={s}>
                    {FOLLOWUP_LABEL[s]}
                  </option>
                ))}
              </Select>
            )}
          </Field>
          {status === 'WON' && (
            <Field label="Nilai PO" optional hint="Kosongkan bila sama dengan nilai penawaran.">
              {() => <RupiahInput label="Nilai PO" value={poValue} onChange={setPoValue} className="h-10 w-full text-[14px]" />}
            </Field>
          )}
          {status === 'LOST' && (
            <Field label="Alasan kalah">
              {p => (
                <Select {...p} value={lostReason} onChange={e => setLostReason(e.target.value as LostReason)}>
                  {(Object.keys(LOST_REASON_LABEL) as LostReason[]).map(r => (
                    <option key={r} value={r}>
                      {LOST_REASON_LABEL[r]}
                    </option>
                  ))}
                </Select>
              )}
            </Field>
          )}
          <Field label="Catatan" optional={status === 'WON' || status === 'LOST'}>
            {p => (
              <Textarea
                {...p}
                rows={2}
                value={note}
                onChange={e => setNote(e.target.value)}
                placeholder={
                  status === 'NEGOTIATION'
                    ? 'Contoh: Customer minta harga final untuk 15 unit, keputusan Jumat.'
                    : status === 'WON'
                      ? 'Contoh: PO No. 123/PO/XI/2026 diterima.'
                      : 'Perkembangan terbaru…'
                }
              />
            )}
          </Field>
          <Button onClick={save} loading={saving} className="self-end">
            Simpan update
          </Button>
        </div>
      )}
    </Panel>
  );
}
