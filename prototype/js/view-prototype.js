/* ==========================================================================
   AI COCKPIT · PROTOTYPE — Zo werkt het (#/zo-werkt-het)
   Uitleg bij het prototype: de opbouw (gedeelde basis en cockpits per
   discipline), wat je kunt proberen, wie wat beheert en wat we met IT
   willen afstemmen. De aantallen komen uit de inhoud zelf.
   ========================================================================== */
(function (ns) {
  'use strict';

  const { el, icon, accentClass } = ns.ui;

  const STATUS = { live: 'Live', voorbeeld: 'Voorbeeld', gepland: 'In voorbereiding' };

  function plural(number, one, many) {
    return `${number} ${number === 1 ? one : many}`;
  }

  function section(id, title, children, className) {
    return el('section', { className: 'about__section' + (className ? ' ' + className : ''), attrs: { 'aria-labelledby': id } }, [
      el('h2', { className: 'about__title', text: title, attrs: { id } })
    ].concat(children));
  }

  /* ---- Opbouw: de basis en de cockpits eronder ------------------------------------------- */
  function diagram() {
    const cockpit = ns.cockpit;
    const shared = cockpit.stats(cockpit.active.id).shared;
    const parts = [
      ['bulb', 'Tips & tricks', plural(shared.tips, 'tip', 'tips')],
      ['calendar-clock', 'Tip van de week', 'iedere vrijdag'],
      ['robot', 'Agents & tools', plural(shared.agents, 'item', 'items')],
      ['cap', 'Trainingen', plural(shared.trainings, 'training', 'trainingen')],
      ['play-circle', 'Algemene usecases', plural(shared.usecases, 'usecase', 'usecases')],
      ['chat', 'Algemene prompts', plural(shared.prompts, 'prompt', 'prompts')]
    ];

    const disciplineCard = (discipline) => {
      const planned = discipline.status === 'gepland';
      const own = planned ? null : cockpit.stats(discipline.id).own;
      return el('li', { className: 'about-cockpit ' + accentClass(discipline.accent) + (planned ? ' is-planned' : '') + (discipline.id === cockpit.active.id ? ' is-current' : '') }, [
        el('div', { className: 'about-cockpit__head' }, [
          el('span', { className: 'about-cockpit__icon', attrs: { 'aria-hidden': 'true' } }, [icon(discipline.icon || 'grid')]),
          el('span', { className: 'about-cockpit__name', text: discipline.name }),
          el('span', { className: 'about-cockpit__status', text: STATUS[discipline.status] || '' })
        ]),
        own
          ? el('ul', { className: 'about-cockpit__counts', attrs: { role: 'list' } }, [
              el('li', { text: plural(own.phases, 'eigen fase', 'eigen fasen') }),
              el('li', { text: plural(own.usecases, 'usecase', 'usecases') }),
              el('li', { text: plural(own.prompts, 'prompt', 'prompts') }),
              own.tips ? el('li', { text: plural(own.tips, 'eigen tip', 'eigen tips') }) : null
            ])
          : el('p', { className: 'about-cockpit__empty', text: 'Nog geen inhoud. Gaat live zodra er een beheerder en een eerste set usecases en prompts is.' }),
        planned ? null : el('a', { className: 'about-cockpit__link', attrs: { href: cockpit.href(discipline.id, '#/') } }, [
          el('span', { text: discipline.id === cockpit.active.id ? 'Je bent hier' : 'Open deze cockpit' }),
          icon('arrow-right')
        ])
      ]);
    };

    return section('about-opbouw', 'Zo is het opgebouwd', [
      el('p', { className: 'about__lead', text: 'Bovenin de basis die voor iedereen hetzelfde is. Daaronder per discipline een eigen cockpit met eigen fasen, usecases, prompts en ideeënhub. Iedere cockpit toont de basis én de eigen inhoud.' }),
      el('div', { className: 'about-diagram' }, [
        el('div', { className: 'about-basis' }, [
          el('div', { className: 'about-basis__head' }, [
            el('span', { className: 'about-basis__icon', attrs: { 'aria-hidden': 'true' } }, [icon('globe')]),
            el('div', {}, [
              el('p', { className: 'about-basis__title', text: 'Gedeelde basis · voor iedereen' }),
              el('p', { className: 'about-basis__text', text: 'Eén keer bijgehouden door het kernteam AI, zichtbaar in iedere cockpit.' })
            ])
          ]),
          el('ul', { className: 'about-basis__parts', attrs: { role: 'list' } }, parts.map(([name, label, detail]) =>
            el('li', { className: 'about-basis__part' }, [icon(name), el('span', { className: 'about-basis__label', text: label }), el('span', { className: 'about-basis__detail', text: detail })])
          ))
        ]),
        el('div', { className: 'about-diagram__joint', attrs: { 'aria-hidden': 'true' } }),
        el('ul', { className: 'about-cockpits', attrs: { role: 'list', 'aria-label': 'Cockpits per discipline' } }, cockpit.disciplines.map(disciplineCard))
      ])
    ]);
  }

  /* ---- Zelf proberen --------------------------------------------------------------------- */
  function tryIt() {
    const name = ns.cockpit.active.name;
    const steps = [
      { text: `Klik in de kopbalk op ${name} achter AI Cockpit en kies een andere discipline. Je komt op dezelfde pagina in die cockpit.` },
      { text: 'Open Tips & tricks. Tips met het label "Voor iedereen" staan in iedere cockpit; Accountancy heeft daarnaast een eigen tip.', href: '#/tips', label: 'Naar Tips & tricks' },
      { text: 'Open de tip "Stel je eigen instructies in" en wissel van discipline. Je blijft op dezelfde tip, met een eigen voorbeeldinstructie per discipline.', href: '#/tip/instructies', label: 'Naar de tip' },
      { text: 'Bekijk de usecases en de promptdatabase: fasen, usecases en prompts verschillen per discipline.', href: '#/usecases', label: 'Naar de usecases' },
      { text: 'Zoeken werkt in de cockpit waarin je zit, inclusief de gedeelde basis.', href: '#/zoeken', label: 'Naar zoeken' }
    ];
    return section('about-proberen', 'Probeer het zelf', [
      el('ol', { className: 'about-steps', attrs: { role: 'list' } }, steps.map((step, index) =>
        el('li', { className: 'about-steps__item' }, [
          el('span', { className: 'about-steps__number', text: String(index + 1), attrs: { 'aria-hidden': 'true' } }),
          el('div', { className: 'about-steps__body' }, [
            el('p', { text: step.text }),
            step.href ? el('a', { className: 'about-steps__link', attrs: { href: step.href } }, [el('span', { text: step.label }), icon('arrow-right')]) : null
          ])
        ])
      ))
    ]);
  }

  /* ---- Beheer ----------------------------------------------------------------------------- */
  function roles() {
    const role = (iconName, title, text) => el('li', { className: 'about-role' }, [
      el('span', { className: 'about-role__icon', attrs: { 'aria-hidden': 'true' } }, [icon(iconName)]),
      el('div', {}, [el('p', { className: 'about-role__title', text: title }), el('p', { text })])
    ]);
    return section('about-beheer', 'Wie beheert wat', [
      el('p', { className: 'about__lead', text: 'Zo zou het werken als de cockpit organisatiebreed live gaat. Alles gaat via Beheer, zonder code, en iedere wijziging blijft bewaard in de geschiedenis.' }),
      el('ul', { className: 'about-roles', attrs: { role: 'list' } }, [
        role('globe', 'Kernteam AI', 'Beheert de gedeelde basis (tips, tip van de week, agents & tools, algemene trainingen) en de opzet van het platform. Zet een nieuwe discipline klaar.'),
        role('users', 'Beheerders per discipline', 'Eén of twee collega\'s per discipline. Zij beheren de eigen fasen, usecases en prompts en de ideeënhub van hun discipline. Bij een gedeeld item kunnen ze een eigen voorbeeld zetten, maar het item zelf niet wijzigen.'),
        role('flag', 'Live per discipline', 'Een discipline gaat pas live als er een beheerder is en een eerste set usecases en prompts. Tot die tijd staat hij niet in de wisselaar; in dit prototype staan er twee grijs als voorbeeld.')
      ])
    ]);
  }

  /* ---- Afstemmen met IT ---------------------------------------------------------------- */
  function questions() {
    const items = [
      ['Hosting', 'Het platform draait nu op GitHub Pages, op een persoonlijk account. Wordt dat een account van Visser & Visser, of een plek op het intranet?'],
      ['Toegang', 'De site is nu openbaar te bereiken (zoekmachines slaan hem over). Blijft dat zo, of loggen collega\'s in met hun Visser & Visser-account?'],
      ['Opslag', 'De inhoud, de ideeënhub en de anonieme tellers staan in Supabase. Welke afspraken zijn daarvoor nodig, zoals de locatie van de gegevens en een verwerkersovereenkomst?'],
      ['Ideeënhub', 'Collega\'s kunnen bij een inzending hun naam en e-mailadres achterlaten (optioneel). Mag dat, en hoe lang bewaren we inzendingen?'],
      ['Beheer en continuïteit', 'Wie kan het platform technisch overnemen, en welke kosten horen erbij als de hele organisatie het gebruikt?']
    ];
    return section('about-it', 'Om af te stemmen met IT', [
      el('dl', { className: 'about-questions' }, items.map(([term, text]) => el('div', { className: 'about-questions__item' }, [
        el('dt', { text: term }),
        el('dd', { text })
      ])))
    ]);
  }

  /* ---- Grenzen van het prototype ----------------------------------------------------------- */
  function limits() {
    return section('about-grenzen', 'Wat dit prototype niet doet', [
      el('ul', { className: 'about-limits', attrs: { role: 'list' } }, [
        el('li', { text: 'De inhoud van Accountancy is voorbeeldinhoud. De usecases zijn gebaseerd op de snacks van de AI Snackbar.' }),
        el('li', { text: 'Er is geen database: de inhoud komt uit bestanden, beheer zit er niet in en de ideeënhub verstuurt niets.' }),
        el('li', { text: 'Belastingadvies en Salarisadministratie zijn voorbeelden van disciplines die later kunnen aansluiten.' }),
        el('li', {}, ['De live AI Cockpit Audit verandert niet door dit prototype. ', el('a', { attrs: { href: './' }, text: 'Open de live cockpit' })])
      ])
    ], 'about__section--quiet');
  }

  function render() {
    const node = el('div', { className: 'page container about' }, [
      ns.ui.pageHeader({
        eyebrow: 'Prototype',
        title: 'Eén AI Cockpit voor heel Visser & Visser',
        lead: 'Iedere discipline een eigen cockpit, op één gedeelde basis. Zo houdt niemand dezelfde tip of training twee keer bij, en vindt iedere collega wat bij het eigen werk past.'
      }),
      diagram(),
      tryIt(),
      roles(),
      questions(),
      limits()
    ]);
    return { node, title: 'Zo werkt het' };
  }

  ns.views = ns.views || {};
  ns.views.about = { render };
})(window.AIAudit);
