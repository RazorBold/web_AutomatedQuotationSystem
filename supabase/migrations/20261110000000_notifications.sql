-- Agusta Quotation System — in-app notifications (+ WhatsApp fan-out via Database Webhook)
-- Run after 20261109000000_init.sql.
--
-- Notifications are created by triggers on quotations / custom_requests, so every path that changes
-- a status (RPC, dashboard edit, future integrations) notifies the right people.
-- Changes made without a signed-in user (seed script, service role) do not notify.

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  type text not null check (type in (
    'QUOTATION_SUBMITTED', 'QUOTATION_RESUBMITTED', 'QUOTATION_APPROVED', 'QUOTATION_REJECTED',
    'CUSTOM_REQUEST_SUBMITTED', 'CUSTOM_REQUEST_PRICED', 'CUSTOM_REQUEST_APPROVED', 'CUSTOM_REQUEST_REJECTED'
  )),
  title text not null,
  body text not null default '',
  quotation_id uuid references public.quotations (id) on delete cascade,
  request_id uuid references public.custom_requests (id) on delete cascade,
  created_at timestamptz not null default now(),
  read_at timestamptz,
  -- Filled by /api/notification-webhook
  whatsapp_status text check (whatsapp_status in ('SKIPPED', 'SIMULATED', 'SENT', 'FAILED')),
  whatsapp_error text
);
create index if not exists notifications_user_idx on public.notifications (user_id, created_at desc);

alter table public.notifications enable row level security;
revoke insert, update, delete, truncate on public.notifications from anon, authenticated;

drop policy if exists "own notifications" on public.notifications;
create policy "own notifications" on public.notifications
  for select to authenticated using (user_id = auth.uid());

-- ───────────────────────────── Helpers ───────────────────────────
create or replace function public._notify(
  p_user uuid, p_type text, p_title text, p_body text, p_quotation uuid default null, p_request uuid default null
) returns void language sql security definer set search_path = public as $$
  insert into public.notifications (user_id, type, title, body, quotation_id, request_id)
  select p_user, p_type, p_title, coalesce(p_body, ''), p_quotation, p_request
   where p_user is not null and p_user is distinct from auth.uid()
$$;

create or replace function public._notify_reviewers(
  p_type text, p_title text, p_body text, p_quotation uuid default null, p_request uuid default null
) returns void language sql security definer set search_path = public as $$
  insert into public.notifications (user_id, type, title, body, quotation_id, request_id)
  select id, p_type, p_title, coalesce(p_body, ''), p_quotation, p_request
    from public.profiles
   where status = 'ACTIVE' and role in ('SALES_SUPPORT', 'MANAGEMENT') and id is distinct from auth.uid()
$$;

create or replace function public._rupiah(p bigint)
returns text language sql immutable as $$
  select 'Rp ' || replace(to_char(coalesce(p, 0), 'FM999G999G999G999'), ',', '.')
$$;

revoke execute on function public._notify(uuid, text, text, text, uuid, uuid) from public, anon, authenticated;
revoke execute on function public._notify_reviewers(text, text, text, uuid, uuid) from public, anon, authenticated;

-- ───────────────────────────── Triggers ──────────────────────────
-- Deferred to commit, so totals computed later in the same transaction are already in the row.
create or replace function public.quotations_notify()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  q public.quotations;
  v_ref text;
begin
  if auth.uid() is null then
    return null;
  end if;
  select * into q from public.quotations where id = new.id;
  if not found then
    return null;
  end if;
  v_ref := q.quotation_number || ' · ' || coalesce(q.customer ->> 'companyName', '-');

  if tg_op = 'INSERT' then
    if q.status = 'PENDING_REVIEW' then
      perform public._notify_reviewers('QUOTATION_SUBMITTED', 'Penawaran baru dari ' || q.sales_name,
        v_ref || ' · ' || public._rupiah(q.grand_total), q.id);
    end if;
    return null;
  end if;

  if old.status is not distinct from new.status then
    return null;
  end if;

  if new.status = 'PENDING_REVIEW' then
    perform public._notify_reviewers('QUOTATION_RESUBMITTED', q.sales_name || ' merevisi penawaran',
      v_ref || ' · ' || public._rupiah(q.grand_total), q.id);
  elsif new.status = 'APPROVED' then
    perform public._notify(q.sales_id, 'QUOTATION_APPROVED', 'Penawaran disetujui',
      v_ref || ' · ' || public._rupiah(q.grand_total) || '. PDF resmi sudah terbit.', q.id);
  elsif new.status = 'REJECTED' then
    perform public._notify(q.sales_id, 'QUOTATION_REJECTED', 'Penawaran perlu revisi',
      v_ref || ' · ' || coalesce(q.rejection_reason, ''), q.id);
  end if;
  return null;
end $$;

drop trigger if exists quotations_notify on public.quotations;
create constraint trigger quotations_notify
  after insert or update of status on public.quotations
  deferrable initially deferred
  for each row execute function public.quotations_notify();

create or replace function public.custom_requests_notify()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  r public.custom_requests;
begin
  if auth.uid() is null then
    return null;
  end if;
  select * into r from public.custom_requests where id = new.id;
  if not found then
    return null;
  end if;

  if tg_op = 'INSERT' then
    perform public._notify_reviewers('CUSTOM_REQUEST_SUBMITTED', 'Request barang custom dari ' || r.sales_name,
      r.product_name || ' · ' || r.estimated_qty || ' unit', null, r.id);
    return null;
  end if;

  if old.status is not distinct from new.status then
    return null;
  end if;

  if r.status = 'PRICED' then
    perform public._notify(r.sales_id, 'CUSTOM_REQUEST_PRICED', 'Harga barang custom sudah dihitung',
      r.product_name || ' · ' || public._rupiah(r.assigned_selling_price) || ' per unit', null, r.id);
  elsif r.status = 'APPROVED' then
    perform public._notify(r.sales_id, 'CUSTOM_REQUEST_APPROVED', 'Barang custom siap dipakai di penawaran',
      r.product_name || ' · ' || public._rupiah(r.assigned_selling_price) || ' per unit', null, r.id);
  elsif r.status = 'REJECTED' then
    perform public._notify(r.sales_id, 'CUSTOM_REQUEST_REJECTED', 'Barang custom tidak dapat diproses',
      r.product_name || coalesce(' · ' || r.support_notes, ''), null, r.id);
  end if;
  return null;
end $$;

drop trigger if exists custom_requests_notify on public.custom_requests;
create constraint trigger custom_requests_notify
  after insert or update of status on public.custom_requests
  deferrable initially deferred
  for each row execute function public.custom_requests_notify();

-- ───────────────────────────── RPC ───────────────────────────────
-- p_ids null → mark everything as read.
create or replace function public.mark_notifications_read(p_ids uuid[] default null)
returns void language sql security definer set search_path = public as $$
  update public.notifications set read_at = now()
   where user_id = auth.uid() and read_at is null and (p_ids is null or id = any (p_ids))
$$;
revoke execute on function public.mark_notifications_read(uuid[]) from public, anon;
grant execute on function public.mark_notifications_read(uuid[]) to authenticated;

-- ───────────────────────────── Realtime ──────────────────────────
do $$ begin
  alter publication supabase_realtime add table public.notifications;
exception when duplicate_object then null; when undefined_object then null; end $$;
