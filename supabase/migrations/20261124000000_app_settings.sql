-- Agusta Quotation System — "Pengaturan": company letterhead, bank accounts, letter templates
-- Run after 20261123000000_letter_by_support.sql.
--
-- * app_settings: one JSON value per key. Everyone signed in reads it (the letter needs it);
--   Sales Support and Management change it through set_app_setting().
--     company          { name, street, city, country, phone, whatsapp, email, place }
--     banks            [{ id, bank, holder, account, isDefault }]   — exactly one default
--     letter_templates { defaultTerms: [..], suggestions: [..], paymentPresets: [{ label, terms: [{ label, percent }] }] }
-- * quotations.bank_account: the account printed on this letter (a copy, so later edits to the
--   list never change an issued letter). Null = the default account.

create table if not exists public.app_settings (
  key text primary key check (key in ('company', 'banks', 'letter_templates')),
  value jsonb not null,
  updated_at timestamptz not null default now(),
  updated_by_name text
);
alter table public.app_settings enable row level security;
revoke insert, update, delete, truncate on public.app_settings from anon, authenticated;
drop policy if exists "settings readable by signed-in users" on public.app_settings;
create policy "settings readable by signed-in users" on public.app_settings for select to authenticated using (true);

insert into public.app_settings (key, value) values
  ('company', jsonb_build_object(
     'name', 'PT. Agusta Triasa', 'street', 'Jl. Pandanaran No.62', 'city', 'Semarang 50134', 'country', 'INDONESIA',
     'phone', '024 844 733', 'whatsapp', '0857 2706 6550', 'email', 'agusta@agusta.co.id', 'place', 'Semarang')),
  ('banks', jsonb_build_array(jsonb_build_object(
     'id', 'bca-gang-tengah', 'bank', 'BANK BCA Cabang Gang Tengah, Semarang', 'holder', 'PT AGUSTA TRIASA',
     'account', '182 9888 333', 'isDefault', true))),
  ('letter_templates', jsonb_build_object(
     'defaultTerms', jsonb_build_array('Harga franco Kota Semarang', 'Harga dan stok tidak mengikat'),
     'suggestions', jsonb_build_array(
       'Harga franco Kota Semarang', 'Harga dan stok tidak mengikat', 'Sudah termasuk pengiriman dan pemasangan',
       'Delivery time 4 minggu', 'Produksi terhitung sejak diterimanya pembayaran dan disetujui gambar kerja',
       'Garansi resmi 1 tahun', 'Tidak termasuk tambahan daya listrik/pasang baru',
       'Semua produk tetap menjadi milik PT. Agusta Triasa hingga pembayaran penuh diterima',
       'Barang yang sudah dipesan tidak dapat diubah atau dikembalikan setelah PO dikeluarkan'),
     'paymentPresets', jsonb_build_array(
       jsonb_build_object('label', 'DP 50% · pelunasan 50%', 'terms', jsonb_build_array(
         jsonb_build_object('label', 'Down Payment', 'percent', 50), jsonb_build_object('label', 'Pelunasan sebelum pengiriman', 'percent', 50))),
       jsonb_build_object('label', 'DP 35% · pelunasan setelah instal 65%', 'terms', jsonb_build_array(
         jsonb_build_object('label', 'Down Payment', 'percent', 35), jsonb_build_object('label', 'Pelunasan setelah instal', 'percent', 65))),
       jsonb_build_object('label', 'DP 30% · pelunasan 70%', 'terms', jsonb_build_array(
         jsonb_build_object('label', 'Down Payment', 'percent', 30), jsonb_build_object('label', 'Pelunasan setelah barang diterima', 'percent', 70))))))
on conflict (key) do nothing;

create or replace function public.set_app_setting(p_key text, p_value jsonb)
returns void language plpgsql security definer set search_path = public as $$
declare
  v jsonb;
begin
  perform public._require_reviewer();
  if p_key = 'company' then
    if jsonb_typeof(p_value) <> 'object' or coalesce(trim(p_value ->> 'name'), '') = '' or coalesce(trim(p_value ->> 'street'), '') = '' then
      raise exception 'Isi minimal nama perusahaan dan alamat.';
    end if;
    v := jsonb_build_object(
      'name', left(trim(p_value ->> 'name'), 120), 'street', left(trim(p_value ->> 'street'), 160),
      'city', left(trim(coalesce(p_value ->> 'city', '')), 120), 'country', left(trim(coalesce(p_value ->> 'country', '')), 60),
      'phone', left(trim(coalesce(p_value ->> 'phone', '')), 40), 'whatsapp', left(trim(coalesce(p_value ->> 'whatsapp', '')), 40),
      'email', left(trim(coalesce(p_value ->> 'email', '')), 120), 'place', left(trim(coalesce(p_value ->> 'place', '')), 60));
  elsif p_key = 'banks' then
    if jsonb_typeof(p_value) <> 'array' or jsonb_array_length(p_value) = 0 or jsonb_array_length(p_value) > 10 then
      raise exception 'Isi 1 sampai 10 rekening.';
    end if;
    if exists (select 1 from jsonb_array_elements(p_value) b
               where coalesce(trim(b ->> 'bank'), '') = '' or coalesce(trim(b ->> 'holder'), '') = ''
                  or coalesce(trim(b ->> 'account'), '') = '' or coalesce(trim(b ->> 'id'), '') = '') then
      raise exception 'Setiap rekening wajib berisi nama bank, atas nama, dan nomor rekening.';
    end if;
    if (select count(*) from jsonb_array_elements(p_value) b where (b ->> 'isDefault')::boolean is true) <> 1 then
      raise exception 'Pilih tepat satu rekening default.';
    end if;
    if (select count(distinct b ->> 'id') from jsonb_array_elements(p_value) b) <> jsonb_array_length(p_value) then
      raise exception 'Rekening ganda.';
    end if;
    select jsonb_agg(jsonb_build_object(
             'id', left(trim(b ->> 'id'), 60), 'bank', left(trim(b ->> 'bank'), 120), 'holder', left(trim(b ->> 'holder'), 120),
             'account', left(trim(b ->> 'account'), 40), 'isDefault', coalesce((b ->> 'isDefault')::boolean, false)) order by ord)
      into v from jsonb_array_elements(p_value) with ordinality as x(b, ord);
  elsif p_key = 'letter_templates' then
    if jsonb_typeof(p_value) <> 'object'
       or jsonb_typeof(coalesce(p_value -> 'defaultTerms', '[]')) <> 'array'
       or jsonb_typeof(coalesce(p_value -> 'suggestions', '[]')) <> 'array'
       or jsonb_typeof(coalesce(p_value -> 'paymentPresets', '[]')) <> 'array'
       or jsonb_array_length(coalesce(p_value -> 'defaultTerms', '[]')) > 20
       or jsonb_array_length(coalesce(p_value -> 'suggestions', '[]')) > 30
       or jsonb_array_length(coalesce(p_value -> 'paymentPresets', '[]')) > 10 then
      raise exception 'Template surat tidak valid.';
    end if;
    if exists (select 1 from jsonb_array_elements(coalesce(p_value -> 'paymentPresets', '[]')) p
               where coalesce(trim(p ->> 'label'), '') = ''
                  or (select coalesce(sum((t ->> 'percent')::numeric), 0) from jsonb_array_elements(coalesce(p -> 'terms', '[]')) t) <> 100) then
      raise exception 'Setiap pilihan termin harus bernama dan totalnya 100%%.';
    end if;
    v := jsonb_build_object(
      'defaultTerms', (select coalesce(jsonb_agg(left(trim(t), 300) order by o), '[]') from jsonb_array_elements_text(coalesce(p_value -> 'defaultTerms', '[]')) with ordinality x(t, o) where trim(t) <> ''),
      'suggestions', (select coalesce(jsonb_agg(left(trim(t), 300) order by o), '[]') from jsonb_array_elements_text(coalesce(p_value -> 'suggestions', '[]')) with ordinality x(t, o) where trim(t) <> ''),
      'paymentPresets', coalesce(p_value -> 'paymentPresets', '[]'));
  else
    raise exception 'Pengaturan tidak dikenal.';
  end if;

  insert into public.app_settings (key, value, updated_at, updated_by_name)
  values (p_key, v, now(), public.app_user_name())
  on conflict (key) do update set value = excluded.value, updated_at = now(), updated_by_name = excluded.updated_by_name;
end $$;
revoke execute on function public.set_app_setting(text, jsonb) from public, anon;
grant execute on function public.set_app_setting(text, jsonb) to authenticated;

-- ───────────────────────────── Bank per quotation ───────────────
alter table public.quotations add column if not exists bank_account jsonb;

-- Sales Support picks the account on the letter: { id, bank, holder, account }, or null for the default.
create or replace function public.set_quotation_bank(p_id uuid, p_bank jsonb)
returns void language plpgsql security definer set search_path = public as $$
declare
  q public.quotations;
begin
  select * into q from public.quotations where id = p_id for update;
  if not found then
    raise exception 'Penawaran tidak ditemukan.';
  end if;
  if not public._can_edit_quotation(q) or not public.is_reviewer() then
    raise exception 'Rekening surat diatur oleh Sales Support.' using errcode = '42501';
  end if;
  if p_bank is not null and (coalesce(trim(p_bank ->> 'bank'), '') = '' or coalesce(trim(p_bank ->> 'account'), '') = '' or coalesce(trim(p_bank ->> 'holder'), '') = '') then
    raise exception 'Rekening tidak lengkap.';
  end if;
  update public.quotations
     set bank_account = case when p_bank is null then null else jsonb_build_object(
           'id', left(coalesce(p_bank ->> 'id', ''), 60), 'bank', left(trim(p_bank ->> 'bank'), 120),
           'holder', left(trim(p_bank ->> 'holder'), 120), 'account', left(trim(p_bank ->> 'account'), 40)) end
   where id = p_id;
end $$;
revoke execute on function public.set_quotation_bank(uuid, jsonb) from public, anon;
grant execute on function public.set_quotation_bank(uuid, jsonb) to authenticated;

-- Revisions keep the account of the letter they revise.
create or replace function public._copy_revision_bank()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.revision_of is not null and new.bank_account is null then
    select bank_account into new.bank_account from public.quotations where id = new.revision_of;
  end if;
  return new;
end $$;
drop trigger if exists copy_revision_bank on public.quotations;
create trigger copy_revision_bank before insert on public.quotations
  for each row execute function public._copy_revision_bank();
