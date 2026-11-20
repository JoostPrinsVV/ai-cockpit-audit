/* ==========================================================================
   Beheer: inhoudsopgave 'Op deze pagina' (rechts naast een lang onderdeel)
   --------------------------------------------------------------------------
   Links staat het menu van Beheer (waar je bent), rechts wat er op deze
   pagina staat: de tussenkopjes van het formulier of overzicht. Het kopje
   waar je bent licht op terwijl je scrolt; klik en je springt erheen.

   - Vanzelf: de kopjes komen uit de pagina (zie HEADINGS); niets per
     onderdeel instellen. Verandert de pagina (een ander formulier, iets
     wat later binnenkomt), dan bouwt de inhoudsopgave zich opnieuw op.
   - Alleen bij minstens drie zichtbare kopjes: korte pagina's blijven rustig.
   - Op een smal scherm (css/admin.css): een rij bovenaan die blijft staan.
   ========================================================================== */
(function (ns) {
  'use strict';

  const { el } = ns.ui;
  // De tussenkopjes in Beheer: formulieren (Teksten, een usecase, training, Wrapped, sessies), de Engelse
  // versie, de blokken van Open Cockpit, de tabellen van het Copilot-gebruik, of een eigen kopje met data-toc
  const HEADINGS = '.form-section__title, .en-box__title, .oc-admin > .side-card .side-card__title, .usage-table__title, [data-toc]';
  const MIN = 3;
  let uid = 0;

  /** Zichtbare kopjes (niet in een dichtgeklapt blok of een verborgen deel), in de volgorde van de pagina. */
  function headingsIn(root) {
    return Array.from(root.querySelectorAll(HEADINGS)).filter((node) => {
      if (!node.textContent.trim() || node.getClientRects().length === 0) return false;
      // Een kopje binnen een dichtgeklapte <details> (behalve de samenvatting zelf) telt niet mee
      const closed = node.closest('details:not([open])');
      return !closed || closed.querySelector('summary').contains(node);
    });
  }

  const labelOf = (node) => (node.dataset.toc && node.dataset.toc !== 'true' ? node.dataset.toc : node.textContent.trim().replace(/^\d+\.\s*/, ''));
  // Hoeveel ruimte de balken bovenin innemen (zie --sticky-top in js/disciplines.js), plus wat lucht
  const offset = () => (parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--sticky-top')) || 0) + 24;

  /**
   * De inhoudsopgave bij een onderdeel van Beheer.
   * @returns {{ node: HTMLElement, refresh: Function, destroy: Function }}
   */
  function attach(root) {
    const list = el('ol', { className: 'admin-toc__list', attrs: { role: 'list' } });
    const node = el('nav', { className: 'admin-toc', attrs: { 'aria-label': 'Op deze pagina', hidden: true } }, [
      el('p', { className: 'admin-toc__title', attrs: { 'aria-hidden': 'true' }, text: 'Op deze pagina' }),
      list
    ]);
    let items = [];
    let frame = 0;
    let timer = 0;
    let lastKey = '';

    // Het kopje waar je bent: het laatste dat in het bovenste derde van het beeld staat (onder de balken);
    // helemaal onderaan: het laatste
    function spy() {
      frame = 0;
      if (!items.length) return;
      const top = offset();
      const line = top + (window.innerHeight - top) * 0.3;
      let active = items[0];
      items.forEach((item) => {
        if (item.heading.getBoundingClientRect().top <= line) active = item;
      });
      if (window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 4) active = items[items.length - 1];
      items.forEach((item) => {
        const on = item === active;
        if (on) item.link.setAttribute('aria-current', 'true');
        else item.link.removeAttribute('aria-current');
        item.link.classList.toggle('is-active', on);
      });
      // Op een smal scherm (de rij bovenaan): het actieve kopje in beeld houden
      if (getComputedStyle(list).flexDirection === 'row' && active.link.offsetParent) {
        const box = list.getBoundingClientRect();
        const link = active.link.getBoundingClientRect();
        if (link.left < box.left || link.right > box.right) list.scrollLeft += link.left - box.left - 16;
      }
    }
    const onScroll = () => {
      if (!frame) frame = window.requestAnimationFrame(spy);
    };

    function build() {
      timer = 0;
      const headings = headingsIn(root);
      const key = headings.map(labelOf).join('|');
      if (key === lastKey && items.length === headings.length && items.every((item, i) => item.heading === headings[i])) return spy();
      lastKey = key;
      items = headings.map((heading) => {
        if (!heading.id) heading.id = 'toc-' + (++uid);
        const link = el('a', { className: 'admin-toc__link', attrs: { href: '#' + heading.id }, text: labelOf(heading) });
        link.addEventListener('click', (event) => {
          // Geen ander adres (#/beheer/… blijft staan): zelf naar het kopje scrollen
          event.preventDefault();
          const top = heading.getBoundingClientRect().top + window.scrollY - offset();
          window.scrollTo({ top, behavior: ns.motion && ns.motion.calm() ? 'auto' : 'smooth' });
          // De focus naar het kopje (voor toetsenbord en schermlezer), zonder nog een keer te scrollen
          if (!heading.hasAttribute('tabindex')) heading.setAttribute('tabindex', '-1');
          heading.focus({ preventScroll: true });
        });
        return { heading, link };
      });
      list.replaceChildren(...items.map((item) => el('li', {}, [item.link])));
      node.hidden = items.length < MIN;
      spy();
    }
    const later = () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(build, 120);
    };

    // Opnieuw opbouwen als de pagina verandert (een ander formulier, iets dat later binnenkomt, een blok dat openklapt)
    const observer = new MutationObserver(later);
    observer.observe(root, { childList: true, subtree: true, attributes: true, attributeFilter: ['open', 'hidden'] });
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    later();

    return {
      node,
      refresh: build,
      destroy() {
        observer.disconnect();
        window.removeEventListener('scroll', onScroll);
        window.removeEventListener('resize', onScroll);
        window.clearTimeout(timer);
        if (frame) window.cancelAnimationFrame(frame);
      }
    };
  }

  ns.adminToc = { attach, headingsIn, HEADINGS, MIN };
})(window.AIAudit);
