-- ============================================================================
-- AI COCKPIT AUDIT — PUNTENITEMS VOOR DE AI-BREVETTEN (stap 15)
-- ----------------------------------------------------------------------------
-- In Beheer → AI-brevetten → Regels kan het AI-team per discipline:
--   - automatische items aanzetten: wat de cockpit al ziet (een tip gelezen,
--     een agent geopend, Cockpit Wrapped bekeken …). Wie meedoet, legt dat
--     zelf vast als feit 'activity';
--   - eigen items maken (bijv. 'Agent gebouwd in Copilot Studio') en die bij
--     een deelnemer toekennen: feit 'item_awarded', alleen door beheer.
-- Hoeveel miles iets oplevert, staat in de regels (audit_content, instelling
-- 'brevet'); de database bewaart alleen de feiten.
--
-- Voer dit uit na setup/supabase-audit-brevetten.sql (stap 12):
--   Supabase → SQL Editor → New query → plak dit hele bestand → Run.
-- Opnieuw uitvoeren kan geen kwaad. Zonder stap 12 doet dit niets.
-- (Stap 12 en 14 bevatten deze soorten ook al: de volgorde maakt niet uit.)
-- ============================================================================

begin;
set local lock_timeout = '5s';

do $$
begin
  if to_regclass('public.audit_brevet_facts') is null then
    raise notice 'AI-brevetten (stap 12) zijn nog niet ingericht: niets te doen.';
    return;
  end if;
  alter table public.audit_brevet_facts drop constraint if exists audit_brevet_facts_kind_check;
  alter table public.audit_brevet_facts add constraint audit_brevet_facts_kind_check
    check (kind in (
      'active_day', 'prompt_used', 'demo_watched', 'prompt_rated', 'builder_strong', 'tour_done',
      'profile_done', 'policy_check', 'idea_sent', 'recording_watched', 'kickstart_done', 'activity',
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
                     'profile_done', 'policy_check', 'idea_sent', 'recording_watched', 'kickstart_done', 'activity')
        and exists (select 1 from public.audit_accounts a where a.email = public.audit_email() and a.joined_at is not null)
      )
    );
end;
$$;

commit;

-- Klaar. Controle: deze query moet 'activity' en 'item_awarded' in de lijst tonen.
-- select pg_get_constraintdef(oid) from pg_constraint where conname = 'audit_brevet_facts_kind_check';
