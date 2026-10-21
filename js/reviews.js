/* ==========================================================================
   Reviews bij usecases en prompts
   --------------------------------------------------------------------------
   Onderaan een usecase of prompt: 'Wat vond je ervan?' met 1 tot 5 sterren
   en eventueel een korte toelichting.
   - Anoniem: één review per apparaat per item (willekeurige code, dezelfde
     als voor de 'Ik ook'-stemmen in de ideeënhub). Wat je gaf, onthoudt
     deze browser.
   - De sterren tellen direct mee in het gemiddelde. Een toelichting is pas
     voor iedereen zichtbaar als een beheerder hem publiceert (Beheer →
     Reviews), want de site is openbaar.
   - Zonder centrale opslag, of zolang de tabel audit_reviews nog ontbreekt
     (setup/supabase-audit.sql), verschijnt het blok niet.
   ========================================================================== */
(function (ns) {
  'use strict';

  const { el, icon, storage, toast, formatDate } = ns.ui;
  const MAX_COMMENT = 500;
  let stats = null; // Promise<Map<'type:id', { reviews, average }> | null>

  const key = (type, id) => type + ':' + id;

  function voterId() {
    let id = storage.get('voterId', '');
    if (!id) {
      id = ns.ui.randomId();
      storage.set('voterId', id);
    }
    return id;
  }

  function mine() {
    const value = storage.get('reviews', {});
    return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  }

  /** Gemiddelden van deze discipline (één keer per bezoek opgehaald). null = geen reviews mogelijk. */
  function loadStats(fresh) {
    if (!stats || fresh) {
      stats = ns.central.reviewStats().then((result) => {
        if (result.status !== 'ok') return null;
        return new Map(result.items.map((item) => [key(item.item_type, item.item_id), { reviews: item.reviews, average: Number(item.average) }]));
      });
    }
    return stats;
  }

  /** Sterren als tekst en icoontjes, bijv. 4,3 → ★★★★☆ (met schermlezertekst). */
  function starRow(value, label) {
    const rounded = Math.round(value);
    return el('span', { className: 'stars', attrs: { role: 'img', 'aria-label': label || `${String(value).replace('.', ',')} van 5 sterren` } },
      [1, 2, 3, 4, 5].map((n) => icon(n <= rounded ? 'star-filled' : 'star', { className: n <= rounded ? 'stars__on' : 'stars__off' })));
  }

  function summaryText(entry) {
    if (!entry || !entry.reviews) return 'Nog geen beoordelingen. Wees de eerste.';
    return `${String(entry.average).replace('.', ',')} gemiddeld · ${entry.reviews} ${entry.reviews === 1 ? 'beoordeling' : 'beoordelingen'}`;
  }

  /**
   * Het blok 'Wat vond je ervan?' voor een usecase of prompt.
   * @param {'usecase'|'prompt'} type
   * @param {object} item  usecase of prompt (met id en title)
   */
  function block(type, item) {
    const config = ns.app && ns.app.config ? ns.app.config() : {};
    if (!ns.central.isEnabled() || config.enableReviews === false) return null;
    const itemKey = key(type, item.id);
    const headingId = 'rv-' + type;
    const summary = el('p', { className: 'review__summary' }, [el('span', { text: 'Beoordelingen laden…' })]);
    const body = el('div', { className: 'review__body' });
    const comments = el('div', { className: 'review__comments' });
    const node = el('section', { className: 'review', attrs: { 'aria-labelledby': headingId, hidden: true } }, [
      el('div', { className: 'review__head' }, [
        el('h2', { className: 'review__title', attrs: { id: headingId } }, [icon('star'), el('span', { text: 'Wat vond je ervan?' })]),
        summary
      ]),
      body,
      comments
    ]);

    function showSummary(entry) {
      summary.replaceChildren(...(entry && entry.reviews ? [starRow(entry.average)] : []), el('span', { text: summaryText(entry) }));
    }

    function thanks(rating) {
      body.replaceChildren(el('p', { className: 'review__thanks' }, [icon('check-circle'), el('span', { text: `Bedankt! Je gaf ${rating === 1 ? '1 ster' : rating + ' sterren'}.` })]));
    }

    function form() {
      let rating = 0;
      const group = 'rating-' + type + '-' + item.id;
      const labels = [];
      const stars = el('fieldset', { className: 'review__stars' }, [
        el('legend', { className: 'field__label', text: 'Jouw beoordeling' }),
        el('div', { className: 'review__picker' }, [1, 2, 3, 4, 5].map((n) => {
          const id = group + '-' + n;
          const input = el('input', { className: 'sr-only', attrs: { type: 'radio', name: group, id, value: String(n) } });
          const label = el('label', { className: 'review__star', attrs: { for: id, title: n === 1 ? '1 ster' : n + ' sterren' } }, [
            icon('star-filled'),
            el('span', { className: 'sr-only', text: n === 1 ? '1 ster' : n + ' sterren' })
          ]);
          labels.push(label);
          input.addEventListener('change', () => {
            rating = n;
            labels.forEach((l, index) => l.classList.toggle('is-on', index < n));
            send.disabled = false;
          });
          return el('span', {}, [input, label]);
        }))
      ]);
      const commentId = 'rv-comment-' + type;
      const comment = el('textarea', { className: 'field__input field__textarea', attrs: { id: commentId, rows: '3', maxlength: String(MAX_COMMENT), placeholder: 'Wat werkte goed, wat kan beter?' } });
      const count = el('p', { className: 'field__counter', text: '0/' + MAX_COMMENT });
      comment.addEventListener('input', () => {
        count.textContent = comment.value.length + '/' + MAX_COMMENT;
      });
      const send = el('button', { className: 'btn btn--primary btn--sm', attrs: { type: 'submit', disabled: true } }, [icon('send'), el('span', { text: 'Versturen' })]);
      const formNode = el('form', { className: 'review__form', attrs: { novalidate: true } }, [
        stars,
        el('div', { className: 'field' }, [
          el('label', { className: 'field__label', text: 'Toelichting (optioneel)', attrs: { for: commentId } }),
          comment,
          el('div', { className: 'field__meta' }, [
            el('p', { className: 'field__hint', text: 'Anoniem. Een toelichting verschijnt hier nadat het AI-team hem heeft bekeken. Geen klantnamen of persoonsgegevens.' }),
            count
          ])
        ]),
        el('div', { className: 'review__actions' }, [send])
      ]);
      formNode.addEventListener('submit', async (event) => {
        event.preventDefault();
        if (!rating) return;
        send.disabled = true;
        const result = await ns.central.submitReview({ type, id: item.id, rating, comment: comment.value.trim(), voter: voterId() });
        if (result === 'ok' || result === 'duplicate') {
          const given = mine();
          given[itemKey] = result === 'ok' ? rating : given[itemKey] || rating;
          storage.set('reviews', given);
          thanks(given[itemKey]);
          if (result === 'ok') toast('Bedankt voor je beoordeling', { tone: 'success' });
          showSummary((await loadStats(true) || new Map()).get(itemKey));
        } else {
          send.disabled = false;
          toast(result === 'missing' ? 'Beoordelen kan nog niet: de centrale opslag is nog niet ingericht.' : 'Versturen lukte niet. Probeer het straks nog eens.', { tone: 'warning' });
        }
      });
      return formNode;
    }

    function showComments(items) {
      const list = items.filter((review) => review.comment);
      comments.replaceChildren(...(list.length ? [
        el('h3', { className: 'review__subtitle', text: 'Wat collega\'s zeggen' }),
        el('ul', { className: 'review__list', attrs: { role: 'list' } }, list.map((review) => el('li', { className: 'review__item' }, [
          el('div', { className: 'review__meta' }, [starRow(review.rating), el('span', { text: formatDate(review.created_at) })]),
          el('p', { className: 'review__text', text: review.comment })
        ])))
      ] : []));
    }

    const given = mine()[itemKey];
    if (given) thanks(given);
    else body.append(form());

    loadStats().then((map) => {
      if (!map) return; // geen centrale opslag of nog geen tabel: blok blijft verborgen
      node.hidden = false;
      showSummary(map.get(itemKey));
      ns.central.listReviews(type, item.id).then((result) => {
        if (result.status === 'ok') showComments(result.items);
      });
    });
    return node;
  }

  /** Na inloggen of opslaan in Beheer: gemiddelden opnieuw ophalen. */
  function refresh() {
    return loadStats(true);
  }

  ns.reviews = { block, refresh, starRow };
})(window.AIAudit);
