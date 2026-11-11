-- ============================================================================
-- AI COCKPIT AUDIT — ALLEEN V&V-ACCOUNTS (stap 18)
-- ----------------------------------------------------------------------------
-- Voor de AI-brevetten loggen collega's in met hun Microsoft-account van V&V.
-- Wie dat voor het eerst doet, krijgt in Supabase een nieuw account; daarvoor
-- moet Authentication → Sign In / Providers → 'Allow new users to sign up' AAN.
-- Dit bestand zorgt dat er dan alleen accounts bij kunnen komen met een adres
-- van @visser-visser.nl, op welke manier ook (Microsoft, een inloglink, een
-- wachtwoord). Bestaande accounts blijven gewoon werken.
--
-- Het geldt voor het hele Supabase-project, dus ook voor de AI Snackbar
-- (die maakt zelf geen accounts aan; beheerders voeg je toe in Authentication
-- → Users, ook met een V&V-adres).
--
-- Voer dit uit (na stap 12):
--   Supabase → SQL Editor → New query → plak dit hele bestand → Run.
-- Zet daarna de controle aan:
--   Authentication → Auth Hooks → Add hook → 'Before User Created' → Postgres,
--   schema 'public', functie 'audit_before_user_created' → Create.
-- Pas dan 'Allow new users to sign up' aan. Opnieuw uitvoeren kan geen kwaad.
-- ============================================================================

begin;
set local lock_timeout = '5s';

-- Supabase roept deze functie aan voordat er een account bijkomt. Een fout = geen account.
create or replace function public.audit_before_user_created(event jsonb)
returns jsonb
language plpgsql
stable
set search_path = public
as $$
declare
  v_email text := lower(coalesce(event -> 'user' ->> 'email', ''));
begin
  if v_email ~ '^[^@\s]+@visser-visser\.nl$' then
    return '{}'::jsonb;
  end if;
  return jsonb_build_object('error', jsonb_build_object(
    'http_code', 403,
    'message', 'Alleen met een account van Visser & Visser (@visser-visser.nl).'
  ));
end;
$$;

-- Alleen Supabase Auth mag hem aanroepen
revoke all on function public.audit_before_user_created(jsonb) from public, anon, authenticated;
grant execute on function public.audit_before_user_created(jsonb) to supabase_auth_admin;

commit;

-- Klaar. Controle (geeft {} en daarna een fout):
-- select public.audit_before_user_created('{"user":{"email":"Jan.Jansen@visser-visser.nl"}}');
-- select public.audit_before_user_created('{"user":{"email":"iemand@gmail.com"}}');
