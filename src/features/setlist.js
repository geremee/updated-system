import { el, icon, ICONS, debounce } from '../lib/dom.js';
import { getState, setState, persistAppState } from '../state/store.js';
import { emptyState } from '../components/empty.js';
import { navigate } from '../router.js';
import { toast } from '../lib/toast.js';

export function renderSetlist(main) {
  let query = '';

  main.appendChild(el('div', { class: 'page-header' },
    el('div', {},
      el('h1', {}, 'Setlist Builder'),
      el('p', { class: 'subtitle' }, 'Search your library, then click to add songs to today\u2019s service.')
    ),
    el('div', { class: 'page-header-actions' },
      el('button', {
        class: 'btn btn-primary',
        onclick: () => {
          if (!getState().selectedSongs.length) { toast('Add at least one song first', 'warning'); return; }
          persistAppState();
          navigate('studio');
        }
      }, icon(ICONS.play), 'Open Studio')
    )
  ));

  const split = el('div', { class: 'split' });
  main.appendChild(split);

  const searchInput = el('input', { type: 'search', placeholder: 'Search songs by title or artist…', 'aria-label': 'Search library' });
  searchInput.addEventListener('input', debounce((e) => { query = e.target.value.toLowerCase(); renderLibrary(); }, 150));

  const libraryPanel = el('div', {},
    el('div', { class: 'search-input', style: { marginBottom: 'var(--space-4)' } }, icon(ICONS.search, 16), searchInput),
    el('div', { id: 'library-list' })
  );
  split.appendChild(libraryPanel);

  const setlistPanel = el('div', { class: 'setlist-panel card' });
  split.appendChild(setlistPanel);

  function renderLibrary() {
    const state = getState();
    const list = libraryPanel.querySelector('#library-list');
    list.innerHTML = '';
    const songs = state.songs.filter((s) => {
      const hay = `${s.title || ''} ${s.artist || ''}`.toLowerCase();
      return !query || hay.includes(query);
    });

    if (!songs.length) {
      list.appendChild(emptyState({
        iconPath: ICONS.library,
        title: state.songs.length === 0 ? 'Your library is empty' : 'No matches',
        description: state.songs.length === 0 ? 'Add songs in the Song Library first.' : 'Try a different search.'
      }));
      return;
    }

    songs.forEach((s) => {
      const selected = state.selectedSongs.some((x) => x.id === s.id);
      const row = el('div', {
        class: `song-row ${selected ? 'selected' : ''}`,
        role: 'button',
        tabindex: '0',
        onclick: () => toggleSong(s),
        onkeydown: (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggleSong(s); } }
      },
        el('div', { class: 'grow' },
          el('div', { class: 'title' }, s.title),
          el('div', { class: 'artist' }, s.artist || 'Unknown')
        ),
        el('div', { class: 'tags' }, ...(s.tags || []).slice(0, 2).map((t) => el('span', { class: 'badge' }, t))),
        selected ? icon(ICONS.check, 18) : icon(ICONS.plus, 18)
      );
      list.appendChild(row);
    });
  }

  function toggleSong(song) {
    const state = getState();
    const exists = state.selectedSongs.some((s) => s.id === song.id);
    if (exists) {
      setState({ selectedSongs: state.selectedSongs.filter((s) => s.id !== song.id) });
    } else {
      setState({ selectedSongs: [...state.selectedSongs, song] });
    }
    persistAppState();
    renderLibrary();
    renderSetlist();
  }

  function renderSetlist() {
    const s = getState();
    setlistPanel.innerHTML = '';

    setlistPanel.appendChild(el('div', { class: 'card-header' },
      el('div', {},
        el('div', { class: 'card-title' }, 'Today\u2019s setlist'),
        el('div', { class: 'card-subtitle' }, `${s.selectedSongs.length} song${s.selectedSongs.length === 1 ? '' : 's'}`)
      ),
      s.selectedSongs.length
        ? el('button', {
            class: 'btn btn-ghost btn-sm',
            onclick: () => { setState({ selectedSongs: [] }); persistAppState(); renderLibrary(); renderSetlist(); }
          }, 'Clear')
        : null
    ));

    if (!s.selectedSongs.length) {
      setlistPanel.appendChild(el('div', { class: 'empty', style: { padding: 'var(--space-6) var(--space-4)' } },
        icon(ICONS.setlist, 32),
        el('p', { style: { marginTop: 'var(--space-2)', fontSize: 'var(--text-sm)' } }, 'Click a song to add it here.')
      ));
      return;
    }

    const list = el('div', { id: 'setlist-list' });
    s.selectedSongs.forEach((song, index) => {
      const item = el('div', { class: 'setlist-item', draggable: 'true', dataset: { id: song.id, index: String(index) } },
        el('span', { class: 'num' }, String(index + 1)),
        el('div', { class: 'info' },
          el('div', { class: 't' }, song.title),
          el('div', { class: 'a' }, song.artist || '')
        ),
        el('button', {
          class: 'icon-btn', 'aria-label': 'Remove', onclick: (e) => {
            e.stopPropagation();
            const cur = getState();
            setState({ selectedSongs: cur.selectedSongs.filter((x) => x.id !== song.id) });
            persistAppState();
            renderLibrary();
            renderSetlist();
          }
        }, icon(ICONS.close, 14))
      );
      list.appendChild(item);
    });
    setlistPanel.appendChild(list);
    attachDragAndDrop(list);
  }

  function attachDragAndDrop(list) {
    let draggedId = null;
    list.addEventListener('dragstart', (e) => {
      const item = e.target.closest('.setlist-item');
      if (!item) return;
      draggedId = item.dataset.id;
      item.classList.add('dragging');
      e.dataTransfer.effectAllowed = 'move';
    });
    list.addEventListener('dragend', () => {
      list.querySelectorAll('.setlist-item').forEach((i) => i.classList.remove('dragging'));
      draggedId = null;
    });
    list.addEventListener('dragover', (e) => {
      e.preventDefault();
      const over = e.target.closest('.setlist-item');
      if (!over || over.dataset.id === draggedId) return;
      const rect = over.getBoundingClientRect();
      const after = e.clientY > rect.top + rect.height / 2;
      const cur = getState();
      const list2 = [...cur.selectedSongs];
      const fromIdx = list2.findIndex((s) => s.id === draggedId);
      const toIdx = list2.findIndex((s) => s.id === over.dataset.id);
      if (fromIdx < 0 || toIdx < 0) return;
      const [moved] = list2.splice(fromIdx, 1);
      list2.splice(after ? toIdx + 1 : toIdx, 0, moved);
      setState({ selectedSongs: list2 });
      persistAppState();
      renderSetlist();
    });
  }

  renderLibrary();
  renderSetlist();
}