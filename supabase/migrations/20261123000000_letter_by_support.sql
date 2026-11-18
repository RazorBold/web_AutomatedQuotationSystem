-- Agusta Quotation System — letter format belongs to Sales Support
-- Run after 20261122000000_letter_format.sql.
--
-- Revisi baru (Sales 2): the Keterangan of the letter (PPN, discount display, terms, payment terms)
-- is set by Sales Support (or Management) at review. Sales no longer sets it; charges stay with Sales.

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
  if not public.is_reviewer() then
    raise exception 'Keterangan surat diatur oleh Sales Support.' using errcode = '42501';
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
