-- ============================================================================
-- AI COCKPIT AUDIT — AI-SPECIALIST INVLIEGEN (stap 13)
-- ----------------------------------------------------------------------------
-- Een team met een klantcasus vraagt vanuit de cockpit de AI-specialist van
-- de discipline om mee te denken ('AI-specialist invliegen', js/specialist.js).
-- Dat wordt een inzending van de soort 'invliegen', met de details (fase,
-- soort klant, data, wanneer, hoe) in de kolom 'details'. Beheer → Invliegen
-- toont ze op urgentie (js/admin-specialist.js).
-- Voer dit uit na setup/supabase-audit.sql (stap 1); andere stappen zijn niet nodig:
--   Supabase → SQL Editor → New query → plak dit hele bestand → Run.
-- Opnieuw uitvoeren kan geen kwaad: bestaande gegevens blijven staan.
--
-- Wat het doet:
--   - de soort 'invliegen' erbij in audit_ideas (naast idee, vraag, verzoek, prompt, verbetering);
--   - één kolom 'details' (geen klantnaam: dat vraagt het formulier niet);
--   - zo'n verzoek is nooit openbaar (niet te publiceren in de hub);
--   - bezoekers mogen 'details' invullen, maar niet lezen (net als naam en e-mailadres);
--   - de aanvrager ziet de status van zijn eigen verzoeken op referentie (die staat
--     alleen op zijn eigen apparaat): audit_invliegen_status. Geen inhoud, geen namen.
--
-- Later, voor een bericht in Teams bij een nieuw verzoek: Supabase → Database →
-- Webhooks → op INSERT in audit_ideas, naar een Power Automate-flow ('When an HTTP
-- request is received'), die filtert op kind = 'invliegen' (zie README).
-- ============================================================================

begin;
set local lock_timeout = '5s';

-- ---- 13. AI-specialist invliegen ------------------------------------------------------------
alter table public.audit_ideas drop constraint if exists audit_ideas_kind_check;
alter table public.audit_ideas add constraint audit_ideas_kind_check
  check (kind in ('idee', 'vraag', 'verzoek', 'prompt', 'verbetering', 'invliegen'));

alter table public.audit_ideas add column if not exists details jsonb;
alter table public.audit_ideas drop constraint if exists audit_ideas_details_check;
alter table public.audit_ideas add constraint audit_ideas_details_check
  check (details is null or (jsonb_typeof(details) = 'object' and octet_length(details::text) <= 2000));
-- Alleen een verzoek om in te vliegen heeft details
alter table public.audit_ideas drop constraint if exists audit_ideas_details_kind;
alter table public.audit_ideas add constraint audit_ideas_details_kind
  check ((kind = 'invliegen') = (details is not null));
-- Nooit openbaar in de hub
alter table public.audit_ideas drop constraint if exists audit_ideas_invliegen_private;
alter table public.audit_ideas add constraint audit_ideas_invliegen_private
  check (kind <> 'invliegen' or (not is_public and not allow_public));

-- Invullen bij het insturen; lezen en bijwerken alleen voor beheerders (de bestaande regels van audit_ideas)
grant insert (details) on public.audit_ideas to anon, authenticated;

-- De status van je eigen verzoeken, op referentie (ref is een willekeurige code van jouw apparaat)
create or replace function public.audit_invliegen_status(p_refs text[])
returns table (ref text, status text, planned text, answered_at timestamptz)
language sql
stable
security definer
set search_path = public
as $$
  select i.ref::text, i.status, i.details ->> 'ingepland', i.answered_at
  from public.audit_ideas i
  where i.kind = 'invliegen'
    and i.ref::text = any (p_refs[1:50])
  limit 50;
$$;
revoke all on function public.audit_invliegen_status(text[]) from public;
grant execute on function public.audit_invliegen_status(text[]) to anon, authenticated;

commit;

-- Klaar. Controle: deze query moet 'details' tonen.
-- select column_name from information_schema.columns where table_name = 'audit_ideas' and column_name = 'details';
