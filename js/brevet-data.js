/* ==========================================================================
   Opslag van de AI-brevetten: accounts en het feitenlogboek
   --------------------------------------------------------------------------
   De tabellen audit_accounts en audit_brevet_facts (stap 12,
   setup/supabase-audit-brevetten.sql), via js/central.js. Wie je bent, staat
   in js/account.js (inloggen met Microsoft of een inloglink).

   Een feit: { id, email, kind, item, detail, namespace, at, by }. Feiten worden
   nooit aangepast, alleen toegevoegd (of door beheer verwijderd); dezelfde soort
   met hetzelfde item bestaat hoogstens één keer per persoon. Een nieuw account
   heeft geen feiten: iedereen begint onderaan de ladder.
   Na een migratie: alleen dit bestand en js/account.js vervangen (zie README).
   ========================================================================== */
(function (ns) {
  'use strict';

  const ACCOUNT_FIELDS = ['name', 'team', 'vestiging', 'joined_at', 'share_brevet', 'level', 'level_seen'];

  const me = () => {
    const account = ns.account.current();
    return account ? account.email : '';
  };
  const pick = (patch) => Object.fromEntries(Object.entries(patch || {}).filter(([name]) => ACCOUNT_FIELDS.includes(name)));

  /* ---- Voor de deelnemer --------------------------------------------------------------- */
  /** Jouw account (of null: nog geen account, of niet ingelogd). */
  async function account() {
    const email = me();
    if (!email) return null;
    return ns.central.brevetAccount(await ns.account.token(), email);
  }

  /** Je account aanmaken of bijwerken; geeft het account. */
  async function saveAccount(patch) {
    const email = me();
    if (!email) throw new Error('niet ingelogd');
    return ns.central.brevetSaveAccount(await ns.account.token(), Object.assign({ email }, pick(patch)));
  }

  /** Stoppen met meedoen: account en logboek weg. */
  async function removeAccount() {
    const email = me();
    if (!email) return;
    await ns.central.brevetRemoveAccount(await ns.account.token(), email);
  }

  /** Jouw feiten (oudste eerst). */
  async function facts() {
    if (!me()) return [];
    return ns.central.brevetFacts(await ns.account.token());
  }

  /** Een feit toevoegen dat je zelf mag vastleggen: 'ok', 'duplicate', 'missing' of 'failed'. */
  async function add(fact) {
    const email = me();
    if (!email) return 'failed';
    return ns.central.brevetAddFact(await ns.account.token(), Object.assign({ email }, fact));
  }

  /** Je royalty's: [{ item, month, users }]. */
  async function royalties() {
    if (!me()) return [];
    return ns.central.brevetRoyalties(await ns.account.token());
  }

  /* ---- Voor beheer (hoofdbeheerders) ----------------------------------------------------- */
  const adminAccounts = () => ns.central.adminBrevetAccounts();
  const adminFacts = () => ns.central.adminBrevetFacts();

  /** Feiten toevoegen namens het AI-team (rows: [{ email, kind, item, detail, namespace }]); bestaande blijven staan. */
  async function adminAdd(rows) {
    if (!rows.length) return 0;
    return ns.central.adminBrevetAdd(rows);
  }

  async function adminRemove(id) {
    await ns.central.adminBrevetRemove(id);
  }

  ns.brevetData = { account, saveAccount, removeAccount, facts, add, royalties, adminAccounts, adminFacts, adminAdd, adminRemove };
})(window.AIAudit);
