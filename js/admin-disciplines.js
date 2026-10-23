/* ==========================================================================
   Beheer → Disciplines (#/beheer/disciplines)
   --------------------------------------------------------------------------
   Welke disciplines er zijn, in welke volgorde, en welke open of op slot
   staan.
   - Open: iedereen kan erin via de wisselaar in de kopbalk.
   - Op slot: collega's zien de discipline met een slotje, maar kunnen er
     niet in. Beheerders wel, om alvast inhoud klaar te zetten (Beheer →
     Inhoud in die cockpit).
   De lijst staat in de database (naamruimte 'ai-algemeen', setting
   'disciplines'). Zolang je hier niets hebt opgeslagen, geldt
   data/disciplines.js.
   ========================================================================== */
(function (ns) {
  'use strict';

  const { el, icon, toast, accentClass } = ns.ui;
  const kit = ns.adminKit;
  const confirm = (message, options) => ns.ui.confirmDialog(message, options);
  const FIELDS = [
    { key: 'name', label: 'Naam', hint: 'In de kopbalk en de wisselaar.', required: true, half: true },
    { key: 'description', label: 'Korte omschrijving', hint: 'In de wisselaar, onder de naam.', half: true },
    { key: 'eyebrow', label: 'Regel boven de titel', hint: 'Op de startpagina, na "Visser & Visser ·". Bijv. Copilot in de controlepraktijk.' },
    { key: 'label', label: 'In lopende tekst', hint: 'Bijv. "de audit" geeft "Waarom handig in de audit".', half: true },
    { key: 'phases', label: 'Fasen van …', hint: 'Bijv. "de controle" geeft "Per fase van de controle".', half: true }
  ];

  let uid = 0;
  const nextId = () => 'dsc' + (++uid);

  function field(label, input, hint, half) {
    const id = input.id || (input.id = nextId());
    return el('div', { className: 'field' + (half ? ' field--half' : '') }, [
      el('label', { className: 'field__label', text: label, attrs: { for: id } }),
      input,
      hint ? el('p', { className: 'field__hint', text: hint }) : null
    ]);
  }

  function render() {
    const list = ns.cockpit.registry().map((discipline) => Object.assign({}, discipline));
    let initial = JSON.stringify(list);
    let openDetails = '';
    const listNode = el('ol', { className: 'disc-list', attrs: { role: 'list' } });
    const formError = kit.formError();

    function row(discipline, index) {
      const isNew = Boolean(discipline._new);
      const status = el('select', { className: 'field__input field__input--sm', attrs: { 'aria-label': 'Status van ' + (discipline.name || 'de nieuwe discipline') }, dataset: { control: 'status' } }, [
        el('option', { attrs: { value: 'open' }, text: 'Open voor iedereen' }),
        el('option', { attrs: { value: 'locked' }, text: 'Op slot' })
      ]);
      status.value = discipline.status;
      status.addEventListener('change', () => {
        discipline.status = status.value;
        draw();
      });
      const up = el('button', { className: 'btn btn--quiet btn--icon btn--tiny', attrs: { type: 'button', 'aria-label': 'Omhoog: ' + discipline.name, disabled: index === 0 }, dataset: { control: 'up' } }, [icon('arrow-up')]);
      const down = el('button', { className: 'btn btn--quiet btn--icon btn--tiny', attrs: { type: 'button', 'aria-label': 'Omlaag: ' + discipline.name, disabled: index === list.length - 1 }, dataset: { control: 'down' } }, [icon('arrow-down')]);
      up.addEventListener('click', () => move(index, -1));
      down.addEventListener('click', () => move(index, 1));

      // Details: naam, teksten, icoon en kleur
      const inputs = {};
      const fields = FIELDS.map((f) => {
        const input = el('input', { className: 'field__input', attrs: { type: 'text', autocomplete: 'off' } });
        input.value = discipline[f.key] || '';
        input.addEventListener('input', () => {
          discipline[f.key] = input.value;
          if (f.key === 'name') {
            nameNode.textContent = input.value || 'Nieuwe discipline';
            if (isNew && !discipline._idTouched && inputs.id) inputs.id.value = discipline.id = kit.slug(input.value, 40);
          }
        });
        inputs[f.key] = input;
        return field(f.label + (f.required ? ' *' : ''), input, f.hint, f.half);
      });
      if (isNew) {
        const idInput = el('input', { className: 'field__input field__input--mono', attrs: { type: 'text', autocomplete: 'off', spellcheck: 'false' } });
        idInput.value = discipline.id;
        idInput.addEventListener('input', () => {
          discipline._idTouched = true;
          discipline.id = idInput.value.trim();
        });
        inputs.id = idInput;
        fields.splice(1, 0, field('Code (id) *', idInput, 'Kleine letters, cijfers en streepjes. Komt in het adres (?d=…) en verandert daarna niet meer.', true));
      }
      const iconSelect = el('select', { className: 'field__input' }, kit.iconNames().map((name) => el('option', { attrs: { value: name }, text: name })));
      iconSelect.value = discipline.icon;
      const accentSelect = el('select', { className: 'field__input' }, kit.accentOptions().map((o) => el('option', { attrs: { value: o.value }, text: o.label })));
      accentSelect.value = discipline.accent;
      const markNode = el('span', { className: 'disc__icon ' + accentClass(discipline.accent), attrs: { 'aria-hidden': 'true' } }, [icon(discipline.icon)]);
      iconSelect.addEventListener('change', () => {
        discipline.icon = iconSelect.value;
        ns.ui.setIcon(markNode.querySelector('svg'), iconSelect.value);
      });
      accentSelect.addEventListener('change', () => {
        discipline.accent = accentSelect.value;
        markNode.className = 'disc__icon ' + accentClass(discipline.accent);
      });
      fields.push(field('Icoon', iconSelect, null, true), field('Kleur', accentSelect, null, true));

      const remove = isNew ? el('button', { className: 'btn btn--danger btn--sm', attrs: { type: 'button' }, dataset: { control: 'remove' } }, [icon('trash'), el('span', { text: 'Weghalen' })]) : null;
      if (remove) remove.addEventListener('click', () => {
        list.splice(index, 1);
        draw();
      });

      const details = el('details', { className: 'disc__details', attrs: { open: openDetails === discipline._key ? true : null } }, [
        el('summary', { className: 'disc__summary' }, [icon('pencil-line'), el('span', { text: 'Naam, teksten en kleur' })]),
        el('div', { className: 'form-grid' }, fields),
        remove ? el('div', { className: 'cms-form__actions' }, [remove]) : null
      ]);
      details.addEventListener('toggle', () => {
        openDetails = details.open ? discipline._key : openDetails === discipline._key ? '' : openDetails;
      });

      const nameNode = el('span', { className: 'disc__name', text: discipline.name || 'Nieuwe discipline' });
      const locked = discipline.status !== 'open';
      return el('li', { className: 'disc' + (locked ? ' disc--locked' : ''), dataset: { key: discipline._key } }, [
        el('div', { className: 'disc__head' }, [
          markNode,
          el('div', { className: 'disc__main' }, [
            nameNode,
            el('p', { className: 'cms-row__meta' }, [
              el('code', { text: discipline.id || '…' }),
              ' · ',
              locked ? 'collega\'s zien hem met een slotje' : 'iedereen kan erin'
            ])
          ]),
          el('span', { className: 'status status--' + (locked ? 'muted' : 'success') }, [icon(locked ? 'lock' : 'check'), el('span', { text: locked ? 'Op slot' : 'Open' })]),
          status,
          el('div', { className: 'cms-row__actions' }, [
            up,
            down,
            isNew ? null : el('a', { className: 'btn btn--secondary btn--sm', attrs: { href: ns.cockpit.href(discipline.id, '#/') } }, [icon('eye'), el('span', { text: 'Bekijken' })]),
            isNew ? null : el('a', { className: 'btn btn--secondary btn--sm', attrs: { href: ns.cockpit.href(discipline.id, '#/beheer/inhoud') } }, [icon('pencil-line'), el('span', { text: 'Inhoud' })])
          ])
        ]),
        details
      ]);
    }

    function move(index, delta) {
      const target = index + delta;
      if (target < 0 || target >= list.length) return;
      const [item] = list.splice(index, 1);
      list.splice(target, 0, item);
      draw();
      ns.ui.announce(`${item.name || 'De nieuwe discipline'} staat nu op plek ${target + 1} van ${list.length}`);
    }

    /**
     * Alles opnieuw opbouwen. De focus blijft op dezelfde knop of keuzelijst van dezelfde
     * discipline (kan die knop niet meer, bijv. bovenaan 'Omhoog': de andere pijl); is de
     * discipline weggehaald, dan naar 'Nieuwe discipline'.
     */
    function draw() {
      list.forEach((discipline, index) => {
        if (!discipline._key) discipline._key = 'k' + index + '-' + (discipline.id || nextId());
      });
      const active = document.activeElement;
      const rowNode = active && listNode.contains(active) ? active.closest('li[data-key]') : null;
      const mark = rowNode && active.dataset.control ? { key: rowNode.dataset.key, control: active.dataset.control } : null;
      listNode.replaceChildren(...list.map(row));
      if (!mark) return;
      const again = listNode.querySelector(`li[data-key="${CSS.escape(mark.key)}"]`);
      if (!again) {
        add.focus();
        return;
      }
      const usable = (name) => again.querySelector(`[data-control="${name}"]:not(:disabled)`);
      const next = usable(mark.control) || usable(mark.control === 'down' ? 'up' : 'down') || usable('status');
      if (next) next.focus();
    }

    const add = el('button', { className: 'btn btn--secondary btn--sm', attrs: { type: 'button' } }, [icon('message-plus'), el('span', { text: 'Nieuwe discipline' })]);
    add.addEventListener('click', () => {
      const discipline = { id: '', name: '', description: '', status: 'locked', icon: 'grid', accent: 'navy', eyebrow: '', label: '', phases: 'je werk', _new: true, _key: nextId() };
      list.push(discipline);
      openDetails = discipline._key;
      draw();
      const input = listNode.lastElementChild && listNode.lastElementChild.querySelector('.disc__details input');
      if (input) input.focus();
    });

    function clean() {
      return list.map((discipline) => {
        const result = {};
        ['id', 'name', 'description', 'status', 'icon', 'accent', 'eyebrow', 'label', 'phases'].forEach((key) => {
          const value = typeof discipline[key] === 'string' ? discipline[key].trim() : discipline[key];
          if (value) result[key] = value;
        });
        return result;
      });
    }

    function problem(cleaned) {
      const seen = new Set();
      for (const discipline of cleaned) {
        if (!discipline.name) return 'Iedere discipline heeft een naam nodig.';
        if (!ns.cockpit.ID_PATTERN.test(discipline.id || '') || discipline.id === 'algemeen') return `De code van "${discipline.name}" mag alleen kleine letters, cijfers en streepjes bevatten (en niet "algemeen" zijn).`;
        if (seen.has(discipline.id)) return `De code "${discipline.id}" komt twee keer voor.`;
        seen.add(discipline.id);
      }
      if (!cleaned.some((discipline) => discipline.status === 'open')) return 'Zet minimaal één discipline open: anders kan niemand erin.';
      return '';
    }

    const save = el('button', { className: 'btn btn--primary', attrs: { type: 'button' } }, [icon('check'), el('span', { text: 'Opslaan' })]);
    save.addEventListener('click', async () => {
      formError.hide();
      const cleaned = clean();
      const message = problem(cleaned);
      if (message) {
        formError.show(message);
        return;
      }
      const names = (status) => cleaned.filter((d) => (status === 'open') === (d.status === 'open')).map((d) => d.name).join(', ') || 'geen';
      if (!(await confirm(`Open voor iedereen: ${names('open')}. Op slot: ${names('locked')}. De wisselaar in de kopbalk verandert direct voor alle collega's.`, { title: 'Disciplines opslaan?', confirmLabel: 'Opslaan' }))) return;
      save.disabled = true;
      try {
        await ns.central.saveContent([{ type: 'setting', id: ns.cockpit.REGISTRY_ID, data: { list: cleaned }, position: 0, status: 'published' }], ns.cockpit.GENERAL_NAMESPACE);
        initial = JSON.stringify(list);
        await ns.app.reloadContent();
        toast('Opgeslagen', { tone: 'success' });
      } catch (error) {
        formError.show('Opslaan mislukt: ' + error.message);
      } finally {
        save.disabled = false;
      }
    });

    draw();
    initial = JSON.stringify(list);
    const node = el('div', { className: 'cms' }, [
      ns.blocks.notice({ title: 'Open of op slot', text: 'Een discipline op slot staat in de wisselaar met een slotje: collega\'s kunnen er nog niet in. Jij als beheerder wel, zodat je de inhoud alvast klaarzet via Inhoud. Zet hem open zodra hij klaar is.' }),
      listNode,
      formError.node,
      el('div', { className: 'cms-form__actions' }, [save, add])
    ]);
    return { node, canLeave: () => JSON.stringify(list) === initial };
  }

  ns.adminDisciplines = { render };
})(window.AIAudit);
