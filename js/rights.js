/* ==========================================================================
   Rechten van de ingelogde beheerder
   --------------------------------------------------------------------------
   Dezelfde regels als audit_can_as() in setup/supabase-audit-beveiligen.sql;
   hier alleen om knoppen te tonen of te verbergen. De database bewaakt het echt.

     hoofdbeheerder  alles, ook beheerders en disciplines (audit_admins)
     beheerder       bewerken, verwijderen en publiceren
     redacteur       bewerken en publiceren, niet verwijderen
     bijdrager       alleen voorstellen; een ander publiceert

   Een rol geldt voor één naamruimte ('ai-audit', 'ai-algemeen' = gedeelde basis)
   of voor alle ('*'), en eventueel alleen voor bepaalde onderdelen (sections).
   ========================================================================== */
(function (ns) {
  'use strict';

  const ROLES = {
    hoofdbeheerder: { label: 'Hoofdbeheerder', text: 'Alles, ook beheerders en disciplines beheren', rank: 0 },
    beheerder: { label: 'Beheerder', text: 'Bewerken, verwijderen en publiceren', rank: 1 },
    redacteur: { label: 'Redacteur', text: 'Bewerken en publiceren, niet verwijderen', rank: 2 },
    bijdrager: { label: 'Bijdrager', text: 'Alleen voorstellen; een ander publiceert', rank: 3 }
  };
  // Onderdelen waartoe je een rol kunt beperken (soorten inhoud)
  const SECTIONS = [
    { id: 'usecase', label: 'Usecases' },
    { id: 'prompt', label: 'Prompts' },
    { id: 'tip', label: 'Tips' },
    { id: 'training', label: 'Trainingen' },
    { id: 'agent', label: 'Agents & tools' },
    { id: 'phase', label: 'Fasen' },
    { id: 'setting', label: 'Teksten' }
  ];

  const current = () => ns.central.rights() || { owner: false, roles: [] };

  const isOwner = () => current().owner === true;

  /** De beste rol voor een naamruimte: { role, sections } of null. */
  function roleFor(namespace) {
    if (isOwner()) return { role: 'hoofdbeheerder', sections: [] };
    const matches = current().roles.filter((r) => r.namespace === namespace || r.namespace === '*');
    matches.sort((a, b) => ROLES[a.role].rank - ROLES[b.role].rank || (a.namespace === '*') - (b.namespace === '*'));
    return matches[0] || null;
  }

  /** Staat deze ene rol het toe? */
  function allows(found, action, type) {
    if (action === 'lezen') return true;
    if (type === 'meta') return false;
    const sections = Array.isArray(found.sections) ? found.sections : [];
    if (type && sections.length && !sections.includes(type)) return false;
    if (action === 'bewerken') return true;
    if (action === 'verwijderen') return found.role === 'beheerder';
    if (action === 'publiceren') return found.role === 'beheerder' || found.role === 'redacteur';
    return false;
  }

  /**
   * Mag dit? action: 'lezen' | 'bewerken' | 'verwijderen' | 'publiceren'; type: soort inhoud (optioneel).
   * Met meerdere rollen (bijv. beheerder van Tips én redacteur van alles) telt iedere rol mee.
   */
  function can(action, namespace, type) {
    if (isOwner()) return true;
    return current().roles.some((found) => (found.namespace === namespace || found.namespace === '*') && allows(found, action, type));
  }

  /** Mag je in deze naamruimte iets bewerken (een of meer onderdelen)? */
  const canEditSomething = (namespace) => isOwner() || Boolean(roleFor(namespace));

  /** Korte omschrijving voor in de bewerkbalk, bijv. 'Redacteur · Tips, Prompts'. */
  function describe(namespace) {
    const found = roleFor(namespace);
    if (!found) return '';
    const sections = (found.sections || []).map((id) => (SECTIONS.find((s) => s.id === id) || { label: id }).label);
    return ROLES[found.role].label + (sections.length ? ' · ' + sections.join(', ') : '');
  }

  ns.rights = { ROLES, SECTIONS, isOwner, can, canEditSomething, describe };
})(window.AIAudit);
