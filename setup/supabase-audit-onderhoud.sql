-- ============================================================================
-- AI COCKPIT AUDIT — ONDERHOUD: ZOEKVRAGEN ZONDER RESULTAAT (stap 17)
-- ----------------------------------------------------------------------------
-- Zoekt een collega iets wat er niet is (op de zoekpagina of met Ctrl+K), dan
-- telt de cockpit die zoekterm anoniem mee (js/search-gaps.js): een teller
-- 'search_empty' in audit_events, net als 'bekeken' en 'gekopieerd'. Geen naam,
-- geen apparaat. De cockpit schoont de term eerst op: kleine letters, cijfers
-- weggelaten (geen BSN, IBAN of telefoonnummer), niets met een e-mailadres of
-- link, hoogstens 60 tekens. Beheer → Onderhoud toont per term hoe vaak hij
-- gezocht is (js/admin-onderhoud.js).
--
-- Voer dit uit na setup/supabase-audit.sql (stap 1):
--   Supabase → SQL Editor → New query → plak dit hele bestand → Run.
-- Opnieuw uitvoeren kan geen kwaad: bestaande gegevens blijven staan.
--
-- Wat het doet:
--   - de soort teller 'search_empty' erbij;
--   - zoektermen worden niet langer bewaard dan nodig: bij iedere nieuwe
--     zoekterm gaan die van meer dan 180 dagen geleden weg;
--   - audit_search_terms: per zoekterm hoe vaak en wanneer het laatst. Alleen
--     beheerders krijgen iets terug (de regels van audit_events gelden); een
--     beheerder kan een term ook wissen (bijv. als er een klantnaam tussen staat);
--   - als de AI-brevetten er al zijn (stap 12): 'Testervaring gedeeld' (test_shared)
--     als feit dat een deelnemer zelf mag vastleggen, bij een agent in testfase.
-- ============================================================================

begin;
set local lock_timeout = '5s';

-- ---- 17. Zoekvragen zonder resultaat ---------------------------------------------------------
alter table public.audit_events drop constraint if exists audit_events_kind_check;
alter table public.audit_events add constraint audit_events_kind_check
  check (kind in ('view_usecase', 'play_demo', 'copy_prompt', 'view_tip', 'copy_tip', 'view_training', 'play_training', 'view_agent', 'open_agent',
                  'time_saved', 'time_none', 'search_empty'));

-- Niet langer bewaren dan nodig: bij een nieuwe zoekterm de zoektermen van meer dan 180 dagen geleden wissen
create or replace function public.audit_events_search_retention()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from public.audit_events
  where kind = 'search_empty'
    and namespace = new.namespace
    and occurred_at < now() - interval '180 days';
  return null;
end;
$$;
revoke all on function public.audit_events_search_retention() from public;

drop trigger if exists audit_events_search_retention on public.audit_events;
create trigger audit_events_search_retention
  after insert on public.audit_events
  for each row when (new.kind = 'search_empty')
  execute function public.audit_events_search_retention();

-- Per zoekterm hoe vaak en wanneer het laatst, de afgelopen p_days dagen (hoogstens een jaar).
-- security invoker: de regels van audit_events gelden, dus alleen een beheerder krijgt rijen terug.
create or replace function public.audit_search_terms(p_namespace text, p_days integer default 180)
returns table (term text, searches bigint, last_at timestamptz)
language sql
stable
security invoker
set search_path = public
as $$
  select e.item_id, count(*), max(e.occurred_at)
  from public.audit_events e
  where e.kind = 'search_empty'
    and e.namespace = p_namespace
    and e.occurred_at >= now() - make_interval(days => least(greatest(coalesce(p_days, 180), 1), 366))
  group by e.item_id
  order by count(*) desc, max(e.occurred_at) desc
  limit 300;
$$;
revoke all on function public.audit_search_terms(text, integer) from public;
grant execute on function public.audit_search_terms(text, integer) to anon, authenticated;

-- AI-brevetten (alleen als stap 12 al is uitgevoerd): 'test_shared' erbij
do $$
begin
  if to_regclass('public.audit_brevet_facts') is null then
    return;
  end if;
  alter table public.audit_brevet_facts drop constraint if exists audit_brevet_facts_kind_check;
  alter table public.audit_brevet_facts add constraint audit_brevet_facts_kind_check
    check (kind in (
      'active_day', 'prompt_used', 'demo_watched', 'prompt_rated', 'builder_strong', 'tour_done',
      'profile_done', 'policy_check', 'idea_sent', 'recording_watched', 'kickstart_done', 'activity', 'test_shared',
      'contribution_adopted', 'training_registered', 'training_attended', 'session_given',
      'nominated', 'prompt_author', 'bonus', 'item_awarded'));

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
end;
$$;

commit;

-- Klaar. Controle: deze query moet een (lege) lijst geven, geen foutmelding.
-- select * from public.audit_search_terms('ai-audit', 180);
