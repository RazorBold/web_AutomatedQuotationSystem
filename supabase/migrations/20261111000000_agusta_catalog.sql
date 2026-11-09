-- Agusta Quotation System — catalog aligned with agusta.co.id
-- Run after 20261110000000_notifications.sql.
--
-- * products can be imported from agusta.co.id (source_id / source_url). The website has no prices,
--   so imported products start at base_price 0 and cannot be quoted until Sales Support prices them.
-- * custom requests can carry the photo + page of an item found on agusta.co.id.

alter table public.products add column if not exists source_id text;
alter table public.products add column if not exists source_url text;
alter table public.products add column if not exists synced_at timestamptz;
create unique index if not exists products_source_id_key on public.products (source_id) where source_id is not null;

alter table public.custom_requests add column if not exists image_url text;
alter table public.custom_requests add column if not exists source_url text;

-- Only photos/pages on agusta.co.id are accepted from the client.
create or replace function public._agusta_image(p_path text)
returns text language sql immutable as $$
  select case when p_path ~ '^products/[A-Za-z0-9_-]{6,80}\.(png|jpe?g|webp)$'
              then 'https://agusta.co.id/storage/' || p_path else '' end
$$;
create or replace function public._agusta_url(p_url text)
returns text language sql immutable as $$
  select case when p_url ~ '^https://agusta\.co\.id/[A-Za-z0-9/_.%-]*$' then p_url end
$$;

-- ───────────────────────────── No quoting without a price ────────
create or replace function public.quotation_items_require_price()
returns trigger language plpgsql as $$
begin
  if coalesce(new.base_price, 0) <= 0 then
    raise exception 'Harga % belum diisi Sales Support. Ajukan "Minta harga" terlebih dahulu.', new.product_name;
  end if;
  return new;
end $$;

drop trigger if exists quotation_items_require_price on public.quotation_items;
create trigger quotation_items_require_price
  before insert on public.quotation_items
  for each row execute function public.quotation_items_require_price();

-- ───────────────────────────── Import from agusta.co.id ──────────
-- p_items: [{ sourceId, name, sku, category, categorySlug, imagePath, specs, description, url }]
-- Existing products (same source_id, or same name not yet linked) keep their price, stock and name;
-- the website refreshes photo (when empty), specs, category (for website products) and the link.
create or replace function public.import_agusta_products(p_items jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v jsonb;
  v_id text;
  v_sku text;
  v_inserted integer := 0;
  v_updated integer := 0;
begin
  perform public._require_reviewer();
  if jsonb_array_length(coalesce(p_items, '[]'::jsonb)) > 200 then
    raise exception 'Maksimal 200 produk per impor.';
  end if;

  for v in select value from jsonb_array_elements(coalesce(p_items, '[]'::jsonb)) loop
    continue when coalesce(v ->> 'sourceId', '') = '' or coalesce(trim(v ->> 'name'), '') = '';

    select id into v_id from public.products where source_id = v ->> 'sourceId';
    if v_id is null then
      select id into v_id from public.products
       where source_id is null and upper(trim(name)) = upper(trim(v ->> 'name'))
       limit 1;
    end if;

    if v_id is not null then
      update public.products
         set category = case when source_id is not null then coalesce(nullif(v ->> 'category', ''), category) else category end,
             image = case when image = '' then public._agusta_image(v ->> 'imagePath') else image end,
             specs = coalesce(nullif(left(v ->> 'specs', 600), ''), specs),
             source_id = v ->> 'sourceId',
             source_url = coalesce(public._agusta_url(v ->> 'url'), source_url),
             synced_at = now()
       where id = v_id;
      v_updated := v_updated + 1;
    else
      v_sku := left(coalesce(nullif(trim(v ->> 'sku'), ''), 'AGT-' || (v ->> 'sourceId')), 60);
      if exists (select 1 from public.products where sku = v_sku) then
        v_sku := v_sku || '-' || (v ->> 'sourceId');
      end if;
      insert into public.products (
        id, name, sku, category, brand, base_price, image, stock, unit, specs, description, keywords,
        source_id, source_url, synced_at
      ) values (
        'agusta-' || (v ->> 'sourceId'), upper(left(trim(v ->> 'name'), 200)), v_sku,
        coalesce(nullif(v ->> 'category', ''), 'Lainnya'), '', 0, public._agusta_image(v ->> 'imagePath'), 0, 'Unit',
        left(coalesce(v ->> 'specs', ''), 600), left(coalesce(v ->> 'description', ''), 240),
        array[replace(coalesce(v ->> 'categorySlug', ''), '-', ' ')],
        v ->> 'sourceId', public._agusta_url(v ->> 'url'), now()
      ) on conflict (id) do nothing;
      v_inserted := v_inserted + 1;
    end if;
  end loop;

  return jsonb_build_object('inserted', v_inserted, 'updated', v_updated);
end $$;

revoke execute on function public.import_agusta_products(jsonb) from public, anon;
grant execute on function public.import_agusta_products(jsonb) to authenticated;

-- ───────────────────────────── Custom requests with photo/link ───
drop function if exists public.submit_custom_request(text, text, integer, bigint, text, text);

create or replace function public.submit_custom_request(
  p_product_name text, p_category text, p_estimated_qty integer, p_target_price bigint,
  p_specs text, p_reference text default '', p_image_url text default null, p_source_url text default null
) returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_id uuid;
begin
  if public.app_role() is distinct from 'SALES' then
    raise exception 'Hanya Sales yang dapat mengajukan barang custom.' using errcode = '42501';
  end if;
  insert into public.custom_requests (
    sales_id, sales_name, product_name, category, estimated_qty, target_price_per_unit, specs,
    reference_url_or_notes, image_url, source_url
  ) values (
    auth.uid(), public.app_user_name(), trim(p_product_name), p_category, greatest(1, p_estimated_qty),
    greatest(0, coalesce(p_target_price, 0)), trim(p_specs), coalesce(p_reference, ''),
    case when p_image_url like 'https://agusta.co.id/storage/products/%' then p_image_url end,
    public._agusta_url(p_source_url)
  ) returning id into v_id;
  return v_id;
end $$;

revoke execute on function public.submit_custom_request(text, text, integer, bigint, text, text, text, text) from public, anon;
grant execute on function public.submit_custom_request(text, text, integer, bigint, text, text, text, text) to authenticated;

-- Same as in 20261109000000_init.sql, plus: the approved catalog product takes the request's photo and link.
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
    insert into public.products (id, name, sku, category, brand, base_price, image, stock, unit, specs, description, is_custom, keywords, source_url)
    values (v_product_id, upper(v_req.product_name), 'CST-' || v_key, v_req.category, 'Custom', p_selling_price,
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
