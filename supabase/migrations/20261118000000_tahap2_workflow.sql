-- Agusta Quotation System — revisi tahap 2
-- Run after 20261117000000_quote_options.sql.
--
-- R11  custom_requests.budget_total (pagu / anggaran untuk seluruh jumlah)
-- R12  discount rules per brand (merek); products.brand filled from "Merek: …" in the specs
-- R6   quotation_charges: jasa pasang, ongkir, lainnya (kena PPN, tidak kena diskon, tanpa margin)
-- R7   escalation to Management for quotations and custom requests
-- R5   revision of an issued quotation: new version -R1, -R2 …; the old one becomes REVISED (archive)

-- ───────────────────────────── Statuses ─────────────────────────
alter table public.quotations drop constraint if exists quotations_status_check;
alter table public.quotations add constraint quotations_status_check
  check (status in ('DRAFT', 'PENDING_REVIEW', 'PENDING_MANAGEMENT', 'APPROVED', 'REJECTED', 'PDF_SENT', 'REVISED'));

alter table public.custom_requests drop constraint if exists custom_requests_status_check;
alter table public.custom_requests add constraint custom_requests_status_check
  check (status in ('PENDING_PRICING', 'PENDING_MANAGEMENT', 'PRICED', 'APPROVED', 'REJECTED'));

-- ───────────────────────────── Columns ──────────────────────────
alter table public.custom_requests add column if not exists budget_total bigint check (budget_total is null or budget_total >= 0);
alter table public.custom_requests add column if not exists escalation jsonb;

alter table public.quotations add column if not exists escalation jsonb;
alter table public.quotations add column if not exists revision_of uuid references public.quotations (id);
alter table public.quotations add column if not exists revision_no integer not null default 0;
alter table public.quotations add column if not exists revised_to uuid references public.quotations (id);

alter table public.discount_rules add column if not exists brand text;

-- ───────────────────────────── R12: brand ───────────────────────
create or replace function public._brand_from_specs(p_specs text)
returns text language sql immutable as $$
  select nullif(upper(trim(substring(coalesce(p_specs, '') from '(?i)merek\s*:\s*([^;]+)'))), '')
$$;

create or replace function public.products_fill_brand()
returns trigger language plpgsql as $$
begin
  if coalesce(trim(new.brand), '') = '' then
    new.brand := coalesce(public._brand_from_specs(new.specs), '');
  end if;
  new.brand := upper(trim(new.brand));
  return new;
end $$;

drop trigger if exists products_fill_brand on public.products;
create trigger products_fill_brand
  before insert or update of brand, specs on public.products
  for each row execute function public.products_fill_brand();

update public.products set brand = coalesce(public._brand_from_specs(specs), '') where coalesce(trim(brand), '') = '';
update public.products set brand = upper(trim(brand)) where brand <> upper(trim(brand));

-- p_rules: [{ brand?, minQty, maxQty?, suggestedDiscount, maxAllowedDiscount, minMarginPercent }]
create or replace function public.replace_discount_rules(p_rules jsonb)
returns void language plpgsql security definer set search_path = public as $$
begin
  perform public._require_reviewer();
  delete from public.discount_rules where true;
  insert into public.discount_rules (position, min_qty, max_qty, brand, customer_category, suggested_discount, max_allowed_discount, min_margin_percent)
  select ord, (r ->> 'minQty')::integer, nullif(r ->> 'maxQty', '')::integer, nullif(upper(trim(r ->> 'brand')), ''), null,
         (r ->> 'suggestedDiscount')::numeric, (r ->> 'maxAllowedDiscount')::numeric, (r ->> 'minMarginPercent')::numeric
    from jsonb_array_elements(coalesce(p_rules, '[]'::jsonb)) with ordinality as t(r, ord);
end $$;

-- Brand is now editable from the catalog too.
drop function if exists public.update_product_pricing(text, bigint, bigint, integer);
create or replace function public.update_product_pricing(
  p_id text, p_cogs bigint default null, p_base_price bigint default null, p_stock integer default null, p_brand text default null
) returns void language plpgsql security definer set search_path = public as $$
begin
  perform public._require_reviewer();
  update public.products
     set base_price = coalesce(p_base_price, base_price),
         stock = coalesce(p_stock, stock),
         brand = coalesce(upper(trim(p_brand)), brand)
   where id = p_id;
  if not found then
    raise exception 'Produk tidak ditemukan.';
  end if;
  if p_cogs is not null then
    insert into public.product_costs (product_id, cogs) values (p_id, p_cogs)
    on conflict (product_id) do update set cogs = excluded.cogs, updated_at = now();
  end if;
end $$;
revoke execute on function public.update_product_pricing(text, bigint, bigint, integer, text) from public, anon;
grant execute on function public.update_product_pricing(text, bigint, bigint, integer, text) to authenticated;

-- ───────────────────────────── R6: charges ──────────────────────
create table if not exists public.quotation_charges (
  id uuid primary key default gen_random_uuid(),
  quotation_id uuid not null references public.quotations (id) on delete cascade,
  position integer not null,
  kind text not null check (kind in ('INSTALL', 'SHIPPING', 'OTHER')),
  label text not null,
  amount bigint not null check (amount >= 0)
);
create index if not exists quotation_charges_quotation_idx on public.quotation_charges (quotation_id);
alter table public.quotation_charges enable row level security;
revoke insert, update, delete, truncate on public.quotation_charges from anon, authenticated;
drop policy if exists "quotation charges follow quotation" on public.quotation_charges;
create policy "quotation charges follow quotation" on public.quotation_charges
  for select to authenticated using (
    exists (select 1 from public.quotations q where q.id = quotation_id
            and (public.is_reviewer() or (public.app_role() = 'SALES' and q.sales_id = auth.uid())))
  );

-- Same as before, plus charges: subtotal = items − extra discount + charges; margin on goods only.
create or replace function public._recalc_quotation(p_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_items bigint;
  v_extra bigint;
  v_goods bigint;
  v_charges bigint;
  v_sub bigint;
  v_cogs bigint;
  v_tax bigint;
begin
  update public.quotation_items
     set subtotal = public._line_subtotal(qty, selling_price, discount_percent)
   where quotation_id = p_id;

  select coalesce(sum(i.subtotal), 0), coalesce(sum(round(i.qty::numeric * coalesce(c.cogs, 0))), 0)
    into v_items, v_cogs
    from public.quotation_items i
    left join public.quotation_item_costs c on c.item_id = i.id
   where i.quotation_id = p_id;

  select least(greatest(coalesce(extra_discount, 0), 0), v_items) into v_extra from public.quotations where id = p_id;
  select coalesce(sum(amount), 0) into v_charges from public.quotation_charges where quotation_id = p_id;
  v_goods := v_items - coalesce(v_extra, 0);
  v_sub := v_goods + v_charges;
  v_tax := round(v_sub * 11 / 100.0);

  update public.quotations
     set subtotal = v_sub, tax_rate_percent = 11, tax_amount = v_tax, grand_total = v_sub + v_tax, updated_at = now()
   where id = p_id;

  insert into public.quotation_costs (quotation_id, total_cogs, gross_profit, gross_margin_percent)
  values (p_id, v_cogs, v_goods - v_cogs, case when v_goods > 0 then round((v_goods - v_cogs)::numeric / v_goods * 100, 2) else 0 end)
  on conflict (quotation_id) do update
    set total_cogs = excluded.total_cogs, gross_profit = excluded.gross_profit, gross_margin_percent = excluded.gross_margin_percent;
end $$;

-- Who may change a quotation's pricing details right now.
create or replace function public._can_edit_quotation(q public.quotations)
returns boolean language sql stable security definer set search_path = public as $$
  select case
    when q.status = 'PENDING_REVIEW' then public.is_reviewer() or (public.app_role() = 'SALES' and q.sales_id = auth.uid())
    when q.status = 'DRAFT' then public.app_role() = 'SALES' and q.sales_id = auth.uid()
    when q.status = 'PENDING_MANAGEMENT' then public.app_role() = 'MANAGEMENT'
    else false
  end
$$;

-- p_charges: [{ kind: INSTALL|SHIPPING|OTHER, label, amount }] — replaces all charges.
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
  if exists (select 1 from jsonb_array_elements(coalesce(p_charges, '[]'::jsonb)) c
             where coalesce(c ->> 'kind', '') not in ('INSTALL', 'SHIPPING', 'OTHER')
                or coalesce((c ->> 'amount')::bigint, -1) < 0
                or coalesce(trim(c ->> 'label'), '') = '') then
    raise exception 'Biaya tambahan tidak valid: isi jenis, keterangan, dan jumlah.';
  end if;
  delete from public.quotation_charges where quotation_id = p_id;
  insert into public.quotation_charges (quotation_id, position, kind, label, amount)
  select p_id, ord, c ->> 'kind', left(trim(c ->> 'label'), 120), (c ->> 'amount')::bigint
    from jsonb_array_elements(coalesce(p_charges, '[]'::jsonb)) with ordinality as t(c, ord);
  perform public._recalc_quotation(p_id);
end $$;
revoke execute on function public.set_quotation_charges(uuid, jsonb) from public, anon;
grant execute on function public.set_quotation_charges(uuid, jsonb) to authenticated;

-- Tahap 1 function, now also allowed for Management while a quotation waits for Management.
create or replace function public.set_quotation_adjustments(
  p_id uuid, p_extra_discount bigint default null, p_show_tax boolean default null, p_show_discount boolean default null
) returns void language plpgsql security definer set search_path = public as $$
declare
  q public.quotations;
  v_items bigint;
begin
  select * into q from public.quotations where id = p_id for update;
  if not found then
    raise exception 'Penawaran tidak ditemukan.';
  end if;
  if not public._can_edit_quotation(q) then
    raise exception 'Pengaturan penawaran tidak bisa diubah pada status ini.' using errcode = '42501';
  end if;
  if not public.is_reviewer() and (p_show_tax is not null or p_show_discount is not null) then
    raise exception 'Tampilan PPN dan diskon diatur oleh Sales Support.' using errcode = '42501';
  end if;
  if p_extra_discount is not null then
    if p_extra_discount < 0 then
      raise exception 'Diskon tambahan tidak boleh negatif.';
    end if;
    select coalesce(sum(public._line_subtotal(qty, selling_price, discount_percent)), 0) into v_items
      from public.quotation_items where quotation_id = p_id;
    if p_extra_discount > v_items then
      raise exception 'Diskon tambahan melebihi total item penawaran.';
    end if;
  end if;
  update public.quotations
     set extra_discount = coalesce(p_extra_discount, extra_discount),
         show_tax = coalesce(p_show_tax, show_tax),
         show_discount = coalesce(p_show_discount, show_discount)
   where id = p_id;
  perform public._recalc_quotation(p_id);
end $$;

-- ───────────────────────────── R7: escalation ───────────────────
create or replace function public._notify_management(
  p_type text, p_title text, p_body text, p_quotation uuid default null, p_request uuid default null
) returns void language sql security definer set search_path = public as $$
  insert into public.notifications (user_id, type, title, body, quotation_id, request_id)
  select id, p_type, p_title, coalesce(p_body, ''), p_quotation, p_request
    from public.profiles
   where status = 'ACTIVE' and role = 'MANAGEMENT' and id is distinct from auth.uid()
$$;
revoke execute on function public._notify_management(text, text, text, uuid, uuid) from public, anon, authenticated;

create or replace function public._escalation_event(p_note text)
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object('note', coalesce(trim(p_note), ''), 'by', public.app_user_name(), 'byId', auth.uid(), 'at', now())
$$;

-- Sales Support forwards a quotation (with its current pricing) to Management.
create or replace function public.escalate_quotation(p_id uuid, p_note text, p_items jsonb default null, p_support_notes text default null)
returns void language plpgsql security definer set search_path = public as $$
begin
  perform public._require_reviewer();
  if length(trim(coalesce(p_note, ''))) < 5 then
    raise exception 'Tulis alasan eskalasi untuk Management.';
  end if;
  perform 1 from public.quotations where id = p_id and status = 'PENDING_REVIEW' for update;
  if not found then
    raise exception 'Hanya penawaran yang menunggu review yang bisa diteruskan ke Management.';
  end if;
  if p_items is not null then
    perform public._apply_pricing(p_id, p_items);
  end if;
  update public.quotations
     set status = 'PENDING_MANAGEMENT',
         support_notes = coalesce(p_support_notes, support_notes),
         escalation = public._escalation_event(p_note),
         history = history || public._history_event('Diteruskan ke Management', trim(p_note))
   where id = p_id;
end $$;

-- Management decides: APPROVED (pricing as now, possibly edited) or RETURNED; back to Sales Support.
create or replace function public.decide_quotation_escalation(p_id uuid, p_decision text, p_note text default null, p_items jsonb default null)
returns void language plpgsql security definer set search_path = public as $$
begin
  if public.app_role() is distinct from 'MANAGEMENT' then
    raise exception 'Hanya Management yang dapat memutuskan eskalasi.' using errcode = '42501';
  end if;
  if p_decision not in ('APPROVED', 'RETURNED') then
    raise exception 'Keputusan tidak valid.';
  end if;
  if p_decision = 'RETURNED' and length(trim(coalesce(p_note, ''))) < 5 then
    raise exception 'Tulis catatan untuk Sales Support.';
  end if;
  perform 1 from public.quotations where id = p_id and status = 'PENDING_MANAGEMENT' for update;
  if not found then
    raise exception 'Penawaran ini tidak sedang menunggu Management.';
  end if;
  if p_items is not null then
    perform public._apply_pricing(p_id, p_items);
  end if;
  update public.quotations
     set status = 'PENDING_REVIEW',
         escalation = coalesce(escalation, '{}'::jsonb) || jsonb_strip_nulls(jsonb_build_object(
           'decision', p_decision, 'decisionNote', nullif(trim(coalesce(p_note, '')), ''),
           'decidedBy', public.app_user_name(), 'decidedAt', now())),
         history = history || public._history_event(
           case when p_decision = 'APPROVED' then 'Disetujui Management' else 'Dikembalikan Management ke Sales Support' end,
           nullif(trim(coalesce(p_note, '')), ''))
   where id = p_id;
end $$;

-- Custom request: Sales Support forwards (optionally with a proposed price) to Management.
create or replace function public.escalate_custom_request(p_id uuid, p_note text, p_cogs bigint default null, p_selling_price bigint default null)
returns void language plpgsql security definer set search_path = public as $$
begin
  perform public._require_reviewer();
  if length(trim(coalesce(p_note, ''))) < 5 then
    raise exception 'Tulis alasan eskalasi untuk Management.';
  end if;
  update public.custom_requests
     set status = 'PENDING_MANAGEMENT',
         assigned_selling_price = coalesce(nullif(p_selling_price, 0), assigned_selling_price),
         escalation = public._escalation_event(p_note)
   where id = p_id and status in ('PENDING_PRICING', 'PRICED');
  if not found then
    raise exception 'Request ini tidak bisa diteruskan ke Management.';
  end if;
  if coalesce(p_cogs, 0) > 0 then
    insert into public.custom_request_costs (request_id, assigned_cogs) values (p_id, p_cogs)
    on conflict (request_id) do update set assigned_cogs = excluded.assigned_cogs;
  end if;
end $$;

-- Management sets the price (APPROVED → PRICED) or returns it (→ PENDING_PRICING).
create or replace function public.decide_custom_request_escalation(
  p_id uuid, p_decision text, p_note text default null, p_cogs bigint default null, p_selling_price bigint default null
) returns void language plpgsql security definer set search_path = public as $$
begin
  if public.app_role() is distinct from 'MANAGEMENT' then
    raise exception 'Hanya Management yang dapat memutuskan eskalasi.' using errcode = '42501';
  end if;
  if p_decision not in ('APPROVED', 'RETURNED') then
    raise exception 'Keputusan tidak valid.';
  end if;
  if p_decision = 'APPROVED' and (coalesce(p_cogs, 0) <= 0 or coalesce(p_selling_price, 0) <= 0) then
    raise exception 'Isi HPP dan harga jual terlebih dahulu.';
  end if;
  if p_decision = 'RETURNED' and length(trim(coalesce(p_note, ''))) < 5 then
    raise exception 'Tulis catatan untuk Sales Support.';
  end if;
  update public.custom_requests
     set status = case when p_decision = 'APPROVED' then 'PRICED' else 'PENDING_PRICING' end,
         assigned_selling_price = case when p_decision = 'APPROVED' then p_selling_price else assigned_selling_price end,
         escalation = coalesce(escalation, '{}'::jsonb) || jsonb_strip_nulls(jsonb_build_object(
           'decision', p_decision, 'decisionNote', nullif(trim(coalesce(p_note, '')), ''),
           'decidedBy', public.app_user_name(), 'decidedAt', now()))
   where id = p_id and status = 'PENDING_MANAGEMENT';
  if not found then
    raise exception 'Request ini tidak sedang menunggu Management.';
  end if;
  if p_decision = 'APPROVED' then
    insert into public.custom_request_costs (request_id, assigned_cogs) values (p_id, p_cogs)
    on conflict (request_id) do update set assigned_cogs = excluded.assigned_cogs;
  end if;
end $$;

grant execute on function public.escalate_quotation(uuid, text, jsonb, text) to authenticated;
grant execute on function public.decide_quotation_escalation(uuid, text, text, jsonb) to authenticated;
grant execute on function public.escalate_custom_request(uuid, text, bigint, bigint) to authenticated;
grant execute on function public.decide_custom_request_escalation(uuid, text, text, bigint, bigint) to authenticated;
revoke execute on function public.escalate_quotation(uuid, text, jsonb, text) from public, anon;
revoke execute on function public.decide_quotation_escalation(uuid, text, text, jsonb) from public, anon;
revoke execute on function public.escalate_custom_request(uuid, text, bigint, bigint) from public, anon;
revoke execute on function public.decide_custom_request_escalation(uuid, text, text, bigint, bigint) from public, anon;

-- Pricing while waiting for Management belongs to Management.
create or replace function public.save_quotation_pricing(p_id uuid, p_items jsonb, p_support_notes text default null)
returns void language plpgsql security definer set search_path = public as $$
declare
  q public.quotations;
begin
  perform public._require_reviewer();
  select * into q from public.quotations where id = p_id;
  if not found or not (q.status = 'PENDING_REVIEW' or (q.status = 'PENDING_MANAGEMENT' and public.app_role() = 'MANAGEMENT')) then
    raise exception 'Penawaran ini tidak sedang bisa diubah harganya.';
  end if;
  perform public._apply_pricing(p_id, p_items);
  update public.quotations set support_notes = coalesce(p_support_notes, support_notes) where id = p_id;
end $$;

-- R11/R7: custom request with budget; no Sales Support pricing while Management has it.
drop function if exists public.submit_custom_request(text, text, integer, bigint, text, text, text, text);
create or replace function public.submit_custom_request(
  p_product_name text, p_category text, p_estimated_qty integer, p_target_price bigint,
  p_specs text, p_reference text default '', p_image_url text default null, p_source_url text default null,
  p_budget_total bigint default null
) returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_id uuid;
begin
  if public.app_role() is distinct from 'SALES' then
    raise exception 'Hanya Sales yang dapat mengajukan barang custom.' using errcode = '42501';
  end if;
  insert into public.custom_requests (
    sales_id, sales_name, product_name, category, estimated_qty, target_price_per_unit, budget_total, specs,
    reference_url_or_notes, image_url, source_url
  ) values (
    auth.uid(), public.app_user_name(), trim(p_product_name), p_category, greatest(1, p_estimated_qty),
    greatest(0, coalesce(p_target_price, 0)), nullif(greatest(0, coalesce(p_budget_total, 0)), 0), trim(p_specs),
    coalesce(p_reference, ''),
    case when p_image_url like 'https://agusta.co.id/storage/products/%' then p_image_url end,
    public._agusta_url(p_source_url)
  ) returning id into v_id;
  return v_id;
end $$;
revoke execute on function public.submit_custom_request(text, text, integer, bigint, text, text, text, text, bigint) from public, anon;
grant execute on function public.submit_custom_request(text, text, integer, bigint, text, text, text, text, bigint) to authenticated;

create or replace function public.price_custom_request(
  p_id uuid, p_cogs bigint, p_selling_price bigint, p_support_notes text, p_status text
) returns void language plpgsql security definer set search_path = public as $$
declare
  v_req public.custom_requests;
  v_product_id text;
  v_key text;
begin
  perform public._require_reviewer();
  if p_status not in ('PRICED', 'APPROVED', 'REJECTED') then
    raise exception 'Status request tidak valid.';
  end if;
  select * into v_req from public.custom_requests where id = p_id for update;
  if not found then
    raise exception 'Request tidak ditemukan.';
  end if;
  if v_req.status = 'PENDING_MANAGEMENT' then
    raise exception 'Request ini sedang menunggu keputusan Management.';
  end if;
  if p_status <> 'REJECTED' and (coalesce(p_cogs, 0) <= 0 or coalesce(p_selling_price, 0) <= 0) then
    raise exception 'Isi HPP dan harga jual terlebih dahulu.';
  end if;

  v_product_id := v_req.product_id;
  if p_status = 'APPROVED' then
    v_key := upper(left(replace(v_req.id::text, '-', ''), 8));
    v_product_id := coalesce(v_product_id, 'prod-custom-' || lower(v_key));
    insert into public.products (id, name, sku, category, brand, base_price, image, stock, unit, specs, description, is_custom, keywords, source_url)
    values (v_product_id, upper(v_req.product_name), 'CST-' || v_key, v_req.category, 'CUSTOM', p_selling_price,
            coalesce(v_req.image_url, ''), v_req.estimated_qty, 'Unit', v_req.specs,
            coalesce(nullif(trim(p_support_notes), ''), 'Barang custom, dibuat sesuai pesanan.'), true,
            array['custom'] || regexp_split_to_array(lower(v_req.product_name), '\s+'), v_req.source_url)
    on conflict (id) do update
      set base_price = excluded.base_price, description = excluded.description, specs = excluded.specs,
          image = case when products.image = '' then excluded.image else products.image end;
    insert into public.product_costs (product_id, cogs) values (v_product_id, p_cogs)
    on conflict (product_id) do update set cogs = excluded.cogs, updated_at = now();
  end if;

  update public.custom_requests
     set status = p_status, assigned_selling_price = nullif(p_selling_price, 0),
         support_notes = nullif(trim(coalesce(p_support_notes, '')), ''), product_id = v_product_id
   where id = p_id;

  if coalesce(p_cogs, 0) > 0 then
    insert into public.custom_request_costs (request_id, assigned_cogs) values (p_id, p_cogs)
    on conflict (request_id) do update set assigned_cogs = excluded.assigned_cogs;
  end if;
end $$;

-- ───────────────────────────── R5: revisions ────────────────────
-- Sales (owner) gets a DRAFT to edit in the wizard; Sales Support gets it straight in review.
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
    support_notes, extra_discount, show_tax, show_discount, whatsapp_status, revision_of, revision_no, history
  ) values (
    v_root || '-R' || v_no, v_today, v_today + 14, case when v_is_sales then 'DRAFT' else 'PENDING_REVIEW' end,
    q.customer, q.sales_id, q.sales_name, q.sales_phone, q.sales_notes, q.support_notes, q.extra_discount,
    q.show_tax, q.show_discount, 'PENDING', q.id, v_no,
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

  insert into public.quotation_charges (quotation_id, position, kind, label, amount)
  select v_new, position, kind, label, amount from public.quotation_charges where quotation_id = q.id;

  perform public._recalc_quotation(v_new);

  update public.quotations
     set status = 'REVISED', revised_to = v_new,
         history = history || public._history_event('Direvisi menjadi ' || v_root || '-R' || v_no)
   where id = q.id;
  return v_new;
end $$;
revoke execute on function public.create_quotation_revision(uuid) from public, anon;
grant execute on function public.create_quotation_revision(uuid) to authenticated;

-- ───────────────────────────── Notifications ────────────────────
alter table public.notifications drop constraint if exists notifications_type_check;
alter table public.notifications add constraint notifications_type_check check (type in (
  'QUOTATION_SUBMITTED', 'QUOTATION_RESUBMITTED', 'QUOTATION_APPROVED', 'QUOTATION_REJECTED',
  'CUSTOM_REQUEST_SUBMITTED', 'CUSTOM_REQUEST_PRICED', 'CUSTOM_REQUEST_APPROVED', 'CUSTOM_REQUEST_REJECTED',
  'QUOTATION_ESCALATED', 'QUOTATION_MGMT_DECIDED', 'CUSTOM_REQUEST_ESCALATED', 'CUSTOM_REQUEST_MGMT_DECIDED'
));

create or replace function public.quotations_notify()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  q public.quotations;
  v_ref text;
  v_escalator uuid;
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
      perform public._notify_reviewers('QUOTATION_SUBMITTED',
        case when q.revision_no > 0 then 'Revisi penawaran ' || q.quotation_number else 'Penawaran baru dari ' || q.sales_name end,
        v_ref || ' · ' || public._rupiah(q.grand_total), q.id);
    end if;
    return null;
  end if;

  if old.status is not distinct from new.status then
    return null;
  end if;

  if new.status = 'PENDING_MANAGEMENT' then
    perform public._notify_management('QUOTATION_ESCALATED', 'Eskalasi dari ' || coalesce(q.escalation ->> 'by', 'Sales Support'),
      v_ref || ' · ' || coalesce(q.escalation ->> 'note', ''), q.id);
  elsif old.status = 'PENDING_MANAGEMENT' and new.status = 'PENDING_REVIEW' then
    v_escalator := nullif(q.escalation ->> 'byId', '')::uuid;
    perform public._notify(v_escalator, 'QUOTATION_MGMT_DECIDED',
      case when q.escalation ->> 'decision' = 'APPROVED' then 'Management menyetujui harga' else 'Management mengembalikan penawaran' end,
      v_ref || coalesce(' · ' || (q.escalation ->> 'decisionNote'), ''), q.id);
  elsif new.status = 'PENDING_REVIEW' then
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

create or replace function public.custom_requests_notify()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  r public.custom_requests;
  v_escalator uuid;
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
      r.product_name || ' · ' || r.estimated_qty || ' unit'
        || coalesce(' · pagu ' || public._rupiah(r.budget_total), ''), null, r.id);
    return null;
  end if;

  if old.status is not distinct from new.status then
    return null;
  end if;

  if r.status = 'PENDING_MANAGEMENT' then
    perform public._notify_management('CUSTOM_REQUEST_ESCALATED', 'Eskalasi harga custom dari ' || coalesce(r.escalation ->> 'by', 'Sales Support'),
      r.product_name || ' · ' || coalesce(r.escalation ->> 'note', ''), null, r.id);
  elsif old.status = 'PENDING_MANAGEMENT' then
    v_escalator := nullif(r.escalation ->> 'byId', '')::uuid;
    perform public._notify(v_escalator, 'CUSTOM_REQUEST_MGMT_DECIDED',
      case when r.escalation ->> 'decision' = 'APPROVED' then 'Management menetapkan harga custom' else 'Management mengembalikan request custom' end,
      r.product_name || coalesce(' · ' || public._rupiah(r.assigned_selling_price) || ' per unit', '')
        || coalesce(' · ' || (r.escalation ->> 'decisionNote'), ''), null, r.id);
  elsif r.status = 'PRICED' then
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
