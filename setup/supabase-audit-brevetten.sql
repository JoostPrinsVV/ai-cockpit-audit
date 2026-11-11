-- ============================================================================
-- AI COCKPIT AUDIT — AI-BREVETTEN (stap 12)
-- ----------------------------------------------------------------------------
-- Voor de AI-brevetten: echte accounts, inloggen met Microsoft (js/config.js: brevet.login).
-- Voer dit uit na setup/supabase-audit.sql (stap 1):
--   Supabase → SQL Editor → New query → plak dit hele bestand → Run.
-- Opnieuw uitvoeren kan geen kwaad: bestaande gegevens blijven staan.
--
-- Daarnaast in Supabase (Authentication; stap voor stap in README, 'AI-brevetten'):
--   - URL Configuration: het adres van de cockpit bij Redirect URLs (de Site URL laten staan);
--   - inloggen met Microsoft: Providers → Azure, met een app-registratie voor alleen de V&V-tenant;
--   - alleen V&V-accounts: stap 18 (setup/supabase-audit-aanmelden.sql en de Auth Hook),
--     daarna 'Allow new users to sign up' aan.
--
-- Wat het doet:
--   audit_accounts      wie meedoet (opt-in): naam, vestiging, of je je brevet deelt;
--   audit_brevet_facts  het logboek: feiten waaruit de cockpit miles en brevetten
--                       berekent (js/brevet.js). Feiten worden niet aangepast.
--
-- Rechten (Row Level Security):
--   - alleen e-mailadressen van @visser-visser.nl (pas audit_brevet_allowed aan
--     voor een ander domein);
--   - een deelnemer leest en beheert alleen zijn eigen account, en voegt alleen
--     zijn eigen gebruiksfeiten toe (geen bijdragen, trainingen of bonussen);
--   - hoofdbeheerders (audit_admins) lezen alles en leggen bijdragen, trainingen
--     en bonussen vast; alleen voor bestaande accounts;
--   - het tijdstip zet de database (terugdateren kan niet);
--   - stoppen wist je account en je hele logboek.
--
-- Na de migratie naar de Microsoft-omgeving: zie README, 'Migratie'. De sleutel
-- is het zakelijke e-mailadres (in kleine letters), in Supabase en Microsoft gelijk.
-- ============================================================================

begin;
set local lock_timeout = '5s';

-- ---- 12. AI-brevetten ------------------------------------------------------------------
-- Het e-mailadres van wie is ingelogd (dezelfde als in stap 7; hier ook, zodat stap 7 niet nodig is)
create or replace function public.audit_email()
returns text
language sql
stable
set search_path = public
as $$
  select lower(coalesce(auth.jwt() ->> 'email', ''));
$$;

-- Mag dit e-mailadres meedoen? (het domein van V&V, of een hoofdbeheerder)
create or replace function public.audit_brevet_allowed()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.audit_email() like '%@visser-visser.nl' or public.audit_is_admin();
$$;

create table if not exists public.audit_accounts (
  email        text primary key check (email = lower(email) and email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' and char_length(email) <= 254),
  name         text check (char_length(name) <= 100),
  team         text check (char_length(team) <= 100),
  vestiging    text check (char_length(vestiging) <= 100),
  joined_at    timestamptz,
  share_brevet boolean not null default false,
  level        text check (level is null or level in ('', 'cadet', 'copilot', 'captain', 'commander')),
  level_seen   text check (level_seen is null or level_seen in ('', 'cadet', 'copilot', 'captain', 'commander')),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
alter table public.audit_accounts enable row level security;
revoke all on public.audit_accounts from anon, authenticated;
grant select, insert, update, delete on public.audit_accounts to authenticated;

drop policy if exists "audit_accounts eigen" on public.audit_accounts;
create policy "audit_accounts eigen" on public.audit_accounts
  for all to authenticated
  using (email = public.audit_email() or public.audit_is_admin())
  with check ((email = public.audit_email() and public.audit_brevet_allowed()) or public.audit_is_admin());

create or replace function public.audit_accounts_stamp()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.email := lower(new.email);
  new.updated_at := now();
  if tg_op = 'INSERT' then
    new.created_at := now();
  else
    new.created_at := old.created_at;
  end if;
  return new;
end;
$$;
drop trigger if exists audit_accounts_stamp on public.audit_accounts;
create trigger audit_accounts_stamp
  before insert or update on public.audit_accounts
  for each row execute function public.audit_accounts_stamp();

create table if not exists public.audit_brevet_facts (
  id         bigint generated always as identity primary key,
  email      text not null references public.audit_accounts (email) on delete cascade on update cascade,
  kind       text not null check (kind in (
               'active_day', 'prompt_used', 'demo_watched', 'prompt_rated', 'builder_strong', 'tour_done',
               'profile_done', 'policy_check', 'idea_sent', 'recording_watched', 'kickstart_done', 'activity', 'test_shared',
               'contribution_adopted', 'training_registered', 'training_attended', 'session_given',
               'nominated', 'prompt_author', 'bonus', 'item_awarded')),
  item_id    text not null default '' check (char_length(item_id) <= 80),
  namespace  text check (namespace is null or namespace ~ '^ai-[a-z0-9-]{1,57}$'),
  detail     jsonb check (detail is null or (jsonb_typeof(detail) = 'object' and octet_length(detail::text) <= 2000)),
  created_at timestamptz not null default now(),
  created_by text,
  constraint audit_brevet_facts_once unique (email, kind, item_id)
);
create index if not exists audit_brevet_facts_item on public.audit_brevet_facts (kind, item_id);
alter table public.audit_brevet_facts enable row level security;
revoke all on public.audit_brevet_facts from anon, authenticated;
grant select, insert, delete on public.audit_brevet_facts to authenticated;
grant usage on sequence public.audit_brevet_facts_id_seq to authenticated;

drop policy if exists "audit_brevet_facts lezen" on public.audit_brevet_facts;
create policy "audit_brevet_facts lezen" on public.audit_brevet_facts
  for select to authenticated
  using (email = public.audit_email() or public.audit_is_admin());

-- Zelf: alleen gebruik, alleen voor jezelf, en alleen als je meedoet. Beheer: alles, voor bestaande accounts.
drop policy if exists "audit_brevet_facts toevoegen" on public.audit_brevet_facts;
create policy "audit_brevet_facts toevoegen" on public.audit_brevet_facts
  for insert to authenticated
  with check (
    public.audit_is_admin()
    or (
      email = public.audit_email()
      and public.audit_brevet_allowed()
      and kind in ('active_day', 'prompt_used', 'demo_watched', 'prompt_rated', 'builder_strong', 'tour_done',
                   'profile_done', 'policy_check', 'idea_sent', 'recording_watched', 'kickstart_done', 'activity', 'test_shared')
      and exists (select 1 from public.audit_accounts a where a.email = public.audit_email() and a.joined_at is not null)
    )
  );

drop policy if exists "audit_brevet_facts wissen" on public.audit_brevet_facts;
create policy "audit_brevet_facts wissen" on public.audit_brevet_facts
  for delete to authenticated
  using (public.audit_is_admin());

-- Tijdstip en wie het vastlegde zet de database (niet in te vullen vanuit de site)
create or replace function public.audit_brevet_facts_stamp()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.email := lower(new.email);
  new.created_at := now();
  new.created_by := public.audit_email();
  return new;
end;
$$;
drop trigger if exists audit_brevet_facts_stamp on public.audit_brevet_facts;
create trigger audit_brevet_facts_stamp
  before insert on public.audit_brevet_facts
  for each row execute function public.audit_brevet_facts_stamp();

-- Royalty's voor jezelf: per prompt waarvan je auteur bent (prompt_author) en per maand
-- het aantal collega's dat hem voor het eerst gebruikte (nooit jijzelf). Alleen aantallen.
create or replace function public.audit_brevet_royalties()
returns table (item_id text, month text, users bigint)
language sql
stable
security definer
set search_path = public
as $$
  select u.item_id,
         to_char(u.created_at at time zone 'Europe/Amsterdam', 'YYYY-MM') as month,
         count(distinct u.email) as users
  from public.audit_brevet_facts a
  join public.audit_brevet_facts u
    on u.kind = 'prompt_used' and u.item_id = a.item_id and u.email <> a.email
  where a.kind = 'prompt_author' and a.email = public.audit_email()
  group by u.item_id, 2;
$$;

revoke all on function public.audit_brevet_royalties() from public, anon;
grant execute on function public.audit_brevet_royalties() to authenticated;
revoke all on function public.audit_brevet_allowed() from public, anon;
grant execute on function public.audit_brevet_allowed() to authenticated;
-- Triggerfuncties hoeft niemand rechtstreeks aan te roepen
revoke all on function public.audit_accounts_stamp() from public, anon, authenticated;
revoke all on function public.audit_brevet_facts_stamp() from public, anon, authenticated;

commit;

-- Klaar. Controle: deze query moet 'audit_accounts' en 'audit_brevet_facts' tonen, met rowsecurity = true.
-- select tablename, rowsecurity from pg_tables where tablename in ('audit_accounts', 'audit_brevet_facts');
