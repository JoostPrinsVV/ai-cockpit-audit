-- ============================================================================
-- AI COCKPIT AUDIT — COPILOT-GEBRUIK (stap 9)
-- ----------------------------------------------------------------------------
-- Voor Beheer → Copilot-gebruik: per periode de totalen uit de export van het
-- Copilot-gebruik, om de ontwikkeling van periode tot periode te volgen.
-- Voer dit uit na setup/supabase-audit.sql (stap 1); stap 7 en 8 zijn er niet voor nodig:
--   Supabase → SQL Editor → New query → plak dit hele bestand → Run.
-- Opnieuw uitvoeren kan geen kwaad: bestaande gegevens blijven staan.
--
-- Wat erin staat: alleen totalen per periode (personen en actieve gebruikers per
-- licentie, volume per week en per kanaal, hoe vaak mensen actief zijn). Geen
-- gegevens per persoon: Beheer leest het bestand in de browser, en de PersonId's
-- en de cijfers per persoon verlaten de browser niet.
--
-- Rechten: lezen, opslaan en verwijderen alleen voor hoofdbeheerders (audit_admins).
-- Bezoekers kunnen niets lezen of toevoegen.
-- ============================================================================

-- Alles of niets; liever netjes stoppen dan de site lang laten wachten op een lock
begin;
set local lock_timeout = '5s';

-- ---- 9. Copilot-gebruik per periode ---------------------------------------------------
-- Eén rij per discipline en periode; een nieuwe import met dezelfde einddatum vervangt
-- de oude. 'summary' heeft de totalen zoals js/admin-copilot.js ze maakt (versie 1).
create table if not exists public.audit_copilot_usage (
  id           bigint generated always as identity primary key,
  namespace    text not null check (namespace ~ '^ai-[a-z0-9-]{1,57}$'),
  period_start date not null,
  period_end   date not null,
  source       text not null check (char_length(source) between 1 and 40),
  summary      jsonb not null check (jsonb_typeof(summary) = 'object' and octet_length(summary::text) <= 200000),
  imported_at  timestamptz not null default now(),
  imported_by  text,
  constraint audit_copilot_usage_period check (period_end >= period_start),
  constraint audit_copilot_usage_unique unique (namespace, period_end)
);
alter table public.audit_copilot_usage enable row level security;
revoke all on public.audit_copilot_usage from anon, authenticated;
-- Ingelogd: alles, maar de policy hieronder laat alleen hoofdbeheerders toe.
grant select, insert, update, delete on public.audit_copilot_usage to authenticated;
grant usage on sequence public.audit_copilot_usage_id_seq to authenticated;

drop policy if exists "audit_copilot_usage beheer" on public.audit_copilot_usage;
create policy "audit_copilot_usage beheer" on public.audit_copilot_usage
  for all to authenticated
  using (public.audit_is_admin())
  with check (public.audit_is_admin());

-- Wie het heeft ingelezen en wanneer (niet in te vullen vanuit de site)
create or replace function public.audit_copilot_usage_stamp()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.imported_at := now();
  new.imported_by := auth.jwt() ->> 'email';
  return new;
end;
$$;
drop trigger if exists audit_copilot_usage_stamp on public.audit_copilot_usage;
create trigger audit_copilot_usage_stamp
  before insert or update on public.audit_copilot_usage
  for each row execute function public.audit_copilot_usage_stamp();

-- Triggerfuncties hoeft niemand rechtstreeks aan te roepen
revoke all on function public.audit_copilot_usage_stamp() from public, anon, authenticated;

commit;

-- Klaar. Controle: deze query moet 'audit_copilot_usage' tonen, met rowsecurity = true.
-- select tablename, rowsecurity from pg_tables where tablename = 'audit_copilot_usage';
