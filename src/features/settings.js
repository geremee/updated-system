import { el, icon, ICONS } from '../lib/dom.js';
import { getState, savePrefs, setTheme } from '../state/store.js';
import { FONTS, STORAGE_KEYS } from '../lib/constants.js';
import { store } from '../lib/storage.js';
import { toast } from '../lib/toast.js';
import { confirmDialog } from '../components/confirm.js';

export function renderSettings(main) {
  const state = getState();

  main.appendChild(el('div', { class: 'page-header' },
    el('div', {},
      el('h1', {}, 'Settings'),
      el('p', { class: 'subtitle' }, 'Personalize your workspace.')
    )
  ));

  const appearance = el('div', { class: 'card', style: { marginBottom: 'var(--space-4)' } },
    el('div', { class: 'card-header' }, el('div', { class: 'card-title' }, 'Appearance'))
  );

  /* Theme toggle */
  const themeSwitch = el('button', {
    class: 'switch', role: 'switch', type: 'button',
    'aria-checked': state.theme === 'dark' ? 'true' : 'false',
    onclick: () => {
      const next = getState().theme === 'dark' ? 'light' : 'dark';
      setTheme(next);
      themeSwitch.setAttribute('aria-checked', next === 'dark' ? 'true' : 'false');
    }
  });
  appearance.appendChild(el('div', { class: 'settings-row' },
    el('div', { class: 'info' }, el('strong', {}, 'Dark mode'), el('span', {}, 'Use a dark color scheme across the app')),
    themeSwitch
  ));
  main.appendChild(appearance);

  /* Presentation */
  const pres = el('div', { class: 'card', style: { marginBottom: 'var(--space-4)' } },
    el('div', { class: 'card-header' }, el('div', { class: 'card-title' }, 'Presentation'))
  );

  const fontSelect = el('select', { class: 'select', onchange: (e) => { savePrefs({ fontFamily: e.target.value }); toast('Font updated', 'success'); } });
  FONTS.forEach((f) => fontSelect.appendChild(el('option', { value: f, selected: f === state.prefs.fontFamily }, f)));
  pres.appendChild(el('div', { class: 'settings-row' },
    el('div', { class: 'info' }, el('strong', {}, 'Default font family'), el('span', {}, 'Used for lyrics on the live screen')),
    el('div', { style: { width: '200px' } }, fontSelect)
  ));

  const sizeRange = el('input', {
    type: 'range', min: '1.5', max: '6', step: '0.1',
    value: String(state.prefs.presentationFontSize),
    oninput: (e) => {
      const v = parseFloat(e.target.value);
      savePrefs({ presentationFontSize: v });
      sizeLabel.textContent = `${v.toFixed(1)}rem`;
    }
  });
  const sizeLabel = el('span', { style: { fontSize: 'var(--text-xs)', color: 'var(--text-muted)', minWidth: '48px', textAlign: 'right' } }, `${state.prefs.presentationFontSize.toFixed(1)}rem`);
  pres.appendChild(el('div', { class: 'settings-row' },
    el('div', { class: 'info' }, el('strong', {}, 'Default font size'), el('span', {}, 'Applied when the live screen opens')),
    el('div', { style: { display: 'flex', alignItems: 'center', gap: 'var(--space-2)', width: '260px' } }, sizeRange, sizeLabel)
  ));
  main.appendChild(pres);

  /* Data */
  const data = el('div', { class: 'card', style: { marginBottom: 'var(--space-4)' } },
    el('div', { class: 'card-header' }, el('div', { class: 'card-title' }, 'Data'))
  );

  data.appendChild(el('div', { class: 'settings-row' },
    el('div', { class: 'info' }, el('strong', {}, 'Export library'), el('span', {}, 'Download all songs as JSON')),
    el('button', { class: 'btn btn-secondary btn-sm', onclick: exportLibrary }, icon(ICONS.upload, 14), 'Export')
  ));

  data.appendChild(el('div', { class: 'settings-row' },
    el('div', { class: 'info' }, el('strong', {}, 'Clear local data'), el('span', {}, 'Removes theme, setlist, announcements, PDF from this device')),
    el('button', { class: 'btn btn-danger btn-sm', onclick: clearLocal }, icon(ICONS.trash, 14), 'Clear')
  ));
  main.appendChild(data);

  /* Shortcuts reference */
  const shortcuts = el('div', { class: 'card' },
    el('div', { class: 'card-header' }, el('div', { class: 'card-title' }, 'Keyboard shortcuts'))
  );
  const list = [
    ['⌘ K / Ctrl K', 'Open command palette'],
    ['← / →', 'Previous / next song part'],
    ['B', 'Blank the live screen'],
    ['T', 'Toggle theme'],
    ['Esc', 'Close dialog']
  ];
  list.forEach(([k, desc]) => {
    shortcuts.appendChild(el('div', { class: 'settings-row' },
      el('div', { class: 'info' }, el('strong', {}, desc)),
      el('kbd', { style: { padding: '4px 10px', background: 'var(--bg-raised)', border: '1px solid var(--border-subtle)', borderRadius: '6px', fontSize: 'var(--text-xs)' } }, k)
    ));
  });
  main.appendChild(shortcuts);
}

function exportLibrary() {
  const songs = getState().songs;
  const blob = new Blob([JSON.stringify(songs, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `jfcm-songs-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
  toast('Library exported', 'success');
}

async function clearLocal() {
  const ok = await confirmDialog({
    title: 'Clear local data?',
    message: 'This removes your theme, saved setlist, announcements, and PDF from this browser. Your song library in the cloud is not affected.',
    confirmText: 'Clear'
  });
  if (!ok) return;
  Object.values(STORAGE_KEYS).forEach((k) => {
    if (k !== STORAGE_KEYS.auth) store.remove(k);
  });
  toast('Local data cleared', 'success');
  setTimeout(() => location.reload(), 400);
}