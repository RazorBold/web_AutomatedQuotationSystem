-- Agusta Quotation System — revisi tahap 3
-- Run after 20261118000000_tahap2_workflow.sql.
--
-- R13  Sales records what happened with the customer after the quotation was sent (weekly).
--      A cron job (api/followup-reminders.ts) reminds reps whose open quotations have no update for 7 days.
-- R14/R8 analytics are computed in the app from these updates and the quotation history.

alter table public.quotations add column if not exists outcome text
  check (outcome is null or outcome in ('WAITING', 'NEGOTIATION', 'WON', 'LOST', 'CANCELLED'));
alter table public.quotations add column if not exists last_followup_at timestamptz;

create table if not exists public.quotation_followups (
  id uuid primary key default gen_random_uuid(),
  quotation_id uuid not null references public.quotations (id) on delete cascade,
  status text not null check (status in ('WAITING', 'NEGOTIATION', 'WON', 'LOST', 'CANCELLED')),
  note text not null default '',
  po_value bigint check (po_value is null or po_value >= 0),
  lost_reason text check (lost_reason is null or lost_reason in ('PRICE', 'COMPETITOR', 'BUDGET', 'SPEC', 'OTHER')),
  created_by uuid references public.profiles (id),
  created_by_name text not null,
  created_at timestamptz not null default now()
);
create index if not exists quotation_followups_quotation_idx on public.quotation_followups (quotation_id, created_at);

alter table public.quotation_followups enable row level security;
revoke insert, update, delete, truncate on public.quotation_followups from anon, authenticated;
drop policy if exists "followups follow quotation" on public.quotation_followups;
create policy "followups follow quotation" on public.quotation_followups
  for select to authenticated using (
    exists (select 1 from public.quotations q where q.id = quotation_id
            and (public.is_reviewer() or (public.app_role() = 'SALES' and q.sales_id = auth.uid())))
  );

-- The owning Sales rep (or Sales Support / Management on their behalf) posts an update.
create or replace function public.add_quotation_followup(
  p_id uuid, p_status text, p_note text default '', p_po_value bigint default null, p_lost_reason text default null
) returns void language plpgsql security definer set search_path = public as $$
declare
  q public.quotations;
begin
  select * into q from public.quotations where id = p_id for update;
  if not found then
    raise exception 'Penawaran tidak ditemukan.';
  end if;
  if not (public.is_reviewer() or (public.app_role() = 'SALES' and q.sales_id = auth.uid())) then
    raise exception 'Anda tidak memiliki akses untuk meng-update penawaran ini.' using errcode = '42501';
  end if;
  if q.status not in ('APPROVED', 'PDF_SENT') then
    raise exception 'Update hanya untuk penawaran yang sudah disetujui/terkirim.';
  end if;
  if p_status not in ('WAITING', 'NEGOTIATION', 'WON', 'LOST', 'CANCELLED') then
    raise exception 'Status update tidak valid.';
  end if;
  if p_status in ('LOST', 'CANCELLED') and length(trim(coalesce(p_note, ''))) < 5 and p_lost_reason is null then
    raise exception 'Tulis alasan kalah/batal.';
  end if;
  if p_status = 'LOST' and p_lost_reason is null then
    raise exception 'Pilih alasan kalah.';
  end if;
  if p_status in ('WAITING', 'NEGOTIATION') and length(trim(coalesce(p_note, ''))) < 5 then
    raise exception 'Tulis perkembangan terbaru minimal 5 karakter.';
  end if;

  insert into public.quotation_followups (quotation_id, status, note, po_value, lost_reason, created_by, created_by_name)
  values (p_id, p_status, trim(coalesce(p_note, '')),
          case when p_status = 'WON' then nullif(greatest(coalesce(p_po_value, 0), 0), 0) end,
          case when p_status = 'LOST' then p_lost_reason end,
          auth.uid(), public.app_user_name());

  update public.quotations
     set outcome = p_status, last_followup_at = now(), updated_at = now()
   where id = p_id;
end $$;
revoke execute on function public.add_quotation_followup(uuid, text, text, bigint, text) from public, anon;
grant execute on function public.add_quotation_followup(uuid, text, text, bigint, text) to authenticated;

-- Weekly reminders (called by the server cron with the service role).
alter table public.notifications drop constraint if exists notifications_type_check;
alter table public.notifications add constraint notifications_type_check check (type in (
  'QUOTATION_SUBMITTED', 'QUOTATION_RESUBMITTED', 'QUOTATION_APPROVED', 'QUOTATION_REJECTED',
  'CUSTOM_REQUEST_SUBMITTED', 'CUSTOM_REQUEST_PRICED', 'CUSTOM_REQUEST_APPROVED', 'CUSTOM_REQUEST_REJECTED',
  'QUOTATION_ESCALATED', 'QUOTATION_MGMT_DECIDED', 'CUSTOM_REQUEST_ESCALATED', 'CUSTOM_REQUEST_MGMT_DECIDED',
  'FOLLOWUP_REMINDER'
));

-- One reminder per Sales rep listing their open quotations without an update for 7 days.
create or replace function public.send_followup_reminders()
returns integer language plpgsql security definer set search_path = public as $$
declare
  v_count integer := 0;
  r record;
begin
  for r in
    select q.sales_id,
           count(*) as n,
           string_agg(q.quotation_number || ' · ' || coalesce(q.customer ->> 'companyName', '-'), '; ' order by q.reviewed_at) as list
      from public.quotations q
      join public.profiles p on p.id = q.sales_id and p.status = 'ACTIVE'
     where q.status in ('APPROVED', 'PDF_SENT')
       and coalesce(q.outcome, 'WAITING') in ('WAITING', 'NEGOTIATION')
       and coalesce(q.last_followup_at, q.reviewed_at, q.created_at) < now() - interval '7 days'
     group by q.sales_id
  loop
    insert into public.notifications (user_id, type, title, body)
    values (r.sales_id, 'FOLLOWUP_REMINDER', r.n || ' penawaran perlu update minggu ini', left(r.list, 600));
    v_count := v_count + 1;
  end loop;
  return v_count;
end $$;
revoke execute on function public.send_followup_reminders() from public, anon, authenticated;
grant execute on function public.send_followup_reminders() to service_role;
