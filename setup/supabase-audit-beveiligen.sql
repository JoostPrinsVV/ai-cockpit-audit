-- ============================================================================
-- AI COCKPIT AUDIT — BEVEILIGEN EN BETROUWBAAR PUBLICEREN (stap 8)
-- ----------------------------------------------------------------------------
-- Voer dit uit NA setup/supabase-audit.sql (stap 1 t/m 6) en
-- setup/supabase-audit-bewerken.sql (stap 7):
--   Supabase → SQL Editor → New query → plak dit hele bestand → Run.
-- Opnieuw uitvoeren kan geen kwaad: bestaande gegevens blijven staan.
--
-- Volgorde bij een bestaande installatie: zet eerst de nieuwe versie van de site
-- live (die kan met én zonder deze stap werken), voer dan dit bestand uit.
-- Een paar functies uit stap 7 krijgen hier hun definitieve vorm; stap 7 weigert daarom
-- om na deze stap opnieuw te draaien. Stap 1 opnieuw uitvoeren kan wel.
--
-- Wat het verandert:
--   8a. Rechten: met meerdere rollen telt iedere rol mee (bijv. beheerder van Tips
--       én redacteur van alles). Ook te controleren voor iemand anders (gepland).
--   8b. Vier ogen bij gepland publiceren: slaat een bijdrager een voorstel op voor
--       een ingepland item, dan vervalt de planning (anders ging zijn niet-bekeken
--       versie op het geplande moment live). Gepland publiceren zet alleen de versie
--       live die is ingepland, en alleen als de planner dat dan nog steeds mag.
--   8c. Publiceren is gebonden aan de versie die je in het paneel zag: is het item
--       intussen opnieuw opgeslagen, dan wordt het overgeslagen.
--   8d. Opslaan zonder versie terwijl het item al bestaat (twee mensen maken
--       tegelijk hetzelfde adres aan) geeft een conflict in plaats van overschrijven.
--   8e. Werkversies en e-mailadressen van beheerders zijn alleen nog te lezen voor
--       wie een rol heeft in die discipline (via de functie audit_content_editor),
--       niet meer voor iedere ingelogde gebruiker van het Supabase-project.
--   8f. Rechtstreekse wijzigingen van bestaande items (back-up terugzetten,
--       definitief verwijderen) komen in het logboek en verhogen de versie; geen
--       lege versies meer in de geschiedenis; 'weggooien' werkt ook bij een oud concept.
--   8g. Media: een geüpload bestand kan niet meer worden overschreven (dat ging
--       direct live, ook door een bijdrager).
--   8h. Opschoning: strengere invoercontrole, minder rechten voor anoniem, vaste
--       search_path, indexen. En, als pg_cron aanstaat, gepland publiceren iedere
--       minuut (zonder pg_cron gebeurt het zoals nu bij het eerstvolgende bezoek).
--
-- Controleer ook, eenmalig, in Supabase → Authentication:
--   - Sign In / Providers → Email: 'Confirm email' AAN en 'Secure email change' AAN
--     (rechten hangen aan het e-mailadres van het account);
--   - 'Allow new users to sign up' UIT en 'Allow anonymous sign-ins' UIT.
--
-- Na afloop: laat beheerders de site herladen (een open tabblad met de oude versie
-- kan na deze stap niet meer opslaan).
-- ============================================================================

-- Alles of niets; liever netjes stoppen dan de site lang laten wachten op een lock
begin;
set local lock_timeout = '5s';

-- ---- 8a. Rechten ---------------------------------------------------------------------
-- Mag p_email dit? Zelfde regels als in js/rights.js. Iedere rol die geldt (voor deze
-- naamruimte of voor alle) telt mee; één rol die het toestaat is genoeg.
create or replace function public.audit_can_as(p_email text, p_action text, p_namespace text, p_type text default null)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_email text := lower(coalesce(p_email, ''));
begin
  if v_email = '' then
    return false;
  end if;
  if exists (select 1 from public.audit_admins a where lower(a.email) = v_email) then
    return true;
  end if;
  return exists (
    select 1 from public.audit_roles r
    where lower(r.email) = v_email
      and r.namespace in (p_namespace, '*')
      and (
        p_action = 'lezen'
        or (
          -- Technische rijen (meta) zijn alleen voor hoofdbeheerders
          p_type is distinct from 'meta'
          -- Een rol voor bepaalde onderdelen geldt alleen voor die onderdelen
          and (p_type is null or coalesce(array_length(r.sections, 1), 0) = 0 or p_type = any (r.sections))
          and case p_action
                when 'bewerken' then true
                when 'verwijderen' then r.role = 'beheerder'
                when 'publiceren' then r.role in ('beheerder', 'redacteur')
                else false
              end
        )
      )
  );
end;
$$;

-- Mag de ingelogde gebruiker dit? (gebruikt in de functies en policies van stap 7)
create or replace function public.audit_can(p_action text, p_namespace text, p_type text default null)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.audit_can_as(public.audit_email(), p_action, p_namespace, p_type);
$$;

-- audit_role() werd nergens gebruikt
drop function if exists public.audit_role(text);

revoke all on function public.audit_can_as(text, text, text, text) from public, anon, authenticated;
-- Anoniem heeft deze niet nodig (alle policies die ze gebruiken gelden alleen voor ingelogde gebruikers)
revoke all on function public.audit_can(text, text, text) from public, anon;
revoke all on function public.audit_email() from public, anon;
revoke all on function public.audit_is_admin() from public, anon;
grant execute on function public.audit_can(text, text, text) to authenticated;
grant execute on function public.audit_email() to authenticated;
grant execute on function public.audit_is_admin() to authenticated;

-- ---- 8b–8d. Opslaan, publiceren en gepland publiceren ------------------------------------
-- De versie die is ingepland (gepland publiceren zet alleen die live)
alter table public.audit_content add column if not exists publish_version integer;
-- Wat al ingepland stond, gaat nog gewoon live. Behalve een voorstel dat ná het inplannen is
-- opgeslagen: die versie heeft niemand bekeken (precies het gat dat deze stap dicht), dus
-- die planning vervalt straks met een regel in het logboek.
update public.audit_content c set publish_version = c.version
where c.publish_at is not null and c.publish_version is null
  and (c.draft_kind is distinct from 'voorstel'
       or c.draft_at <= (select max(l.at) from public.audit_log l
                         where l.namespace = c.namespace and l.type = c.type and l.item_id = c.id
                           and l.action = 'gepland'));

-- Wie een wijziging doet (voor de geschiedenis en het logboek, zie de trigger hieronder).
-- Alleen binnen deze transactie: elke aanroep vanuit de site is een eigen transactie.
create or replace function public.audit_set_actor(p_actor text)
returns void
language sql
set search_path = public
as $$
  select set_config('audit.actor', coalesce(p_actor, ''), true);
$$;
revoke all on function public.audit_set_actor(text) from public, anon, authenticated;

-- Werkversie opslaan (nieuw item of wijziging).
-- p_version: de versie die je had geladen; null alleen voor een nieuw item.
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
  v_me text := public.audit_email();
  v_kind text;
  v_status text := coalesce(p_draft ->> 'status', 'published');
  v_title text := left(coalesce(p_title, p_draft -> 'data' ->> 'title', p_draft -> 'data' ->> 'label', p_id), 200);
  v_keep_plan boolean;
begin
  if not public.audit_can('bewerken', p_namespace, p_type) then
    raise exception 'geen rechten om dit onderdeel te bewerken' using errcode = '42501';
  end if;
  if p_type = 'setting' and p_id = 'disciplines' and not public.audit_is_admin() then
    raise exception 'alleen een hoofdbeheerder past de disciplines aan' using errcode = '42501';
  end if;
  -- De werkversie: een object met data (ook een object), position en status, niet onbeperkt groot
  if jsonb_typeof(p_draft) is distinct from 'object' or jsonb_typeof(coalesce(p_draft -> 'data', '{}'::jsonb)) <> 'object' then
    raise exception 'de werkversie heeft niet de juiste vorm' using errcode = '22023';
  end if;
  if pg_column_size(p_draft) > 2000000 then
    raise exception 'de werkversie is te groot (meer dan 2 MB)' using errcode = '22023';
  end if;
  -- Een positie die later bij publiceren niet in een geheel getal past, zou het publiceren blokkeren
  if (p_draft ->> 'position') !~ '^-?[0-9]{1,9}$' then
    raise exception 'de positie in de werkversie moet een geheel getal zijn' using errcode = '22023';
  end if;
  if v_status not in ('published', 'trash') then
    raise exception 'onbekende status in de werkversie' using errcode = '22023';
  end if;
  if v_status = 'trash' and not public.audit_can('verwijderen', p_namespace, p_type) then
    raise exception 'geen rechten om te verwijderen' using errcode = '42501';
  end if;
  v_kind := case when public.audit_can('publiceren', p_namespace, p_type) then 'wijziging' else 'voorstel' end;
  perform public.audit_set_actor(v_me);

  select * into v_row from public.audit_content
  where namespace = p_namespace and type = p_type and id = p_id
  for update;

  if not found then
    -- Nieuw item. Maakt een ander tegelijk hetzelfde adres aan, dan is dat een conflict.
    insert into public.audit_content (namespace, type, id, data, position, status, draft, draft_kind, draft_by, draft_at, version)
    values (p_namespace, p_type, p_id, '{}'::jsonb, coalesce((p_draft ->> 'position')::integer, 0), 'draft',
            p_draft, v_kind, v_me, now(), 1)
    on conflict (namespace, type, id) do nothing;
    if not found then
      select * into v_row from public.audit_content where namespace = p_namespace and type = p_type and id = p_id;
      return jsonb_build_object('conflict', true, 'version', v_row.version,
        'draft_by', v_row.draft_by, 'draft_at', v_row.draft_at,
        'updated_by', v_row.updated_by, 'updated_at', v_row.updated_at);
    end if;
    insert into public.audit_log (actor, namespace, type, item_id, title, action, detail)
    values (v_me, p_namespace, p_type, p_id, v_title, case when v_kind = 'voorstel' then 'voorstel' else 'nieuw' end, null);
    return jsonb_build_object('ok', true, 'version', 1, 'kind', v_kind);
  end if;

  -- Een andere versie dan je had geladen, of geen versie terwijl het item al bestaat
  if p_version is null or v_row.version <> p_version then
    return jsonb_build_object('conflict', true, 'version', v_row.version,
      'draft_by', v_row.draft_by, 'draft_at', v_row.draft_at,
      'updated_by', v_row.updated_by, 'updated_at', v_row.updated_at);
  end if;

  -- Stond dit item ingepland? Wie mag publiceren, neemt een geldige planning (nog in de toekomst,
  -- voor de versie die er stond) over voor deze nieuwe versie. Een voorstel (vier ogen) laat de
  -- planning vervallen: deze versie heeft nog niemand bekeken.
  v_keep_plan := v_kind = 'wijziging' and v_row.publish_at > now()
                 and v_row.publish_version is not distinct from v_row.version;
  update public.audit_content
  set draft = p_draft, draft_kind = v_kind, draft_by = v_me, draft_at = now(), version = v_row.version + 1,
      publish_at = case when v_keep_plan then v_row.publish_at end,
      publish_by = case when v_keep_plan then v_me end,
      publish_version = case when v_keep_plan then v_row.version + 1 end
  where namespace = p_namespace and type = p_type and id = p_id;

  insert into public.audit_log (actor, namespace, type, item_id, title, action, detail)
  values (v_me, p_namespace, p_type, p_id, v_title,
          case when v_status = 'trash' then 'verwijderd' when v_kind = 'voorstel' then 'voorstel' else 'opgeslagen' end, null);
  if v_row.publish_at is not null and not v_keep_plan then
    insert into public.audit_log (actor, namespace, type, item_id, title, action, detail)
    values (v_me, p_namespace, p_type, p_id, v_title, 'planning vervallen',
            jsonb_build_object('was', v_row.publish_at, 'reden', case when v_kind = 'voorstel' then 'nieuw voorstel' else 'planning verlopen of verouderd' end));
  end if;
  return jsonb_build_object('ok', true, 'version', v_row.version + 1, 'kind', v_kind);
end;
$$;

-- Werkversie weggooien: je eigen werk, of met publicatierechten ook dat van een ander.
-- Een nieuw item verdwijnt helemaal; een oud concept zonder werkversie ook (dat is verwijderen,
-- dus alleen met verwijderrechten). Een werkversie op een oud concept: alleen die werkversie weg.
create or replace function public.audit_discard_draft(p_namespace text, p_type text, p_id text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.audit_content%rowtype;
  v_me text := public.audit_email();
begin
  select * into v_row from public.audit_content
  where namespace = p_namespace and type = p_type and id = p_id
  for update;
  if not found then
    return jsonb_build_object('ok', true);
  end if;
  if not (public.audit_can('publiceren', p_namespace, p_type)
          or (public.audit_can('bewerken', p_namespace, p_type) and lower(coalesce(v_row.draft_by, '')) = v_me)) then
    raise exception 'geen rechten om deze werkversie weg te gooien' using errcode = '42501';
  end if;
  perform public.audit_set_actor(v_me);
  if v_row.status = 'draft' and (v_row.data = '{}'::jsonb or v_row.draft is null) then
    if v_row.data <> '{}'::jsonb and not public.audit_can('verwijderen', p_namespace, p_type) then
      raise exception 'geen rechten om dit concept te verwijderen' using errcode = '42501';
    end if;
    delete from public.audit_content where namespace = p_namespace and type = p_type and id = p_id;
  else
    update public.audit_content
    set draft = null, draft_kind = null, draft_by = null, draft_at = null,
        publish_at = null, publish_by = null, publish_version = null, version = v_row.version + 1
    where namespace = p_namespace and type = p_type and id = p_id;
  end if;
  insert into public.audit_log (actor, namespace, type, item_id, title, action, detail)
  values (v_me, p_namespace, p_type, p_id,
          coalesce(v_row.draft -> 'data' ->> 'title', v_row.data ->> 'title', v_row.data ->> 'label', p_id), 'weggegooid', null);
  return jsonb_build_object('ok', true);
end;
$$;

-- Intern: de werkversie van één rij live zetten (of een oud concept publiceren).
-- p_actor: wie publiceert (bij gepland publiceren: wie het inplande).
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
  perform public.audit_set_actor(p_actor);
  if v_row.draft is null then
    if v_row.status <> 'draft' then
      return;
    end if;
    update public.audit_content
    set status = 'published', publish_at = null, publish_by = null, publish_version = null,
        version = v_row.version + 1, updated_by = p_actor
    where namespace = p_namespace and type = p_type and id = p_id;
  else
    update public.audit_content
    set data = coalesce(v_row.draft -> 'data', v_row.data),
        position = coalesce((v_row.draft ->> 'position')::integer, v_row.position),
        status = coalesce(v_row.draft ->> 'status', 'published'),
        draft = null, draft_kind = null, draft_by = null, draft_at = null,
        publish_at = null, publish_by = null, publish_version = null,
        version = v_row.version + 1,
        updated_by = p_actor
    where namespace = p_namespace and type = p_type and id = p_id;
  end if;
  insert into public.audit_log (actor, namespace, type, item_id, title, action, detail)
  values (p_actor, p_namespace, p_type, p_id,
          coalesce(v_row.draft -> 'data' ->> 'title', v_row.draft -> 'data' ->> 'label', v_row.data ->> 'title', v_row.data ->> 'label', p_id),
          case when v_row.draft ->> 'status' = 'trash' then 'verwijderd en gepubliceerd' else p_action end,
          jsonb_build_object('door', v_row.draft_by, 'soort', v_row.draft_kind));
end;
$$;

-- Publiceren (of plannen met p_at in de toekomst).
-- p_items: [{ namespace, type, id, version? }]; met version alleen als het item nog die versie heeft.
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
  v_me text := public.audit_email();
  v_done integer := 0;
  v_scheduled integer := 0;
  v_skipped jsonb := '[]'::jsonb;
begin
  for v_item in select value from jsonb_array_elements(coalesce(p_items, '[]'::jsonb)) loop
    select * into v_row from public.audit_content
    where namespace = v_item ->> 'namespace' and type = v_item ->> 'type' and id = v_item ->> 'id'
    for update;
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
    -- Intussen opnieuw opgeslagen: je hebt deze versie niet gezien, dus niet blind publiceren
    if jsonb_typeof(v_item -> 'version') = 'number' and v_row.version <> (v_item ->> 'version')::integer then
      v_skipped := v_skipped || jsonb_build_object('namespace', v_row.namespace, 'type', v_row.type, 'id', v_row.id, 'reason', 'intussen gewijzigd');
      continue;
    end if;
    if p_at is not null and p_at > now() then
      update public.audit_content
      set publish_at = p_at, publish_by = v_me, publish_version = v_row.version
      where namespace = v_row.namespace and type = v_row.type and id = v_row.id;
      insert into public.audit_log (actor, namespace, type, item_id, title, action, detail)
      values (v_me, v_row.namespace, v_row.type, v_row.id,
              coalesce(v_row.draft -> 'data' ->> 'title', v_row.draft -> 'data' ->> 'label', v_row.data ->> 'title', v_row.data ->> 'label', v_row.id),
              'gepland', jsonb_build_object('op', p_at));
      v_scheduled := v_scheduled + 1;
    else
      perform public.audit_apply_draft(v_row.namespace, v_row.type, v_row.id, v_me, 'gepubliceerd');
      v_done := v_done + 1;
    end if;
  end loop;
  return jsonb_build_object('done', v_done, 'scheduled', v_scheduled, 'skipped', v_skipped);
end;
$$;

-- Geplande publicaties uitvoeren waarvan het moment voorbij is: alleen de versie die is
-- ingepland, en alleen als de planner dat nu nog mag (anders vervalt de planning).
-- Doet niets (en kost bijna niets, zie de index) als er niets klaarstaat.
create or replace function public.audit_publish_due()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row record;
  v_count integer := 0;
  v_reason text;
begin
  for v_row in
    select c.namespace, c.type, c.id, c.publish_by, c.publish_at, c.publish_version, c.version, c.draft ->> 'status' as draft_status,
           coalesce(c.draft -> 'data' ->> 'title', c.draft -> 'data' ->> 'label', c.data ->> 'title', c.data ->> 'label', c.id) as title
    from public.audit_content c
    where c.publish_at is not null and c.publish_at <= now() and (c.draft is not null or c.status = 'draft')
    for update skip locked
  loop
    v_reason := case
      when v_row.publish_version is distinct from v_row.version then 'na het inplannen gewijzigd'
      when not public.audit_can_as(v_row.publish_by, 'publiceren', v_row.namespace, v_row.type) then 'planner mag niet (meer) publiceren'
      when v_row.draft_status = 'trash' and not public.audit_can_as(v_row.publish_by, 'verwijderen', v_row.namespace, v_row.type) then 'planner mag niet (meer) verwijderen'
    end;
    if v_reason is not null then
      update public.audit_content set publish_at = null, publish_by = null, publish_version = null
      where namespace = v_row.namespace and type = v_row.type and id = v_row.id;
      insert into public.audit_log (actor, namespace, type, item_id, title, action, detail)
      values ('gepland', v_row.namespace, v_row.type, v_row.id, v_row.title, 'planning vervallen',
              jsonb_build_object('was', v_row.publish_at, 'reden', v_reason, 'planner', v_row.publish_by));
      continue;
    end if;
    -- Eén item dat niet lukt (bijv. een oude werkversie met een kapotte waarde) houdt de rest niet tegen
    begin
      perform public.audit_apply_draft(v_row.namespace, v_row.type, v_row.id, coalesce(v_row.publish_by, 'gepland'), 'gepubliceerd (gepland)');
      v_count := v_count + 1;
    exception when others then
      update public.audit_content set publish_at = null, publish_by = null, publish_version = null
      where namespace = v_row.namespace and type = v_row.type and id = v_row.id;
      insert into public.audit_log (actor, namespace, type, item_id, title, action, detail)
      values ('gepland', v_row.namespace, v_row.type, v_row.id, v_row.title, 'planning vervallen',
              jsonb_build_object('was', v_row.publish_at, 'reden', 'fout: ' || sqlerrm, 'planner', v_row.publish_by));
    end;
  end loop;
  return v_count;
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
  update public.audit_content set publish_at = null, publish_by = null, publish_version = null
  where namespace = p_namespace and type = p_type and id = p_id;
  insert into public.audit_log (actor, namespace, type, item_id, action)
  values (public.audit_email(), p_namespace, p_type, p_id, 'planning geannuleerd');
end;
$$;
create index if not exists audit_content_publish_due_idx on public.audit_content (publish_at) where publish_at is not null;

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

-- ---- 8e. Werkversies alleen voor wie een rol heeft --------------------------------------
-- Ingelogd zonder rol (bijv. een account van de snackbar in hetzelfde project): dezelfde
-- kolommen als een bezoeker. Werkversies, planning en e-mailadressen via de functie hieronder.
-- Schrijven blijft zoals het was (de policy van stap 1 laat alleen hoofdbeheerders toe).
revoke select on public.audit_content from authenticated;
grant select (namespace, type, id, data, position, status, updated_at) on public.audit_content to authenticated;

-- De inhoud van deze naamruimtes voor de bewerkbalk en Beheer: gepubliceerde rijen voor
-- iedereen, en waar je een rol hebt ook concepten, werkversies en wie wat deed.
create or replace function public.audit_content_editor(p_namespaces text[])
returns table (
  namespace text, type text, id text, data jsonb, "position" integer, status text, updated_at timestamptz, updated_by text,
  draft jsonb, draft_kind text, draft_by text, draft_at timestamptz, publish_at timestamptz, publish_by text, version integer
)
language sql
stable
security definer
set search_path = public
as $$
  with mine as (
    select distinct n from unnest(coalesce(p_namespaces, '{}'::text[])) n where public.audit_can('lezen', n)
  )
  select c.namespace, c.type, c.id, c.data, c.position, c.status, c.updated_at,
         case when m.n is not null then c.updated_by end,
         case when m.n is not null then c.draft end,
         case when m.n is not null then c.draft_kind end,
         case when m.n is not null then c.draft_by end,
         case when m.n is not null then c.draft_at end,
         case when m.n is not null then c.publish_at end,
         case when m.n is not null then c.publish_by end,
         c.version
  from public.audit_content c
  left join mine m on m.n = c.namespace
  where c.namespace = any (coalesce(p_namespaces, '{}'::text[]))
    and (c.status = 'published' or m.n is not null)
  order by c.type, c.position, c.id
  limit 5000;
$$;
revoke all on function public.audit_content_editor(text[]) from public, anon;
grant execute on function public.audit_content_editor(text[]) to authenticated;

-- ---- 8f. Geschiedenis en logboek ---------------------------------------------------------
-- Bij iedere wijziging van de gepubliceerde stand: de vorige versie naar de geschiedenis,
-- tijdstip en wie. Rechtstreekse wijzigingen (niet via opslaan en publiceren, bijv. een
-- back-up terugzetten of definitief verwijderen) komen ook in het logboek en verhogen de
-- versie, zodat een werkversie die op de oude stand is gebaseerd een conflict geeft.
create or replace function public.audit_content_stamp()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_set text := coalesce(current_setting('audit.actor', true), '');
  v_actor text := coalesce(nullif(v_set, ''), auth.jwt() ->> 'email');
  v_direct boolean := v_set = '';
begin
  if tg_op = 'DELETE' then
    -- Een nieuw item dat nooit live stond, laat geen lege versie achter
    if not (old.status = 'draft' and old.data = '{}'::jsonb) then
      insert into public.audit_content_history (namespace, type, id, data, status, action, changed_by)
      values (old.namespace, old.type, old.id, old.data, old.status, 'delete', v_actor);
    end if;
    if v_direct then
      insert into public.audit_log (actor, namespace, type, item_id, title, action)
      values (v_actor, old.namespace, old.type, old.id, coalesce(old.data ->> 'title', old.data ->> 'label', old.id), 'definitief verwijderd');
    end if;
    return old;
  end if;
  if tg_op = 'UPDATE' then
    -- Alleen de werkversie of de planning veranderd: geen nieuwe gepubliceerde stand
    if new.data is not distinct from old.data
       and new.status is not distinct from old.status
       and new.position is not distinct from old.position then
      return new;
    end if;
    if not (old.status = 'draft' and old.data = '{}'::jsonb) then
      insert into public.audit_content_history (namespace, type, id, data, status, action, changed_by)
      values (old.namespace, old.type, old.id, old.data, old.status, 'update', v_actor);
    end if;
    if new.version is not distinct from old.version then
      new.version := old.version + 1;
    end if;
    if v_direct then
      insert into public.audit_log (actor, namespace, type, item_id, title, action)
      values (v_actor, new.namespace, new.type, new.id, coalesce(new.data ->> 'title', new.data ->> 'label', new.id), 'rechtstreeks aangepast');
    end if;
  end if;
  new.updated_at := now();
  new.updated_by := coalesce(v_actor, new.updated_by);
  return new;
end;
$$;
drop trigger if exists audit_content_stamp on public.audit_content;
create trigger audit_content_stamp
  before insert or update or delete on public.audit_content
  for each row execute function public.audit_content_stamp();

create index if not exists audit_content_history_item_idx on public.audit_content_history (namespace, type, id, changed_at desc);

-- ---- 8g. Media ------------------------------------------------------------------------------
-- Een geüpload bestand is onveranderlijk: vervangen ging direct live (ook als bijdrager).
-- Een nieuw bestand uploaden en het adres aanpassen gaat wel gewoon via opslaan en publiceren.
drop policy if exists "cockpit-media vervangen" on storage.objects;

-- ---- 8h. Opschoning -----------------------------------------------------------------------
-- Inzendingen, reviews en tellers alleen in een naamruimte van een discipline ('ai-…').
-- Alleen als er geen afwijkende rijen zijn: de controle geldt ook bij het bijwerken van een
-- bestaande rij (bijv. een stem), en die mag daar niet op stuklopen.
do $format$
declare
  v_table text;
  v_other boolean;
begin
  foreach v_table in array array['audit_ideas', 'audit_reviews', 'audit_events'] loop
    execute format('alter table public.%I drop constraint if exists %I', v_table, v_table || '_namespace_format');
    execute format('select exists (select 1 from public.%I where namespace !~ %L)', v_table, '^ai-[a-z0-9-]{1,57}$') into v_other;
    if v_other then
      raise notice '% heeft rijen met een andere naamruimte: daar komt geen controle op.', v_table;
    else
      execute format('alter table public.%I add constraint %I check (namespace ~ %L) not valid',
                     v_table, v_table || '_namespace_format', '^ai-[a-z0-9-]{1,57}$');
    end if;
  end loop;
end;
$format$;

-- Vaste search_path ook voor deze twee (de rest had hem al)
alter function public.audit_email() set search_path = public;
alter function public.audit_ideas_touch() set search_path = public;

-- Triggerfuncties hoeft niemand rechtstreeks aan te roepen
revoke all on function public.audit_votes_count() from public, anon, authenticated;
revoke all on function public.audit_content_stamp() from public, anon, authenticated;
revoke all on function public.audit_ideas_touch() from public, anon, authenticated;

-- Gepland publiceren iedere minuut, als pg_cron aanstaat (Database → Extensions → pg_cron).
-- Zonder pg_cron gebeurt het bij het eerstvolgende bezoek na het geplande moment.
do $cron$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.schedule('audit-publish-due', '* * * * *', 'select public.audit_publish_due()');
    -- Het logboek van pg_cron groeit met 1.440 regels per dag: die van deze taak na een week weg
    -- (alleen van deze taak; het project wordt gedeeld met de snackbar)
    perform cron.schedule('audit-publish-due-opschonen', '17 3 * * *',
      $job$delete from cron.job_run_details where jobid in (select jobid from cron.job where jobname = 'audit-publish-due') and end_time < now() - interval '7 days'$job$);
    raise notice 'Gepland publiceren: iedere minuut via pg_cron.';
  else
    raise notice 'pg_cron staat niet aan: gepland publiceren gebeurt bij het eerstvolgende bezoek.';
  end if;
end;
$cron$;

commit;

-- Klaar. Controle: deze query moet audit_content_editor en audit_can_as tonen.
-- select proname from pg_proc where proname in ('audit_content_editor', 'audit_can_as');
--
-- Proef (wordt teruggedraaid; vervang <hoofdbeheerder> door een adres uit audit_admins):
--   begin;
--   select set_config('request.jwt.claims', '{"email":"<hoofdbeheerder>","role":"authenticated"}', true);
--   select public.audit_save_draft('ai-audit', 'tip', 'zz-proef', '{"data":{"title":"proef"},"position":0,"status":"published"}'::jsonb);
--   select public.audit_publish('[{"namespace":"ai-audit","type":"tip","id":"zz-proef"}]'::jsonb);
--   select action, actor from public.audit_log where item_id = 'zz-proef' order by id;
--   rollback;
-- Verwacht: 'nieuw' en 'gepubliceerd', met het adres van de hoofdbeheerder.
