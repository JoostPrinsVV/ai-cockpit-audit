-- ============================================================================
-- AI COCKPIT AUDIT — TIJDWINST (stap 14)
-- ----------------------------------------------------------------------------
-- Na het kopiëren van een prompt met een tijdsindicatie vraagt de cockpit
-- 'Scheelde dit tijd?' (js/tijdwinst.js). Het antwoord gaat als anonieme teller
-- naar audit_events, net als 'gekopieerd' en 'bekeken': geen naam, geen
-- apparaat, alleen welke prompt of usecase en of het tijd scheelde.
-- Voer dit uit na setup/supabase-audit.sql (stap 1):
--   Supabase → SQL Editor → New query → plak dit hele bestand → Run.
-- Opnieuw uitvoeren kan geen kwaad: bestaande gegevens blijven staan.
--
-- Wat het doet:
--   - twee soorten tellers erbij: 'time_saved' (ja) en 'time_none' (nee);
--   - audit_time_saved: per prompt of usecase hoe vaak 'ja', deze maand en in
--     totaal, voor de regel op de startpagina. Alleen aantallen, voor iedereen
--     te lezen; de cockpit rekent ze om met de schatting die bij de prompt staat;
--   - als de AI-brevetten er al zijn (stap 12): 'Kickstart afgerond' als feit
--     dat een deelnemer zelf mag vastleggen.
-- Beheer → Gebruik toont ja en nee per prompt (dat lezen beheerders al).
-- ============================================================================

begin;
set local lock_timeout = '5s';

-- ---- 14. Tijdwinst ------------------------------------------------------------------------
alter table public.audit_events drop constraint if exists audit_events_kind_check;
alter table public.audit_events add constraint audit_events_kind_check
  check (kind in ('view_usecase', 'play_demo', 'copy_prompt', 'view_tip', 'copy_tip', 'view_training', 'play_training', 'view_agent', 'open_agent',
                  'time_saved', 'time_none'));

-- Hoe vaak 'ja, het scheelde tijd' per prompt of usecase: deze maand (Nederlandse tijd) en in totaal
create or replace function public.audit_time_saved(p_namespace text)
returns table (item_id text, month_count bigint, total_count bigint)
language sql
stable
security definer
set search_path = public
as $$
  select e.item_id,
         count(*) filter (where e.occurred_at >= date_trunc('month', now() at time zone 'Europe/Amsterdam') at time zone 'Europe/Amsterdam'),
         count(*)
  from public.audit_events e
  where e.kind = 'time_saved'
    and e.namespace = p_namespace
  group by e.item_id
  order by count(*) desc
  limit 500;
$$;
revoke all on function public.audit_time_saved(text) from public;
grant execute on function public.audit_time_saved(text) to anon, authenticated;

-- AI-brevetten (alleen als stap 12 al is uitgevoerd): 'kickstart_done' erbij
do $$
begin
  if to_regclass('public.audit_brevet_facts') is null then
    return;
  end if;
  alter table public.audit_brevet_facts drop constraint if exists audit_brevet_facts_kind_check;
  alter table public.audit_brevet_facts add constraint audit_brevet_facts_kind_check
    check (kind in (
      'active_day', 'prompt_used', 'demo_watched', 'prompt_rated', 'builder_strong', 'tour_done',
      'profile_done', 'policy_check', 'idea_sent', 'recording_watched', 'kickstart_done',
      'contribution_adopted', 'training_registered', 'training_attended', 'session_given',
      'nominated', 'prompt_author', 'bonus'));

  drop policy if exists "audit_brevet_facts toevoegen" on public.audit_brevet_facts;
  create policy "audit_brevet_facts toevoegen" on public.audit_brevet_facts
    for insert to authenticated
    with check (
      public.audit_is_admin()
      or (
        email = public.audit_email()
        and public.audit_brevet_allowed()
        and kind in ('active_day', 'prompt_used', 'demo_watched', 'prompt_rated', 'builder_strong', 'tour_done',
                     'profile_done', 'policy_check', 'idea_sent', 'recording_watched', 'kickstart_done')
        and exists (select 1 from public.audit_accounts a where a.email = public.audit_email() and a.joined_at is not null)
      )
    );
end;
$$;

commit;

-- Klaar. Controle: deze query moet een (lege) lijst geven, geen foutmelding.
-- select * from public.audit_time_saved('ai-audit');
