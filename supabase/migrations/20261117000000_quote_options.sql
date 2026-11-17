-- Agusta Quotation System — revisi tahap 1
-- Run after 20261112000000_supplier_research.sql.
--
-- * extra_discount: quotation-level discount in rupiah (diskon tambahan), set by Sales when submitting
--   and adjustable by Sales Support during review. Applied to the item lines before PPN.
-- * show_tax / show_discount: how the PDF presents the quotation (Sales Support decides).
-- * Customer phone and segment are optional: customer is jsonb, nothing to migrate.

alter table public.quotations add column if not exists extra_discount bigint not null default 0 check (extra_discount >= 0);
alter table public.quotations add column if not exists show_tax boolean not null default true;
alter table public.quotations add column if not exists show_discount boolean not null default true;

-- Same as in 20261109000000_init.sql, plus the extra discount before PPN.
create or replace function public._recalc_quotation(p_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_items bigint;
  v_extra bigint;
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
  v_sub := v_items - coalesce(v_extra, 0);
  v_tax := round(v_sub * 11 / 100.0);

  update public.quotations
     set subtotal = v_sub, tax_rate_percent = 11, tax_amount = v_tax, grand_total = v_sub + v_tax, updated_at = now()
   where id = p_id;

  insert into public.quotation_costs (quotation_id, total_cogs, gross_profit, gross_margin_percent)
  values (p_id, v_cogs, v_sub - v_cogs, case when v_sub > 0 then round((v_sub - v_cogs)::numeric / v_sub * 100, 2) else 0 end)
  on conflict (quotation_id) do update
    set total_cogs = excluded.total_cogs, gross_profit = excluded.gross_profit, gross_margin_percent = excluded.gross_margin_percent;
end $$;

-- Sales (owner) may set the extra discount; Sales Support / Management may set everything.
-- Only while the quotation waits for review. Null arguments leave the value unchanged.
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
  if q.status <> 'PENDING_REVIEW' then
    raise exception 'Pengaturan penawaran hanya bisa diubah selama menunggu review.';
  end if;

  if public.is_reviewer() then
    null;
  elsif public.app_role() = 'SALES' and q.sales_id = auth.uid() then
    if p_show_tax is not null or p_show_discount is not null then
      raise exception 'Tampilan PPN dan diskon diatur oleh Sales Support.' using errcode = '42501';
    end if;
  else
    raise exception 'Anda tidak memiliki akses untuk mengubah penawaran ini.' using errcode = '42501';
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

revoke execute on function public.set_quotation_adjustments(uuid, bigint, boolean, boolean) from public, anon;
grant execute on function public.set_quotation_adjustments(uuid, bigint, boolean, boolean) to authenticated;
