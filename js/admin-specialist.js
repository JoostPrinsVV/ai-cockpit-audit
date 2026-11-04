/* ==========================================================================
   Beheer → Invliegen (#/beheer/invliegen)
   --------------------------------------------------------------------------
   Verzoeken van teams om de AI-specialist in te vliegen bij een klantcasus
   (js/specialist.js), van de discipline die bovenin de zijbalk gekozen is.
   Op urgentie: eerst wat nieuw is, dan wat is ingepland; daarbinnen wat deze
   week moet, en de vroegste datum. Per verzoek: de casus, wie het vraagt
   (mail of chat in Teams), de status met een datum, een notitie, en 'Maak er
   een usecase van' (een concept-usecase in Beheer → Inhoud).
   Een verzoek wordt nooit gepubliceerd; de aanvrager ziet de status bij
   'Jouw inzendingen' (op referentie, stap 13).
   ========================================================================== */
(function (ns) {
  'use strict';

  const { el, icon, toast, formatDate, toggleGroup } = ns.ui;
  const { notice } = ns.blocks;
  const kit = ns.adminKit;
  const view = { filter: 'open' };
  // Wat je kunt kiezen als status (de statussen van de ideeënhub, met namen die hier passen)
  const CHOICES = ['nieuw', 'gepland', 'gerealiseerd', 'afgewezen'];

  function statusBadge(status) {
    const info = ns.specialist.STATUS[status] || ns.specialist.STATUS.nieuw;
    return el('span', { className: 'status status--' + info.tone, text: info.label });
  }

  /** Eén verzoek, met contact, status en wat je ermee doet. */
  function card(item, onChanged) {
    const S = ns.specialist;
    const d = item.details || {};
    const phase = item.phase ? ns.content.phaseById.get(item.phase) : null;
    const usecase = d.usecase ? ns.content.usecaseById.get(d.usecase) : null;
    const urgent = d.wanneer === 'week' && S.OPEN.includes(item.status);
    const chips = [
      phase ? ns.ui.chip(phase.label, { icon: phase.icon }) : null,
      d.klant ? ns.ui.chip(d.klant, { icon: 'users' }) : null,
      d.data ? ns.ui.chip(S.dataLabel(d.data), { icon: 'shield', className: d.data === 'hoog' ? 'chip--danger' : '' }) : null,
      d.vorm ? ns.ui.chip(S.labelOf(S.HOW, d.vorm), { icon: 'chat' }) : null,
      usecase ? el('a', { className: 'chip', attrs: { href: '#/usecase/' + encodeURIComponent(usecase.id) } }, [icon('play-circle'), usecase.title]) : null
    ].filter(Boolean);
    const who = [item.name, d.team, d.vestiging].filter(Boolean).join(' · ') || 'Onbekend';
    const mail = item.email ? el('a', { className: 'btn btn--secondary btn--sm', attrs: { href: 'mailto:' + item.email + '?subject=' + encodeURIComponent('Je verzoek om de AI-specialist in te vliegen: ' + item.title) } }, [icon('mail'), el('span', { text: 'Mail het team' })]) : null;
    const chat = item.email ? el('a', { className: 'btn btn--secondary btn--sm', attrs: { href: S.teamsLink(item.email, 'Hoi' + (item.name ? ' ' + item.name.split(/\s+/)[0] : '') + ', ik zag je verzoek in de AI-cockpit: ' + item.title), target: '_blank', rel: 'noopener noreferrer' } }, [icon('chat'), el('span', { text: 'Chat in Teams' })]) : null;

    // Beheren: status, datum, notitie
    const uid = 'fly-' + item.id;
    const status = el('select', { className: 'field__input field__input--sm', attrs: { id: uid + '-status' } }, CHOICES.map((value) => el('option', { attrs: { value }, text: S.STATUS[value].label })));
    status.value = CHOICES.includes(item.status) ? item.status : 'nieuw';
    const planned = el('input', { className: 'field__input field__input--sm', attrs: { id: uid + '-date', type: 'date' } });
    planned.value = d.ingepland || '';
    const plannedField = el('div', { className: 'field' }, [el('label', { className: 'field__label', attrs: { for: uid + '-date' }, text: 'Ingepland op' }), planned]);
    const syncPlanned = () => {
      plannedField.hidden = status.value !== 'gepland';
    };
    status.addEventListener('change', syncPlanned);
    syncPlanned();
    const note = el('textarea', { className: 'field__input field__textarea', attrs: { id: uid + '-note', rows: '2', maxlength: '4000', placeholder: 'Wat je hebt afgesproken of geadviseerd (alleen voor het AI-team)' } });
    note.value = item.answer || '';
    const save = el('button', { className: 'btn btn--primary btn--sm', attrs: { type: 'button' } }, [icon('check'), el('span', { text: 'Opslaan' })]);
    save.addEventListener('click', async () => {
      save.disabled = true;
      try {
        const details = JSON.parse(JSON.stringify(Object.assign({}, d, { ingepland: status.value === 'gepland' ? planned.value || undefined : undefined })));
        Object.assign(item, await ns.central.adminUpdateIdea(item.id, { status: status.value, answer: note.value.trim() || null, details }));
        toast('Opgeslagen', { tone: 'success' });
        onChanged();
      } catch (error) {
        kit.failed('Opslaan', error);
      } finally {
        save.disabled = false;
      }
    });
    // Een goede casus voor iedereen: een concept-usecase (geanonimiseerd), in Beheer → Inhoud
    const toUsecase = el('button', { className: 'btn btn--quiet btn--sm', attrs: { type: 'button' } }, [icon('play-circle'), el('span', { text: 'Maak er een usecase van' })]);
    toUsecase.addEventListener('click', () => {
      ns.adminContent.draft('usecase', { title: item.title, phase: item.phase || undefined, intro: item.body });
      window.location.hash = '#/beheer/inhoud/usecase/nieuw';
    });
    const remove = el('button', { className: 'btn btn--quiet btn--sm', attrs: { type: 'button' } }, [icon('trash'), el('span', { text: 'Verwijderen' })]);
    remove.addEventListener('click', async () => {
      if (!(await ns.ui.confirmDialog(`Het verzoek "${item.title}" wordt definitief verwijderd.`, { title: 'Verzoek verwijderen?', confirmLabel: 'Verwijderen', danger: true }))) return;
      remove.disabled = true;
      try {
        await ns.central.adminDeleteIdea(item.id);
        item.deleted = true;
        toast('Verwijderd');
        onChanged();
      } catch (error) {
        kit.failed('Verwijderen', error);
        remove.disabled = false;
      }
    });

    return el('article', { className: 'flyin-item' + (urgent ? ' is-urgent' : '') + (S.OPEN.includes(item.status) ? '' : ' is-done') }, [
      el('div', { className: 'flyin-item__head' }, [
        el('div', { className: 'flyin-item__badges' }, [
          el('span', { className: 'flyin-item__when' + (urgent ? ' is-urgent' : '') }, [icon('clock'), el('span', { text: (S.labelOf(S.WHEN, d.wanneer) || 'Geen termijn') + (d.datum ? ' · uiterlijk ' + formatDate(d.datum) : '') })]),
          statusBadge(item.status),
          item.status === 'gepland' && d.ingepland ? el('span', { className: 'flyin-item__planned', text: 'op ' + formatDate(d.ingepland) }) : null,
          // Nog niet gereageerd: hoeveel tijd er nog is volgens de belofte (js/promises.js)
          ns.promises.badge(item)
        ]),
        el('span', { className: 'flyin-item__date', text: 'Ingestuurd ' + formatDate(String(item.created_at || '').slice(0, 10)) })
      ]),
      el('h3', { className: 'flyin-item__title', text: item.title }),
      chips.length ? el('div', { className: 'flyin-item__chips' }, chips) : null,
      el('p', { className: 'flyin-item__body', text: item.body }),
      el('div', { className: 'flyin-item__who' }, [
        icon('user'),
        el('span', { text: who }),
        item.email ? el('a', { attrs: { href: 'mailto:' + item.email }, text: item.email }) : null
      ]),
      el('div', { className: 'flyin-item__actions' }, [mail, chat].filter(Boolean)),
      el('details', { className: 'flyin-item__manage', attrs: { open: S.OPEN.includes(item.status) ? true : null } }, [
        el('summary', { text: 'Status en notitie' }),
        el('div', { className: 'flyin-item__form' }, [
          el('div', { className: 'field' }, [el('label', { className: 'field__label', attrs: { for: uid + '-status' }, text: 'Status' }), status]),
          plannedField,
          el('div', { className: 'field flyin-item__note' }, [el('label', { className: 'field__label', attrs: { for: uid + '-note' }, text: 'Notitie' }), note])
        ]),
        el('div', { className: 'flyin-item__buttons' }, [save, toUsecase, remove])
      ])
    ]);
  }

  function render() {
    const S = ns.specialist;
    const who = S.current();
    const list = el('div', { className: 'flyin-list' });
    const summary = el('div', { className: 'kpis' });
    let items = [];
    const filters = toggleGroup('Welke verzoeken', [
      { value: 'open', label: 'Open' },
      { value: 'done', label: 'Afgerond' },
      { value: 'all', label: 'Alles' }
    ], view.filter, (value) => {
      view.filter = value;
      update();
    }, { animate: false, resetValue: 'open' });

    function update() {
      items = items.filter((item) => !item.deleted);
      const count = (statuses) => items.filter((item) => statuses.includes(item.status)).length;
      summary.replaceChildren(...[
        ['Nieuw', count(['nieuw', 'in-behandeling'])],
        ['Ingepland', count(['gepland'])],
        ['Afgerond', count(['gerealiseerd', 'beantwoord'])]
      ].map(([label, value]) => el('div', { className: 'kpi' }, [el('span', { className: 'kpi__value', text: String(value) }), el('span', { className: 'kpi__label', text: label })])));
      const shown = S.sort(items.filter((item) => view.filter === 'all' || (view.filter === 'open') === S.OPEN.includes(item.status)));
      list.replaceChildren(...(shown.length ? shown.map((item) => card(item, update)) : [el('p', { className: 'section__lead', text: items.length ? 'Geen verzoeken met dit filter.' : 'Nog geen verzoeken. Teams vinden de knop bij iedere usecase, in de ideeënhub, op de startpagina en met Ctrl+K.' })]));
    }

    async function load() {
      list.replaceChildren(el('p', { className: 'loading', text: 'Verzoeken laden…' }));
      try {
        items = (await ns.central.adminListIdeas()).filter((item) => item.kind === S.KIND);
        update();
      } catch (error) {
        list.replaceChildren(notice({ tone: 'warning', title: 'Laden mislukt', text: error.message }));
      }
    }

    const setup = who.name && who.email ? null : notice({
      title: who.name ? 'Nog geen Teams-adres' : 'Wie is de AI-specialist van ' + who.discipline + '?',
      text: (who.name ? 'Zet bij ' : 'Vul bij ') + 'Beheer → Disciplines (bij ' + who.discipline + ') de naam, het e-mailadres voor Teams en de reactietijd in. Dan zien teams wie er invliegt en kunnen ze meteen chatten.'
    });
    load();
    return {
      node: el('div', { className: 'flyin-admin' }, [
        setup,
        summary,
        el('div', { className: 'filters filters--inline' }, [
          filters,
          el('button', { className: 'btn btn--secondary btn--sm', attrs: { type: 'button' }, on: { click: load } }, [icon('refresh'), el('span', { text: 'Vernieuwen' })])
        ]),
        list
      ])
    };
  }

  ns.adminSpecialist = { render };
})(window.AIAudit);
