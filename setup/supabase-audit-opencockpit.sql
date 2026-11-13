-- ============================================================================
-- AI COCKPIT AUDIT — OPEN COCKPIT, HET INLOOPUUR OVER COPILOT (stap 19)
-- ----------------------------------------------------------------------------
-- Collega's dragen op #/open-cockpit een agendapunt aan voor de volgende sessie.
-- Dat wordt een inzending van de soort 'agendapunt', met in de kolom 'session'
-- bij welke sessie hij hoort (de datum, bijv. '2026-12-10'). In Beheer → Open
-- Cockpit zet je een punt op de agenda (gepubliceerd, zonder naam), verplaats je
-- het naar een andere sessie en schrijf je na afloop de reactie erbij.
-- De sessies zelf (datum, tijd, vestiging, Teams-link, nieuws, opname) staan als
-- instelling in audit_content: daarvoor is geen SQL nodig.
-- Voer dit uit na setup/supabase-audit.sql (stap 1):
--   Supabase → SQL Editor → New query → plak dit hele bestand → Run.
-- Opnieuw uitvoeren kan geen kwaad: bestaande gegevens blijven staan.
--
-- Wat het doet:
--   - de soort 'agendapunt' erbij in audit_ideas (naast de soorten van stap 1, 11, 13 en 16);
--   - één kolom 'session' (bij welke sessie: een datum of 'volgende', geen persoonsgegevens);
--   - bezoekers mogen 'session' invullen bij een nieuwe inzending én lezen bij wat
--     gepubliceerd is (de agenda en eerdere sessies tonen per sessie de punten).
-- ============================================================================

begin;
set local lock_timeout = '5s';

-- ---- 19. Agendapunten voor Open Cockpit -----------------------------------------------------
-- De volledige lijst, ook de soorten van stap 11 (verbetering), 13 (invliegen) en 16 (testfeedback):
-- die bestanden noemen 'agendapunt' ook, zodat de volgorde van de stappen niet uitmaakt.
alter table public.audit_ideas drop constraint if exists audit_ideas_kind_check;
alter table public.audit_ideas add constraint audit_ideas_kind_check
  check (kind in ('idee', 'vraag', 'verzoek', 'prompt', 'verbetering', 'invliegen', 'testfeedback', 'agendapunt'));

alter table public.audit_ideas add column if not exists session text;
alter table public.audit_ideas drop constraint if exists audit_ideas_session_check;
alter table public.audit_ideas add constraint audit_ideas_session_check
  check (session is null or session ~ '^([0-9]{4}-[0-9]{2}-[0-9]{2}|volgende)$');
-- Een agendapunt hoort altijd bij een sessie; de andere soorten hebben er geen
alter table public.audit_ideas drop constraint if exists audit_ideas_session_kind;
alter table public.audit_ideas add constraint audit_ideas_session_kind
  check ((kind = 'agendapunt') = (session is not null));

-- Invullen bij het insturen, en lezen bij wat een beheerder heeft gepubliceerd
grant insert (session) on public.audit_ideas to anon, authenticated;
grant select (session) on public.audit_ideas to anon;

create index if not exists audit_ideas_session_idx on public.audit_ideas (namespace, session) where session is not null;

commit;

-- Klaar. Controle: deze query moet 'session' tonen.
-- select column_name from information_schema.columns where table_name = 'audit_ideas' and column_name = 'session';
