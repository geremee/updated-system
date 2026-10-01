import { el, icon, ICONS } from '../lib/dom.js';
import { getState, setState, persistAppState, savePrefs } from '../state/store.js';
import { toast } from '../lib/toast.js';
import { FONTS } from '../lib/constants.js';
import { navigate } from '../router.js';
import { registerPresentationWindow, postToPresentation, isPresentationOpen } from '../lib/presentation-bus.js';
import { openModalCount, openModal } from '../components/modal.js';

export function renderStudio(main) {
  const state = getState();
  if (!state.selectedSongs.length) {
    main.appendChild(el('div', { class: 'page-header' },
      el('div', {}, el('h1', {}, 'Worship Studio')),
    ));
    main.appendChild(el('div', { class: 'empty' },
      icon(ICONS.studio, 48),
      el('h3', {}, 'No songs in your setlist'),
      el('p', {}, 'Add songs in the Setlist Builder before opening the studio.'),
      el('button', { class: 'btn btn-primary', onclick: () => navigate('setlist') }, icon(ICONS.setlist), 'Go to Setlist Builder')
    ));
    return;
  }

  const studio = el('div', { class: 'studio' });
  main.appendChild(studio);

  const queueCol = el('div', { class: 'card studio-queue' });
  studio.appendChild(queueCol);

  const queueHeader = el('div', { class: 'card-header' },
    el('div', {},
      el('div', { class: 'card-title' }, 'Song queue'),
      el('div', { class: 'card-subtitle' }, `${state.selectedSongs.length} song${state.selectedSongs.length === 1 ? '' : 's'}`)
    ),
    el('button', { class: 'btn btn-ghost btn-sm', onclick: () => navigate('setlist') }, 'Edit')
  );
  queueCol.appendChild(queueHeader);

  const queueScroll = el('div', { class: 'queue-scroll', id: 'studio-queue-list' });
  queueCol.appendChild(queueScroll);

  const partsHeader = el('div', { class: 'card-title', style: { marginTop: 'var(--space-4)', fontSize: 'var(--text-sm)' } }, 'Parts');
  queueCol.appendChild(partsHeader);
  const partsScroll = el('div', { class: 'queue-scroll', id: 'studio-parts-list', style: { flex: '0 0 auto', maxHeight: '220px' } });
  queueCol.appendChild(partsScroll);

  const previewCol = el('div', { class: 'studio-preview' });
  studio.appendChild(previewCol);

  const preview = el('div', { class: 'live-preview', id: 'studio-preview', 'aria-live': 'polite' });
  previewCol.appendChild(preview);

  const director = el('div', { class: 'card studio-director' });
  previewCol.appendChild(director);

  function renderQueue() {
    queueScroll.innerHTML = '';
    const s = getState();
    s.selectedSongs.forEach((song, i) => {
      const isCurrent = song.id === s.currentSongId;
      queueScroll.appendChild(el('div', {
        class: `song-row ${isCurrent ? 'selected' : ''}`,
        role: 'button',
        tabindex: '0',
        onclick: () => selectSong(song),
        onkeydown: (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); selectSong(song); } }
      },
        el('span', { class: 'num', style: { width: '22px', height: '22px', borderRadius: '6px', background: 'var(--brand-subtle)', color: 'var(--brand)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 'var(--text-xs)', fontWeight: 700 } }, String(i + 1)),
        el('div', { class: 'grow' },
          el('div', { class: 'title' }, song.title),
          el('div', { class: 'artist' }, song.artist || '')
        )
      ));
    });
  }

  function renderParts() {
    partsScroll.innerHTML = '';
    const s = getState();
    const song = s.selectedSongs.find((x) => x.id === s.currentSongId);
    if (!song) {
      partsScroll.appendChild(el('p', { style: { color: 'var(--text-muted)', fontSize: 'var(--text-xs)', padding: 'var(--space-2)' } }, 'Select a song to see its parts.'));
      return;
    }
    const partNames = Object.keys(song.parts || {});
    if (!partNames.length) {
      partsScroll.appendChild(el('p', { style: { color: 'var(--text-muted)', fontSize: 'var(--text-xs)', padding: 'var(--space-2)' } }, 'No parts for this song.'));
      return;
    }
    partNames.forEach((name) => {
      const isCurrent = name === s.currentPart;
      partsScroll.appendChild(el('div', {
        class: `part-item ${isCurrent ? 'active' : ''}`,
        role: 'button',
        tabindex: '0',
        onclick: () => selectPart(name),
        onkeydown: (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); selectPart(name); } }
      },
        el('span', { class: 'status' }),
        el('span', {}, name)
      ));
    });
  }

  function renderPreview() {
    preview.innerHTML = '';
    const s = getState();
    const song = s.selectedSongs.find((x) => x.id === s.currentSongId);
    if (!song || !s.currentPart) {
      preview.appendChild(el('div', { class: 'preview-placeholder' }, 'Select a song and part to preview lyrics'));
      return;
    }
    const lyrics = song.parts?.[s.currentPart] || '';
    if (!lyrics.trim()) {
      preview.appendChild(el('div', { class: 'preview-placeholder' }, `(No lyrics for ${s.currentPart})`));
    } else {
      const node = el('div', { class: 'lyrics' });
      node.textContent = lyrics;
      preview.appendChild(node);
    }
  }

  function renderDirector() {
    director.innerHTML = '';
    const s = getState();
    const liveOpen = isPresentationOpen();

    const prevBtn = el('button', { class: 'btn btn-secondary', onclick: () => navigatePart(-1), title: 'Previous part (←)' }, icon(ICONS.chevronL), 'Prev');
    const nextBtn = el('button', { class: 'btn btn-secondary', onclick: () => navigatePart(1), title: 'Next part (→)' }, 'Next', icon(ICONS.chevronR));

    const liveBtn = el('button', {
      class: `btn ${liveOpen ? 'btn-primary' : 'btn-secondary'}`,
      onclick: () => openPresentation()
    }, icon(ICONS.monitor), liveOpen ? 'Live screen open' : 'Open live screen');

    const blankBtn = el('button', {
      class: 'btn btn-secondary',
      title: 'Blank the live screen (B)',
      onclick: () => {
        if (isPresentationOpen()) {
          postToPresentation({ type: 'blank' });
          toast('Live screen blanked', 'info');
        } else {
          toast('Open the live screen first', 'warning');
        }
      }
    }, icon(ICONS.blank), 'Blank');

    const fontBtn = el('button', { class: 'btn btn-secondary', onclick: () => openFontPopover() }, icon(ICONS.settings), 'Font');

    const info = el('div', { style: { display: 'flex', gap: 'var(--space-3)', fontSize: 'var(--text-xs)', color: 'var(--text-muted)', marginLeft: 'auto' } },
      el('span', {}, `Song: `, el('strong', { style: { color: 'var(--text-primary)' } }, s.selectedSongs.find((x) => x.id === s.currentSongId)?.title || '—')),
      el('span', {}, `Part: `, el('strong', { style: { color: 'var(--text-primary)' } }, s.currentPart || '—'))
    );

    director.appendChild(prevBtn);
    director.appendChild(nextBtn);
    director.appendChild(liveBtn);
    director.appendChild(blankBtn);
    director.appendChild(fontBtn);
    director.appendChild(info);
  }

  function selectSong(song) {
    setState({ currentSongId: song.id, currentPart: null });
    persistAppState();
    renderQueue();
    renderParts();
    renderPreview();
    renderDirector();
    sendPresentationUpdate();
  }

  function selectPart(name) {
    setState({ currentPart: name });
    persistAppState();
    renderParts();
    renderPreview();
    renderDirector();
    sendPresentationUpdate();
  }

  function navigatePart(delta) {
    const s = getState();
    const song = s.selectedSongs.find((x) => x.id === s.currentSongId);
    if (!song) { toast('Select a song first', 'warning'); return; }
    const parts = Object.keys(song.parts || {});
    if (!parts.length) return;
    const idx = parts.indexOf(s.currentPart);
    const next = idx + delta;
    if (next < 0 || next >= parts.length) { toast(delta > 0 ? 'End of song' : 'Start of song', 'info'); return; }
    selectPart(parts[next]);
  }

  function openPresentation() {
    if (isPresentationOpen()) {
      const win = window.open('', 'SanctuaryView');
      win?.focus();
      return;
    }
    const w = 1100, h = 700;
    const left = (screen.width - w) / 2;
    const top = (screen.height - h) / 2;
    const win = window.open('', 'SanctuaryView', `width=${w},height=${h},left=${left},top=${top},resizable=yes`);
    if (!win) { toast('Popup blocked. Please allow popups for this site.', 'error'); return; }

    registerPresentationWindow(win);

    const prefs = getState().prefs;
    const html = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8" />
<title>JFCM · Live</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  html, body { width: 100%; height: 100%; background: #0a0a0a; overflow: hidden; }
  body { display: flex; align-items: center; justify-content: center; position: relative; font-family: '${prefs.fontFamily}', Georgia, serif; }
  body::before {
    content: ''; position: absolute; inset: 0;
    background: url('/images/jfcmlogo.webp') center / 380px no-repeat;
    opacity: 0.05; pointer-events: none;
  }
  #content {
    position: relative; z-index: 1;
    width: 100%; max-width: 100%;
    padding: 40px 60px;
    color: #fff;
    text-align: center;
    font-size: ${prefs.presentationFontSize}rem;
    line-height: 1.7;
    letter-spacing: 1px;
    text-shadow: 2px 2px 8px rgba(0,0,0,0.55);
    white-space: pre-wrap;
    animation: fade 0.6s ease;
  }
  #content.blank { opacity: 0; }
  @keyframes fade { from { opacity: 0.4; transform: scale(0.985); } to { opacity: 1; transform: none; } }
</style>
</head>
<body><div id="content"></div>
<script>
  window.addEventListener('message', (e) => {
    if (e.origin !== window.location.origin) return;
    const msg = e.data || {};
    const c = document.getElementById('content');
    if (msg.type === 'content') {
      c.textContent = msg.text || '';
      c.style.background = '';
      c.style.color = '#fff';
      c.style.fontFamily = "'" + (msg.fontFamily || 'Cinzel') + "', Georgia, serif";
      c.style.fontSize = (msg.fontSize || 3.2) + 'rem';
      c.classList.remove('blank');
      c.style.animation = 'none'; c.offsetHeight; c.style.animation = '';
    } else if (msg.type === 'blank') {
      c.classList.add('blank');
    } else if (msg.type === 'announcement') {
      const lines = [msg.title, '', msg.message];
      if (msg.subtitle) { lines.push('', msg.subtitle); }
      c.textContent = lines.join('\\n');
      c.style.color = msg.textColor || '#fff';
      c.style.fontFamily = "'Arial', sans-serif";
      c.style.fontSize = '3.2rem';
      if (msg.bgImage) {
        c.style.background = "url('" + msg.bgImage + "') center/cover no-repeat";
      } else if (msg.gradient) {
        c.style.background = msg.gradient;
      } else {
        c.style.background = '';
      }
      c.classList.remove('blank');
      c.style.animation = 'none'; c.offsetHeight; c.style.animation = '';
    }
  });
<\/script>
</body>
</html>`;
    win.document.write(html);
    win.document.close();
    win.focus();
    setTimeout(() => sendPresentationUpdate(), 300);
    renderDirector();
    toast('Live screen opened', 'success');
  }

  function sendPresentationUpdate() {
    if (!isPresentationOpen()) return;
    const s = getState();
    const song = s.selectedSongs.find((x) => x.id === s.currentSongId);
    const lyrics = song && s.currentPart ? (song.parts?.[s.currentPart] || '') : '';
    const prefs = s.prefs;
    postToPresentation({
      type: 'content',
      text: lyrics,
      fontFamily: prefs.fontFamily,
      fontSize: prefs.presentationFontSize
    });
  }

  function openFontPopover() {
    const prefs = getState().prefs;

    const sizeLabel = el('label', {}, `Live font size (${prefs.presentationFontSize.toFixed(1)}rem)`);

    const fontSel = el('select', {
      class: 'select',
      onchange: (e) => { savePrefs({ fontFamily: e.target.value }); sendPresentationUpdate(); }
    });
    FONTS.forEach((f) => fontSel.appendChild(el('option', { value: f, selected: f === prefs.fontFamily }, f)));

    const sizeRange = el('input', {
      type: 'range', min: '1.5', max: '6', step: '0.1',
      value: String(prefs.presentationFontSize),
      oninput: (e) => {
        const v = parseFloat(e.target.value);
        savePrefs({ presentationFontSize: v });
        sizeLabel.textContent = `Live font size (${v.toFixed(1)}rem)`;
        sendPresentationUpdate();
      }
    });

    const body = el('div', {},
      el('div', { class: 'field' }, el('label', {}, 'Font family'), fontSel),
      el('div', { class: 'field' }, sizeLabel, sizeRange),
      el('p', { style: { fontSize: 'var(--text-xs)', color: 'var(--text-muted)' } }, 'Changes apply instantly to the live screen.')
    );

    openModal({ title: 'Presentation font', body });
  }

  const onKey = (e) => {
    if (e.target.matches('input, textarea, select')) return;
    if (openModalCount() > 0) return;
    if (e.key === 'ArrowRight' || e.key === ' ') { e.preventDefault(); navigatePart(1); }
    else if (e.key === 'ArrowLeft') { e.preventDefault(); navigatePart(-1); }
    else if (e.key === 'b' || e.key === 'B') {
      if (isPresentationOpen()) { postToPresentation({ type: 'blank' }); toast('Blanked', 'info'); }
    }
  };
  document.addEventListener('keydown', onKey);

  if (!state.currentSongId && state.selectedSongs[0]) {
    setState({ currentSongId: state.selectedSongs[0].id });
  }
  renderQueue();
  renderParts();
  renderPreview();
  renderDirector();

  return () => document.removeEventListener('keydown', onKey);
}