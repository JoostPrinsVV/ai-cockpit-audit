-- ============================================================================
-- AI COCKPIT AUDIT — VERBETERVOORSTELLEN BIJ PROMPTS (stap 11)
-- ----------------------------------------------------------------------------
-- Bij iedere prompt kan een collega een betere versie voorstellen ('Stel een
-- verbetering voor'). Dat wordt een inzending van de soort 'verbetering', met
-- in de kolom 'target' bij welke prompt hij hoort. In Beheer → Inzendingen zie
-- je wat er verandert, kies je welke wijzigingen je overneemt en zet je het
-- resultaat klaar om op te slaan en te publiceren.
-- Voer dit uit na setup/supabase-audit.sql (stap 1); stap 7 tot en met 10 zijn er
-- niet voor nodig (overnemen in de cockpit gaat wel via de werkversies van stap 7):
--   Supabase → SQL Editor → New query → plak dit hele bestand → Run.
-- Opnieuw uitvoeren kan geen kwaad: bestaande gegevens blijven staan.
--
-- Wat het doet:
--   - de soort 'verbetering' erbij in audit_ideas (naast idee, vraag, verzoek, prompt);
--   - één kolom 'target' (bij welke prompt: soort, adres, veld, kop; geen persoonsgegevens);
--   - bezoekers mogen 'target' invullen bij een nieuwe inzending, maar niet lezen
--     (net als naam en e-mailadres; een verbetering wordt niet in de hub gepubliceerd).
-- ============================================================================

begin;
set local lock_timeout = '5s';

-- ---- 11. Verbetervoorstellen ---------------------------------------------------------------
-- De volledige lijst, ook de soorten van stap 13 (invliegen) en 16 (testfeedback): zo haalt opnieuw
-- uitvoeren van dit bestand die soorten niet weg (de volgorde van de stappen maakt niet uit).
alter table public.audit_ideas drop constraint if exists audit_ideas_kind_check;
alter table public.audit_ideas add constraint audit_ideas_kind_check
  check (kind in ('idee', 'vraag', 'verzoek', 'prompt', 'verbetering', 'invliegen', 'testfeedback'));

alter table public.audit_ideas add column if not exists target jsonb;
alter table public.audit_ideas drop constraint if exists audit_ideas_target_check;
alter table public.audit_ideas add constraint audit_ideas_target_check
  check (target is null or (jsonb_typeof(target) = 'object' and octet_length(target::text) <= 4000));
-- Een verbetering hoort altijd bij een prompt; de andere soorten hebben geen 'target'
alter table public.audit_ideas drop constraint if exists audit_ideas_target_kind;
alter table public.audit_ideas add constraint audit_ideas_target_kind
  check ((kind = 'verbetering') = (target is not null));

-- Invullen bij het insturen; lezen alleen voor beheerders (de bestaande regels van audit_ideas)
grant insert (target) on public.audit_ideas to anon, authenticated;

commit;

-- Klaar. Controle: deze query moet 'target' tonen.
-- select column_name from information_schema.columns where table_name = 'audit_ideas' and column_name = 'target';
