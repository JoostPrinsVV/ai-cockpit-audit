-- ============================================================================
-- AI COCKPIT AUDIT — BEWERKEN, PUBLICEREN EN ROLLEN (stap 7)
-- ----------------------------------------------------------------------------
-- Voer dit uit NA setup/supabase-audit.sql (stap 1 t/m 6):
--   Supabase → SQL Editor → New query → plak dit hele bestand → Run.
-- Daarna: setup/supabase-audit-beveiligen.sql (stap 8).
-- Is stap 8 al uitgevoerd, voer dit bestand dan niet opnieuw uit: het zou een paar functies
-- en rechten terugzetten naar de oude vorm. Het weigert dat ook (zie hieronder). Wil je de
-- functies opnieuw laten zetten, voer dan stap 8 opnieuw uit.
--
-- Wat het toevoegt:
--   7a. Werkversie naast de gepubliceerde versie. Opslaan zet je wijziging klaar
--       (alleen beheerders zien hem); Publiceren zet hem live voor iedereen.
--   7b. Rollen per discipline en per onderdeel (naast de hoofdbeheerders in
--       audit_admins):
--         hoofdbeheerder  alles, ook beheerders en disciplines beheren
--         beheerder       bewerken, verwijderen en publiceren
--         redacteur       bewerken en publiceren, niet verwijderen
--         bijdrager       alleen voorstellen; een ander publiceert (vier ogen)
--   7c. Logboek: wie wat wanneer deed.
--   7d. Opslaan, publiceren (ook gepland), weggooien: via functies die de
--       rechten controleren. Gepland publiceren gebeurt bij het eerstvolgende
--       bezoek na het gekozen moment (geen aparte planner nodig).
--   7e. Melding als iemand anders hetzelfde item open heeft.
--   7f. Beheerders beheren vanuit de portal.
--   7g. Afbeeldingen en video's uploaden (Supabase Storage, map cockpit-media).
--
-- Nieuwe beheerders hebben een Supabase-account nodig met hetzelfde e-mailadres
-- (Authentication → Users → Add user). De portal laat zien of dat account er al is.
-- ============================================================================

-- Na stap 8 niet meer: dan zou dit bestand het vier-ogengat en oude rechten terugzetten
do $guard$
begin
  if exists (select 1 from information_schema.columns
             where table_schema = 'public' and table_name = 'audit_content' and column_name = 'publish_version') then
    raise exception 'Stap 8 is al uitgevoerd: voer dit bestand niet opnieuw uit. Voer alleen setup/supabase-audit-beveiligen.sql opnieuw uit.';
  end if;
end;
$guard$;

-- ---- 7a. Werkversie naast de gepubliceerde versie ---------------------------------
-- draft: { "data": {...}, "position": 10, "status": "published" | "trash" } of null
alter table public.audit_content add column if not exists draft      jsonb;
alter table public.audit_content add column if not exists draft_kind text;        -- 'wijziging' of 'voorstel'
alter table public.audit_content add column if not exists draft_by   text;
alter table public.audit_content add column if not exists draft_at   timestamptz;
alter table public.audit_content add column if not exists publish_at timestamptz; -- gepland publiceren
alter table public.audit_content add column if not exists publish_by text;
alter table public.audit_content add column if not exists version    integer not null default 1;

-- Geschiedenis en 'laatst bijgewerkt' alleen bij een wijziging van de gepubliceerde
-- versie (niet bij iedere keer opslaan van een werkversie)
create or replace function public.audit_content_stamp()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'DELETE' then
    insert into public.audit_content_history (namespace, type, id, data, status, action, changed_by)
    values (old.namespace, old.type, old.id, old.data, old.status, 'delete', auth.jwt() ->> 'email');
    return old;
  end if;
  if tg_op = 'UPDATE' then
    if new.data is not distinct from old.data
       and new.status is not distinct from old.status
       and new.position is not distinct from old.position then
      return new;
    end if;
    insert into public.audit_content_history (namespace, type, id, data, status, action, changed_by)
    values (old.namespace, old.type, old.id, old.data, old.status, 'update', auth.jwt() ->> 'email');
  end if;
  new.updated_at := now();
  new.updated_by := coalesce(auth.jwt() ->> 'email', new.updated_by);
  return new;
end;
$$;
drop trigger if exists audit_content_stamp on public.audit_content;
create trigger audit_content_stamp
  before insert or update or delete on public.audit_content
  for each row execute function public.audit_content_stamp();

-- ---- 7b. Rollen ---------------------------------------------------------------------
-- Hoofdbeheerders staan (zoals altijd) in audit_admins. Overige rollen hier, per
-- naamruimte ('ai-audit', 'ai-algemeen' voor de gedeelde basis, of '*' voor alle) en
-- eventueel beperkt tot onderdelen (sections leeg = alle onderdelen).
create table if not exists public.audit_roles (
  email     text not null,
  namespace text not null check (char_length(namespace) between 1 and 60),
  role      text not null check (role in ('beheerder', 'redacteur', 'bijdrager')),
  sections  text[] not null default '{}'::text[],
  added_at  timestamptz not null default now(),
  added_by  text,
  primary key (email, namespace)
);
alter table public.audit_roles enable row level security;
revoke all on public.audit_roles from anon, authenticated;

create or replace function public.audit_email()
returns text
language sql
stable
set search_path = public
as $$
  select lower(coalesce(auth.jwt() ->> 'email', ''));
$$;

-- De beste rol van de ingelogde gebruiker voor een naamruimte (of null)
create or replace function public.audit_role(p_namespace text)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select case
    when public.audit_is_admin() then 'hoofdbeheerder'
    else (
      select r.role from public.audit_roles r
      where lower(r.email) = public.audit_email() and r.namespace in (p_namespace, '*')
      order by case r.role when 'beheerder' then 1 when 'redacteur' then 2 else 3 end,
               case when r.namespace = '*' then 2 else 1 end
      limit 1
    )
  end;
$$;

-- Mag de ingelogde gebruiker dit?
-- p_action: 'lezen', 'bewerken', 'verwijderen' of 'publiceren'; p_type: soort inhoud (of null)
create or replace function public.audit_can(p_action text, p_namespace text, p_type text default null)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_role text;
  v_sections text[];
begin
  if public.audit_is_admin() then
    return true;
  end if;
  select r.role, r.sections into v_role, v_sections
  from public.audit_roles r
  where lower(r.email) = public.audit_email() and r.namespace in (p_namespace, '*')
  order by case r.role when 'beheerder' then 1 when 'redacteur' then 2 else 3 end,
           case when r.namespace = '*' then 2 else 1 end
  limit 1;
  if v_role is null then
    return false;
  end if;
  if p_action = 'lezen' then
    return true;
  end if;
  -- Technische rijen (meta) zijn alleen voor hoofdbeheerders
  if p_type = 'meta' then
    return false;
  end if;
  if p_type is not null and coalesce(array_length(v_sections, 1), 0) > 0 and not (p_type = any (v_sections)) then
    return false;
  end if;
  return case p_action
    when 'bewerken' then true
    when 'verwijderen' then v_role = 'beheerder'
    when 'publiceren' then v_role in ('beheerder', 'redacteur')
    else false
  end;
end;
$$;

revoke all on function public.audit_email() from public;
revoke all on function public.audit_role(text) from public;
revoke all on function public.audit_can(text, text, text) from public;
grant execute on function public.audit_email() to anon, authenticated;
grant execute on function public.audit_role(text) to anon, authenticated;
grant execute on function public.audit_can(text, text, text) to anon, authenticated;

-- Iedereen met een rol mag de inhoud (ook werkversies) van zijn naamruimtes lezen.
-- Gepubliceerde inhoud blijft voor iedereen leesbaar. Schrijven gaat via de functies
-- hieronder; rechtstreeks schrijven blijft voorbehouden aan hoofdbeheerders.
drop policy if exists "audit_content leden lezen" on public.audit_content;
create policy "audit_content leden lezen" on public.audit_content
  for select to authenticated
  using (status = 'published' or public.audit_can('lezen', namespace));

drop policy if exists "audit_content_history beheer lezen" on public.audit_content_history;
create policy "audit_content_history beheer lezen" on public.audit_content_history
  for select to authenticated
  using (public.audit_can('lezen', namespace));

-- ---- 7c. Logboek ---------------------------------------------------------------------
create table if not exists public.audit_log (
  id        bigint generated always as identity primary key,
  at        timestamptz not null default now(),
  actor     text,
  namespace text not null,
  type      text,
  item_id   text,
  title     text,
  action    text not null,
  detail    jsonb
);
create index if not exists audit_log_namespace_at on public.audit_log (namespace, at desc);
alter table public.audit_log enable row level security;
revoke all on public.audit_log from anon, authenticated;
grant select on public.audit_log to authenticated;

drop policy if exists "audit_log leden lezen" on public.audit_log;
create policy "audit_log leden lezen" on public.audit_log
  for select to authenticated
  using (public.audit_can('lezen', namespace));

-- ---- 7d. Opslaan, weggooien, publiceren ------------------------------------------------

-- Werkversie opslaan (nieuw item of wijziging).
-- p_version: de versie die je had geladen (null = niet controleren, bijv. bij een nieuw item).
-- Antwoord: { ok, version, kind } of { conflict, version, draft_by, draft_at, updated_by, updated_at }.
create or replace function public.audit_save_draft(
  p_namespace text, p_type text, p_id text, p_draft jsonb, p_version integer default null, p_title text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.audit_content%rowtype;
  v_kind text;
  v_status text := coalesce(p_draft ->> 'status', 'published');
  v_title text := coalesce(p_title, p_draft -> 'data' ->> 'title', p_draft -> 'data' ->> 'label', p_id);
begin
  if not public.audit_can('bewerken', p_namespace, p_type) then
    raise exception 'geen rechten om dit onderdeel te bewerken' using errcode = '42501';
  end if;
  if p_type = 'setting' and p_id = 'disciplines' and not public.audit_is_admin() then
    raise exception 'alleen een hoofdbeheerder past de disciplines aan' using errcode = '42501';
  end if;
  if v_status not in ('published', 'trash') then
    raise exception 'onbekende status in de werkversie' using errcode = '22023';
  end if;
  if v_status = 'trash' and not public.audit_can('verwijderen', p_namespace, p_type) then
    raise exception 'geen rechten om te verwijderen' using errcode = '42501';
  end if;
  v_kind := case when public.audit_can('publiceren', p_namespace, p_type) then 'wijziging' else 'voorstel' end;

  select * into v_row from public.audit_content
  where namespace = p_namespace and type = p_type and id = p_id
  for update;

  if not found then
    insert into public.audit_content (namespace, type, id, data, position, status, draft, draft_kind, draft_by, draft_at, version)
    values (p_namespace, p_type, p_id, '{}'::jsonb, coalesce((p_draft ->> 'position')::integer, 0), 'draft',
            p_draft, v_kind, public.audit_email(), now(), 1);
    insert into public.audit_log (actor, namespace, type, item_id, title, action, detail)
    values (public.audit_email(), p_namespace, p_type, p_id, v_title,
            case when v_kind = 'voorstel' then 'voorstel' else 'nieuw' end, null);
    return jsonb_build_object('ok', true, 'version', 1, 'kind', v_kind);
  end if;

  if p_version is not null and v_row.version <> p_version then
    return jsonb_build_object('conflict', true, 'version', v_row.version,
      'draft_by', v_row.draft_by, 'draft_at', v_row.draft_at,
      'updated_by', v_row.updated_by, 'updated_at', v_row.updated_at);
  end if;

  update public.audit_content
  set draft = p_draft, draft_kind = v_kind, draft_by = public.audit_email(), draft_at = now(), version = v_row.version + 1
  where namespace = p_namespace and type = p_type and id = p_id;

  insert into public.audit_log (actor, namespace, type, item_id, title, action, detail)
  values (public.audit_email(), p_namespace, p_type, p_id, v_title,
          case when v_status = 'trash' then 'verwijderd' when v_kind = 'voorstel' then 'voorstel' else 'opgeslagen' end, null);
  return jsonb_build_object('ok', true, 'version', v_row.version + 1, 'kind', v_kind);
end;
$$;

-- Werkversie weggooien: je eigen werk, of met publicatierechten ook dat van een ander.
-- Een nieuw item dat nog nooit live stond, verdwijnt helemaal.
create or replace function public.audit_discard_draft(p_namespace text, p_type text, p_id text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.audit_content%rowtype;
begin
  select * into v_row from public.audit_content
  where namespace = p_namespace and type = p_type and id = p_id
  for update;
  if not found then
    return jsonb_build_object('ok', true);
  end if;
  if not (public.audit_can('publiceren', p_namespace, p_type)
          or (public.audit_can('bewerken', p_namespace, p_type) and lower(coalesce(v_row.draft_by, '')) = public.audit_email())) then
    raise exception 'geen rechten om deze werkversie weg te gooien' using errcode = '42501';
  end if;
  if v_row.status = 'draft' and v_row.data = '{}'::jsonb then
    delete from public.audit_content where namespace = p_namespace and type = p_type and id = p_id;
  else
    update public.audit_content
    set draft = null, draft_kind = null, draft_by = null, draft_at = null, publish_at = null, publish_by = null, version = v_row.version + 1
    where namespace = p_namespace and type = p_type and id = p_id;
  end if;
  insert into public.audit_log (actor, namespace, type, item_id, title, action, detail)
  values (public.audit_email(), p_namespace, p_type, p_id,
          coalesce(v_row.draft -> 'data' ->> 'title', v_row.data ->> 'title', v_row.data ->> 'label', p_id), 'weggegooid', null);
  return jsonb_build_object('ok', true);
end;
$$;

-- Intern: de werkversie van één rij live zetten (of een oud concept publiceren)
create or replace function public.audit_apply_draft(p_namespace text, p_type text, p_id text, p_actor text, p_action text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.audit_content%rowtype;
begin
  select * into v_row from public.audit_content
  where namespace = p_namespace and type = p_type and id = p_id
  for update;
  if not found then
    return;
  end if;
  if v_row.draft is null then
    if v_row.status <> 'draft' then
      return;
    end if;
    update public.audit_content
    set status = 'published', publish_at = null, publish_by = null, version = v_row.version + 1, updated_by = p_actor
    where namespace = p_namespace and type = p_type and id = p_id;
  else
    update public.audit_content
    set data = coalesce(v_row.draft -> 'data', v_row.data),
        position = coalesce((v_row.draft ->> 'position')::integer, v_row.position),
        status = coalesce(v_row.draft ->> 'status', 'published'),
        draft = null, draft_kind = null, draft_by = null, draft_at = null,
        publish_at = null, publish_by = null,
        version = v_row.version + 1,
        updated_by = coalesce(v_row.publish_by, v_row.draft_by, p_actor)
    where namespace = p_namespace and type = p_type and id = p_id;
  end if;
  insert into public.audit_log (actor, namespace, type, item_id, title, action, detail)
  values (p_actor, p_namespace, p_type, p_id,
          coalesce(v_row.draft -> 'data' ->> 'title', v_row.draft -> 'data' ->> 'label', v_row.data ->> 'title', v_row.data ->> 'label', p_id),
          case when v_row.draft ->> 'status' = 'trash' then 'verwijderd en gepubliceerd' else p_action end,
          jsonb_build_object('door', v_row.draft_by, 'soort', v_row.draft_kind));
end;
$$;

-- Publiceren (of plannen met p_at in de toekomst). p_items: [{ namespace, type, id }].
-- Antwoord: { done, scheduled, skipped: [{ namespace, type, id, reason }] }
create or replace function public.audit_publish(p_items jsonb, p_at timestamptz default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_item jsonb;
  v_row public.audit_content%rowtype;
  v_done integer := 0;
  v_scheduled integer := 0;
  v_skipped jsonb := '[]'::jsonb;
begin
  for v_item in select value from jsonb_array_elements(coalesce(p_items, '[]'::jsonb)) loop
    select * into v_row from public.audit_content
    where namespace = v_item ->> 'namespace' and type = v_item ->> 'type' and id = v_item ->> 'id';
    if not found then
      continue;
    end if;
    if not public.audit_can('publiceren', v_row.namespace, v_row.type) then
      v_skipped := v_skipped || jsonb_build_object('namespace', v_row.namespace, 'type', v_row.type, 'id', v_row.id, 'reason', 'geen rechten');
      continue;
    end if;
    if v_row.draft ->> 'status' = 'trash' and not public.audit_can('verwijderen', v_row.namespace, v_row.type) then
      v_skipped := v_skipped || jsonb_build_object('namespace', v_row.namespace, 'type', v_row.type, 'id', v_row.id, 'reason', 'geen rechten om te verwijderen');
      continue;
    end if;
    if p_at is not null and p_at > now() then
      update public.audit_content
      set publish_at = p_at, publish_by = public.audit_email()
      where namespace = v_row.namespace and type = v_row.type and id = v_row.id;
      insert into public.audit_log (actor, namespace, type, item_id, title, action, detail)
      values (public.audit_email(), v_row.namespace, v_row.type, v_row.id,
              coalesce(v_row.draft -> 'data' ->> 'title', v_row.draft -> 'data' ->> 'label', v_row.data ->> 'title', v_row.data ->> 'label', v_row.id),
              'gepland', jsonb_build_object('op', p_at));
      v_scheduled := v_scheduled + 1;
    else
      perform public.audit_apply_draft(v_row.namespace, v_row.type, v_row.id, public.audit_email(), 'gepubliceerd');
      v_done := v_done + 1;
    end if;
  end loop;
  return jsonb_build_object('done', v_done, 'scheduled', v_scheduled, 'skipped', v_skipped);
end;
$$;

-- Planning annuleren (de werkversie blijft staan)
create or replace function public.audit_unschedule(p_namespace text, p_type text, p_id text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.audit_can('publiceren', p_namespace, p_type) then
    raise exception 'geen rechten om de planning aan te passen' using errcode = '42501';
  end if;
  update public.audit_content set publish_at = null, publish_by = null
  where namespace = p_namespace and type = p_type and id = p_id;
  insert into public.audit_log (actor, namespace, type, item_id, action)
  values (public.audit_email(), p_namespace, p_type, p_id, 'planning geannuleerd');
end;
$$;

-- Geplande publicaties uitvoeren waarvan het moment voorbij is. Iedere bezoeker roept
-- dit aan bij het laden; het doet alleen iets als er iets klaarstaat.
create or replace function public.audit_publish_due()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row record;
  v_count integer := 0;
begin
  for v_row in
    select c.namespace, c.type, c.id, c.publish_by from public.audit_content c
    where c.publish_at is not null and c.publish_at <= now() and (c.draft is not null or c.status = 'draft')
    for update skip locked
  loop
    perform public.audit_apply_draft(v_row.namespace, v_row.type, v_row.id, coalesce(v_row.publish_by, 'gepland'), 'gepubliceerd (gepland)');
    v_count := v_count + 1;
  end loop;
  return v_count;
end;
$$;

revoke all on function public.audit_save_draft(text, text, text, jsonb, integer, text) from public, anon;
revoke all on function public.audit_discard_draft(text, text, text) from public, anon;
revoke all on function public.audit_apply_draft(text, text, text, text, text) from public, anon, authenticated;
revoke all on function public.audit_publish(jsonb, timestamptz) from public, anon;
revoke all on function public.audit_unschedule(text, text, text) from public, anon;
revoke all on function public.audit_publish_due() from public;
grant execute on function public.audit_save_draft(text, text, text, jsonb, integer, text) to authenticated;
grant execute on function public.audit_discard_draft(text, text, text) to authenticated;
grant execute on function public.audit_publish(jsonb, timestamptz) to authenticated;
grant execute on function public.audit_unschedule(text, text, text) to authenticated;
grant execute on function public.audit_publish_due() to anon, authenticated;

-- ---- 7e. Wie bewerkt wat (melding bij gelijktijdig bewerken) --------------------------
create table if not exists public.audit_presence (
  email     text not null,
  namespace text not null,
  type      text not null,
  item_id   text not null,
  seen_at   timestamptz not null default now(),
  constraint audit_presence_pkey primary key (email, namespace, type, item_id)
);
alter table public.audit_presence enable row level security;
revoke all on public.audit_presence from anon, authenticated;

-- Meld dat je dit item open hebt; geeft de anderen die het de afgelopen 2 minuten open hadden
create or replace function public.audit_ping(p_namespace text, p_type text, p_id text)
returns table (editor text, since timestamptz)
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.audit_can('lezen', p_namespace) then
    return;
  end if;
  insert into public.audit_presence as p (email, namespace, type, item_id, seen_at)
  values (public.audit_email(), p_namespace, p_type, p_id, now())
  on conflict on constraint audit_presence_pkey do update set seen_at = now();
  delete from public.audit_presence as old_row where old_row.seen_at < now() - interval '10 minutes';
  return query
    select p.email, p.seen_at from public.audit_presence p
    where p.namespace = p_namespace and p.type = p_type and p.item_id = p_id
      and p.email <> public.audit_email() and p.seen_at > now() - interval '2 minutes';
end;
$$;

-- Item gesloten: niet meer melden
create or replace function public.audit_leave(p_namespace text, p_type text, p_id text)
returns void
language sql
security definer
set search_path = public
as $$
  delete from public.audit_presence p
  where p.email = public.audit_email() and p.namespace = p_namespace and p.type = p_type and p.item_id = p_id;
$$;

revoke all on function public.audit_ping(text, text, text) from public, anon;
revoke all on function public.audit_leave(text, text, text) from public, anon;
grant execute on function public.audit_ping(text, text, text) to authenticated;
grant execute on function public.audit_leave(text, text, text) to authenticated;

-- ---- 7f. Beheerders beheren --------------------------------------------------------------

-- Wie ben ik en wat mag ik?
create or replace function public.audit_me()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'email', public.audit_email(),
    'owner', public.audit_is_admin(),
    'roles', coalesce((
      select jsonb_agg(jsonb_build_object('namespace', r.namespace, 'role', r.role, 'sections', r.sections))
      from public.audit_roles r where lower(r.email) = public.audit_email()
    ), '[]'::jsonb)
  );
$$;

-- Alle beheerders (alleen voor hoofdbeheerders), met of ze al een account hebben
create or replace function public.audit_list_admins()
returns table (email text, namespace text, role text, sections text[], added_at timestamptz, added_by text, has_account boolean, last_sign_in timestamptz)
language sql
stable
security definer
set search_path = public, auth
as $$
  select a.email, '*'::text, 'hoofdbeheerder'::text, '{}'::text[], null::timestamptz, null::text,
         exists (select 1 from auth.users u where lower(u.email) = lower(a.email)),
         (select max(u.last_sign_in_at) from auth.users u where lower(u.email) = lower(a.email))
  from public.audit_admins a
  where public.audit_is_admin()
  union all
  select r.email, r.namespace, r.role, r.sections, r.added_at, r.added_by,
         exists (select 1 from auth.users u where lower(u.email) = lower(r.email)),
         (select max(u.last_sign_in_at) from auth.users u where lower(u.email) = lower(r.email))
  from public.audit_roles r
  where public.audit_is_admin();
$$;

-- Rol geven of aanpassen. Hoofdbeheerder: altijd voor alle disciplines.
create or replace function public.audit_set_admin(p_email text, p_namespace text, p_role text, p_sections text[] default '{}'::text[])
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_email text := lower(trim(p_email));
begin
  if not public.audit_is_admin() then
    raise exception 'alleen een hoofdbeheerder beheert de beheerders' using errcode = '42501';
  end if;
  if v_email !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' then
    raise exception 'ongeldig e-mailadres' using errcode = '22023';
  end if;
  if p_role = 'hoofdbeheerder' then
    insert into public.audit_admins (email) values (v_email) on conflict do nothing;
  elsif p_role in ('beheerder', 'redacteur', 'bijdrager') then
    if exists (select 1 from public.audit_admins a where lower(a.email) = v_email) then
      if v_email = public.audit_email() then
        raise exception 'je kunt jezelf geen lagere rol geven' using errcode = '22023';
      end if;
      delete from public.audit_admins a where lower(a.email) = v_email;
    end if;
    insert into public.audit_roles (email, namespace, role, sections, added_by)
    values (v_email, p_namespace, p_role, coalesce(p_sections, '{}'::text[]), public.audit_email())
    on conflict (email, namespace) do update
      set role = excluded.role, sections = excluded.sections, added_by = excluded.added_by, added_at = now();
  else
    raise exception 'onbekende rol' using errcode = '22023';
  end if;
  insert into public.audit_log (actor, namespace, title, action, detail)
  values (public.audit_email(), coalesce(p_namespace, '*'), v_email, 'beheerder',
          jsonb_build_object('rol', p_role, 'onderdelen', p_sections));
end;
$$;

-- Rol intrekken. p_role 'hoofdbeheerder' haalt iemand uit audit_admins (nooit jezelf of de laatste).
create or replace function public.audit_remove_admin(p_email text, p_namespace text, p_role text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_email text := lower(trim(p_email));
begin
  if not public.audit_is_admin() then
    raise exception 'alleen een hoofdbeheerder beheert de beheerders' using errcode = '42501';
  end if;
  if p_role = 'hoofdbeheerder' then
    if v_email = public.audit_email() then
      raise exception 'je kunt jezelf niet verwijderen' using errcode = '22023';
    end if;
    if (select count(*) from public.audit_admins) <= 1 then
      raise exception 'er moet minstens één hoofdbeheerder blijven' using errcode = '22023';
    end if;
    delete from public.audit_admins a where lower(a.email) = v_email;
  else
    delete from public.audit_roles r where lower(r.email) = v_email and r.namespace = p_namespace;
  end if;
  insert into public.audit_log (actor, namespace, title, action, detail)
  values (public.audit_email(), coalesce(p_namespace, '*'), v_email, 'beheerder verwijderd', jsonb_build_object('rol', p_role));
end;
$$;

revoke all on function public.audit_me() from public, anon;
revoke all on function public.audit_list_admins() from public, anon;
revoke all on function public.audit_set_admin(text, text, text, text[]) from public, anon;
revoke all on function public.audit_remove_admin(text, text, text) from public, anon;
grant execute on function public.audit_me() to authenticated;
grant execute on function public.audit_list_admins() to authenticated;
grant execute on function public.audit_set_admin(text, text, text, text[]) to authenticated;
grant execute on function public.audit_remove_admin(text, text, text) to authenticated;

-- ---- 7g. Afbeeldingen en video's (Supabase Storage) --------------------------------------
-- Map 'cockpit-media', openbaar leesbaar (de site is ook openbaar: geen interne of
-- klantinformatie). Bestanden staan per naamruimte: ai-audit/..., ai-algemeen/...
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('cockpit-media', 'cockpit-media', true, 52428800,
        array['image/png', 'image/jpeg', 'image/webp', 'image/gif', 'video/mp4', 'video/webm', 'application/pdf'])
on conflict (id) do update
  set public = true, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "cockpit-media bekijken" on storage.objects;
create policy "cockpit-media bekijken" on storage.objects
  for select to authenticated
  using (bucket_id = 'cockpit-media' and public.audit_can('lezen', (storage.foldername(name))[1]));

drop policy if exists "cockpit-media uploaden" on storage.objects;
create policy "cockpit-media uploaden" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'cockpit-media' and public.audit_can('bewerken', (storage.foldername(name))[1]));

drop policy if exists "cockpit-media vervangen" on storage.objects;
create policy "cockpit-media vervangen" on storage.objects
  for update to authenticated
  using (bucket_id = 'cockpit-media' and public.audit_can('bewerken', (storage.foldername(name))[1]));

drop policy if exists "cockpit-media verwijderen" on storage.objects;
create policy "cockpit-media verwijderen" on storage.objects
  for delete to authenticated
  using (bucket_id = 'cockpit-media' and public.audit_can('verwijderen', (storage.foldername(name))[1]));
