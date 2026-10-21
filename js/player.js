/* ==========================================================================
   Demospeler
   --------------------------------------------------------------------------
     video   Opgenomen demo (MP4) met de gewone videobediening.
     demo    HTML-demo in een afgeschermd iframe (sandbox, geen toegang tot
             deze pagina of de opslag). Bediening via postMessage, hetzelfde
             protocol als de AI Snackbar:
               demo -> pagina : { source: 'ai-snackbar-demo', event: 'ready' | 'playing' | 'paused' | 'ended' | 'activity' }
               pagina -> demo : { source: 'ai-snackbar', command: 'play' | 'pause' | 'restart' }
     geen    Nette plaats met 'Demo volgt'.
   ========================================================================== */
(function (ns) {
  'use strict';

  const { el, icon, setIcon } = ns.ui;
  const READY_TIMEOUT = 9000;

  function placeholder(title, text) {
    return el('div', { className: 'player__placeholder' }, [
      el('span', { className: 'player__placeholder-icon', attrs: { 'aria-hidden': 'true' } }, [icon('film')]),
      el('p', { className: 'player__placeholder-title', text: title }),
      el('p', { className: 'player__placeholder-text', text })
    ]);
  }

  /** Eigen demo's (demos/player.html) volgen het gekozen thema: ?theme=dark of light vóór de #. */
  function themedSrc(src) {
    if (!/demos\/player\.html/.test(src)) return src;
    const theme = document.documentElement.dataset.theme === 'donker' ? 'dark' : 'light';
    const [path, hash] = src.split('#');
    return path + (path.includes('?') ? '&' : '?') + 'theme=' + theme + (hash ? '#' + hash : '');
  }

  function fullscreenButton(target) {
    if (!document.fullscreenEnabled || !target.requestFullscreen) return null;
    const btn = el('button', { className: 'btn btn--secondary btn--sm', attrs: { type: 'button' } }, [icon('fullscreen'), el('span', { text: 'Volledig scherm' })]);
    btn.addEventListener('click', () => {
      if (document.fullscreenElement) document.exitFullscreen();
      else target.requestFullscreen().catch(() => {});
    });
    return btn;
  }

  /**
   * @param {object} usecase  Genormaliseerde usecase of training (js/content.js): id, title, accent, video/demo
   * @param {object} options  trackKind (standaard 'play_demo'), note (tekst onder een video), poster
   * @returns {{ node: HTMLElement, destroy: Function, video: HTMLVideoElement|null }}
   */
  function create(usecase, options) {
    const opts = options || {};
    const root = el('div', { className: 'player ' + ns.ui.accentClass(usecase.accent) });
    const stage = el('div', { className: 'player__stage' });
    const bar = el('div', { className: 'player__bar' });
    root.append(stage, bar);
    let cleanup = () => {};
    let tracked = false;
    let videoNode = null;
    function trackPlay() {
      if (tracked) return;
      tracked = true;
      ns.central.track(opts.trackKind || 'play_demo', usecase.id);
    }

    if (usecase.video) {
      // ---- Opgenomen video ----
      stage.classList.add('player__stage--video');
      const video = el('video', {
        className: 'player__video',
        attrs: { src: usecase.video, poster: opts.poster || null, controls: true, preload: 'metadata', playsinline: true, 'aria-label': (opts.trackKind === 'play_training' ? 'Opname: ' : 'Demo: ') + usecase.title }
      });
      video.addEventListener('play', trackPlay);
      video.addEventListener('error', () => {
        stage.replaceChildren(opts.trackKind === 'play_training'
          ? placeholder('Opname niet gevonden', 'Het videobestand ontbreekt of kon niet laden. Laat het weten via de ideeënhub.')
          : placeholder('Demo volgt', 'De opname van deze demo wordt binnenkort toegevoegd. De prompts hiernaast kun je nu al gebruiken.'));
        bar.hidden = true;
      }, { once: true });
      stage.append(video);
      videoNode = video;
      bar.append(el('p', { className: 'player__note' }, [icon('info'), el('span', { text: opts.note || 'Opgenomen demo met fictieve gegevens' })]));
      cleanup = () => video.pause();
    } else if (usecase.demo) {
      // ---- HTML-demo ----
      stage.classList.add('player__stage--demo');
      const frame = el('iframe', {
        className: 'player__frame',
        attrs: { src: themedSrc(usecase.demo), title: 'Demo: ' + usecase.title, sandbox: 'allow-scripts', referrerpolicy: 'no-referrer', loading: 'eager' }
      });
      const overlay = el('button', { className: 'player__overlay', attrs: { type: 'button', disabled: true } }, [
        el('span', { className: 'player__overlay-play', attrs: { 'aria-hidden': 'true' } }, [icon('play')]),
        el('span', { className: 'player__overlay-label', text: 'Bekijk de demo' }),
        usecase.duration ? el('span', { className: 'player__overlay-meta', text: usecase.duration }) : null
      ]);
      stage.append(frame, overlay);

      const toggle = el('button', { className: 'btn btn--primary btn--sm', attrs: { type: 'button', disabled: true } }, [icon('play'), el('span', { text: 'Afspelen' })]);
      const restart = el('button', { className: 'btn btn--secondary btn--sm', attrs: { type: 'button', disabled: true } }, [icon('replay'), el('span', { text: 'Opnieuw' })]);
      bar.append(toggle, restart, fullscreenButton(stage), el('p', { className: 'player__note' }, [icon('info'), el('span', { text: 'Nagespeelde demo met fictieve gegevens' })]));

      let state = 'loading';
      function send(command) {
        if (frame.contentWindow) frame.contentWindow.postMessage({ source: 'ai-snackbar', command }, '*');
      }
      function setState(next) {
        state = next;
        const playing = next === 'playing';
        setIcon(toggle.querySelector('svg'), playing ? 'pause' : 'play');
        toggle.querySelector('span').textContent = playing ? 'Pauze' : next === 'paused' ? 'Verder' : 'Afspelen';
        overlay.hidden = playing || next === 'paused';
        overlay.querySelector('.player__overlay-label').textContent = next === 'ended' ? 'Opnieuw bekijken' : 'Bekijk de demo';
        root.dataset.state = next;
      }
      function onMessage(event) {
        if (event.source !== frame.contentWindow) return;
        const data = event.data;
        if (!data || data.source !== 'ai-snackbar-demo') return;
        if (data.event === 'ready' && state === 'loading') {
          window.clearTimeout(readyTimer);
          [overlay, toggle, restart].forEach((node) => {
            node.disabled = false;
          });
          setState('ready');
        } else if (data.event === 'playing') {
          trackPlay();
          setState('playing');
        } else if (data.event === 'paused') {
          setState('paused');
        } else if (data.event === 'ended') {
          setState('ended');
        }
      }
      window.addEventListener('message', onMessage);
      const readyTimer = window.setTimeout(() => {
        if (state !== 'loading') return;
        stage.replaceChildren(placeholder('Demo kon niet laden', 'Herlaad de pagina en probeer het opnieuw. De prompts hiernaast kun je gewoon gebruiken.'));
        bar.hidden = true;
      }, READY_TIMEOUT);

      overlay.addEventListener('click', () => send(state === 'ended' ? 'restart' : 'play'));
      toggle.addEventListener('click', () => {
        if (state === 'playing') send('pause');
        else if (state === 'ended') send('restart');
        else send('play');
      });
      restart.addEventListener('click', () => send('restart'));
      setState('loading');
      cleanup = () => {
        window.clearTimeout(readyTimer);
        window.removeEventListener('message', onMessage);
        send('pause');
      };
    } else {
      stage.append(placeholder('Demo volgt', 'Deze demo wordt binnenkort opgenomen. De prompts hiernaast kun je nu al gebruiken.'));
      bar.hidden = true;
    }

    return { node: root, destroy: () => cleanup(), video: videoNode };
  }

  ns.player = { create };
})(window.AIAudit);
