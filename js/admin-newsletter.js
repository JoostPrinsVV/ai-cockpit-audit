/* ==========================================================================
   Beheer → Nieuwsbrief (#/beheer/nieuwsbrief)
   --------------------------------------------------------------------------
   Stelt een weekupdate of maandnieuwsbrief samen uit wat er in die periode
   nieuw was in deze cockpit (de eigen inhoud van de discipline plus de
   gedeelde basis):
     tips van de week en nieuwe tips · nieuwe usecases · nieuwe prompts ·
     trainingen · agents & tools · beantwoorde vragen uit de ideeënhub ·
     wat populair was · wat het best beoordeeld is · ook bijgewerkt (uit) ·
     binnenkort (de volgende tip van de week, zonder hem te verklappen)
   - Week = maandag t/m zondag, maand = de kalendermaand. Op de laatste dag
     van de maand meldt Beheer dat de maandnieuwsbrief compleet is.
   - Per onderdeel en per item aan- of uitvinken; onderwerp, inleiding,
     afsluiting en ondertekening aanpassen (per periode onthouden in deze
     browser).
   - PDF opslaan (afdrukken als PDF, A4), e-mail (.eml: opent in Outlook als
     nieuw bericht) of kopiëren als opgemaakte tekst (Outlook, Teams).
   Er wordt niets verstuurd en niets in de database opgeslagen. De links gaan
   naar siteUrl uit js/config.js.
   ========================================================================== */
(function (ns) {
  'use strict';

  const { el, icon, toast, storage } = ns.ui;
  const MONTHS = ['januari', 'februari', 'maart', 'april', 'mei', 'juni', 'juli', 'augustus', 'september', 'oktober', 'november', 'december'];
  const KINDS = { week: 'Weekupdate', maand: 'Maandnieuwsbrief' };
  const COLORS = { navy: '#101d4f', teal: '#00b49c', tealInk: '#156f7e', crimson: '#ae3255', text: '#101d4f', muted: '#4c567b', border: '#dde0e8', page: '#f1f3f7', wash: '#e8f6f3' };

  /* ---- Datums en periode ------------------------------------------------------------- */
  const pad = (n) => String(n).padStart(2, '0');
  const ymd = (date) => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
  const parse = (value) => new Date(String(value).slice(0, 10) + 'T12:00:00');
  const addDays = (date, days) => {
    const copy = new Date(date);
    copy.setDate(copy.getDate() + days);
    return copy;
  };

  function isoWeek(date) {
    const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    const day = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() + 4 - day);
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    return { year: d.getUTCFullYear(), week: Math.ceil(((d - yearStart) / 86400000 + 1) / 7) };
  }

  /** '2026-10-25' → '25 oktober 2026' (voluit, voor de nieuwsbrief) */
  function longDate(value) {
    const date = parse(value);
    return `${date.getDate()} ${MONTHS[date.getMonth()]} ${date.getFullYear()}`;
  }

  function rangeLabel(start, end) {
    const a = parse(start);
    const b = parse(end);
    if (a.getFullYear() !== b.getFullYear()) return `${longDate(start)} – ${longDate(end)}`;
    if (a.getMonth() !== b.getMonth()) return `${a.getDate()} ${MONTHS[a.getMonth()]} – ${b.getDate()} ${MONTHS[b.getMonth()]} ${b.getFullYear()}`;
    return `${a.getDate()} – ${b.getDate()} ${MONTHS[b.getMonth()]} ${b.getFullYear()}`;
  }

  /** De periode rond een datum: week (maandag t/m zondag) of maand. */
  function period(kind, anchor) {
    const date = parse(anchor);
    if (kind === 'maand') {
      const start = new Date(date.getFullYear(), date.getMonth(), 1, 12);
      const end = new Date(date.getFullYear(), date.getMonth() + 1, 0, 12);
      const name = MONTHS[date.getMonth()];
      return {
        kind, start: ymd(start), end: ymd(end), key: `maand-${start.getFullYear()}-${pad(start.getMonth() + 1)}`,
        title: `${name.charAt(0).toUpperCase() + name.slice(1)} ${start.getFullYear()}`, name, range: rangeLabel(ymd(start), ymd(end))
      };
    }
    const start = addDays(date, -((date.getDay() + 6) % 7));
    const end = addDays(start, 6);
    const week = isoWeek(start);
    return {
      kind: 'week', start: ymd(start), end: ymd(end), key: `week-${week.year}-${pad(week.week)}`,
      title: `Week ${week.week}`, name: `week ${week.week}`, range: rangeLabel(ymd(start), ymd(end))
    };
  }

  function shift(p, delta) {
    if (p.kind === 'maand') {
      const date = parse(p.start);
      return ymd(new Date(date.getFullYear(), date.getMonth() + delta, 1, 12));
    }
    return ymd(addDays(parse(p.start), delta * 7));
  }

  const lastDayOfMonth = (day) => ymd(new Date(parse(day).getFullYear(), parse(day).getMonth() + 1, 0, 12)) === day;

  /** Op de laatste dag van de maand: een melding bovenaan Beheer. */
  function reminder() {
    const today = ns.content.today();
    // Alleen voor wie de nieuwsbrief kan maken (het tabblad is er alleen voor hoofdbeheerders)
    if (!lastDayOfMonth(today) || !ns.central.signedIn() || !ns.rights.isOwner()) return null;
    const name = MONTHS[parse(today).getMonth()];
    return ns.blocks.notice({
      tone: 'cta',
      icon: 'mail',
      title: `Vandaag is de laatste dag van ${name}`,
      text: 'De maandnieuwsbrief is compleet en staat klaar om te downloaden als PDF of e-mail.',
      action: ns.blocks.linkButton('#/beheer/nieuwsbrief', 'mail', 'Naar de nieuwsbrief', 'btn--primary btn--sm')
    });
  }

  /* ---- Verzamelen ------------------------------------------------------------------- */
  function siteLink(route) {
    const config = ns.app.config();
    const base = String(config.siteUrl || (window.location.origin + window.location.pathname)).replace(/[?#].*$/, '');
    return `${base}?d=${encodeURIComponent(ns.cockpit.activeId())}#/${route || ''}`;
  }

  const licenseText = (license) => (license === true ? 'met licentie' : license === false ? 'ook zonder licentie' : '');
  const sentence = (text) => {
    const value = String(text || '').trim();
    const match = /^(.{40,180}?[.!?])(\s|$)/.exec(value);
    return match ? match[1] : value.length > 180 ? value.slice(0, 177).replace(/\s+\S*$/, '') + '…' : value;
  };

  /** Ideeën, tellers en reviews (alleen voor beheerders; wat niet lukt, blijft leeg). */
  async function loadExtras() {
    const safe = (promise) => promise.then((value) => value || []).catch(() => []);
    const [ideas, events, reviews] = await Promise.all([
      safe(ns.central.adminListIdeas()),
      safe(ns.central.adminEvents(400)),
      safe(ns.central.adminListReviews())
    ]);
    return { ideas, events, reviews };
  }

  function collect(p, extras) {
    const c = ns.content;
    const inPeriod = (value) => Boolean(value) && String(value).slice(0, 10) >= p.start && String(value).slice(0, 10) <= p.end;
    const live = (item) => item && !item.draft;
    const sections = [];
    const add = (id, title, iconName, style, items, options) => sections.push(Object.assign({ id, title, icon: iconName, style, items }, options));

    // Tips: eerst de tips van de week die vrijkwamen, dan nieuwe tips
    const weekly = c.tips.filter((tip) => live(tip) && tip.weekly && !tip.locked && inPeriod(tip.release)).sort((a, b) => (a.release < b.release ? -1 : 1));
    const newTips = c.tips.filter((tip) => live(tip) && !tip.weekly && inPeriod(tip.added));
    add('tips', 'Tips & tricks', 'bulb', 'highlight', weekly.map((tip) => ({
      key: 'tip:' + tip.id, title: tip.title, text: tip.summary, href: siteLink('tip/' + tip.id),
      meta: `Tip van de week · vrijdag ${longDate(tip.release)}`
    })).concat(newTips.map((tip) => ({
      key: 'tip:' + tip.id, title: tip.title, text: tip.summary, href: siteLink('tip/' + tip.id), meta: `Nieuwe tip · ${tip.category.label}`
    }))));

    add('usecases', 'Nieuwe usecases', 'play-circle', 'list', c.usecases.filter((u) => live(u) && inPeriod(u.added)).map((u) => ({
      key: 'usecase:' + u.id, title: u.title, text: u.subtitle || sentence(u.intro), href: siteLink('usecase/' + u.id),
      meta: [u.phase.label, u.hasDemo ? 'met demo' : '', licenseText(u.license)].filter(Boolean).join(' · ')
    })));

    add('prompts', 'Nieuwe prompts', 'chat', 'list', c.prompts.filter((pr) => live(pr) && !pr.usecase && inPeriod(pr.added)).map((pr) => ({
      key: 'prompt:' + pr.id, title: pr.title, text: pr.description, href: siteLink('prompt/' + pr.id),
      meta: [pr.phase.label, pr.tool, licenseText(pr.license)].filter(Boolean).join(' · ')
    })));

    add('trainingen', 'Trainingen', 'cap', 'list', c.trainings.filter((t) => live(t) && t.available && (inPeriod(t.added) || inPeriod(t.date))).map((t) => ({
      key: 'training:' + t.id, title: t.title, text: t.subtitle || sentence(t.description), href: siteLink('training/' + t.id),
      meta: [longDate(t.date), t.hasRecording ? 'opname terug te kijken' : '', t.hasNaslag ? 'met naslagwerk' : ''].filter(Boolean).join(' · ')
    })));

    add('agents', 'Agents & tools', 'robot', 'list', c.agents.filter((a) => live(a) && !a.stopped && inPeriod(a.added)).map((a) => ({
      key: 'agent:' + a.id, title: a.title, text: a.summary, href: siteLink('agent/' + a.id), meta: [a.kind, a.status].join(' · ')
    })));

    // Beantwoord en gepubliceerd in de ideeënhub (nooit naam of e-mailadres)
    add('faq', 'Vragen van collega\'s', 'question', 'qa', extras.ideas
      .filter((idea) => idea.is_public && idea.answer && inPeriod(idea.answered_at || idea.created_at))
      .map((idea) => ({ key: 'idea:' + idea.id, title: idea.title, text: idea.answer, href: siteLink('ideeen') })));

    // Populair: meest bekeken usecases en meest gekopieerde prompts
    const events = extras.events.filter((event) => inPeriod(event.occurred_at));
    const top = (kind, map, label) => {
      const counts = new Map();
      events.filter((event) => event.kind === kind).forEach((event) => counts.set(event.item_id, (counts.get(event.item_id) || 0) + 1));
      return Array.from(counts.entries()).filter(([id]) => map.get(id)).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([id, n]) => {
        const item = map.get(id);
        return { key: `pop:${kind}:${id}`, title: item.usecase ? item.usecase.title + ' · ' + item.title : item.title, meta: `${n} keer ${label}`, href: siteLink((kind === 'view_usecase' ? 'usecase/' : 'prompt/') + id) };
      });
    };
    add('populair', 'Populair bij collega\'s', 'chart', 'ranking', top('view_usecase', c.usecaseById, 'bekeken').concat(top('copy_prompt', c.promptById, 'gekopieerd')));

    // Best beoordeeld in deze periode, met eventueel één gepubliceerde toelichting
    const reviews = extras.reviews.filter((review) => inPeriod(review.created_at));
    const scores = new Map();
    reviews.forEach((review) => {
      const k = review.item_type + ':' + review.item_id;
      const entry = scores.get(k) || { type: review.item_type, id: review.item_id, count: 0, sum: 0 };
      entry.count += 1;
      entry.sum += review.rating;
      scores.set(k, entry);
    });
    const rated = Array.from(scores.values())
      .map((entry) => Object.assign(entry, { item: (entry.type === 'usecase' ? c.usecaseById : c.promptById).get(entry.id), average: entry.sum / entry.count }))
      .filter((entry) => entry.item && entry.average >= 3.5)
      // Items met minstens twee beoordelingen eerst, zodat één losse 5 niet meteen bovenaan staat
      .sort((a, b) => Number(b.count >= 2) - Number(a.count >= 2) || b.average - a.average || b.count - a.count).slice(0, 3);
    const quote = reviews.find((review) => review.is_public && review.comment && review.rating >= 4);
    add('beoordeeld', 'Best beoordeeld', 'star', 'ranking', rated.map((entry) => ({
      key: `rated:${entry.type}:${entry.id}`, title: entry.item.title, rating: entry.average, href: siteLink(entry.type + '/' + entry.id),
      meta: `${entry.average.toFixed(1).replace('.', ',')} van 5 · ${entry.count} ${entry.count === 1 ? 'beoordeling' : 'beoordelingen'}`
    })), { quote: quote ? quote.comment : '' });

    // Ook bijgewerkt (standaard uit: ook kleine correcties tellen mee)
    const added = new Set(sections.flatMap((section) => section.items.map((item) => item.key)));
    const updated = (c.adminRows || [])
      .filter((row) => ns.kinds.byRoute(row.type) && row.status === 'published' && inPeriod(row.updated_at) && !added.has(row.type + ':' + row.id))
      .map((row) => ({ row, item: ns.kinds.item(row.type, row.id) }))
      .filter((entry) => entry.item && !entry.item.locked);
    add('bijgewerkt', 'Ook bijgewerkt', 'refresh', 'compact', updated.map(({ row, item }) => ({
      key: 'upd:' + row.type + ':' + row.id, title: item.title, href: siteLink(row.type + '/' + row.id)
    })), { defaultOff: true });

    // Binnenkort: de volgende tip van de week die nog op slot zit (alleen het thema en de datum);
    // alleen in de lopende of een komende periode
    const next = c.nextWeeklyTip;
    const today = c.today();
    add('binnenkort', 'Binnenkort', 'calendar-clock', 'upcoming', next && p.end >= today && next.release > today ? [{
      key: 'next:' + next.id, title: `Vrijdag ${longDate(next.release)}: de volgende tip van de week`, text: `Over ${next.category.label.toLowerCase()}. Tot die dag zit hij nog op slot.`, href: siteLink('tips')
    }] : []);

    return sections;
  }

  /* ---- Het document --------------------------------------------------------------------- */
  function defaults(p) {
    const discipline = ns.cockpit.active();
    const brand = `${ns.app.config().applicationTitle || 'AI Cockpit'} ${discipline.name}`;
    return {
      subject: `${brand} · ${KINDS[p.kind]} ${p.kind === 'maand' ? p.name + ' ' + parse(p.start).getFullYear() : p.name}`,
      intro: p.kind === 'maand'
        ? `Dit was ${p.name} in de AI Cockpit: nieuwe usecases en prompts om direct te proberen, de tips van de week en de vragen van collega's. Iedere link brengt je naar de juiste plek in de cockpit.`
        : 'Dit was er deze week nieuw in de AI Cockpit. Iedere link brengt je naar de juiste plek, zodat je het direct kunt proberen.',
      closing: 'Heb je een idee, een vraag of een prompt die goed werkt? Laat het weten in de ideeënhub: daar komt de volgende editie vandaan.',
      signature: 'Het AI-team'
    };
  }

  /** Alles wat nodig is voor het voorbeeld, de PDF en de e-mail. */
  function documentFor(p, sections, texts, off) {
    const discipline = ns.cockpit.active();
    const config = ns.app.config();
    const shown = sections
      .filter((section) => !off.has('section:' + section.id))
      .map((section) => Object.assign({}, section, { items: section.items.filter((item) => !off.has(item.key)) }))
      .filter((section) => section.items.length);
    const count = (id) => (shown.find((section) => section.id === id) || { items: [] }).items.length;
    const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;
    const summary = [
      count('tips') && plural(count('tips'), 'tip', 'tips'),
      count('usecases') && plural(count('usecases'), 'nieuwe usecase', 'nieuwe usecases'),
      count('prompts') && plural(count('prompts'), 'nieuwe prompt', 'nieuwe prompts'),
      count('trainingen') && plural(count('trainingen'), 'training', 'trainingen'),
      count('agents') && plural(count('agents'), 'agent of tool', 'agents en tools'),
      count('faq') && plural(count('faq'), 'vraag beantwoord', 'vragen beantwoord')
    ].filter(Boolean);
    return {
      kind: KINDS[p.kind],
      title: p.title,
      range: p.range,
      app: config.applicationTitle || 'AI Cockpit',
      discipline: discipline.name,
      organization: config.organizationName || 'Visser & Visser',
      subject: texts.subject,
      intro: texts.intro,
      closing: texts.closing,
      signature: texts.signature,
      summary,
      sections: shown,
      home: siteLink(''),
      ideas: siteLink('ideeen'),
      siteLabel: String(config.siteUrl || '').replace(/^https?:\/\//, '').replace(/\/$/, '')
    };
  }

  /* ---- Weergave in Beheer en als PDF (de opmaak staat in css/audit.css, .nl-doc) ------------ */
  function starsNode(value) {
    return el('span', { className: 'stars', attrs: { role: 'img', 'aria-label': `${value.toFixed(1).replace('.', ',')} van 5 sterren` } },
      [1, 2, 3, 4, 5].map((n) => icon(n <= Math.round(value) ? 'star-filled' : 'star', { className: n <= Math.round(value) ? 'stars__on' : 'stars__off' })));
  }

  function itemNode(section, item, index) {
    const link = el('a', { className: 'nl-item__title', attrs: { href: item.href }, text: item.title });
    if (section.style === 'qa') {
      return el('li', { className: 'nl-qa' }, [
        el('p', { className: 'nl-qa__q' }, [el('span', { className: 'nl-qa__label', text: 'Vraag' }), el('span', { text: item.title })]),
        el('p', { className: 'nl-qa__a' }, [el('span', { className: 'nl-qa__label', text: 'Antwoord' }), el('span', { text: item.text })])
      ]);
    }
    if (section.style === 'ranking') {
      return el('li', { className: 'nl-rank' }, [
        el('span', { className: 'nl-rank__n', text: String(index + 1) }),
        el('span', { className: 'nl-rank__body' }, [link, el('span', { className: 'nl-item__meta' }, [item.rating ? starsNode(item.rating) : null, el('span', { text: item.meta })])])
      ]);
    }
    if (section.style === 'compact') return el('li', { className: 'nl-compact' }, [link]);
    return el('li', { className: 'nl-item' + (section.style === 'highlight' ? ' nl-item--highlight' : '') + (section.style === 'upcoming' ? ' nl-item--upcoming' : '') }, [
      item.meta ? el('p', { className: 'nl-item__meta', text: item.meta }) : null,
      link,
      item.text ? el('p', { className: 'nl-item__text', text: item.text }) : null
    ]);
  }

  function preview(doc) {
    return el('article', { className: 'nl-doc', attrs: { 'aria-label': 'Voorbeeld van de nieuwsbrief' } }, [
      el('header', { className: 'nl-doc__head' }, [
        el('div', { className: 'nl-doc__brand' }, [
          el('img', { className: 'nl-doc__mark', attrs: { src: 'assets/branding/logo-dark.svg', alt: '', width: '36', height: '36' } }),
          el('span', { className: 'nl-doc__name' }, [doc.app + ' ', el('span', { className: 'nl-doc__discipline', text: doc.discipline })])
        ]),
        el('p', { className: 'nl-doc__edition' }, [el('span', { text: doc.kind }), el('span', { text: doc.range })])
      ]),
      el('div', { className: 'nl-doc__body' }, [
        el('h1', { className: 'nl-doc__title', text: doc.title }),
        doc.intro ? el('p', { className: 'nl-doc__intro', text: doc.intro }) : null,
        doc.summary.length ? el('p', { className: 'nl-doc__summary' }, [el('strong', { text: 'In deze editie: ' }), doc.summary.join(' · ')]) : null,
        ...(doc.sections.length ? doc.sections.map((section) => el('section', { className: 'nl-section nl-section--' + section.style }, [
          el('h2', { className: 'nl-section__title' }, [icon(section.icon), el('span', { text: section.title })]),
          el(section.style === 'ranking' ? 'ol' : 'ul', { className: 'nl-section__list', attrs: { role: 'list' } }, section.items.map((item, index) => itemNode(section, item, index))),
          section.quote ? el('blockquote', { className: 'nl-quote' }, [el('p', { text: '“' + section.quote + '”' }), el('cite', { text: 'Een collega' })]) : null
        ])) : [el('p', { className: 'nl-doc__empty', text: 'In deze periode is er niets nieuws bijgekomen. Vink hierboven aan wat er toch in moet, of kies een andere periode.' })]),
        el('div', { className: 'nl-doc__closing' }, [
          doc.closing ? el('p', { text: doc.closing }) : null,
          doc.signature ? el('p', { className: 'nl-doc__signature', text: doc.signature }) : null,
          el('p', { className: 'nl-doc__buttons' }, [
            el('a', { className: 'nl-button', attrs: { href: doc.home }, text: 'Naar de ' + doc.app }),
            el('a', { className: 'nl-button nl-button--quiet', attrs: { href: doc.ideas }, text: 'Naar de ideeënhub' })
          ])
        ])
      ]),
      el('footer', { className: 'nl-doc__foot' }, [
        el('span', { text: `${doc.app} ${doc.discipline} · ${doc.organization}` }),
        doc.siteLabel ? el('span', { text: doc.siteLabel }) : null
      ])
    ]);
  }

  /* ---- E-mail: tabellen en inline opmaak, zodat het ook in Outlook goed staat --------------- */
  const esc = (value) => String(value == null ? '' : value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const FONT = "font-family:Arial,Helvetica,sans-serif;";

  function emailItem(section, item, index) {
    const title = `<a href="${esc(item.href)}" style="${FONT}font-size:16px;font-weight:700;line-height:1.35;color:${COLORS.navy};text-decoration:none;">${esc(item.title)}</a>`;
    const meta = item.meta ? `<div style="${FONT}font-size:12px;line-height:1.5;color:${COLORS.tealInk};font-weight:600;letter-spacing:0.02em;margin:0 0 2px;">${esc(item.meta)}</div>` : '';
    const text = item.text ? `<div style="${FONT}font-size:14px;line-height:1.55;color:${COLORS.text};margin:4px 0 0;">${esc(item.text)}</div>` : '';
    const more = `<div style="margin:6px 0 0;"><a href="${esc(item.href)}" style="${FONT}font-size:13px;font-weight:600;color:${COLORS.tealInk};text-decoration:none;">Bekijk in de cockpit &rarr;</a></div>`;
    if (section.style === 'qa') {
      return `<div style="margin:0 0 16px;"><div style="${FONT}font-size:15px;font-weight:700;line-height:1.4;color:${COLORS.navy};">${esc(item.title)}</div><div style="${FONT}font-size:14px;line-height:1.55;color:${COLORS.text};margin:4px 0 0;">${esc(item.text)}</div></div>`;
    }
    if (section.style === 'ranking') {
      return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 10px;"><tr><td width="28" valign="top" style="${FONT}font-size:15px;font-weight:700;color:${COLORS.teal};">${index + 1}.</td><td valign="top">${title}<div style="${FONT}font-size:13px;color:${COLORS.muted};margin:2px 0 0;">${item.rating ? '&#9733; ' : ''}${esc(item.meta)}</div></td></tr></table>`;
    }
    if (section.style === 'compact') return `<div style="${FONT}font-size:14px;line-height:1.6;color:${COLORS.text};">&bull; <a href="${esc(item.href)}" style="color:${COLORS.navy};text-decoration:underline;">${esc(item.title)}</a></div>`;
    if (section.style === 'highlight' || section.style === 'upcoming') {
      const bg = section.style === 'highlight' ? COLORS.wash : COLORS.page;
      const line = section.style === 'highlight' ? COLORS.teal : COLORS.border;
      return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 12px;background:${bg};border-left:4px solid ${line};"><tr><td style="padding:14px 18px;">${meta}${title}${text}${section.style === 'highlight' ? more : ''}</td></tr></table>`;
    }
    return `<div style="margin:0 0 18px;">${meta}${title}${text}${more}</div>`;
  }

  function emailHtml(doc) {
    const row = (inner, padding) => `<tr><td style="padding:${padding || '0 32px'};">${inner}</td></tr>`;
    const sections = doc.sections.map((section) => row(
      `<h2 style="${FONT}margin:26px 0 14px;padding:0 0 6px;font-size:17px;line-height:1.3;color:${COLORS.navy};border-bottom:2px solid ${COLORS.teal};">${esc(section.title)}</h2>` +
      section.items.map((item, index) => emailItem(section, item, index)).join('') +
      (section.quote ? `<div style="${FONT}margin:6px 0 0;padding:10px 16px;border-left:3px solid ${COLORS.border};font-size:14px;font-style:italic;color:${COLORS.muted};">&ldquo;${esc(section.quote)}&rdquo; &mdash; een collega</div>` : '')
    )).join('');
    return `<!doctype html>
<html lang="nl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${esc(doc.subject)}</title></head>
<body style="margin:0;padding:0;background:${COLORS.page};">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${COLORS.page};"><tr><td align="center" style="padding:24px 12px;">
<table role="presentation" width="640" cellpadding="0" cellspacing="0" style="width:640px;max-width:100%;background:#ffffff;border:1px solid ${COLORS.border};">
<tr><td style="background:${COLORS.navy};padding:22px 32px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
<td style="${FONT}font-size:20px;font-weight:700;color:#ffffff;">${esc(doc.app)} <span style="color:${COLORS.teal};">${esc(doc.discipline)}</span></td>
<td align="right" style="${FONT}font-size:12px;line-height:1.4;color:#c9cede;">${esc(doc.kind)}<br>${esc(doc.range)}</td>
</tr></table>
</td></tr>
<tr><td style="height:4px;line-height:4px;font-size:0;background:${COLORS.teal};">&nbsp;</td></tr>
${row(`<h1 style="${FONT}margin:28px 0 10px;font-size:26px;line-height:1.2;color:${COLORS.navy};">${esc(doc.title)}</h1>` +
      (doc.intro ? `<p style="${FONT}margin:0 0 12px;font-size:15px;line-height:1.6;color:${COLORS.text};">${esc(doc.intro)}</p>` : '') +
      (doc.summary.length ? `<p style="${FONT}margin:0;padding:10px 14px;background:${COLORS.page};font-size:13px;line-height:1.5;color:${COLORS.muted};"><strong style="color:${COLORS.navy};">In deze editie:</strong> ${esc(doc.summary.join(' · '))}</p>` : ''))}
${sections || row(`<p style="${FONT}font-size:14px;color:${COLORS.muted};">In deze periode is er niets nieuws bijgekomen.</p>`)}
${row(`<div style="height:8px;"></div>` +
      (doc.closing ? `<p style="${FONT}margin:18px 0 6px;font-size:15px;line-height:1.6;color:${COLORS.text};">${esc(doc.closing)}</p>` : '') +
      (doc.signature ? `<p style="${FONT}margin:0 0 20px;font-size:15px;font-weight:700;color:${COLORS.navy};">${esc(doc.signature)}</p>` : '') +
      `<table role="presentation" cellpadding="0" cellspacing="0"><tr><td style="background:${COLORS.crimson};border-radius:999px;"><a href="${esc(doc.home)}" style="${FONT}display:inline-block;padding:11px 22px;font-size:14px;font-weight:700;color:#ffffff;text-decoration:none;">Naar de ${esc(doc.app)}</a></td>` +
      `<td style="width:10px;"></td><td style="border:2px solid ${COLORS.border};border-radius:999px;"><a href="${esc(doc.ideas)}" style="${FONT}display:inline-block;padding:9px 20px;font-size:14px;font-weight:700;color:${COLORS.navy};text-decoration:none;">Naar de ideeënhub</a></td></tr></table>`,
    '0 32px 28px')}
<tr><td style="${FONT}padding:16px 32px;background:${COLORS.page};border-top:1px solid ${COLORS.border};font-size:12px;line-height:1.5;color:${COLORS.muted};">${esc(doc.app)} ${esc(doc.discipline)} · ${esc(doc.organization)}${doc.siteLabel ? ' · ' + esc(doc.siteLabel) : ''}</td></tr>
</table>
</td></tr></table>
</body></html>`;
  }

  function plainText(doc) {
    const lines = [`${doc.app} ${doc.discipline} · ${doc.kind} · ${doc.range}`, '', doc.title.toUpperCase(), ''];
    if (doc.intro) lines.push(doc.intro, '');
    if (doc.summary.length) lines.push('In deze editie: ' + doc.summary.join(' · '), '');
    doc.sections.forEach((section) => {
      lines.push(section.title.toUpperCase());
      section.items.forEach((item, index) => {
        if (section.style === 'qa') lines.push(`- Vraag: ${item.title}`, `  Antwoord: ${item.text}`);
        else {
          lines.push(`${section.style === 'ranking' ? index + 1 + '.' : '-'} ${item.title}${item.meta ? ' (' + item.meta + ')' : ''}`);
          if (item.text) lines.push('  ' + item.text);
          if (item.href) lines.push('  ' + item.href);
        }
      });
      if (section.quote) lines.push(`  "${section.quote}" (een collega)`);
      lines.push('');
    });
    if (doc.closing) lines.push(doc.closing);
    if (doc.signature) lines.push(doc.signature);
    lines.push('', doc.home);
    return lines.join('\n');
  }

  /** E-mailbestand (.eml) dat Outlook opent als nieuw bericht (X-Unsent), met HTML en platte tekst. */
  function eml(doc) {
    const base64 = (value) => {
      const bytes = new TextEncoder().encode(value);
      let binary = '';
      bytes.forEach((byte) => { binary += String.fromCharCode(byte); });
      return window.btoa(binary).replace(/.{1,76}/g, '$&\r\n').trim();
    };
    const boundary = 'aicockpit-' + Date.now().toString(36);
    return [
      `Subject: =?UTF-8?B?${base64(doc.subject).replace(/\r\n/g, '')}?=`,
      'X-Unsent: 1',
      'MIME-Version: 1.0',
      `Content-Type: multipart/alternative; boundary="${boundary}"`,
      '',
      `--${boundary}`,
      'Content-Type: text/plain; charset=UTF-8',
      'Content-Transfer-Encoding: base64',
      '',
      base64(plainText(doc)),
      `--${boundary}`,
      'Content-Type: text/html; charset=UTF-8',
      'Content-Transfer-Encoding: base64',
      '',
      base64(emailHtml(doc)),
      `--${boundary}--`,
      ''
    ].join('\r\n');
  }

  /** PDF: het voorbeeld afdrukken, de rest van de pagina verborgen (zie @media print in css/audit.css). */
  function printPdf(doc, node) {
    const root = el('div', { className: 'nl-print', attrs: { id: 'nl-print' } }, [node.cloneNode(true)]);
    const title = document.title;
    document.body.append(root);
    document.body.classList.add('is-printing-newsletter');
    document.title = doc.subject.replace(/[\\/:*?"<>|]+/g, '-');
    const done = () => {
      document.body.classList.remove('is-printing-newsletter');
      root.remove();
      document.title = title;
      window.removeEventListener('afterprint', done);
    };
    window.addEventListener('afterprint', done);
    window.print();
    window.setTimeout(() => { if (document.body.contains(root)) done(); }, 1500);
  }

  async function copyRich(doc) {
    const html = emailHtml(doc);
    const text = plainText(doc);
    try {
      if (navigator.clipboard && window.ClipboardItem && window.isSecureContext) {
        await navigator.clipboard.write([new window.ClipboardItem({ 'text/html': new Blob([html], { type: 'text/html' }), 'text/plain': new Blob([text], { type: 'text/plain' }) })]);
        return 'rich';
      }
    } catch (error) {
      /* terugval: platte tekst */
    }
    return (await ns.ui.copyText(text)) ? 'plain' : '';
  }

  /* ---- Het tabblad ---------------------------------------------------------------------------- */
  function render() {
    const today = ns.content.today();
    const discipline = ns.cockpit.activeId();
    const state = { kind: lastDayOfMonth(today) ? 'maand' : storage.get('nieuwsbrief:soort', 'week') === 'maand' ? 'maand' : 'week', anchor: today };
    let extras = { ideas: [], events: [], reviews: [] };
    let current = null; // { p, sections, texts, off, doc }

    const controls = el('div', { className: 'nl__controls' });
    const previewSlot = el('div', { className: 'nl__preview' });
    const node = el('div', { className: 'nl' }, [controls, previewSlot]);
    const storeKey = (p) => `nieuwsbrief:${discipline}:${p.key}`;

    function saved(p) {
      const value = storage.get(storeKey(p), null);
      return value && typeof value === 'object' ? value : {};
    }

    function persist() {
      storage.set(storeKey(current.p), { texts: current.texts, off: Array.from(current.off) });
    }

    function refreshPreview() {
      current.doc = documentFor(current.p, current.sections, current.texts, current.off);
      previewSlot.replaceChildren(preview(current.doc));
    }

    function field(label, key, multiline) {
      const id = 'nl-' + key;
      const input = el(multiline ? 'textarea' : 'input', { className: 'field__input' + (multiline ? ' field__textarea' : ''), attrs: { id, type: multiline ? null : 'text', rows: multiline ? '3' : null } });
      input.value = current.texts[key] || '';
      input.addEventListener('input', () => {
        current.texts[key] = input.value;
        persist();
        refreshPreview();
      });
      return el('div', { className: 'field' }, [el('label', { className: 'field__label', text: label, attrs: { for: id } }), input]);
    }

    function choices() {
      return el('fieldset', { className: 'nl__choices' }, [
        el('legend', { className: 'field__label', text: 'Wat komt erin' }),
        ...current.sections.map((section) => {
          const sectionKey = 'section:' + section.id;
          const sectionBox = el('input', { attrs: { type: 'checkbox', id: 'nl-s-' + section.id, checked: !current.off.has(sectionKey), disabled: !section.items.length } });
          sectionBox.addEventListener('change', () => {
            if (sectionBox.checked) current.off.delete(sectionKey);
            else current.off.add(sectionKey);
            persist();
            draw();
          });
          return el('div', { className: 'nl__choice' + (section.items.length ? '' : ' is-empty') }, [
            el('label', { className: 'check', attrs: { for: 'nl-s-' + section.id } }, [sectionBox, el('span', {}, [
              el('strong', { text: section.title }),
              el('span', { className: 'nl__count', text: section.items.length ? ` (${section.items.length})` : ' · niets in deze periode' })
            ])]),
            section.items.length && !current.off.has(sectionKey) && section.items.length > 1 ? el('div', { className: 'nl__items' }, section.items.map((item, index) => {
              const id = `nl-i-${section.id}-${index}`;
              const box = el('input', { attrs: { type: 'checkbox', id, checked: !current.off.has(item.key) } });
              box.addEventListener('change', () => {
                if (box.checked) current.off.delete(item.key);
                else current.off.add(item.key);
                persist();
                refreshPreview();
              });
              return el('label', { className: 'check check--compact', attrs: { for: id } }, [box, el('span', { text: item.title })]);
            })) : null
          ]);
        })
      ]);
    }

    function draw() {
      const p = current.p;
      const isCurrent = today >= p.start && today <= p.end;
      const kinds = el('div', { className: 'toggles', attrs: { role: 'group', 'aria-label': 'Soort nieuwsbrief' } }, Object.entries(KINDS).map(([kind, label]) => {
        const btn = el('button', { className: 'toggle', attrs: { type: 'button', 'aria-pressed': String(kind === p.kind) } }, [icon(kind === 'maand' ? 'calendar' : 'calendar-clock'), el('span', { text: label })]);
        btn.addEventListener('click', () => {
          if (kind === state.kind) return;
          state.kind = kind;
          state.anchor = today;
          storage.set('nieuwsbrief:soort', kind);
          setup();
        });
        return btn;
      }));
      const prev = el('button', { className: 'btn btn--secondary btn--icon btn--sm', attrs: { type: 'button', 'aria-label': p.kind === 'maand' ? 'Vorige maand' : 'Vorige week' } }, [icon('arrow-left')]);
      const next = el('button', { className: 'btn btn--secondary btn--icon btn--sm', attrs: { type: 'button', 'aria-label': p.kind === 'maand' ? 'Volgende maand' : 'Volgende week', disabled: isCurrent || p.start > today } }, [icon('arrow-right')]);
      prev.addEventListener('click', () => { state.anchor = shift(p, -1); setup(); });
      next.addEventListener('click', () => { state.anchor = shift(p, 1); setup(); });
      const back = isCurrent ? null : el('button', { className: 'btn btn--quiet btn--sm', attrs: { type: 'button' } }, [el('span', { text: p.kind === 'maand' ? 'Deze maand' : 'Deze week' })]);
      if (back) back.addEventListener('click', () => { state.anchor = today; setup(); });

      let status = null;
      if (p.kind === 'maand' && isCurrent) {
        status = lastDayOfMonth(today)
          ? el('p', { className: 'nl__status nl__status--ready' }, [icon('check-circle'), el('span', { text: `Vandaag is de laatste dag van ${p.name}: deze maandnieuwsbrief is compleet.` })])
          : el('p', { className: 'nl__status' }, [icon('info'), el('span', { text: `Nog niet compleet: wat er tot en met ${longDate(p.end)} bijkomt, komt er vanzelf bij. Op de laatste dag van de maand meldt Beheer dat hij klaarstaat.` })]);
      } else if (p.kind === 'week' && isCurrent) {
        status = el('p', { className: 'nl__status' }, [icon('info'), el('span', { text: `Deze week loopt tot en met zondag ${longDate(p.end)}. Verstuur je hem op vrijdag, dan staat de tip van de week er al in.` })]);
      }

      const pdf = el('button', { className: 'btn btn--primary', attrs: { type: 'button' } }, [icon('download'), el('span', { text: 'PDF opslaan' })]);
      const mail = el('button', { className: 'btn btn--secondary', attrs: { type: 'button' } }, [icon('mail'), el('span', { text: 'E-mail (Outlook)' })]);
      const copy = el('button', { className: 'btn btn--secondary', attrs: { type: 'button' } }, [icon('copy'), el('span', { text: 'Kopieer voor e-mail of Teams' })]);
      const reset = el('button', { className: 'btn btn--quiet btn--sm', attrs: { type: 'button' } }, [icon('refresh'), el('span', { text: 'Standaardteksten en -keuze terugzetten' })]);
      pdf.addEventListener('click', () => printPdf(current.doc, previewSlot.querySelector('.nl-doc')));
      mail.addEventListener('click', () => {
        ns.adminKit.download(`${current.doc.subject.replace(/[\\/:*?"<>|]+/g, '-')}.eml`, eml(current.doc), 'message/rfc822');
        toast('E-mail gedownload: open het bestand, dan opent Outlook een nieuw bericht. Vul de ontvangers in en verstuur.', { duration: 7000 });
      });
      copy.addEventListener('click', async () => {
        const result = await copyRich(current.doc);
        toast(result === 'rich' ? 'Gekopieerd met opmaak: plak het in een nieuw bericht in Outlook of in Teams.' : result === 'plain' ? 'Gekopieerd als platte tekst (deze browser kopieert geen opmaak).' : 'Kopiëren lukte niet.', { tone: result ? 'success' : 'warning', duration: 6000 });
      });
      reset.addEventListener('click', () => {
        storage.remove(storeKey(p));
        setup();
      });

      controls.replaceChildren(
        kinds,
        el('div', { className: 'nl__period' }, [prev, el('p', { className: 'nl__range' }, [el('strong', { text: p.title }), el('span', { text: p.range })]), next, back]),
        status,
        el('div', { className: 'nl__actions' }, [pdf, mail, copy]),
        el('p', { className: 'field__hint', text: 'PDF: kies in het afdrukvenster "Opslaan als PDF". E-mail: een bestand dat Outlook opent als nieuw bericht, met de opmaak erin.' }),
        field('Onderwerp', 'subject'),
        field('Inleiding', 'intro', true),
        choices(),
        field('Afsluiting', 'closing', true),
        field('Ondertekening', 'signature'),
        reset
      );
      refreshPreview();
    }

    function setup() {
      const p = period(state.kind, state.anchor);
      // Alleen wat collega's zien: geen werkversies, voorstellen of niet-opgeslagen wijzigingen
      const sections = ns.app.withPublished(() => collect(p, extras));
      const remembered = saved(p);
      const off = new Set(Array.isArray(remembered.off) ? remembered.off : sections.filter((section) => section.defaultOff).map((section) => 'section:' + section.id));
      current = { p, sections, texts: Object.assign(defaults(p), remembered.texts || {}), off };
      draw();
    }

    controls.append(el('p', { className: 'loading', text: 'Nieuwsbrief samenstellen…' }));
    loadExtras().then((result) => {
      extras = result;
      setup();
    });
    return { node };
  }

  ns.adminNewsletter = { render, reminder };
})(window.AIAudit);
