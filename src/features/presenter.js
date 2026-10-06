// src/features/presenter.js
import { el, icon, ICONS } from '../lib/dom.js';
import { getPdf } from '../lib/pdf-store.js';
import { getDeck } from '../lib/pdf-store.js';
import { openPdf, renderPage } from '../lib/pdf-renderer.js';
import { sendMessage, onMessage } from '../lib/present-bus.js';

const PRELOAD_AHEAD = 2;

export async function renderPresenter(root, deckId) {
  document.body.style.background = '#000';
  document.body.style.margin = '0';
  document.body.style.overflow = 'hidden';

  const deck = await getDeck(deckId);
  if (!deck) {
    root.appendChild(el('div', { style: { color: '#fff', padding: '40px', fontFamily: 'system-ui' } },
      `Deck not found: ${deckId}`));
    return;
  }

  const state = {
    items: deck.items || [],
    index: 0,
    fit: 'fit-page',
    zoom: 1,
    blank: false,
    whiteout: false,
    showCounter: true,
    docCache: new Map(),   // pdfId → pdf.js document
    pageCache: new Map(),  // `${pdfId}:${page}` → pdf.js page
    renderedCache: new Map() // `${pdfId}:${page}` → ImageBitmap (optional)
  };

  const stage = el('div', { id: 'presenter-stage', style: {
    position: 'fixed', inset: '0',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    background: '#000', overflow: 'hidden', cursor: 'none'
  }});

  const canvas = el('canvas', { id: 'presenter-canvas', style: { display: 'block', background: '#000' } });
  stage.appendChild(canvas);

  const counter = el('div', { id: 'presenter-counter', style: {
    position: 'fixed', bottom: '16px', right: '24px',
    color: 'rgba(255,255,255,0.7)', fontFamily: 'system-ui', fontSize: '14px',
    background: 'rgba(0,0,0,0.5)', padding: '6px 12px', borderRadius: '8px',
    pointerEvents: 'none', userSelect: 'none'
  }}, '1 / 1');

  const progress = el('div', { id: 'presenter-progress', style: {
    position: 'fixed', bottom: '0', left: '0', height: '3px',
    background: '#c9a227', transition: 'width 200ms', width: '0%',
    pointerEvents: 'none'
  }});

  const hint = el('div', { id: 'presenter-hint', style: {
    position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%,-50%)',
    color: 'rgba(255,255,255,0.35)', fontFamily: 'system-ui', fontSize: '16px',
    pointerEvents: 'none', textAlign: 'center', opacity: '0', transition: 'opacity 300ms'
  }});

  root.appendChild(stage);
  root.appendChild(counter);
  root.appendChild(progress);
  root.appendChild(hint);

  /* ---------- Rendering ---------- */

  async function getDoc(pdfId) {
    if (state.docCache.has(pdfId)) return state.docCache.get(pdfId);
    const pdf = await getPdf(pdfId);
    if (!pdf) throw new Error('PDF not found: ' + pdfId);
    const doc = await openPdf(pdf.data);
    state.docCache.set(pdfId, doc);
    return doc;
  }

  async function getPage(pdfId, pageNum) {
    const key = `${pdfId}:${pageNum}`;
    if (state.pageCache.has(key)) return state.pageCache.get(key);
    const doc = await getDoc(pdfId);
    const page = await doc.getPage(pageNum);
    state.pageCache.set(key, page);
    return page;
  }

  async function renderCurrent() {
    const item = state.items[state.index];
    if (!item) return;

    if (item.kind === 'pdf') {
      try {
        const page = await getPage(item.pdfId, item.page);
        const rect = stage.getBoundingClientRect();
        await renderPage({
          page, canvas,
          containerWidth: rect.width,
          containerHeight: rect.height,
          fit: state.fit,
          zoom: state.zoom
        });
      } catch (e) {
        showHint(`Cannot render page: ${e.message}`);
      }
    } else if (item.kind === 'announce') {
      // Render announcement directly into the canvas as text
      const rect = stage.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
      canvas.style.width = rect.width + 'px';
      canvas.style.height = rect.height + 'px';
      const ctx = canvas.getContext('2d');
      const grad = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
      grad.addColorStop(0, '#1a1a2e');
      grad.addColorStop(1, '#c9a227');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = '#fff';
      ctx.textAlign = 'center';
      ctx.font = `bold ${Math.round(rect.width * 0.055)}px system-ui, sans-serif`;
      ctx.fillText(item.title || '', canvas.width / 2, canvas.height * 0.42);
      ctx.font = `${Math.round(rect.width * 0.03)}px system-ui, sans-serif`;
      wrapText(ctx, item.message || '', canvas.width / 2, canvas.height * 0.52, rect.width * 0.8, rect.width * 0.04);
    }

    counter.textContent = `${state.index + 1} / ${state.items.length}`;
    progress.style.width = `${((state.index + 1) / state.items.length) * 100}%`;
    counter.style.opacity = state.showCounter ? '1' : '0';
    progress.style.opacity = state.showCounter ? '1' : '0';

    // Broadcast
    sendMessage({ type: 'deck:index', index: state.index, total: state.items.length });

    // Preload next pages
    preloadAhead();
  }

  async function preloadAhead() {
    for (let i = 1; i <= PRELOAD_AHEAD; i++) {
      const next = state.items[state.index + i];
      if (!next || next.kind !== 'pdf') continue;
      try {
        await getPage(next.pdfId, next.page);
      } catch { /* ignore */ }
    }
  }

  function wrapText(ctx, text, x, y, maxWidth, lineHeight) {
    const words = text.split(' ');
    let line = '';
    for (const word of words) {
      const test = line + word + ' ';
      if (ctx.measureText(test).width > maxWidth && line) {
        ctx.fillText(line.trim(), x, y);
        line = word + ' ';
        y += lineHeight;
      } else {
        line = test;
      }
    }
    if (line.trim()) ctx.fillText(line.trim(), x, y);
  }

  let hintTimer;
  function showHint(text, ms = 1800) {
    hint.textContent = text;
    hint.style.opacity = '1';
    clearTimeout(hintTimer);
    hintTimer = setTimeout(() => { hint.style.opacity = '0'; }, ms);
  }

  /* ---------- Navigation ---------- */

  function go(delta) {
    const next = state.index + delta;
    if (next < 0 || next >= state.items.length) return;
    state.index = next;
    renderCurrent();
  }

  function goTo(i) {
    if (i < 0 || i >= state.items.length) return;
    state.index = i;
    renderCurrent();
  }

  /* ---------- Blank / whiteout ---------- */

  function toggleBlank() {
    state.blank = !state.blank;
    state.whiteout = false;
    stage.style.background = state.blank ? '#000' : '#000';
    canvas.style.opacity = state.blank ? '0' : '1';
    showHint(state.blank ? 'Blank' : '');
    sendMessage({ type: 'deck:blank', blank: state.blank });
  }

  function toggleWhiteout() {
    state.whiteout = !state.whiteout;
    state.blank = false;
    stage.style.background = state.whiteout ? '#fff' : '#000';
    canvas.style.opacity = state.whiteout ? '0' : '1';
    showHint(state.whiteout ? 'Whiteout' : '');
    sendMessage({ type: 'deck:whiteout', whiteout: state.whiteout });
  }

  /* ---------- Fullscreen ---------- */

  async function enterFullscreen() {
    try {
      await document.documentElement.requestFullscreen();
    } catch { /* ignore */ }
  }

  async function toggleFullscreen() {
    if (!document.fullscreenElement) await enterFullscreen();
    else await document.exitFullscreen();
  }

  /* ---------- Laser pointer ---------- */

  const laser = el('div', { style: {
    position: 'fixed', width: '14px', height: '14px', borderRadius: '50%',
    background: 'rgba(255, 60, 60, 0.9)', boxShadow: '0 0 20px 6px rgba(255,60,60,0.5)',
    pointerEvents: 'none', transform: 'translate(-50%,-50%)', display: 'none', zIndex: '9999'
  }});
  root.appendChild(laser);

  window.addEventListener('mousemove', (e) => {
    if (e.ctrlKey || e.metaKey) {
      laser.style.display = 'block';
      laser.style.left = e.clientX + 'px';
      laser.style.top = e.clientY + 'px';
      stage.style.cursor = 'none';
    } else {
      laser.style.display = 'none';
      stage.style.cursor = 'none';
    }
  });

  /* ---------- Keyboard ---------- */

  function onKey(e) {
    if (e.target.matches('input, textarea, select')) return;
    switch (e.key) {
      case 'ArrowRight': case ' ': case 'PageDown': e.preventDefault(); go(1); break;
      case 'ArrowLeft': case 'PageUp': e.preventDefault(); go(-1); break;
      case 'Home': goTo(0); break;
      case 'End': goTo(state.items.length - 1); break;
      case 'b': case 'B': toggleBlank(); break;
      case 'w': case 'W': toggleWhiteout(); break;
      case 'f': case 'F': toggleFullscreen(); break;
      case 'c': case 'C': state.showCounter = !state.showCounter; renderCurrent(); break;
      case 'Escape': if (document.fullscreenElement) document.exitFullscreen(); break;
      default:
        if (/^[1-9]$/.test(e.key)) {
          const n = parseInt(e.key, 10);
          goTo(n - 1);
        }
    }
  }
  window.addEventListener('keydown', onKey);

  /* ---------- Messages from presenter view ---------- */

  const off = onMessage((msg) => {
    if (!msg) return;
    if (msg.type === 'deck:go') go(msg.delta);
    else if (msg.type === 'deck:goto') goTo(msg.index);
    else if (msg.type === 'deck:blank') toggleBlank();
    else if (msg.type === 'deck:whiteout') toggleWhiteout();
    else if (msg.type === 'deck:fit') { state.fit = msg.fit; state.zoom = msg.zoom ?? state.zoom; renderCurrent(); }
  });

  /* ---------- Resize ---------- */

  const onResize = () => renderCurrent();
  window.addEventListener('resize', onResize);

  /* ---------- Boot ---------- */

  // Try to go fullscreen on first user gesture (browser policy requires a gesture)
  const armFullscreen = () => {
    enterFullscreen();
    window.removeEventListener('click', armFullscreen);
    window.removeEventListener('keydown', armFullscreen);
  };
  window.addEventListener('click', armFullscreen, { once: true });
  window.addEventListener('keydown', armFullscreen, { once: true });

  await renderCurrent();
  showHint('Press F for fullscreen · ← → to navigate · B to blank · W for whiteout', 4000);

  return () => {
    off?.();
    window.removeEventListener('keydown', onKey);
    window.removeEventListener('resize', onResize);
  };
}