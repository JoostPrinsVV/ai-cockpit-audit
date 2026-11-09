/* ==========================================================================
   Beheer → Inhoud → Agents & tools: de testervaringen bij een agent
   --------------------------------------------------------------------------
   Boven het formulier van een agent: wat collega's die hem testten, vonden
   (js/agent-test.js). Per testcriterium de gemiddelde score, hoe vaak 'Zou je
   hem gebruiken?' ja, misschien of nee was, en de laatste ervaringen. De
   volledige inzendingen staan in Beheer → Inzendingen (soort Testervaring).
   ========================================================================== */
(function (ns) {
  'use strict';

  const { el, icon, formatDate } = ns.ui;
  const NUMBER = () => new Intl.NumberFormat('nl-NL', { minimumFractionDigits: 1, maximumFractionDigits: 1 });

  function render(body, agent, ideas) {
    const s = ns.agentTest.summarize(agent, ideas);
    if (!s.count) {
      body.replaceChildren(el('p', { className: 'field__hint', text: agent.testing
        ? 'Nog geen testervaringen. Collega\'s delen ze met de knop "Deel je testervaring" op de pagina van de agent.'
        : 'Nog geen testervaringen. Zet de status op Testfase om collega\'s te laten testen en hun ervaring te laten delen.' }));
      return;
    }
    const use = [['Ja', s.use.ja], ['Misschien', s.use.misschien], ['Nee', s.use.nee]];
    const latest = (ideas || [])
      .filter((item) => item.kind === ns.agentTest.KIND && item.details && item.details.agent === agent.id)
      .sort((a, b) => (a.created_at < b.created_at ? 1 : -1))
      .slice(0, 6);
    body.replaceChildren(...[
      el('div', { className: 'test-summary__tiles' }, [
        el('div', { className: 'test-summary__tile' }, [el('strong', { text: String(s.count) }), el('span', { text: s.count === 1 ? 'testervaring' : 'testervaringen' })]),
        ...use.map(([label, n]) => el('div', { className: 'test-summary__tile' }, [el('strong', { text: String(n) }), el('span', { text: 'Zou hem gebruiken: ' + label.toLowerCase() })]))
      ]),
      el('table', { className: 'table test-summary__table' }, [
        el('thead', {}, [el('tr', {}, [el('th', { attrs: { scope: 'col' }, text: 'Testcriterium' }), el('th', { className: 'num', attrs: { scope: 'col' }, text: 'Gemiddeld' }), el('th', { className: 'num', attrs: { scope: 'col' }, text: 'Scores' })])]),
        el('tbody', {}, s.criteria.map((c) => {
          const bar = el('span', { className: 'test-summary__bar' });
          bar.style.setProperty('--w', c.average ? Math.round((c.average / 5) * 100) + '%' : '0%');
          return el('tr', {}, [
            el('th', { attrs: { scope: 'row' }, text: c.label }),
            el('td', { className: 'num' }, [el('span', { className: 'test-summary__score' }, [bar, el('span', { text: c.average ? NUMBER().format(c.average) + ' van 5' : '–' })])]),
            el('td', { className: 'num', text: String(c.n) })
          ]);
        }))
      ]),
      el('h4', { className: 'test-summary__h', text: 'De laatste ervaringen' }),
      el('ul', { className: 'test-summary__list', attrs: { role: 'list' } }, latest.map((item) => el('li', { className: 'test-summary__item' }, [
        el('p', { className: 'test-summary__meta', text: [formatDate(String(item.created_at || '').slice(0, 10)), item.name || 'Zonder naam', item.email || ''].filter(Boolean).join(' · ') }),
        el('p', { className: 'test-summary__text', text: item.body || '' })
      ]))),
      el('p', { className: 'field__hint' }, ['Alle ervaringen, met beantwoorden: ', el('a', { attrs: { href: '#/beheer/inzendingen' }, text: 'Inzendingen' }), ' (soort Testervaring). Klaar met testen? Zet de status op Beschikbaar; dan verdwijnt de gele band.'])
    ]);
  }

  /** Het uitklapblok boven het formulier van een agent. */
  function panel(agentId, data) {
    const known = ns.content.agentById.get(agentId);
    // Zoals het in het formulier staat (ook als de agent nog een concept is)
    const agent = known || { id: agentId, testing: data && (data.status === 'Testfase' || data.status === 'Pilot'), testCriteria: Array.isArray(data && data.testCriteria) ? data.testCriteria : [] };
    const body = el('div', { className: 'test-summary__body' }, [el('p', { className: 'loading', text: 'Testervaringen ophalen…' })]);
    ns.central.adminListIdeas()
      .then((ideas) => render(body, agent, ideas || []))
      .catch(() => body.replaceChildren(el('p', { className: 'field__hint', text: 'De testervaringen konden niet worden opgehaald.' })));
    const details = el('details', { className: 'naslag-import test-summary' }, [
      el('summary', { className: 'naslag-import__head' }, [
        el('span', { className: 'naslag-import__icon test-summary__icon', attrs: { 'aria-hidden': 'true' } }, [icon('flask')]),
        el('span', { className: 'naslag-import__heading' }, [
          el('span', { className: 'naslag-import__title', text: 'Testervaringen' }),
          el('span', { className: 'naslag-import__lead', text: agent.testing ? 'Wat collega\'s die hem testten ervan vonden' : 'Van collega\'s, als de agent in testfase staat' })
        ]),
        icon('chevron-down', { className: 'naslag-import__chevron' })
      ]),
      body
    ]);
    if (agent.testing) details.open = true;
    return details;
  }

  ns.adminTestfase = { panel };
})(window.AIAudit);
