-- Agusta Quotation System — quotation letter in Agusta's own format
-- Run after 20261121000000_airtable_catalog.sql.
--
-- * Number like Agusta's letters: 0088/FHM/AG/VIII/26 (running number per letter code per year,
--   code = the Sales person's "kode surat"). Revisions keep the number (…-R1 internally) and the
--   letter says "Penawaran Harga (Revisi 1)".
-- * tax_mode:      ADDED (PPN 11% line), INCLUDED (prices shown incl. PPN, no PPN line),
--                  EXCLUDED (no PPN, "harga belum termasuk PPN"). show_tax stays in sync:
--                  false only for EXCLUDED (the customer's total is then the pre-tax subtotal).
-- * discount_mode: PERCENT, AMOUNT (rupiah per line), HIDDEN (net unit price). show_discount in sync.
-- * letter_terms / payment_terms: the "Keterangan" and "Termin pembayaran" of the letter.
-- * Charges (jasa pasang, ongkir, …) get a description and may be 0 = printed "Termasuk".
-- Sales sets the letter format on its own draft/pending quotation; Sales Support may change it at review.

-- ───────────────────────────── Letter code & numbering ──────────
alter table public.profiles add column if not exists quote_code text;
alter table public.profiles drop constraint if exists profiles_quote_code_check;
alter table public.profiles add constraint profiles_quote_code_check check (quote_code is null or quote_code ~ '^[A-Z]{2,5}$');

create table if not exists public.quotation_counters (
  code text not null,
  year integer not null,
  last_no integer not null default 0 check (last_no >= 0),
  primary key (code, year)
);
alter table public.quotation_counters enable row level security;
revoke all on public.quotation_counters from anon, authenticated;

create or replace function public._roman_month(p_month integer)
returns text language sql immutable as $$
  select (array['I','II','III','IV','V','VI','VII','VIII','IX','X','XI','XII'])[p_month]
$$;

-- A Sales person's letter code: their own, else their initials, else AG.
create or replace function public._quote_code(p_user uuid)
returns text language sql stable security definer set search_path = public as $$
  select coalesce(
    (select case when quote_code ~ '^[A-Z]{2,5}$' then quote_code end from public.profiles where id = p_user),
    (select case when upper(avatar) ~ '^[A-Z]{2,5}$' then upper(avatar) end from public.profiles where id = p_user),
    'AG')
$$;

-- New (non-revision) quotations get the next Agusta number; submit_quotation still inserts a QTN- placeholder.
create or replace function public._assign_quotation_number()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_code text;
  v_day date := coalesce(new.issued_on, (now() at time zone 'Asia/Jakarta')::date);
  v_no integer;
  v_number text;
begin
  if new.revision_of is not null or new.quotation_number not like 'QTN-%' then
    return new;
  end if;
  v_code := public._quote_code(new.sales_id);
  loop
    insert into public.quotation_counters (code, year, last_no)
    values (v_code, extract(year from v_day)::integer, 1)
    on conflict (code, year) do update set last_no = public.quotation_counters.last_no + 1
    returning last_no into v_no;
    v_number := lpad(v_no::text, 4, '0') || '/' || v_code || '/AG/' || public._roman_month(extract(month from v_day)::integer)
                || '/' || to_char(v_day, 'YY');
    exit when not exists (select 1 from public.quotations where quotation_number = v_number);
  end loop;
  new.quotation_number := v_number;
  return new;
end $$;

drop trigger if exists assign_quotation_number on public.quotations;
create trigger assign_quotation_number before insert on public.quotations
  for each row execute function public._assign_quotation_number();

-- Management: a Sales person's letter code and, optionally, the last number already used this year
-- (so the portal continues Agusta's existing count).
create or replace function public.set_quote_code(p_user uuid, p_code text, p_last_no integer default null)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_code text := nullif(upper(trim(coalesce(p_code, ''))), '');
begin
  if public.app_role() is distinct from 'MANAGEMENT' then
    raise exception 'Hanya Management yang dapat mengatur kode surat.' using errcode = '42501';
  end if;
  if v_code is not null and v_code !~ '^[A-Z]{2,5}$' then
    raise exception 'Kode surat 2–5 huruf, mis. FHM.';
  end if;
  update public.profiles set quote_code = v_code where id = p_user;
  if p_last_no is not null then
    if p_last_no < 0 or p_last_no > 9999 then
      raise exception 'Nomor surat terakhir harus 0–9999.';
    end if;
    insert into public.quotation_counters (code, year, last_no)
    values (public._quote_code(p_user), extract(year from (now() at time zone 'Asia/Jakarta'))::integer, p_last_no)
    on conflict (code, year) do update set last_no = excluded.last_no;
  end if;
end $$;
revoke execute on function public.set_quote_code(uuid, text, integer) from public, anon;
grant execute on function public.set_quote_code(uuid, text, integer) to authenticated;

-- Last number used this year per code (Management sees it on the Users page).
create or replace function public.quote_counters_this_year()
returns table (code text, last_no integer) language sql stable security definer set search_path = public as $$
  select c.code, c.last_no from public.quotation_counters c
   where public.app_role() = 'MANAGEMENT'
     and c.year = extract(year from (now() at time zone 'Asia/Jakarta'))::integer
$$;
revoke execute on function public.quote_counters_this_year() from public, anon;
grant execute on function public.quote_counters_this_year() to authenticated;

-- ───────────────────────────── Letter format ────────────────────
alter table public.quotations add column if not exists tax_mode text;
alter table public.quotations add column if not exists discount_mode text;
alter table public.quotations add column if not exists letter_terms jsonb;
alter table public.quotations add column if not exists payment_terms jsonb;
update public.quotations set tax_mode = case when show_tax then 'ADDED' else 'EXCLUDED' end where tax_mode is null;
update public.quotations set discount_mode = case when show_discount then 'PERCENT' else 'HIDDEN' end where discount_mode is null;
alter table public.quotations alter column tax_mode set default 'ADDED';
alter table public.quotations alter column tax_mode set not null;
alter table public.quotations alter column discount_mode set default 'PERCENT';
alter table public.quotations alter column discount_mode set not null;
alter table public.quotations drop constraint if exists quotations_tax_mode_check;
alter table public.quotations add constraint quotations_tax_mode_check check (tax_mode in ('ADDED', 'INCLUDED', 'EXCLUDED'));
alter table public.quotations drop constraint if exists quotations_discount_mode_check;
alter table public.quotations add constraint quotations_discount_mode_check check (discount_mode in ('PERCENT', 'AMOUNT', 'HIDDEN'));

-- p_terms: ["Harga franco Kota Semarang", …]   p_payment_terms: [{ label: "Down Payment", percent: 35 }, …]
-- null leaves a part unchanged.
create or replace function public.set_quotation_letter(
  p_id uuid, p_tax_mode text default null, p_discount_mode text default null,
  p_terms jsonb default null, p_payment_terms jsonb default null
) returns void language plpgsql security definer set search_path = public as $$
declare
  q public.quotations;
  v_terms jsonb;
  v_pay jsonb;
  v_sum numeric;
begin
  select * into q from public.quotations where id = p_id for update;
  if not found then
    raise exception 'Penawaran tidak ditemukan.';
  end if;
  if not public._can_edit_quotation(q) then
    raise exception 'Format surat tidak bisa diubah pada status ini.' using errcode = '42501';
  end if;
  if p_tax_mode is not null and p_tax_mode not in ('ADDED', 'INCLUDED', 'EXCLUDED') then
    raise exception 'Pilihan PPN tidak valid.';
  end if;
  if p_discount_mode is not null and p_discount_mode not in ('PERCENT', 'AMOUNT', 'HIDDEN') then
    raise exception 'Pilihan tampilan diskon tidak valid.';
  end if;

  if p_terms is not null then
    if jsonb_typeof(p_terms) <> 'array' or jsonb_array_length(p_terms) > 20 then
      raise exception 'Keterangan maksimal 20 baris.';
    end if;
    select coalesce(jsonb_agg(left(trim(t), 300) order by ord), '[]'::jsonb) into v_terms
      from jsonb_array_elements_text(p_terms) with ordinality as x(t, ord)
     where trim(t) <> '';
  end if;

  if p_payment_terms is not null then
    if jsonb_typeof(p_payment_terms) <> 'array' or jsonb_array_length(p_payment_terms) > 6 then
      raise exception 'Termin pembayaran maksimal 6 baris.';
    end if;
    if exists (select 1 from jsonb_array_elements(p_payment_terms) p
               where coalesce(trim(p ->> 'label'), '') = ''
                  or coalesce((p ->> 'percent')::numeric, -1) <= 0 or (p ->> 'percent')::numeric > 100) then
      raise exception 'Termin pembayaran tidak valid: isi keterangan dan persen (1–100).';
    end if;
    select coalesce(sum((p ->> 'percent')::numeric), 0) into v_sum from jsonb_array_elements(p_payment_terms) p;
    if jsonb_array_length(p_payment_terms) > 0 and v_sum <> 100 then
      raise exception 'Total termin pembayaran harus 100%% (sekarang % persen).', v_sum;
    end if;
    select coalesce(jsonb_agg(jsonb_build_object('label', left(trim(p ->> 'label'), 60), 'percent', (p ->> 'percent')::numeric) order by ord), '[]'::jsonb)
      into v_pay from jsonb_array_elements(p_payment_terms) with ordinality as x(p, ord);
  end if;

  update public.quotations
     set tax_mode = coalesce(p_tax_mode, tax_mode),
         show_tax = coalesce(p_tax_mode, tax_mode) <> 'EXCLUDED',
         discount_mode = coalesce(p_discount_mode, discount_mode),
         show_discount = coalesce(p_discount_mode, discount_mode) <> 'HIDDEN',
         letter_terms = case when p_terms is null then letter_terms else v_terms end,
         payment_terms = case when p_payment_terms is null then payment_terms else nullif(v_pay, '[]'::jsonb) end
   where id = p_id;
end $$;
revoke execute on function public.set_quotation_letter(uuid, text, text, jsonb, jsonb) from public, anon;
grant execute on function public.set_quotation_letter(uuid, text, text, jsonb, jsonb) to authenticated;

-- The old toggles (Tahap 1) keep the new modes consistent.
create or replace function public._sync_letter_modes()
returns trigger language plpgsql as $$
begin
  if new.show_tax is distinct from old.show_tax and new.tax_mode is not distinct from old.tax_mode then
    new.tax_mode := case when new.show_tax then 'ADDED' else 'EXCLUDED' end;
  end if;
  if new.show_discount is distinct from old.show_discount and new.discount_mode is not distinct from old.discount_mode then
    new.discount_mode := case when new.show_discount then 'PERCENT' else 'HIDDEN' end;
  end if;
  return new;
end $$;
drop trigger if exists sync_letter_modes on public.quotations;
create trigger sync_letter_modes before update on public.quotations
  for each row execute function public._sync_letter_modes();

-- ───────────────────────────── Charges: description, "Termasuk" ──
alter table public.quotation_charges add column if not exists description text not null default '';

-- p_charges: [{ kind: INSTALL|SHIPPING|OTHER, label, amount (0 = Termasuk), description }] — replaces all charges.
create or replace function public.set_quotation_charges(p_id uuid, p_charges jsonb)
returns void language plpgsql security definer set search_path = public as $$
declare
  q public.quotations;
begin
  select * into q from public.quotations where id = p_id for update;
  if not found then
    raise exception 'Penawaran tidak ditemukan.';
  end if;
  if not public._can_edit_quotation(q) then
    raise exception 'Biaya tambahan tidak bisa diubah pada status ini.' using errcode = '42501';
  end if;
  if jsonb_array_length(coalesce(p_charges, '[]'::jsonb)) > 20 then
    raise exception 'Biaya tambahan maksimal 20 baris.';
  end if;
  if exists (select 1 from jsonb_array_elements(coalesce(p_charges, '[]'::jsonb)) c
             where coalesce(c ->> 'kind', '') not in ('INSTALL', 'SHIPPING', 'OTHER')
                or coalesce((c ->> 'amount')::bigint, -1) < 0
                or coalesce(trim(c ->> 'label'), '') = '') then
    raise exception 'Biaya tambahan tidak valid: isi jenis, keterangan, dan jumlah.';
  end if;
  delete from public.quotation_charges where quotation_id = p_id;
  insert into public.quotation_charges (quotation_id, position, kind, label, amount, description)
  select p_id, ord, c ->> 'kind', left(trim(c ->> 'label'), 120), (c ->> 'amount')::bigint, left(trim(coalesce(c ->> 'description', '')), 300)
    from jsonb_array_elements(coalesce(p_charges, '[]'::jsonb)) with ordinality as t(c, ord);
  perform public._recalc_quotation(p_id);
end $$;

-- ───────────────────────────── Revisions copy the letter ────────
create or replace function public.create_quotation_revision(p_id uuid)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  q public.quotations;
  v_root text;
  v_no integer;
  v_new uuid;
  v_today date := (now() at time zone 'Asia/Jakarta')::date;
  v_is_sales boolean;
  v_item record;
  v_item_id uuid;
begin
  select * into q from public.quotations where id = p_id for update;
  if not found then
    raise exception 'Penawaran tidak ditemukan.';
  end if;
  v_is_sales := public.app_role() = 'SALES' and q.sales_id = auth.uid();
  if not (public.is_reviewer() or v_is_sales) then
    raise exception 'Anda tidak memiliki akses untuk merevisi penawaran ini.' using errcode = '42501';
  end if;
  if q.status not in ('APPROVED', 'PDF_SENT') then
    raise exception 'Hanya penawaran yang sudah disetujui/terkirim yang bisa direvisi dengan cara ini.';
  end if;

  v_root := regexp_replace(q.quotation_number, '-R[0-9]+$', '');
  select coalesce(max(revision_no), 0) + 1 into v_no
    from public.quotations where quotation_number = v_root or quotation_number like v_root || '-R%';

  insert into public.quotations (
    quotation_number, issued_on, valid_until, status, customer, sales_id, sales_name, sales_phone, sales_notes,
    support_notes, extra_discount, show_tax, show_discount, tax_mode, discount_mode, letter_terms, payment_terms,
    whatsapp_status, revision_of, revision_no, history
  ) values (
    v_root || '-R' || v_no, v_today, v_today + 14, case when v_is_sales then 'DRAFT' else 'PENDING_REVIEW' end,
    q.customer, q.sales_id, q.sales_name, q.sales_phone, q.sales_notes, q.support_notes, q.extra_discount,
    q.show_tax, q.show_discount, q.tax_mode, q.discount_mode, q.letter_terms, q.payment_terms,
    'PENDING', q.id, v_no,
    jsonb_build_array(public._history_event('Revisi dari ' || q.quotation_number))
  ) returning id into v_new;

  for v_item in
    select i.*, c.cogs from public.quotation_items i left join public.quotation_item_costs c on c.item_id = i.id
     where i.quotation_id = q.id order by i.position
  loop
    insert into public.quotation_items (quotation_id, position, product_id, product_name, sku, category, image, qty, unit,
                                        base_price, selling_price, discount_percent, notes, specs)
    values (v_new, v_item.position, v_item.product_id, v_item.product_name, v_item.sku, v_item.category, v_item.image,
            v_item.qty, v_item.unit, v_item.base_price, v_item.selling_price, v_item.discount_percent, v_item.notes, v_item.specs)
    returning id into v_item_id;
    insert into public.quotation_item_costs (item_id, cogs) values (v_item_id, coalesce(v_item.cogs, 0));
  end loop;

  insert into public.quotation_charges (quotation_id, position, kind, label, amount, description)
  select v_new, position, kind, label, amount, description from public.quotation_charges where quotation_id = q.id;

  perform public._recalc_quotation(v_new);

  update public.quotations
     set status = 'REVISED', revised_to = v_new,
         history = history || public._history_event('Direvisi menjadi ' || v_root || '-R' || v_no)
   where id = q.id;
  return v_new;
end $$;
revoke execute on function public.create_quotation_revision(uuid) from public, anon;
grant execute on function public.create_quotation_revision(uuid) to authenticated;
