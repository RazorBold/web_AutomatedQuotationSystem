-- Agusta Quotation System — catalog sync from Airtable
-- Run after 20261120000000_tahap4_supplier.sql.
--
-- Agusta keeps its product catalog (with selling prices) in Airtable. "Sinkronkan dari Airtable"
-- reads it page by page through /api/airtable-catalog and upserts it here.
-- * Airtable is the price master: name, brand, category, selling price, specs, dimensions and photo
--   are refreshed on every sync. HPP and stock stay in the portal.
-- * Photos are copied into the public bucket `product-images` (Airtable's own links expire).

insert into storage.buckets (id, name, public)
values ('product-images', 'product-images', true)
on conflict (id) do update set public = true;

-- Only photos copied by the sync into our own bucket are accepted from the client.
create or replace function public._airtable_image(p_url text)
returns text language sql immutable as $$
  select case
    when p_url ~ '^https://[a-z0-9]{10,40}\.supabase\.co/storage/v1/object/public/product-images/airtable/att[A-Za-z0-9]{8,24}\.(png|jpg|webp|gif)$'
    then p_url else '' end
$$;

-- p_items: [{ sourceId: "airtable:rec…", name, sku, brand, category, price, specs, dimensions, image }]
create or replace function public.import_airtable_products(p_items jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v jsonb;
  v_id text;
  v_sku text;
  v_rec text;
  v_price bigint;
  v_image text;
  v_brand text;
  v_category text;
  v_inserted integer := 0;
  v_updated integer := 0;
begin
  perform public._require_reviewer();
  if jsonb_array_length(coalesce(p_items, '[]'::jsonb)) > 200 then
    raise exception 'Maksimal 200 produk per impor.';
  end if;

  for v in select value from jsonb_array_elements(coalesce(p_items, '[]'::jsonb)) loop
    continue when coalesce(v ->> 'sourceId', '') !~ '^airtable:rec[A-Za-z0-9]{8,24}$'
               or coalesce(trim(v ->> 'name'), '') = '';
    v_rec := substr(v ->> 'sourceId', 10);
    v_price := greatest(0, coalesce(nullif(v ->> 'price', '')::numeric, 0))::bigint;
    v_image := public._airtable_image(v ->> 'image');
    v_brand := upper(left(trim(coalesce(v ->> 'brand', '')), 60));
    v_category := coalesce(nullif(left(trim(v ->> 'category'), 80), ''), 'Lainnya');

    select id into v_id from public.products where source_id = v ->> 'sourceId';

    if v_id is not null then
      update public.products
         set name = upper(left(trim(v ->> 'name'), 200)),
             brand = coalesce(nullif(v_brand, ''), brand),
             category = v_category,
             base_price = case when v_price > 0 then v_price else base_price end,
             specs = left(coalesce(v ->> 'specs', ''), 600),
             dimensions = nullif(left(trim(coalesce(v ->> 'dimensions', '')), 80), ''),
             image = case when v_image <> '' then v_image else image end,
             synced_at = now()
       where id = v_id;
      v_updated := v_updated + 1;
    else
      v_sku := left(coalesce(nullif(upper(trim(v ->> 'sku')), ''), 'AT-' || upper(v_rec)), 60);
      if exists (select 1 from public.products where upper(sku) = upper(v_sku)) then
        v_sku := left(v_sku, 45) || '-' || upper(right(v_rec, 6));
      end if;
      insert into public.products (
        id, name, sku, category, brand, base_price, image, stock, unit, dimensions, specs, description, keywords,
        source_id, synced_at
      ) values (
        'at-' || v_rec, upper(left(trim(v ->> 'name'), 200)), v_sku, v_category, v_brand, v_price, v_image,
        0, 'Unit', nullif(left(trim(coalesce(v ->> 'dimensions', '')), 80), ''), left(coalesce(v ->> 'specs', ''), 600), '',
        array(select distinct w from unnest(regexp_split_to_array(lower(v_brand || ' ' || v_category), '[\s/&]+')) w where length(w) >= 3),
        v ->> 'sourceId', now()
      ) on conflict (id) do nothing;
      v_inserted := v_inserted + 1;
    end if;
  end loop;

  return jsonb_build_object('inserted', v_inserted, 'updated', v_updated);
end $$;

revoke execute on function public.import_airtable_products(jsonb) from public, anon;
grant execute on function public.import_airtable_products(jsonb) to authenticated;
