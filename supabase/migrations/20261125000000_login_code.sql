-- Agusta Quotation System — sign in with a user code (all roles)
-- Run after 20261124000000_app_settings.sql.
--
-- profiles.quote_code becomes the "kode user": unique, used to sign in (e.g. ISM, RZK, DWL) and,
-- for Sales, also as the code in quotation numbers (0001/ISM/AG/XI/26). Email keeps working as a fallback.

create unique index if not exists profiles_quote_code_key on public.profiles (quote_code) where quote_code is not null;

-- The sign-in screen turns a code into the account's email (Supabase Auth signs in by email).
-- Only active accounts; returns null for an unknown code.
create or replace function public.login_email(p_code text)
returns text language sql stable security definer set search_path = public as $$
  select email from public.profiles
   where quote_code = upper(trim(coalesce(p_code, ''))) and status = 'ACTIVE'
   limit 1
$$;
revoke execute on function public.login_email(text) from public;
grant execute on function public.login_email(text) to anon, authenticated;

-- Same as before, plus: a code belongs to one person.
create or replace function public.set_quote_code(p_user uuid, p_code text, p_last_no integer default null)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_code text := nullif(upper(trim(coalesce(p_code, ''))), '');
  v_owner text;
begin
  if public.app_role() is distinct from 'MANAGEMENT' then
    raise exception 'Hanya Management yang dapat mengatur kode user.' using errcode = '42501';
  end if;
  if v_code is not null and v_code !~ '^[A-Z]{2,5}$' then
    raise exception 'Kode user 2–5 huruf, mis. FHM.';
  end if;
  select name into v_owner from public.profiles where quote_code = v_code and id <> p_user;
  if v_owner is not null then
    raise exception 'Kode % sudah dipakai %.', v_code, v_owner;
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
