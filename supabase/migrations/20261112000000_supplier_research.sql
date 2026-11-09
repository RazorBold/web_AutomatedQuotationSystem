-- Agusta Quotation System — supplier reference from market price research
-- Run after 20261111000000_agusta_catalog.sql.
--
-- The supplier chosen for a custom request (store, link, buy price) is as sensitive as HPP, so it
-- lives in custom_request_costs, which only SALES_SUPPORT and MANAGEMENT can read (RLS).

alter table public.custom_request_costs alter column assigned_cogs drop not null;
alter table public.custom_request_costs add column if not exists supplier_name text;
alter table public.custom_request_costs add column if not exists supplier_url text;
alter table public.custom_request_costs add column if not exists supplier_price bigint check (supplier_price is null or supplier_price >= 0);
alter table public.custom_request_costs add column if not exists supplier_set_at timestamptz;

-- p_name null/empty → clears the supplier reference.
create or replace function public.set_custom_request_supplier(p_id uuid, p_name text, p_url text, p_price bigint)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_name text := nullif(left(trim(coalesce(p_name, '')), 120), '');
  v_url text := case when length(p_url) <= 500 and p_url ~ '^https?://[^[:space:]]{3,}$' then p_url end;
begin
  perform public._require_reviewer();
  if not exists (select 1 from public.custom_requests where id = p_id) then
    raise exception 'Request tidak ditemukan.';
  end if;
  insert into public.custom_request_costs (request_id, supplier_name, supplier_url, supplier_price, supplier_set_at)
  values (p_id, v_name, case when v_name is null then null else v_url end,
          case when v_name is null then null else greatest(0, coalesce(p_price, 0)) end, now())
  on conflict (request_id) do update
    set supplier_name = excluded.supplier_name,
        supplier_url = excluded.supplier_url,
        supplier_price = excluded.supplier_price,
        supplier_set_at = excluded.supplier_set_at;
end $$;

revoke execute on function public.set_custom_request_supplier(uuid, text, text, bigint) from public, anon;
grant execute on function public.set_custom_request_supplier(uuid, text, text, bigint) to authenticated;
