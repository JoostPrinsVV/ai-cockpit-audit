-- ============================================================================
-- AI COCKPIT AUDIT — CENTRALE OPSLAG (Supabase)
-- ----------------------------------------------------------------------------
-- Tabellen voor de inhoud van het platform (usecases, prompts, tips,
-- trainingen, agents & tools, fasen en teksten), de ideeënhub, de 'Ik ook'-stemmen en de
-- anonieme tellers. Gebruikt hetzelfde Supabase-project als de AI Snackbar;
-- raakt de tabellen van de snackbar niet aan.
--
-- Eenmalig uitvoeren:
--   1. Pas hieronder bij stap 1 het e-mailadres van de beheerder(s) aan.
--      Dat moet hetzelfde adres zijn als van hun Supabase-gebruiker
--      (Authentication → Users; dezelfde gebruiker als voor de snackbar kan).
--   2. Supabase → SQL Editor → New query → plak dit hele bestand → Run.
--   3. Controleer in Authentication → Sign In / Providers dat
--      'Allow new users to sign up' UIT staat.
--
-- Opnieuw uitvoeren kan geen kwaad: bestaande gegevens blijven staan. Doe dat
-- ook na een nieuwe soort inhoud of tellers (bijv. agents & tools), zodat de
-- database die accepteert.
--
-- Rechten in het kort (Row Level Security):
--   - Iedereen mag gepubliceerde inhoud lezen (usecases, prompts, tips, ...).
--   - Iedereen mag een inzending, stem of teller toevoegen, niets anders.
--   - Iedereen mag alleen gepubliceerde inzendingen lezen, zonder naam en e-mail.
--   - Inhoud aanpassen, alles lezen, beantwoorden, publiceren en wissen kan
--     alleen een ingelogde beheerder van wie het e-mailadres in audit_admins staat.
-- ============================================================================

-- ---- 1. Beheerders ----------------------------------------------------------
create table if not exists public.audit_admins (
  email text primary key
);
alter table public.audit_admins enable row level security;
revoke all on public.audit_admins from anon, authenticated;

-- PAS DIT AAN: één regel per beheerder.
insert into public.audit_admins (email) values
  ('beheerder@visser-visser.nl')
on conflict do nothing;

create or replace function public.audit_is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.audit_admins
    where lower(email) = lower(coalesce(auth.jwt() ->> 'email', ''))
  );
$$;
revoke all on function public.audit_is_admin() from public;
grant execute on function public.audit_is_admin() to anon, authenticated;

-- ---- 2. Inzendingen uit de ideeënhub ------------------------------------------
create table if not exists public.audit_ideas (
  id           bigint generated always as identity primary key,
  namespace    text not null check (char_length(namespace) between 1 and 60),
  ref          uuid unique,
  created_at   timestamptz not null default now(),
  kind         text not null check (kind in ('idee', 'vraag', 'verzoek', 'prompt')),
  title        text not null check (char_length(title) between 3 and 140),
  body         text not null check (char_length(body) between 1 and 4000),
  phase        text check (phase is null or char_length(phase) <= 40),
  name         text check (name is null or char_length(name) <= 100),
  email        text check (email is null or (char_length(email) <= 254 and email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$')),
  allow_public boolean not null default true,
  status       text not null default 'nieuw'
               check (status in ('nieuw', 'in-behandeling', 'gepland', 'gerealiseerd', 'beantwoord', 'afgewezen')),
  answer       text check (answer is null or char_length(answer) <= 4000),
  answered_at  timestamptz,
  is_public    boolean not null default false,
  votes        integer not null default 0,
  updated_at   timestamptz not null default now(),
  -- Alleen publiceren als de inzender dat goed vond
  constraint audit_ideas_public_allowed check (not is_public or allow_public)
);
create index if not exists audit_ideas_namespace_idx on public.audit_ideas (namespace, created_at desc);
alter table public.audit_ideas enable row level security;

-- Kolomrechten: bezoekers mogen alleen deze kolommen invullen ...
revoke all on public.audit_ideas from anon, authenticated;
grant insert (namespace, ref, kind, title, body, phase, name, email, allow_public) on public.audit_ideas to anon, authenticated;
-- ... en alleen deze kolommen lezen (nooit naam of e-mailadres).
grant select (id, namespace, ref, created_at, kind, title, body, phase, status, answer, answered_at, is_public, votes) on public.audit_ideas to anon;
-- Ingelogd: alles, maar de policies hieronder laten alleen beheerders toe.
grant select, update, delete on public.audit_ideas to authenticated;
grant usage on sequence public.audit_ideas_id_seq to anon, authenticated;

drop policy if exists "audit_ideas toevoegen" on public.audit_ideas;
create policy "audit_ideas toevoegen" on public.audit_ideas
  for insert to anon, authenticated
  with check (status = 'nieuw' and is_public = false and answer is null and votes = 0);

drop policy if exists "audit_ideas gepubliceerd lezen" on public.audit_ideas;
create policy "audit_ideas gepubliceerd lezen" on public.audit_ideas
  for select to anon
  using (is_public);

drop policy if exists "audit_ideas beheer lezen" on public.audit_ideas;
create policy "audit_ideas beheer lezen" on public.audit_ideas
  for select to authenticated
  using (public.audit_is_admin());

drop policy if exists "audit_ideas beheer wijzigen" on public.audit_ideas;
create policy "audit_ideas beheer wijzigen" on public.audit_ideas
  for update to authenticated
  using (public.audit_is_admin())
  with check (public.audit_is_admin());

drop policy if exists "audit_ideas beheer wissen" on public.audit_ideas;
create policy "audit_ideas beheer wissen" on public.audit_ideas
  for delete to authenticated
  using (public.audit_is_admin());

-- Bijhouden wanneer iets is gewijzigd en beantwoord
create or replace function public.audit_ideas_touch()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  if new.answer is distinct from old.answer and coalesce(new.answer, '') <> '' then
    new.answered_at := now();
  end if;
  return new;
end;
$$;
drop trigger if exists audit_ideas_touch on public.audit_ideas;
create trigger audit_ideas_touch
  before update on public.audit_ideas
  for each row execute function public.audit_ideas_touch();

-- ---- 3. 'Ik ook'-stemmen --------------------------------------------------------
create table if not exists public.audit_idea_votes (
  idea_id    bigint not null references public.audit_ideas (id) on delete cascade,
  voter      uuid not null,            -- willekeurige code per apparaat, geen persoonsgegeven
  created_at timestamptz not null default now(),
  primary key (idea_id, voter)
);
alter table public.audit_idea_votes enable row level security;
revoke all on public.audit_idea_votes from anon, authenticated;
grant insert (idea_id, voter) on public.audit_idea_votes to anon, authenticated;

drop policy if exists "audit_votes toevoegen" on public.audit_idea_votes;
create policy "audit_votes toevoegen" on public.audit_idea_votes
  for insert to anon, authenticated
  with check (exists (select 1 from public.audit_ideas i where i.id = idea_id and i.is_public));

-- Teller bij de inzending bijwerken (zodat bezoekers geen stemmen hoeven te lezen)
create or replace function public.audit_votes_count()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    update public.audit_ideas set votes = votes + 1 where id = new.idea_id;
  elsif tg_op = 'DELETE' then
    update public.audit_ideas set votes = greatest(votes - 1, 0) where id = old.idea_id;
  end if;
  return null;
end;
$$;
drop trigger if exists audit_votes_count on public.audit_idea_votes;
create trigger audit_votes_count
  after insert or delete on public.audit_idea_votes
  for each row execute function public.audit_votes_count();

-- ---- 4. Anonieme tellers ------------------------------------------------------------
create table if not exists public.audit_events (
  id          bigint generated always as identity primary key,
  namespace   text not null check (char_length(namespace) between 1 and 60),
  kind        text not null,
  item_id     text not null check (char_length(item_id) between 1 and 80),
  occurred_at timestamptz not null default now()
);
-- Toegestane soorten tellers (ook bij opnieuw uitvoeren bijgewerkt, bijv. na het toevoegen van trainingen en agents)
alter table public.audit_events drop constraint if exists audit_events_kind_check;
alter table public.audit_events add constraint audit_events_kind_check
  check (kind in ('view_usecase', 'play_demo', 'copy_prompt', 'view_tip', 'copy_tip', 'view_training', 'play_training', 'view_agent', 'open_agent'));
create index if not exists audit_events_namespace_idx on public.audit_events (namespace, occurred_at);
alter table public.audit_events enable row level security;
revoke all on public.audit_events from anon, authenticated;
grant insert (namespace, kind, item_id) on public.audit_events to anon, authenticated;
grant select, delete on public.audit_events to authenticated;
grant usage on sequence public.audit_events_id_seq to anon, authenticated;

drop policy if exists "audit_events toevoegen" on public.audit_events;
create policy "audit_events toevoegen" on public.audit_events
  for insert to anon, authenticated
  with check (true);

drop policy if exists "audit_events beheer lezen" on public.audit_events;
create policy "audit_events beheer lezen" on public.audit_events
  for select to authenticated
  using (public.audit_is_admin());

drop policy if exists "audit_events beheer wissen" on public.audit_events;
create policy "audit_events beheer wissen" on public.audit_events
  for delete to authenticated
  using (public.audit_is_admin());

-- ---- 5. Inhoud van het platform ----------------------------------------------------
-- Eén rij per usecase, prompt, tip, training, agent, fase of tekstblok. 'data'
-- heeft dezelfde velden als in de databestanden (data/*.js).
-- Zolang hier geen rij 'meta/bron' staat, toont het platform de inhoud uit de
-- bestanden. Beheer → Inhoud → 'Overzetten' zet de bestanden hier neer.
create table if not exists public.audit_content (
  namespace  text not null check (char_length(namespace) between 1 and 60),
  type       text not null,
  id         text not null check (id ~ '^[a-z0-9-]{1,80}$'),
  data       jsonb not null default '{}'::jsonb,
  position   integer not null default 0,
  status     text not null default 'published' check (status in ('published', 'draft', 'trash')),
  updated_at timestamptz not null default now(),
  updated_by text,
  primary key (namespace, type, id)
);
-- Toegestane soorten inhoud (ook bij opnieuw uitvoeren bijgewerkt, bijv. na het toevoegen van agents)
alter table public.audit_content drop constraint if exists audit_content_type_check;
alter table public.audit_content add constraint audit_content_type_check
  check (type in ('meta', 'setting', 'phase', 'usecase', 'prompt', 'tip', 'training', 'agent'));
alter table public.audit_content enable row level security;

revoke all on public.audit_content from anon, authenticated;
grant select (namespace, type, id, data, position, status, updated_at) on public.audit_content to anon;
grant select, insert, update, delete on public.audit_content to authenticated;

drop policy if exists "audit_content gepubliceerd lezen" on public.audit_content;
create policy "audit_content gepubliceerd lezen" on public.audit_content
  for select to anon
  using (status = 'published');

drop policy if exists "audit_content beheer" on public.audit_content;
create policy "audit_content beheer" on public.audit_content
  for all to authenticated
  using (public.audit_is_admin())
  with check (public.audit_is_admin());

-- Geschiedenis: iedere wijziging of verwijdering bewaart de vorige versie
create table if not exists public.audit_content_history (
  hist_id    bigint generated always as identity primary key,
  namespace  text not null,
  type       text not null,
  id         text not null,
  data       jsonb,
  status     text,
  action     text not null,
  changed_at timestamptz not null default now(),
  changed_by text
);
alter table public.audit_content_history enable row level security;
revoke all on public.audit_content_history from anon, authenticated;
grant select on public.audit_content_history to authenticated;

drop policy if exists "audit_content_history beheer lezen" on public.audit_content_history;
create policy "audit_content_history beheer lezen" on public.audit_content_history
  for select to authenticated
  using (public.audit_is_admin());

-- Bij opslaan: tijdstip en wie; de oude versie gaat naar de geschiedenis
create or replace function public.audit_content_stamp()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op in ('UPDATE', 'DELETE') then
    insert into public.audit_content_history (namespace, type, id, data, status, action, changed_by)
    values (old.namespace, old.type, old.id, old.data, old.status, lower(tg_op), auth.jwt() ->> 'email');
  end if;
  if tg_op = 'DELETE' then
    return old;
  end if;
  new.updated_at := now();
  new.updated_by := auth.jwt() ->> 'email';
  return new;
end;
$$;
drop trigger if exists audit_content_stamp on public.audit_content;
create trigger audit_content_stamp
  before insert or update or delete on public.audit_content
  for each row execute function public.audit_content_stamp();

-- Klaar. Controle: deze query moet de zes tabellen tonen
-- (audit_admins, audit_content, audit_content_history, audit_events, audit_ideas, audit_idea_votes).
-- select table_name from information_schema.tables where table_name like 'audit_%';
