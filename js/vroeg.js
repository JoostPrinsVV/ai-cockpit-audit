/* ==========================================================================
   Vóór de eerste weergave (het enige script zonder defer, zo klein mogelijk)
   --------------------------------------------------------------------------
   - Het gekozen thema meteen zetten: wie donker heeft gekozen, ziet geen
     witte flits terwijl de rest laadt. (Dezelfde opslag als js/app.js.)
   - Vangnet: gaat er bij het opstarten iets mis (een fout vóórdat de eerste
     pagina er staat), dan een melding in plaats van een lege pagina. Daarna
     zet js/app.js data-gestart en doet dit niets meer.
   ========================================================================== */
(function () {
  'use strict';

  try {
    const theme = JSON.parse(window.localStorage.getItem('ai-snackbar-audit:theme') || 'null');
    if (theme === 'licht' || theme === 'donker') document.documentElement.dataset.theme = theme;
  } catch (error) {
    /* geen opslag: het standaardthema */
  }

  // Slot met pincode (js/lock.js): nog nooit geopend op dit apparaat? Dan de cockpit pas tonen als
  // het slot heeft beslist (geen flits van de inhoud). Een lokale kopie blijft open, behalve met ?slot.
  try {
    const local = window.location.protocol === 'file:' || /^(localhost|127\.0\.0\.1|\[::1\])$/.test(window.location.hostname);
    const forced = new URLSearchParams(window.location.search).has('slot');
    if (forced || (!local && !window.localStorage.getItem('ai-snackbar-audit:slot'))) document.documentElement.dataset.slot = 'dicht';
  } catch (error) {
    /* geen opslag: het slot beslist straks */
  }

  function fatal(message) {
    if (document.documentElement.dataset.gestart === 'ja') return;
    const box = document.getElementById('fatal');
    if (!box) return;
    const detail = document.getElementById('fatal-detail');
    if (detail) detail.textContent = message || '';
    box.hidden = false;
  }

  window.addEventListener('error', (event) => {
    // Alleen fouten uit de eigen bestanden (niet uit een browserextensie)
    if (event.filename && !event.filename.startsWith(window.location.origin)) return;
    fatal(event.message);
  });
  window.addEventListener('unhandledrejection', (event) => fatal(event.reason && event.reason.message));
})();
