-- Agusta Quotation System — revisi tahap 4
-- Run after 20261119000000_tahap3_followup.sql.
--
-- R10  Supplier / distributor websites searched by the market research panel (list kept here).
-- R9   Supplier price lists update HPP in bulk (preview in the app, applied here) and every HPP
--      change — manual or imported — is kept in a price history.

-- ───────────────────────────── R10: supplier websites ─────────────────────────────
create table if not exists public.supplier_sites (
  id uuid primary key default gen_random_uuid(),
  position integer not null default 0,
  name text not null check (length(trim(name)) between 1 and 120),
  domain text not null unique check (domain ~ '^([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,24}$'),
  created_at timestamptz not null default now()
);
alter table public.supplier_sites enable row level security;
revoke insert, update, delete, truncate on public.supplier_sites from anon, authenticated;
drop policy if exists "supplier sites for reviewers" on public.supplier_sites;
create policy "supplier sites for reviewers" on public.supplier_sites
  for select to authenticated using (public.is_reviewer());

-- Replaces the whole list (the settings screen saves it as one list).
create or replace function public.replace_supplier_sites(p_sites jsonb)
returns void language plpgsql security definer set search_path = public as $$
declare
  s jsonb;
  i integer := 0;
  v_domain text;
begin
  perform public._require_reviewer();
  if jsonb_typeof(p_sites) <> 'array' or jsonb_array_length(p_sites) > 15 then
    raise exception 'Maksimal 15 website supplier.';
  end if;
  delete from public.supplier_sites where true;
  for s in select * from jsonb_array_elements(p_sites) loop
    v_domain := lower(trim(coalesce(s ->> 'domain', '')));
    v_domain := regexp_replace(regexp_replace(v_domain, '^[a-z]+://', ''), '^www\.', '');
    v_domain := split_part(split_part(split_part(v_domain, '/', 1), '?', 1), ':', 1);
    if v_domain !~ '^([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,24}$' then
      raise exception 'Alamat website tidak valid: %', coalesce(s ->> 'domain', '');
    end if;
    if length(trim(coalesce(s ->> 'name', ''))) = 0 then
      raise exception 'Nama supplier untuk % wajib diisi.', v_domain;
    end if;
    insert into public.supplier_sites (position, name, domain)
    values (i, left(trim(s ->> 'name'), 120), v_domain)
    on conflict (domain) do nothing;
    i := i + 1;
  end loop;
end $$;
revoke execute on function public.replace_supplier_sites(jsonb) from public, anon;
grant execute on function public.replace_supplier_sites(jsonb) to authenticated;

-- ───────────────────────────── R9: HPP history ─────────────────────────────
create table if not exists public.product_price_history (
  id uuid primary key default gen_random_uuid(),
  product_id text not null references public.products (id) on delete cascade,
  old_cogs bigint,
  new_cogs bigint not null,
  source text not null default 'MANUAL' check (source in ('MANUAL', 'IMPORT')),
  reference text,
  changed_by uuid references public.profiles (id),
  changed_by_name text not null default 'Sistem',
  created_at timestamptz not null default now()
);
create index if not exists product_price_history_created_idx on public.product_price_history (created_at desc);
create index if not exists product_price_history_product_idx on public.product_price_history (product_id, created_at desc);
alter table public.product_price_history enable row level security;
revoke insert, update, delete, truncate on public.product_price_history from anon, authenticated;
drop policy if exists "price history for reviewers" on public.product_price_history;
create policy "price history for reviewers" on public.product_price_history
  for select to authenticated using (public.is_reviewer());

-- Every HPP change is logged, whoever makes it. An import sets app.price_source / app.price_reference
-- for its transaction so the log says where the number came from.
create or replace function public._log_cogs_change()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'UPDATE' and new.cogs is not distinct from old.cogs then
    return new;
  end if;
  if tg_op = 'INSERT' and (new.cogs = 0 or auth.uid() is null) then
    return new; -- empty cost row for a website product, or the initial data load (seed script)
  end if;
  insert into public.product_price_history (product_id, old_cogs, new_cogs, source, reference, changed_by, changed_by_name)
  values (
    new.product_id,
    case when tg_op = 'UPDATE' then old.cogs end,
    new.cogs,
    coalesce(nullif(current_setting('app.price_source', true), ''), 'MANUAL'),
    nullif(current_setting('app.price_reference', true), ''),
    auth.uid(),
    coalesce(public.app_user_name(), 'Sistem')
  );
  return new;
end $$;
drop trigger if exists product_costs_history on public.product_costs;
create trigger product_costs_history after insert or update of cogs on public.product_costs
  for each row execute function public._log_cogs_change();

-- Applies a reviewed price list: [{productId, cogs}] → product_costs. Returns the number changed.
create or replace function public.apply_price_list(p_reference text, p_changes jsonb)
returns integer language plpgsql security definer set search_path = public as $$
declare
  c jsonb;
  v_cogs bigint;
  v_count integer := 0;
  v_old bigint;
begin
  perform public._require_reviewer();
  if jsonb_typeof(p_changes) <> 'array' or jsonb_array_length(p_changes) = 0 then
    raise exception 'Tidak ada perubahan harga untuk disimpan.';
  end if;
  if jsonb_array_length(p_changes) > 2000 then
    raise exception 'Maksimal 2.000 produk per import.';
  end if;
  perform set_config('app.price_source', 'IMPORT', true);
  perform set_config('app.price_reference', left(coalesce(nullif(trim(p_reference), ''), 'Price list'), 160), true);

  for c in select * from jsonb_array_elements(p_changes) loop
    v_cogs := (c ->> 'cogs')::bigint;
    if v_cogs is null or v_cogs <= 0 then
      raise exception 'HPP baru harus lebih dari 0 (produk %).', c ->> 'productId';
    end if;
    if not exists (select 1 from public.products where id = c ->> 'productId') then
      raise exception 'Produk % tidak ditemukan.', c ->> 'productId';
    end if;
    select cogs into v_old from public.product_costs where product_id = c ->> 'productId';
    if v_old is distinct from v_cogs then
      insert into public.product_costs (product_id, cogs) values (c ->> 'productId', v_cogs)
      on conflict (product_id) do update set cogs = excluded.cogs, updated_at = now();
      v_count := v_count + 1;
    end if;
  end loop;

  perform set_config('app.price_source', '', true);
  perform set_config('app.price_reference', '', true);
  return v_count;
end $$;
revoke execute on function public.apply_price_list(text, jsonb) from public, anon;
grant execute on function public.apply_price_list(text, jsonb) to authenticated;
