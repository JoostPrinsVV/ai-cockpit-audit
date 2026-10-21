/* ==========================================================================
   Nagespeelde Copilot-demo: speelt een gesprek uit demos/scripts.js af.
   Gebaseerd op de HTML-demo van de AI Snackbar (assets/demos/snack-01.html),
   maar dan voor ieder script: bijlagen toevoegen, prompt plakken of typen,
   denkstappen en een antwoord dat stap voor stap verschijnt.

   Opmaak in de teksten van scripts.js:
     **vet**        vetgedrukt
     [[p. 12]]      bronverwijzing (grijs label)
   ========================================================================== */
(function () {
  'use strict';

  const DEMOS = window.AuditDemos || {};
  const demoId = decodeURIComponent(window.location.hash.replace(/^#/, ''));
  const demo = DEMOS[demoId];

  /* Thema van het platform (?theme=dark of light); zonder: volgt de instelling van het apparaat */
  const theme = new URLSearchParams(window.location.search).get('theme');
  if (theme === 'dark' || theme === 'light') document.documentElement.dataset.theme = theme;

  /* In het platform (iframe) of los geopend? */
  const EMBED = window.parent !== window;
  if (EMBED) document.documentElement.classList.add('embed');
  function notify(event) {
    if (EMBED) window.parent.postMessage({ source: 'ai-snackbar-demo', event }, '*');
  }

  const $ = (id) => document.getElementById(id);
  const app = $('app');
  const convo = $('convo');
  const dock = $('dock');
  const cursor = $('cursor');

  const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const fmt = (s) => esc(s).replace(/\*\*(.+?)\*\*/g, '<b>$1</b>').replace(/\[\[(.+?)\]\]/g, '<span class="cite">$1</span>');
  const NUMERIC = /^[-–+]?\s?(€\s?)?[\d.,]+\s?(%|mln|k)?$/;

  const SPARK = '<svg viewBox="0 0 24 24"><path d="M12 2l2.2 6.3L20 10l-5.8 2.2L12 19l-2.2-6.8L4 10l5.8-1.7z" fill="var(--accent)"/></svg>';
  const LOGO = '<svg class="logo" viewBox="0 0 48 48"><defs><linearGradient id="lg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#2b88d8"/><stop offset=".5" stop-color="#8661c5"/><stop offset="1" stop-color="#e3008c"/></linearGradient></defs><path d="M24 4c3 9 8 14 20 16-12 2-17 7-20 24-3-17-8-22-20-24C16 18 21 13 24 4z" fill="url(#lg)"/></svg>';
  const ACTS = '<div class="acts s"><svg viewBox="0 0 24 24"><rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V5a1 1 0 0 0-1-1H5a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h3"/></svg><svg viewBox="0 0 24 24"><path d="M7 11v9H4v-9zM7 11l4-8c1.5 0 2.5 1 2.2 2.6L12.5 9H19a2 2 0 0 1 2 2.3l-1.2 7A2 2 0 0 1 17.8 20H7"/></svg><svg class="down" viewBox="0 0 24 24"><path d="M7 11v9H4v-9zM7 11l4-8c1.5 0 2.5 1 2.2 2.6L12.5 9H19a2 2 0 0 1 2 2.3l-1.2 7A2 2 0 0 1 17.8 20H7"/></svg><svg viewBox="0 0 24 24"><path d="M20 12a8 8 0 1 1-2.3-5.7M20 4v5h-5"/></svg><svg viewBox="0 0 24 24"><circle cx="6" cy="12" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="18" cy="12" r="1"/></svg></div>';

  /* ---- Tijd, pauze en afbreken (zoals in snack-01.html) ---- */
  let runId = 0;
  let paused = false;
  let started = false;
  const ABORT = Symbol('abort');
  async function sleep(ms) {
    const id = runId;
    let t = 0;
    while (t < ms) {
      await new Promise((resolve) => setTimeout(resolve, 40));
      if (id !== runId) throw ABORT;
      if (!paused) t += 40;
    }
  }

  /* ---- Muis ---- */
  function pos(el, dx, dy) {
    const a = app.getBoundingClientRect();
    const r = el.getBoundingClientRect();
    const k = a.width / app.offsetWidth || 1;
    return [(r.left - a.left + r.width / 2) / k + (dx || 0), (r.top - a.top + r.height / 2) / k + (dy || 0)];
  }
  async function moveTo(el, ms, dx, dy) {
    const [x, y] = pos(el, dx, dy);
    cursor.style.transitionDuration = (ms || 900) + 'ms';
    cursor.style.transform = `translate(${x - 4}px,${y - 2}px)`;
    await sleep((ms || 900) + 80);
  }
  function park() {
    cursor.style.transitionDuration = '600ms';
    cursor.style.transform = `translate(${app.clientWidth - 60}px,${app.clientHeight - 40}px)`;
  }
  async function click(el) {
    const [x, y] = pos(el);
    const ripple = document.createElement('div');
    ripple.className = 'ripple';
    ripple.style.left = x + 'px';
    ripple.style.top = y + 'px';
    app.append(ripple);
    setTimeout(() => ripple.remove(), 600);
    await sleep(220);
  }

  /* ---- Meescrollen, behalve als iemand zelf terugscrollt ---- */
  let follow = true;
  let userIntent = 0;
  let lastActivity = 0;
  function activity() {
    userIntent = Date.now();
    if (userIntent - lastActivity > 2000) {
      lastActivity = userIntent;
      notify('activity');
    }
  }
  ['wheel', 'touchstart', 'pointerdown', 'keydown'].forEach((type) => convo.addEventListener(type, activity, { passive: true }));
  convo.addEventListener('scroll', () => {
    if (Date.now() - userIntent > 1500) return;
    follow = convo.scrollHeight - convo.scrollTop - convo.clientHeight < 60;
  });
  const scrollDown = () => {
    if (follow) convo.scrollTo({ top: convo.scrollHeight, behavior: 'smooth' });
  };

  /* ---- Invoer ---- */
  function fileChip(file, withBar) {
    const ext = (file.split('.').pop() || '').toLowerCase();
    return `<span class="file"><span class="ic ${esc(ext)}">${esc(ext.toUpperCase().slice(0, 4))}</span><b>${esc(file)}</b>${withBar ? '<span class="bar"></span>' : ''}</span>`;
  }
  function compose(inner) {
    return `<div class="compose"><div class="attach" id="attach"></div><div class="inputbox" id="ib"><span class="plus" id="plus">+</span>${inner}<div class="send" id="send"><svg viewBox="0 0 24 24"><path d="M12 4l7 7-1.4 1.4L13 7.8V20h-2V7.8l-4.6 4.6L5 11z"/></svg></div></div></div>`;
  }
  const emptyCompose = () => compose('<span class="ph">Copilot een bericht sturen</span>');

  async function attachFiles(files) {
    if (!files || !files.length) return;
    const plus = $('plus');
    await moveTo(plus, 800);
    await click(plus);
    plus.classList.add('press');
    await sleep(350);
    plus.classList.remove('press');
    const holder = $('attach');
    for (const file of files) {
      holder.insertAdjacentHTML('beforeend', fileChip(file, true));
      const chip = holder.lastElementChild;
      chip.classList.add('show');
      await sleep(60);
      chip.querySelector('.bar').style.width = '100%';
      await sleep(700);
      chip.querySelector('.bar').remove();
      chip.insertAdjacentHTML('beforeend', '<small>✓</small>');
    }
    await sleep(400);
  }

  async function enterPrompt(turn) {
    const ib = $('ib');
    await moveTo(ib, 800, -120, 0);
    await click(ib);
    ib.classList.add('focus');
    const box = ib.querySelector('.ph,.txt');
    box.className = 'txt';
    box.innerHTML = '<span class="caret"></span>';
    const text = turn.prompt;
    if (turn.paste) {
      // Geplakt uit de promptdatabase
      const [x, y] = pos(ib, -150, -40);
      const label = document.createElement('div');
      label.className = 'paste';
      label.textContent = 'Ctrl + V';
      label.style.left = x + 'px';
      label.style.top = y + 'px';
      app.append(label);
      await sleep(500);
      box.innerHTML = esc(text) + '<span class="caret"></span>';
      box.scrollTop = box.scrollHeight;
      await sleep(700);
      label.remove();
    } else {
      const [x, y] = pos(ib);
      cursor.style.transitionDuration = '500ms';
      cursor.style.transform = `translate(${x + 60}px,${y + 80}px)`;
      await sleep(450);
      let i = 0;
      while (i < text.length) {
        i += 1 + (Math.random() < 0.5 ? 1 : 0);
        box.innerHTML = esc(text.slice(0, i)) + '<span class="caret"></span>';
        box.scrollTop = box.scrollHeight;
        const c = text[i - 1];
        await sleep(c === '.' || c === ',' || c === ':' ? 130 : 20 + Math.random() * 18);
      }
    }
    await sleep(600);
    const send = $('send');
    await moveTo(send, 700);
    await click(send);
    send.classList.add('press');
    await sleep(120);
  }

  /* ---- Antwoord opbouwen ---- */
  const stream = (t) => `<p class="s" data-stream data-html="${esc(fmt(t))}"></p>`;
  function table(head, rows) {
    return `<div class="tw s"><table><thead><tr>${head.map((h) => `<th>${fmt(h)}</th>`).join('')}</tr></thead><tbody>${rows
      .map((row) => `<tr class="s">${row.map((cell) => `<td${NUMERIC.test(String(cell).trim()) ? ' class="n"' : ''}>${fmt(cell)}</td>`).join('')}</tr>`)
      .join('')}</tbody></table></div>`;
  }
  function block(b) {
    const [type, a, c] = b;
    switch (type) {
      case 'p': return a.length < 420 ? stream(a) : `<p class="s">${fmt(a)}</p>`;
      case 'h2': return `<h2 class="s">${fmt(a)}</h2>`;
      case 'h3': return `<h3 class="s">${fmt(a)}</h3>`;
      case 'ul': return `<ul>${a.map((item) => `<li class="s">${fmt(item)}</li>`).join('')}</ul>`;
      case 'ol': return `<ol>${a.map((item) => `<li class="s">${fmt(item)}</li>`).join('')}</ol>`;
      case 'table': return table(a, c);
      case 'note': return `<p class="note s">${fmt(a)}</p>`;
      case 'code': return `<div class="code s"><div class="lb"><span>${esc(a)}</span><span>Code</span></div><pre>${esc(c)}</pre></div>`;
      case 'sugg': return `<div class="sugg s">${a.map((item) => `<div>${esc(item)}</div>`).join('')}</div>`;
      default: return '';
    }
  }

  function userBubble(turn) {
    const shown = turn.prompt.length > 300 ? turn.prompt.slice(0, 280).replace(/\s+\S*$/, '') + '…' : turn.prompt;
    return `<div class="user show">${turn.files && turn.files.length ? `<div class="attach">${turn.files.map((f) => fileChip(f)).join('')}</div>` : ''}<div class="bubble">${esc(shown)}</div>${turn.prompt.length > 300 ? '<span class="more">Meer weergeven</span>' : ''}</div>`;
  }

  async function turn(t) {
    const wrap = document.createElement('div');
    const html = t.answer.map(block).join('') + ACTS + (t.suggestions ? block(['sugg', t.suggestions]) : '');
    wrap.innerHTML = `${userBubble(t)}<div class="bot"><div class="step" id="stp"><div class="nm">${SPARK}<span class="sn"></span> ›</div><div class="ds"></div></div>${html}</div>`;
    if (convo.querySelector('.hero')) convo.innerHTML = '';
    convo.append(wrap);
    dock.innerHTML = emptyCompose();
    wrap.querySelectorAll('.s').forEach((node) => node.classList.add('hid'));
    park();
    follow = true;
    scrollDown();
    const step = wrap.querySelector('#stp');
    step.removeAttribute('id');
    for (const [name, desc] of t.steps || [['Bezig met antwoord', '']]) {
      step.querySelector('.sn').textContent = name;
      step.querySelector('.ds').textContent = desc || '';
      step.querySelector('.ds').classList.toggle('hid', !desc);
      await sleep(desc ? 2300 : 1500);
    }
    const count = (t.steps || []).length + 1;
    step.outerHTML = `<div class="reason">Redeneren voltooid in ${count} stappen ›</div>`;
    for (const node of wrap.querySelectorAll('.s')) {
      node.classList.remove('hid');
      node.classList.add('show');
      if (node.dataset.stream !== undefined) {
        const full = node.dataset.html;
        const words = full.split(' ');
        for (let k = 1; k <= words.length; k += 1) {
          node.innerHTML = words.slice(0, k).join(' ');
          await sleep(30);
        }
        node.innerHTML = full;
      }
      scrollDown();
      const tag = node.tagName;
      await sleep(tag === 'TR' ? 260 : /^H/.test(tag) ? 380 : node.classList.contains('tw') ? 200 : tag === 'LI' ? 240 : 300);
    }
    return wrap;
  }

  function hero(withChips) {
    convo.innerHTML = `<div class="hero">${LOGO}<h2>${esc(demo.greeting || 'Hallo, waarmee kan ik je vandaag helpen?')}</h2>${emptyCompose()}${withChips && demo.chips ? `<div class="chips">${demo.chips.map((c) => `<div class="chip">${esc(c)}</div>`).join('')}</div>` : ''}</div>`;
  }

  async function play() {
    hero(true);
    dock.innerHTML = '';
    cursor.style.transitionDuration = '0ms';
    cursor.style.transform = `translate(${app.clientWidth - 120}px,${app.clientHeight - 60}px)`;
    await sleep(1100);
    for (let n = 0; n < demo.turns.length; n += 1) {
      const t = demo.turns[n];
      await attachFiles(t.files);
      await enterPrompt(t);
      const wrap = await turn(t);
      await sleep(900);
      // Even terug naar de eerste tabel, zodat je het resultaat kunt lezen
      const first = wrap.querySelector('table');
      if (t.review !== false && first && follow) {
        convo.scrollTo({ top: first.closest('.tw').offsetTop - 70, behavior: 'smooth' });
        await sleep(t.read || 3200);
        follow = true;
        scrollDown();
      }
      await sleep(n === demo.turns.length - 1 ? 1500 : 1800);
    }
    park();
    await sleep(EMBED ? 2500 : 3000);
    if (EMBED) {
      started = false;
      notify('ended');
      return;
    }
    const overlay = document.createElement('div');
    overlay.className = 'overlay show';
    overlay.innerHTML = `<div><h4>${esc(demo.title)}</h4><p>${esc(demo.summary || '')}</p><button type="button">↺ Opnieuw afspelen</button></div>`;
    overlay.onclick = start;
    app.append(overlay);
  }

  function start() {
    runId += 1;
    paused = false;
    started = true;
    follow = true;
    $('pause').textContent = '❚❚ Pauze';
    app.querySelectorAll('.overlay').forEach((node) => node.remove());
    notify('playing');
    play().catch((error) => {
      if (error !== ABORT) console.error(error);
    });
  }
  function setPaused(value) {
    paused = value;
    $('pause').textContent = paused ? '▶ Verder' : '❚❚ Pauze';
    notify(paused ? 'paused' : 'playing');
  }

  function intro() {
    if (!demo) {
      convo.innerHTML = `<div class="hero"><h2>Deze demo bestaat (nog) niet</h2><p>${esc(demoId || 'geen naam')}</p></div>`;
      return;
    }
    document.title = demo.title + ' · Copilot-demo (fictief)';
    $('mode').innerHTML = demo.mode ? esc(demo.mode) : 'Copilot Chat';
    if (demo.url) $('url').textContent = demo.url;
    hero(false);
    if (EMBED) {
      park();
      notify('ready');
      return;
    }
    const overlay = document.createElement('div');
    overlay.className = 'overlay';
    overlay.innerHTML = `<div><h4>Demo: ${esc(demo.title)}</h4><p>${esc(demo.summary || '')} Klik of druk op spatie om te starten.</p><button type="button">▶ Start demo</button></div>`;
    overlay.onclick = start;
    app.append(overlay);
  }

  /* Bediening vanuit het platform */
  window.addEventListener('message', (event) => {
    if (!EMBED || event.source !== window.parent) return;
    const data = event.data;
    if (!data || data.source !== 'ai-snackbar' || !demo) return;
    if (data.command === 'play') {
      if (!started) start();
      else if (paused) setPaused(false);
      else notify('playing');
    }
    if (data.command === 'pause' && started && !paused) setPaused(true);
    if (data.command === 'restart') start();
  });

  /* Los geopend: eigen knoppen en sneltoetsen */
  $('pause').onclick = () => {
    if (started) setPaused(!paused);
  };
  $('restart').onclick = () => demo && start();
  $('fs').onclick = () => {
    if (document.fullscreenElement) document.exitFullscreen();
    else if (document.documentElement.requestFullscreen) document.documentElement.requestFullscreen();
  };
  if (!EMBED) {
    document.addEventListener('keydown', (event) => {
      if (!demo) return;
      if (event.target.tagName === 'BUTTON' && (event.key === ' ' || event.key === 'Enter')) return;
      if (event.key === ' ') {
        event.preventDefault();
        if (app.querySelector('.overlay')) start();
        else $('pause').click();
      }
      if (event.key.toLowerCase() === 'r') start();
      if (event.key.toLowerCase() === 'f') $('fs').click();
    });
  }
  intro();
})();
