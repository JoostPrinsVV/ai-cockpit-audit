-- ============================================================================
-- AI COCKPIT AUDIT — AGENTS IN TESTFASE (stap 16)
-- ----------------------------------------------------------------------------
-- Een agent met de status 'Testfase' is nog geen geaccepteerde agent. Op zijn
-- pagina staat de knop 'Deel je testervaring' (js/agent-test.js): per
-- testcriterium een score van 1 tot 5, 'Zou je hem gebruiken?' en wat goed
-- ging en beter kan. Dat wordt een inzending van de soort 'testfeedback', met
-- de scores in de kolom 'details'. Alleen beheerders lezen hem (Beheer →
-- Inzendingen, en bij de agent in Beheer → Inhoud); hij wordt nooit openbaar.
--
-- Voer dit uit na setup/supabase-audit-invliegen.sql (stap 13):
--   Supabase → SQL Editor → New query → plak dit hele bestand → Run.
-- Opnieuw uitvoeren kan geen kwaad. (Stap 13 kent 'testfeedback' ook al: de
-- volgorde maakt niet uit, zolang de kolom 'details' er is.)
--
-- Wat het doet:
--   - de soort 'testfeedback' erbij in audit_ideas, met details, nooit openbaar;
--   - audit_testfeedback_count: per agent hoe vaak er een testervaring is
--     gedeeld, voor de regel op de pagina. Alleen aantallen, geen inhoud of namen.
-- ============================================================================

begin;
set local lock_timeout = '5s';

-- ---- 16. Agents in testfase ------------------------------------------------------------------
alter table public.audit_ideas add column if not exists details jsonb;

alter table public.audit_ideas drop constraint if exists audit_ideas_kind_check;
alter table public.audit_ideas add constraint audit_ideas_kind_check
  check (kind in ('idee', 'vraag', 'verzoek', 'prompt', 'verbetering', 'invliegen', 'testfeedback', 'agendapunt'));

alter table public.audit_ideas drop constraint if exists audit_ideas_details_check;
alter table public.audit_ideas add constraint audit_ideas_details_check
  check (details is null or (jsonb_typeof(details) = 'object' and octet_length(details::text) <= 2000));
-- Alleen een verzoek om in te vliegen en een testervaring hebben details
alter table public.audit_ideas drop constraint if exists audit_ideas_details_kind;
alter table public.audit_ideas add constraint audit_ideas_details_kind
  check ((kind in ('invliegen', 'testfeedback')) = (details is not null));
-- Nooit openbaar in de hub
alter table public.audit_ideas drop constraint if exists audit_ideas_invliegen_private;
alter table public.audit_ideas add constraint audit_ideas_invliegen_private
  check (kind not in ('invliegen', 'testfeedback') or (not is_public and not allow_public));

-- Invullen bij het insturen; lezen en bijwerken alleen voor beheerders (de bestaande regels van audit_ideas)
grant insert (details) on public.audit_ideas to anon, authenticated;

-- Hoe vaak er per agent een testervaring is gedeeld (alleen het aantal)
create or replace function public.audit_testfeedback_count(p_namespace text)
returns table (agent_id text, testers bigint)
language sql
stable
security definer
set search_path = public
as $$
  select i.details ->> 'agent', count(*)
  from public.audit_ideas i
  where i.kind = 'testfeedback'
    and i.namespace = p_namespace
    and i.details ? 'agent'
  group by i.details ->> 'agent'
  limit 200;
$$;
revoke all on function public.audit_testfeedback_count(text) from public;
grant execute on function public.audit_testfeedback_count(text) to anon, authenticated;

commit;

-- Klaar. Controle: deze query moet een (lege) lijst geven, geen foutmelding.
-- select * from public.audit_testfeedback_count('ai-audit');
