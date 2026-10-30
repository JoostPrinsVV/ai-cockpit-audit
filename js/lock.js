/* ==========================================================================
   Slot met pincode over de hele cockpit
   --------------------------------------------------------------------------
   Net als het 'Even gesloten'-scherm van de AI Snackbar: wie de cockpit
   opent, vult eerst de pincode in. Daarna blijft hij op dit apparaat open
   (localStorage), tot de pincode verandert. Geen slot voor een ingelogde
   beheerder en op een lokale kopie (ontwikkelen, de demo-opname); daar kun
   je het slot toch zien met ?slot vóór de #.

   In js/config.js staat niet de pincode zelf, maar een vingerafdruk ervan
   (lockPinHash). Nieuwe pincode: open de cockpit, en typ in de console
   await AIAudit.lock.hash('nieuwe pincode')  en zet de uitkomst in de config.
   Leeg = geen slot.

   Let op: een drempel tegen doorsturen, geen beveiliging. De bestanden op
   het online adres (ook de video bij de training) blijven op te vragen voor
   wie het precieze adres kent, en de repository is openbaar.
   ========================================================================== */
(function (ns) {
  'use strict';

  const root = document.documentElement;
  let screen = null;
  let inertNodes = [];
  let storeKey = '';

  const isLocalCopy = () => window.location.protocol === 'file:' || /^(localhost|127\.0\.0\.1|\[::1\])$/.test(window.location.hostname);
  const forced = () => new URLSearchParams(window.location.search).has('slot');

  /** Vingerafdruk van een pincode (SHA-256, hex), met een vast voorvoegsel. */
  async function hash(pin) {
    const bytes = new TextEncoder().encode('ai-cockpit|' + String(pin).trim());
    const digest = await window.crypto.subtle.digest('SHA-256', bytes);
    return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('');
  }

  function remembered() {
    try {
      return window.localStorage.getItem(storeKey);
    } catch (error) {
      return null;
    }
  }

  function remember(value) {
    try {
      window.localStorage.setItem(storeKey, value);
    } catch (error) {
      // Opslag geblokkeerd: dan alleen tot herladen
    }
  }

  /**
   * Bij het opstarten (js/app.js), na central.init.
   * @param {object} options  config, admin (ingelogde beheerder: geen slot)
   */
  function init({ config, admin }) {
    storeKey = config.storageNamespace + ':slot';
    const pinHash = String(config.lockPinHash || '').toLowerCase();
    const open = !pinHash || admin || (isLocalCopy() && !forced()) || (remembered() === pinHash && !forced());
    if (open) {
      delete root.dataset.slot;
      return;
    }
    show(pinHash);
  }

  function show(pinHash) {
    if (screen) return;
    root.dataset.slot = 'dicht';
    inertNodes = Array.from(document.body.children).filter((node) => !node.inert && node.id !== 'fatal');
    inertNodes.forEach((node) => { node.inert = true; });
    screen = build(pinHash);
    document.body.append(screen);
    screen.querySelector('#gate-pin').focus();
  }

  function hide() {
    if (!screen) return;
    screen.remove();
    screen = null;
    inertNodes.forEach((node) => { node.inert = false; });
    inertNodes = [];
    delete root.dataset.slot;
  }

  function build(pinHash) {
    const { el, icon, toast } = ns.ui;
    const pin = el('input', {
      className: 'field__input gate__pin',
      attrs: { id: 'gate-pin', type: 'password', inputmode: 'numeric', autocomplete: 'off', maxlength: '8', 'aria-describedby': 'gate-error' }
    });
    const error = el('p', { className: 'field__error gate__error', attrs: { id: 'gate-error', role: 'alert' } });
    const submit = el('button', { className: 'btn btn--primary gate__submit', attrs: { type: 'submit' } }, [icon('key'), el('span', { text: 'Openen' })]);
    const form = el('form', { className: 'gate__form', attrs: { novalidate: true } }, [
      el('div', { className: 'field' }, [el('label', { className: 'field__label', attrs: { for: 'gate-pin' }, text: 'Pincode' }), pin, error]),
      submit
    ]);

    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      const value = pin.value.trim();
      if (!value) {
        error.textContent = 'Vul de pincode in.';
        pin.setAttribute('aria-invalid', 'true');
        pin.focus();
        return;
      }
      submit.disabled = true;
      const ok = (await hash(value)) === pinHash;
      if (!ok) {
        // Even wachten: raden kost tijd
        await new Promise((resolve) => window.setTimeout(resolve, 600));
        submit.disabled = false;
        error.textContent = 'Deze pincode klopt niet. Probeer het opnieuw.';
        pin.setAttribute('aria-invalid', 'true');
        pin.value = '';
        pin.focus();
        return;
      }
      remember(pinHash);
      hide();
      document.getElementById('main').focus();
      toast('Welkom! Op dit apparaat blijft de cockpit voortaan open.', { tone: 'success', duration: 6000 });
    });
    pin.addEventListener('input', () => {
      error.textContent = '';
      pin.removeAttribute('aria-invalid');
    });

    return el('section', { className: 'gate', attrs: { 'aria-labelledby': 'gate-title', 'aria-describedby': 'gate-text' } }, [
      el('div', { className: 'gate__panel' }, [
        el('img', { className: 'gate__logo', attrs: { src: 'assets/branding/logo-dark.svg', alt: '', width: '88', height: '88' } }),
        el('p', { className: 'gate__eyebrow', text: (ns.config && ns.config.organizationName) || 'Visser & Visser' }),
        el('h1', { className: 'gate__title', attrs: { id: 'gate-title' }, text: 'AI Cockpit' }),
        el('p', { className: 'gate__text', attrs: { id: 'gate-text' }, text: 'Alleen voor collega\'s. Vul de pincode in om verder te gaan; op dit apparaat hoeft dat daarna niet meer.' }),
        form,
        el('p', { className: 'gate__hint' }, [icon('info'), el('span', { text: 'Weet je de pincode niet? Vraag hem aan een collega of aan het AI-team.' })])
      ])
    ]);
  }

  ns.lock = { init, hash, isShown: () => Boolean(screen) };
})(window.AIAudit);
