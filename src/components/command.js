import { el, icon, ICONS, debounce } from '../lib/dom.js';

export function openCommandPalette({ commands, songs, onPick }) {
  const root = document.getElementById('modal-root');
  const backdrop = el('div', { class: 'cmdk-backdrop' });
  const box = el('div', { class: 'cmdk', role: 'dialog', 'aria-modal': 'true', 'aria-label': 'Command palette' });

  const input = el('input', { type: 'text', placeholder: 'Type a command or search songs…', 'aria-label': 'Command search' });
  const inputRow = el('div', { class: 'cmdk-input' }, icon(ICONS.search, 18), input);
  const list = el('div', { class: 'cmdk-list' });

  let active = 0;
  let visibleItems = [];

  const close = () => {
    backdrop.remove();
    document.removeEventListener('keydown', onKey);
  };

  const commandRow = (c, i) =>
    el('div', {
      class: 'cmdk-item',
      role: 'option',
      'aria-selected': i === active ? 'true' : 'false',
      onclick: () => { close(); c.run?.(); }
    },
      el('span', { class: 'icon' }, icon(c.icon || ICONS.command)),
      el('span', { class: 'grow' }, c.label),
      c.hint ? el('span', { class: 'meta' }, c.hint) : null
    );

  const songRow = (s, i) =>
    el('div', {
      class: 'cmdk-item',
      role: 'option',
      'aria-selected': i === active ? 'true' : 'false',
      onclick: () => { close(); onPick?.(s); }
    },
      el('span', { class: 'icon' }, icon(ICONS.library)),
      el('span', { class: 'grow' }, s.title),
      el('span', { class: 'meta' }, s.artist || '')
    );

  const render = (query = '') => {
    list.innerHTML = '';
    const q = query.trim().toLowerCase();

    const matchedCommands = commands.filter((c) => !q || c.label.toLowerCase().includes(q));
    const matchedSongs = songs.filter((s) =>
      !q || s.title.toLowerCase().includes(q) || (s.artist || '').toLowerCase().includes(q)
    ).slice(0, 30);

    visibleItems = [
      ...matchedCommands.map((c) => ({ type: 'command', data: c })),
      ...matchedSongs.map((s) => ({ type: 'song', data: s }))
    ];

    if (!visibleItems.length) {
      list.appendChild(el('div', { class: 'cmdk-group' }, 'No results'));
      return;
    }

    active = Math.min(active, visibleItems.length - 1);

    if (matchedCommands.length) {
      list.appendChild(el('div', { class: 'cmdk-group' }, 'Actions'));
      matchedCommands.forEach((c, i) => list.appendChild(commandRow(c, i)));
    }
    if (matchedSongs.length) {
      list.appendChild(el('div', { class: 'cmdk-group' }, 'Songs'));
      matchedSongs.forEach((s, i) => list.appendChild(songRow(s, matchedCommands.length + i)));
    }

    const activeEl = list.querySelector('.cmdk-item[aria-selected="true"]');
    activeEl?.scrollIntoView({ block: 'nearest' });
  };

  const onKey = (e) => {
    if (e.key === 'Escape') { e.preventDefault(); close(); return; }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      active = Math.min(active + 1, visibleItems.length - 1);
      render(input.value);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      active = Math.max(active - 1, 0);
      render(input.value);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const v = visibleItems[active];
      if (!v) return;
      close();
      if (v.type === 'command') v.data.run?.();
      else onPick?.(v.data);
    }
  };

  input.addEventListener('input', debounce((e) => { active = 0; render(e.target.value); }, 80));
  backdrop.addEventListener('click', (e) => { if (e.target === backdrop) close(); });
  document.addEventListener('keydown', onKey);

  box.appendChild(inputRow);
  box.appendChild(list);
  backdrop.appendChild(box);
  root.appendChild(backdrop);
  input.focus();
  render('');
}