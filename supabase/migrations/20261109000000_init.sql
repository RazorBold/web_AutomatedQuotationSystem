-- Agusta Automated Quotation System — initial schema
-- Run once in Supabase: Dashboard → SQL Editor → paste → Run (or `supabase db push`).
--
-- Security model
--   * Every table has RLS. Clients only get SELECT policies; every write goes through a
--     SECURITY DEFINER function below that checks the caller's role.
--   * HPP/COGS lives in separate *_costs tables that only SALES_SUPPORT and MANAGEMENT can read,
--     so a Sales session never receives cost data from the API at all.

create extension if not exists pgcrypto;

-- ───────────────────────────── Types ─────────────────────────────
do $$ begin
  create type public.user_role as enum ('SALES', 'SALES_SUPPORT', 'MANAGEMENT');
exception when duplicate_object then null; end $$;

-- ───────────────────────────── Tables ────────────────────────────
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  name text not null,
  role public.user_role not null default 'SALES',
  title text not null default '',
  phone text not null default '',
  email text not null unique,
  status text not null default 'ACTIVE' check (status in ('ACTIVE', 'INACTIVE')),
  avatar text not null default '',
  created_at timestamptz not null default now(),
  last_login_at timestamptz
);

create table if not exists public.products (
  id text primary key,
  name text not null,
  sku text not null unique,
  category text not null,
  brand text not null default '',
  base_price bigint not null check (base_price >= 0),
  image text not null default '',
  stock integer not null default 0,
  unit text not null default 'Unit',
  weight_kg numeric,
  dimensions text,
  specs text not null default '',
  description text not null default '',
  is_custom boolean not null default false,
  is_best_seller boolean not null default false,
  e_katalog_lkpp boolean not null default false,
  keywords text[] not null default '{}',
  created_at timestamptz not null default now()
);

create table if not exists public.product_costs (
  product_id text primary key references public.products (id) on delete cascade,
  cogs bigint not null check (cogs >= 0),
  updated_at timestamptz not null default now()
);

create table if not exists public.discount_rules (
  id bigint generated always as identity primary key,
  position integer not null,
  min_qty integer not null check (min_qty >= 1),
  max_qty integer,
  customer_category text check (customer_category in ('BUMN_GOV', 'CORPORATE', 'EDUCATION', 'RETAIL')),
  suggested_discount numeric not null,
  max_allowed_discount numeric not null,
  min_margin_percent numeric not null
);

create table if not exists public.quotations (
  id uuid primary key default gen_random_uuid(),
  quotation_number text not null unique,
  issued_on date not null,
  valid_until date not null,
  status text not null check (status in ('DRAFT', 'PENDING_REVIEW', 'APPROVED', 'REJECTED', 'PDF_SENT')),
  customer jsonb not null,
  sales_id uuid not null references public.profiles (id),
  sales_name text not null,
  sales_phone text not null default '',
  subtotal bigint not null default 0,
  tax_rate_percent numeric not null default 11,
  tax_amount bigint not null default 0,
  grand_total bigint not null default 0,
  sales_notes text not null default '',
  support_notes text,
  reviewed_by text,
  reviewed_by_id uuid references public.profiles (id),
  reviewed_at timestamptz,
  rejection_reason text,
  pdf_generated_at timestamptz,
  pdf_path text,
  whatsapp_status text check (whatsapp_status in ('PENDING', 'SENT', 'DELIVERED', 'READ', 'FAILED')),
  whatsapp_message_id text,
  history jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists quotations_sales_id_idx on public.quotations (sales_id);
create index if not exists quotations_status_idx on public.quotations (status);
create index if not exists quotations_wa_message_idx on public.quotations (whatsapp_message_id);

create table if not exists public.quotation_costs (
  quotation_id uuid primary key references public.quotations (id) on delete cascade,
  total_cogs bigint not null default 0,
  gross_profit bigint not null default 0,
  gross_margin_percent numeric not null default 0
);

create table if not exists public.quotation_items (
  id uuid primary key default gen_random_uuid(),
  quotation_id uuid not null references public.quotations (id) on delete cascade,
  position integer not null,
  product_id text not null references public.products (id),
  product_name text not null,
  sku text not null,
  category text not null,
  image text not null default '',
  qty integer not null check (qty >= 1),
  unit text not null,
  base_price bigint not null,
  selling_price bigint not null check (selling_price >= 0),
  discount_percent numeric not null default 0 check (discount_percent between 0 and 100),
  subtotal bigint not null default 0,
  notes text,
  specs text
);
create index if not exists quotation_items_quotation_idx on public.quotation_items (quotation_id);

create table if not exists public.quotation_item_costs (
  item_id uuid primary key references public.quotation_items (id) on delete cascade,
  cogs bigint not null default 0 check (cogs >= 0)
);

create table if not exists public.custom_requests (
  id uuid primary key default gen_random_uuid(),
  sales_id uuid not null references public.profiles (id),
  sales_name text not null,
  product_name text not null,
  category text not null,
  estimated_qty integer not null check (estimated_qty >= 1),
  target_price_per_unit bigint not null default 0,
  specs text not null,
  reference_url_or_notes text not null default '',
  submitted_at timestamptz not null default now(),
  status text not null default 'PENDING_PRICING' check (status in ('PENDING_PRICING', 'PRICED', 'APPROVED', 'REJECTED')),
  assigned_selling_price bigint,
  support_notes text,
  product_id text references public.products (id)
);
create index if not exists custom_requests_sales_idx on public.custom_requests (sales_id);

create table if not exists public.custom_request_costs (
  request_id uuid primary key references public.custom_requests (id) on delete cascade,
  assigned_cogs bigint not null check (assigned_cogs >= 0)
);

-- ───────────────────────────── Role helpers ──────────────────────
create or replace function public.app_role()
returns public.user_role language sql stable security definer set search_path = public as $$
  select role from public.profiles where id = auth.uid() and status = 'ACTIVE'
$$;

create or replace function public.is_reviewer()
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce(public.app_role() in ('SALES_SUPPORT', 'MANAGEMENT'), false)
$$;

create or replace function public.app_user_name()
returns text language sql stable security definer set search_path = public as $$
  select coalesce((select name from public.profiles where id = auth.uid()), 'Sistem')
$$;

create or replace function public._require_reviewer()
returns void language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_reviewer() then
    raise exception 'Hanya Sales Support atau Management yang dapat melakukan ini.' using errcode = '42501';
  end if;
end $$;

create or replace function public._history_event(p_label text, p_note text default null)
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_strip_nulls(jsonb_build_object('at', now(), 'by', public.app_user_name(), 'label', p_label, 'note', p_note))
$$;

-- ───────────────────────────── Pricing math ──────────────────────
-- Mirrors calculateLineSubtotal / calculateQuotationTotals in src/utils/quotationEngine.ts.
create or replace function public._line_subtotal(p_qty integer, p_price bigint, p_discount numeric)
returns bigint language sql immutable as $$
  select round(greatest(p_qty, 0)::numeric * greatest(p_price, 0) * (1 - least(100, greatest(0, p_discount)) / 100))::bigint
$$;

create or replace function public._recalc_quotation(p_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_sub bigint;
  v_cogs bigint;
  v_tax bigint;
begin
  update public.quotation_items
     set subtotal = public._line_subtotal(qty, selling_price, discount_percent)
   where quotation_id = p_id;

  select coalesce(sum(i.subtotal), 0), coalesce(sum(round(i.qty::numeric * coalesce(c.cogs, 0))), 0)
    into v_sub, v_cogs
    from public.quotation_items i
    left join public.quotation_item_costs c on c.item_id = i.id
   where i.quotation_id = p_id;

  v_tax := round(v_sub * 11 / 100.0);

  update public.quotations
     set subtotal = v_sub, tax_rate_percent = 11, tax_amount = v_tax, grand_total = v_sub + v_tax, updated_at = now()
   where id = p_id;

  insert into public.quotation_costs (quotation_id, total_cogs, gross_profit, gross_margin_percent)
  values (p_id, v_cogs, v_sub - v_cogs, case when v_sub > 0 then round((v_sub - v_cogs)::numeric / v_sub * 100, 2) else 0 end)
  on conflict (quotation_id) do update
    set total_cogs = excluded.total_cogs, gross_profit = excluded.gross_profit, gross_margin_percent = excluded.gross_margin_percent;
end $$;

-- p_items: [{ "id": uuid, "cogs": int, "sellingPrice": int, "discountPercent": number }]
create or replace function public._apply_pricing(p_id uuid, p_items jsonb)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_item jsonb;
begin
  for v_item in select value from jsonb_array_elements(coalesce(p_items, '[]'::jsonb)) loop
    update public.quotation_items
       set selling_price = greatest(0, (v_item ->> 'sellingPrice')::bigint),
           discount_percent = least(100, greatest(0, coalesce((v_item ->> 'discountPercent')::numeric, 0)))
     where id = (v_item ->> 'id')::uuid and quotation_id = p_id;
    if found then
      insert into public.quotation_item_costs (item_id, cogs)
      values ((v_item ->> 'id')::uuid, greatest(0, coalesce((v_item ->> 'cogs')::bigint, 0)))
      on conflict (item_id) do update set cogs = excluded.cogs;
    end if;
  end loop;
  perform public._recalc_quotation(p_id);
end $$;

-- ───────────────────────────── Quotation RPCs ────────────────────
-- p_items: [{ "productId": text, "qty": int, "discountPercent": number, "notes": text }]
-- COGS is attached here from product_costs; the Sales client never sends or sees it.
create or replace function public.submit_quotation(
  p_customer jsonb, p_items jsonb, p_sales_notes text default '', p_existing_id uuid default null
) returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_me public.profiles;
  v_id uuid;
  v_seq integer;
  v_today date := (now() at time zone 'Asia/Jakarta')::date;
  v_item jsonb;
  v_prod public.products;
  v_cost bigint;
  v_item_id uuid;
  v_pos integer := 0;
begin
  if public.app_role() is distinct from 'SALES' then
    raise exception 'Hanya Sales yang dapat mengajukan penawaran.' using errcode = '42501';
  end if;
  if jsonb_array_length(coalesce(p_items, '[]'::jsonb)) = 0 then
    raise exception 'Penawaran minimal berisi satu produk.';
  end if;
  if coalesce(trim(p_customer ->> 'companyName'), '') = '' then
    raise exception 'Nama customer wajib diisi.';
  end if;

  select * into v_me from public.profiles where id = auth.uid();

  if p_existing_id is not null then
    select id into v_id from public.quotations
     where id = p_existing_id and sales_id = auth.uid() and status in ('DRAFT', 'REJECTED', 'PENDING_REVIEW')
     for update;
    if v_id is null then
      raise exception 'Penawaran tidak ditemukan atau sudah tidak bisa direvisi.';
    end if;
    delete from public.quotation_items where quotation_id = v_id;
    update public.quotations
       set customer = p_customer, sales_notes = coalesce(p_sales_notes, ''), status = 'PENDING_REVIEW',
           rejection_reason = null, history = history || public._history_event('Direvisi dan diajukan ulang')
     where id = v_id;
  else
    perform pg_advisory_xact_lock(hashtext('agusta_quotation_number'));
    select coalesce(max((substring(quotation_number from '(\d+)$'))::integer), 0) + 1 into v_seq from public.quotations;
    insert into public.quotations (
      quotation_number, issued_on, valid_until, status, customer, sales_id, sales_name, sales_phone,
      sales_notes, whatsapp_status, history
    ) values (
      'QTN-' || to_char(v_today, 'YYMMDD') || '-' || lpad(v_seq::text, 4, '0'), v_today, v_today + 14,
      'PENDING_REVIEW', p_customer, auth.uid(), v_me.name, v_me.phone, coalesce(p_sales_notes, ''), 'PENDING',
      jsonb_build_array(public._history_event('Diajukan ke Sales Support'))
    ) returning id into v_id;
  end if;

  for v_item in select value from jsonb_array_elements(p_items) loop
    select * into v_prod from public.products where id = v_item ->> 'productId';
    if not found then
      raise exception 'Produk % tidak ditemukan di katalog.', v_item ->> 'productId';
    end if;
    select cogs into v_cost from public.product_costs where product_id = v_prod.id;
    v_pos := v_pos + 1;
    insert into public.quotation_items (
      quotation_id, position, product_id, product_name, sku, category, image, qty, unit,
      base_price, selling_price, discount_percent, notes, specs
    ) values (
      v_id, v_pos, v_prod.id, v_prod.name, v_prod.sku, v_prod.category, v_prod.image,
      greatest(1, coalesce((v_item ->> 'qty')::integer, 1)), v_prod.unit, v_prod.base_price, v_prod.base_price,
      least(100, greatest(0, coalesce((v_item ->> 'discountPercent')::numeric, 0))),
      nullif(trim(coalesce(v_item ->> 'notes', '')), ''), v_prod.specs
    ) returning id into v_item_id;
    insert into public.quotation_item_costs (item_id, cogs) values (v_item_id, coalesce(v_cost, 0));
  end loop;

  perform public._recalc_quotation(v_id);
  return v_id;
end $$;

create or replace function public.save_quotation_pricing(p_id uuid, p_items jsonb, p_support_notes text default null)
returns void language plpgsql security definer set search_path = public as $$
begin
  perform public._require_reviewer();
  if not exists (select 1 from public.quotations where id = p_id and status = 'PENDING_REVIEW') then
    raise exception 'Penawaran ini tidak sedang menunggu review.';
  end if;
  perform public._apply_pricing(p_id, p_items);
  update public.quotations set support_notes = coalesce(p_support_notes, support_notes) where id = p_id;
end $$;

create or replace function public.approve_quotation(p_id uuid, p_items jsonb, p_support_notes text default null)
returns void language plpgsql security definer set search_path = public as $$
begin
  perform public._require_reviewer();
  perform 1 from public.quotations where id = p_id and status = 'PENDING_REVIEW' for update;
  if not found then
    raise exception 'Penawaran ini tidak sedang menunggu review.';
  end if;
  perform public._apply_pricing(p_id, p_items);
  update public.quotations
     set status = 'APPROVED',
         support_notes = p_support_notes,
         reviewed_by = public.app_user_name(),
         reviewed_by_id = auth.uid(),
         reviewed_at = now(),
         pdf_generated_at = now(),
         history = history || public._history_event('Disetujui, PDF diterbitkan')
   where id = p_id;
end $$;

create or replace function public.reject_quotation(p_id uuid, p_reason text)
returns void language plpgsql security definer set search_path = public as $$
begin
  perform public._require_reviewer();
  if length(trim(coalesce(p_reason, ''))) < 10 then
    raise exception 'Tulis alasan minimal 10 karakter.';
  end if;
  update public.quotations
     set status = 'REJECTED',
         rejection_reason = trim(p_reason),
         reviewed_by = public.app_user_name(),
         reviewed_by_id = auth.uid(),
         reviewed_at = now(),
         history = history || public._history_event('Dikembalikan untuk revisi', trim(p_reason))
   where id = p_id and status = 'PENDING_REVIEW';
  if not found then
    raise exception 'Penawaran ini tidak sedang menunggu review.';
  end if;
end $$;

create or replace function public.set_quotation_pdf(p_id uuid, p_path text)
returns void language plpgsql security definer set search_path = public as $$
begin
  perform public._require_reviewer();
  update public.quotations set pdf_path = p_path, updated_at = now()
   where id = p_id and status in ('APPROVED', 'PDF_SENT');
  if not found then
    raise exception 'PDF hanya bisa dilampirkan pada penawaran yang sudah disetujui.';
  end if;
end $$;

-- Called only by the server (service role) after the WhatsApp API call.
create or replace function public.record_whatsapp_sent(p_id uuid, p_by text, p_message_id text, p_simulated boolean)
returns void language plpgsql security definer set search_path = public as $$
begin
  update public.quotations
     set status = 'PDF_SENT',
         whatsapp_status = 'SENT',
         whatsapp_message_id = p_message_id,
         updated_at = now(),
         history = history || jsonb_build_object(
           'at', now(), 'by', p_by,
           'label', case when p_simulated then 'Dikirim ke WhatsApp Sales (mode simulasi)' else 'Dikirim ke WhatsApp Sales' end)
   where id = p_id;
end $$;

-- ───────────────────────────── Custom requests ───────────────────
create or replace function public.submit_custom_request(
  p_product_name text, p_category text, p_estimated_qty integer, p_target_price bigint,
  p_specs text, p_reference text default ''
) returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_id uuid;
begin
  if public.app_role() is distinct from 'SALES' then
    raise exception 'Hanya Sales yang dapat mengajukan barang custom.' using errcode = '42501';
  end if;
  insert into public.custom_requests (sales_id, sales_name, product_name, category, estimated_qty, target_price_per_unit, specs, reference_url_or_notes)
  values (auth.uid(), public.app_user_name(), trim(p_product_name), p_category, greatest(1, p_estimated_qty),
          greatest(0, coalesce(p_target_price, 0)), trim(p_specs), coalesce(p_reference, ''))
  returning id into v_id;
  return v_id;
end $$;

-- Approving a price also publishes the item to the catalog so Sales can quote it.
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
  if p_status <> 'REJECTED' and (coalesce(p_cogs, 0) <= 0 or coalesce(p_selling_price, 0) <= 0) then
    raise exception 'Isi HPP dan harga jual terlebih dahulu.';
  end if;

  v_product_id := v_req.product_id;
  if p_status = 'APPROVED' then
    v_key := upper(left(replace(v_req.id::text, '-', ''), 8));
    v_product_id := coalesce(v_product_id, 'prod-custom-' || lower(v_key));
    insert into public.products (id, name, sku, category, brand, base_price, image, stock, unit, specs, description, is_custom, keywords)
    values (v_product_id, upper(v_req.product_name), 'CST-' || v_key, v_req.category, 'Custom', p_selling_price, '',
            v_req.estimated_qty, 'Unit', v_req.specs,
            coalesce(nullif(trim(p_support_notes), ''), 'Barang custom, dibuat sesuai pesanan.'), true,
            array['custom'] || regexp_split_to_array(lower(v_req.product_name), '\s+'))
    on conflict (id) do update
      set base_price = excluded.base_price, description = excluded.description, specs = excluded.specs;
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

-- ───────────────────────────── Catalog & rules ───────────────────
create or replace function public.update_product_pricing(p_id text, p_cogs bigint default null, p_base_price bigint default null, p_stock integer default null)
returns void language plpgsql security definer set search_path = public as $$
begin
  perform public._require_reviewer();
  update public.products
     set base_price = coalesce(p_base_price, base_price), stock = coalesce(p_stock, stock)
   where id = p_id;
  if not found then
    raise exception 'Produk tidak ditemukan.';
  end if;
  if p_cogs is not null then
    insert into public.product_costs (product_id, cogs) values (p_id, p_cogs)
    on conflict (product_id) do update set cogs = excluded.cogs, updated_at = now();
  end if;
end $$;

-- p_rules: [{ minQty, maxQty?, customerCategory?, suggestedDiscount, maxAllowedDiscount, minMarginPercent }]
create or replace function public.replace_discount_rules(p_rules jsonb)
returns void language plpgsql security definer set search_path = public as $$
begin
  perform public._require_reviewer();
  delete from public.discount_rules where true;
  insert into public.discount_rules (position, min_qty, max_qty, customer_category, suggested_discount, max_allowed_discount, min_margin_percent)
  select ord, (r ->> 'minQty')::integer, nullif(r ->> 'maxQty', '')::integer, nullif(r ->> 'customerCategory', ''),
         (r ->> 'suggestedDiscount')::numeric, (r ->> 'maxAllowedDiscount')::numeric, (r ->> 'minMarginPercent')::numeric
    from jsonb_array_elements(coalesce(p_rules, '[]'::jsonb)) with ordinality as t(r, ord);
end $$;

create or replace function public.touch_last_login()
returns void language sql security definer set search_path = public as $$
  update public.profiles set last_login_at = now() where id = auth.uid()
$$;

-- ───────────────────────────── Function grants ───────────────────
revoke execute on function public._require_reviewer() from public, anon, authenticated;
revoke execute on function public._history_event(text, text) from public, anon, authenticated;
revoke execute on function public._recalc_quotation(uuid) from public, anon, authenticated;
revoke execute on function public._apply_pricing(uuid, jsonb) from public, anon, authenticated;
revoke execute on function public.record_whatsapp_sent(uuid, text, text, boolean) from public, anon, authenticated;
grant execute on function public.record_whatsapp_sent(uuid, text, text, boolean) to service_role;

revoke execute on function public.submit_quotation(jsonb, jsonb, text, uuid) from public, anon;
revoke execute on function public.save_quotation_pricing(uuid, jsonb, text) from public, anon;
revoke execute on function public.approve_quotation(uuid, jsonb, text) from public, anon;
revoke execute on function public.reject_quotation(uuid, text) from public, anon;
revoke execute on function public.set_quotation_pdf(uuid, text) from public, anon;
revoke execute on function public.submit_custom_request(text, text, integer, bigint, text, text) from public, anon;
revoke execute on function public.price_custom_request(uuid, bigint, bigint, text, text) from public, anon;
revoke execute on function public.update_product_pricing(text, bigint, bigint, integer) from public, anon;
revoke execute on function public.replace_discount_rules(jsonb) from public, anon;
revoke execute on function public.touch_last_login() from public, anon;
grant execute on function public.submit_quotation(jsonb, jsonb, text, uuid) to authenticated;
grant execute on function public.save_quotation_pricing(uuid, jsonb, text) to authenticated;
grant execute on function public.approve_quotation(uuid, jsonb, text) to authenticated;
grant execute on function public.reject_quotation(uuid, text) to authenticated;
grant execute on function public.set_quotation_pdf(uuid, text) to authenticated;
grant execute on function public.submit_custom_request(text, text, integer, bigint, text, text) to authenticated;
grant execute on function public.price_custom_request(uuid, bigint, bigint, text, text) to authenticated;
grant execute on function public.update_product_pricing(text, bigint, bigint, integer) to authenticated;
grant execute on function public.replace_discount_rules(jsonb) to authenticated;
grant execute on function public.touch_last_login() to authenticated;

-- ───────────────────────────── Row level security ────────────────
-- Clients may only read; all writes go through the functions above (which run as owner).
revoke insert, update, delete, truncate on all tables in schema public from anon, authenticated;

alter table public.profiles enable row level security;
alter table public.products enable row level security;
alter table public.product_costs enable row level security;
alter table public.discount_rules enable row level security;
alter table public.quotations enable row level security;
alter table public.quotation_costs enable row level security;
alter table public.quotation_items enable row level security;
alter table public.quotation_item_costs enable row level security;
alter table public.custom_requests enable row level security;
alter table public.custom_request_costs enable row level security;

drop policy if exists "profiles readable by active users" on public.profiles;
create policy "profiles readable by active users" on public.profiles
  for select to authenticated using (public.app_role() is not null or id = auth.uid());

drop policy if exists "products readable" on public.products;
create policy "products readable" on public.products
  for select to authenticated using (public.app_role() is not null);

drop policy if exists "product costs for reviewers" on public.product_costs;
create policy "product costs for reviewers" on public.product_costs
  for select to authenticated using (public.is_reviewer());

drop policy if exists "discount rules readable" on public.discount_rules;
create policy "discount rules readable" on public.discount_rules
  for select to authenticated using (public.app_role() is not null);

drop policy if exists "quotations visible to owner or reviewer" on public.quotations;
create policy "quotations visible to owner or reviewer" on public.quotations
  for select to authenticated using (public.is_reviewer() or (public.app_role() = 'SALES' and sales_id = auth.uid()));

drop policy if exists "quotation items follow quotation" on public.quotation_items;
create policy "quotation items follow quotation" on public.quotation_items
  for select to authenticated using (
    exists (select 1 from public.quotations q where q.id = quotation_id
            and (public.is_reviewer() or (public.app_role() = 'SALES' and q.sales_id = auth.uid())))
  );

drop policy if exists "quotation costs for reviewers" on public.quotation_costs;
create policy "quotation costs for reviewers" on public.quotation_costs
  for select to authenticated using (public.is_reviewer());

drop policy if exists "quotation item costs for reviewers" on public.quotation_item_costs;
create policy "quotation item costs for reviewers" on public.quotation_item_costs
  for select to authenticated using (public.is_reviewer());

drop policy if exists "custom requests visible to owner or reviewer" on public.custom_requests;
create policy "custom requests visible to owner or reviewer" on public.custom_requests
  for select to authenticated using (public.is_reviewer() or (public.app_role() = 'SALES' and sales_id = auth.uid()));

drop policy if exists "custom request costs for reviewers" on public.custom_request_costs;
create policy "custom request costs for reviewers" on public.custom_request_costs
  for select to authenticated using (public.is_reviewer());

-- ───────────────────────────── Storage (PDF) ─────────────────────
insert into storage.buckets (id, name, public)
values ('quotations', 'quotations', false)
on conflict (id) do nothing;

drop policy if exists "reviewers manage quotation pdfs" on storage.objects;
create policy "reviewers manage quotation pdfs" on storage.objects
  for all to authenticated
  using (bucket_id = 'quotations' and public.is_reviewer())
  with check (bucket_id = 'quotations' and public.is_reviewer());

drop policy if exists "sales read own quotation pdfs" on storage.objects;
create policy "sales read own quotation pdfs" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'quotations'
    and exists (select 1 from public.quotations q where q.pdf_path = name and q.sales_id = auth.uid())
  );

-- ───────────────────────────── Realtime ──────────────────────────
do $$ begin
  alter publication supabase_realtime add table public.quotations, public.custom_requests;
exception when duplicate_object then null; when undefined_object then null; end $$;
