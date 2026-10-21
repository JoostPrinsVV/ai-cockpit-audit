/* ==========================================================================
   Promptblok: prompttekst met kopieerknop en 'Invullen'
   --------------------------------------------------------------------------
   [PLAATSHOUDERS] worden gemarkeerd. Met 'Invullen' krijgt iedere
   plaatshouder een eigen veld; de kopie bevat dan de ingevulde tekst.
   Wat je invult wordt nergens bewaard (het kan om klantgegevens gaan):
   weg zodra je de pagina verlaat.
   ========================================================================== */
(function (ns) {
  'use strict';

  const { el, icon, copyButton, parsePlaceholders, fillPlaceholders, promptNodes } = ns.ui;
  let counter = 0;

  /**
   * @param {object} options
   *   text        De prompttekst
   *   label       Kop boven de prompt (bijv. 'Stap 1 · Risico's in kaart')
   *   headingTag  'h2' of 'h3' (standaard 'h3')
   *   copyLabel   Tekst op de kopieerknop
   *   onCopy      Wordt aangeroepen na kopiëren
   *   fillable    false = geen 'Invullen'
   *   collapsed   true = lange prompt eerst ingeklapt
   */
  function create(options) {
    const opts = options || {};
    const id = 'pb-' + (++counter);
    const text = opts.text || '';
    const fields = opts.fillable === false ? [] : parsePlaceholders(text);
    const values = {};

    const pre = el('pre', { className: 'prompt-box__text', attrs: { id: id + '-text', tabindex: '0', 'aria-label': opts.label ? 'Prompt: ' + opts.label : 'Prompt' } });
    function renderText() {
      pre.replaceChildren(...promptNodes(text, values));
    }
    renderText();

    const copy = copyButton(() => fillPlaceholders(text, values), { label: opts.copyLabel || 'Kopieer prompt', onCopy: opts.onCopy });

    // ---- Invullen ----
    let fillToggle = null;
    let fillPanel = null;
    if (fields.length) {
      fillPanel = el('div', { className: 'fill', attrs: { id: id + '-fill', hidden: true } });
      const intro = el('p', { className: 'fill__intro' }, [
        icon('shield'),
        el('span', { text: 'Vul in wat je weet; de rest blijft als [PLAATSHOUDER] staan. Wat je hier invult wordt niet bewaard.' })
      ]);
      const grid = el('div', { className: 'fill__grid' });
      fields.forEach((field, index) => {
        const inputId = `${id}-f${index}`;
        let control;
        if (field.long) {
          control = el('textarea', { className: 'fill__input fill__input--long', attrs: { id: inputId, rows: '4', placeholder: field.hint || 'Plak hier de tekst', spellcheck: 'false' } });
        } else {
          control = el('input', { className: 'fill__input', attrs: { id: inputId, type: 'text', placeholder: field.hint || (field.options.length ? field.options.join(' / ') : ''), autocomplete: 'off', spellcheck: 'false' } });
          if (field.options.length) {
            const listId = inputId + '-list';
            control.setAttribute('list', listId);
            grid.append(el('datalist', { attrs: { id: listId } }, field.options.map((option) => el('option', { attrs: { value: option } }))));
          }
        }
        control.addEventListener('input', () => {
          values[field.key] = control.value;
          renderText();
        });
        grid.append(el('div', { className: 'fill__field' + (field.long ? ' fill__field--wide' : '') }, [
          el('label', { className: 'fill__label', text: field.label, attrs: { for: inputId } }),
          control
        ]));
      });
      const clear = el('button', { className: 'btn btn--quiet btn--sm fill__clear', attrs: { type: 'button' } }, [icon('refresh'), el('span', { text: 'Wis invulling' })]);
      clear.addEventListener('click', () => {
        Object.keys(values).forEach((keyName) => delete values[keyName]);
        fillPanel.querySelectorAll('.fill__input').forEach((input) => {
          input.value = '';
        });
        renderText();
      });
      fillPanel.append(intro, grid, clear);

      fillToggle = el('button', { className: 'btn btn--secondary btn--sm prompt-box__fill', attrs: { type: 'button', 'aria-expanded': 'false', 'aria-controls': id + '-fill' } }, [
        icon('pencil-line'),
        el('span', { text: `Invullen (${fields.length})` })
      ]);
      fillToggle.addEventListener('click', () => {
        const open = fillPanel.hidden;
        fillPanel.hidden = !open;
        fillToggle.setAttribute('aria-expanded', String(open));
        if (open) {
          const first = fillPanel.querySelector('.fill__input');
          if (first) first.focus();
        }
      });
    }

    // ---- Lange prompt eerst ingeklapt ----
    let expand = null;
    const body = el('div', { className: 'prompt-box__body' }, [pre]);
    if (opts.collapsed && text.length > 700) {
      body.classList.add('is-collapsed');
      expand = el('button', { className: 'prompt-box__expand', attrs: { type: 'button', 'aria-expanded': 'false', 'aria-controls': id + '-text' } }, [
        el('span', { text: 'Toon de hele prompt' }),
        icon('chevron-down')
      ]);
      expand.addEventListener('click', () => {
        const open = body.classList.toggle('is-collapsed') === false;
        expand.setAttribute('aria-expanded', String(open));
        expand.querySelector('span').textContent = open ? 'Klap de prompt in' : 'Toon de hele prompt';
      });
      body.append(expand);
    }

    const headingTag = opts.headingTag || 'h3';
    const node = el('div', { className: 'prompt-box' }, [
      el('div', { className: 'prompt-box__head' }, [
        opts.label ? el(headingTag, { className: 'prompt-box__label', text: opts.label }) : el('p', { className: 'prompt-box__label', text: 'Prompt' }),
        el('div', { className: 'prompt-box__actions' }, [fillToggle, copy])
      ]),
      fillPanel,
      body
    ]);
    return node;
  }

  ns.promptBox = { create };
})(window.AIAudit);
