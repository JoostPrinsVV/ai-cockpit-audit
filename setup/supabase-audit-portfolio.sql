-- ============================================================================
-- AI COCKPIT AUDIT — IDEEËN BEOORDELEN (stap 10)
-- ----------------------------------------------------------------------------
-- Voor Beheer → Portfolio: een inzending uit de ideeënhub beoordelen met de
-- AI Value Matrix (knock-outs, scores, kwadrant, risicoklasse, besluit).
-- Voer dit uit na setup/supabase-audit.sql (stap 1); stap 7 tot en met 9 zijn er
-- niet voor nodig:
--   Supabase → SQL Editor → New query → plak dit hele bestand → Run.
-- Opnieuw uitvoeren kan geen kwaad: bestaande gegevens blijven staan.
--
-- Wat het doet: één kolom 'assessment' bij audit_ideas. Lezen en aanpassen kan
-- alleen een hoofdbeheerder (de bestaande regels van audit_ideas). Bezoekers van
-- de hub kunnen hem niet lezen: zij hebben alleen leesrecht op de kolommen die
-- in stap 1 met name zijn genoemd, en deze hoort daar niet bij.
-- ============================================================================

begin;
set local lock_timeout = '5s';

-- ---- 10. Beoordeling bij een inzending ----------------------------------------------------
alter table public.audit_ideas add column if not exists assessment jsonb;
alter table public.audit_ideas drop constraint if exists audit_ideas_assessment_check;
alter table public.audit_ideas add constraint audit_ideas_assessment_check
  check (assessment is null or (jsonb_typeof(assessment) = 'object' and octet_length(assessment::text) <= 20000));

commit;

-- Klaar. Controle: deze query moet 'assessment' tonen.
-- select column_name from information_schema.columns where table_name = 'audit_ideas' and column_name = 'assessment';
