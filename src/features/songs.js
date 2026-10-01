import { el, icon, ICONS, debounce } from '../lib/dom.js';
import { getState, setState } from '../state/store.js';
import { fetchSongs, insertSong, updateSong, deleteSong } from '../lib/supabase.js';
import { toast, setLoading } from '../lib/toast.js';
import { openModal } from '../components/modal.js';
import { confirmDialog } from '../components/confirm.js';
import { emptyState } from '../components/empty.js';
import { CATEGORY_TAGS } from '../lib/constants.js';
import { rerender } from '../router.js';

export async function ensureSongsLoaded(force = false) {
  const state = getState();
  if (!force && state.songs.length) return;
  setLoading(true, 'Loading song library…');
  try {
    const songs = await fetchSongs();
    setState({ songs });
  } catch (e) {
    toast('Failed to load songs: ' + e.message, 'error');
  } finally {
    setLoading(false);
  }
}

export function renderSongs(main) {
  const state = getState();
  let query = '';
  let activeTag = 'All';

  main.appendChild(el('div', { class: 'page-header' },
    el('div', {},
      el('h1', {}, 'Song Library'),
      el('p', { class: 'subtitle' }, `${state.songs.length} song${state.songs.length === 1 ? '' : 's'} in your collection`)
    ),
    el('div', { class: 'page-header-actions' },
      el('button', { class: 'btn btn-primary', onclick: () => openSongDrawer(null) }, icon(ICONS.plus), 'New Song')
    )
  ));

  const searchInput = el('input', {
    type: 'search',
    placeholder: 'Search by title or artist…',
    'aria-label': 'Search songs'
  });
  searchInput.addEventListener('input', debounce((e) => { query = e.target.value.toLowerCase(); renderList(); }, 150));

  const toolbar = el('div', { style: { display: 'flex', gap: 'var(--space-3)', marginBottom: 'var(--space-4)', flexWrap: 'wrap' } },
    el('div', { class: 'search-input', style: { flex: '1', minWidth: '240px' } }, icon(ICONS.search, 16), searchInput)
  );

  const chips = el('div', { class: 'chip-grid', style: { marginBottom: 'var(--space-4)' } });
  ['All', ...CATEGORY_TAGS].forEach((tag) => {
    const chip = el('button', {
      class: `chip ${tag === 'All' ? 'active' : ''}`,
      type: 'button',
      onclick: () => {
        activeTag = tag;
        chips.querySelectorAll('.chip').forEach((c) => c.classList.toggle('active', c.textContent === tag));
        renderList();
      }
    }, tag);
    chips.appendChild(chip);
  });
  toolbar.appendChild(chips);
  main.appendChild(toolbar);

  const listWrap = el('div');
  main.appendChild(listWrap);

  function renderList() {
    const state = getState();
    listWrap.innerHTML = '';
    const filtered = state.songs.filter((s) => {
      const hay = `${s.title || ''} ${s.artist || ''}`.toLowerCase();
      if (query && !hay.includes(query)) return false;
      if (activeTag !== 'All' && !(s.tags || []).includes(activeTag)) return false;
      return true;
    });

    if (!filtered.length) {
      listWrap.appendChild(emptyState({
        iconPath: ICONS.library,
        title: state.songs.length === 0 ? 'No songs yet' : 'No matches',
        description: state.songs.length === 0
          ? 'Add your first song to begin building your library.'
          : 'Try a different search term or category.',
        action: state.songs.length === 0
          ? el('button', { class: 'btn btn-primary', onclick: () => openSongDrawer(null) }, icon(ICONS.plus), 'Add Song')
          : null
      }));
      return;
    }

    const table = el('table', { class: 'table' });
    table.appendChild(el('thead', {},
      el('tr', {},
        el('th', {}, 'Title'),
        el('th', {}, 'Artist'),
        el('th', {}, 'Tags'),
        el('th', { style: { width: '120px' } }, 'Actions')
      )
    ));

    const tbody = el('tbody');
    filtered.forEach((s) => {
      const row = el('tr', {},
        el('td', {}, el('strong', {}, s.title || 'Untitled')),
        el('td', { style: { color: 'var(--text-secondary)' } }, s.artist || '—'),
        el('td', {}, el('div', { class: 'chip-grid' }, ...(s.tags || []).map((t) => el('span', { class: 'badge' }, t)))),
        el('td', {},
          el('div', { style: { display: 'flex', gap: '4px' } },
            el('button', { class: 'icon-btn', title: 'Edit', 'aria-label': `Edit ${s.title}`, onclick: () => openSongDrawer(s) }, icon(ICONS.edit, 16)),
            el('button', { class: 'icon-btn', title: 'Delete', 'aria-label': `Delete ${s.title}`, onclick: () => removeSong(s) }, icon(ICONS.trash, 16))
          )
        )
      );
      tbody.appendChild(row);
    });
    table.appendChild(tbody);
    listWrap.appendChild(el('div', { class: 'table-wrap' }, table));
  }

  renderList();
}

async function removeSong(song) {
  const ok = await confirmDialog({
    title: 'Delete song?',
    message: `"${song.title}" will be permanently removed from your library. This cannot be undone.`,
    confirmText: 'Delete'
  });
  if (!ok) return;
  setLoading(true, 'Deleting…');
  try {
    await deleteSong(song.id);
    const state = getState();
    setState({
      songs: state.songs.filter((s) => s.id !== song.id),
      selectedSongs: state.selectedSongs.filter((s) => s.id !== song.id)
    });
    toast('Song deleted', 'success');
  } catch (e) {
    toast('Delete failed: ' + e.message, 'error');
  } finally {
    setLoading(false);
    rerender();
  }
}

export function openSongDrawer(existing) {
  const isEdit = !!existing;
  const form = { title: existing?.title || '', artist: existing?.artist || '', tags: existing?.tags || [], notes: existing?.notes || '' };
  let parts = existing?.parts ? { ...existing.parts } : { 'Verse 1': '' };
  if (parts['⏹️ End'] === undefined) parts['⏹️ End'] = '';

  const titleInput = el('input', { class: 'input', value: form.title, placeholder: 'Amazing Grace', id: 'f-title' });
  const artistInput = el('input', { class: 'input', value: form.artist, placeholder: 'John Newton', id: 'f-artist' });
  const notesInput = el('textarea', { class: 'textarea', placeholder: 'Private notes for the worship leader…', id: 'f-notes' }, form.notes);

  const tagsWrap = el('div', { class: 'chip-grid' });
  CATEGORY_TAGS.forEach((tag) => {
    const chip = el('button', {
      class: `chip ${form.tags.includes(tag) ? 'active' : ''}`,
      type: 'button',
      onclick: () => {
        chip.classList.toggle('active');
        if (form.tags.includes(tag)) form.tags = form.tags.filter((t) => t !== tag);
        else form.tags = [...form.tags, tag];
      }
    }, tag);
    tagsWrap.appendChild(chip);
  });

  const partsWrap = el('div', { style: { display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' } });
  const renderParts = () => {
    partsWrap.innerHTML = '';
    Object.entries(parts).forEach(([name, lyrics], i) => {
      const nameInput = el('input', { class: 'input', value: name, placeholder: 'Part name (Verse 1)', disabled: name === '⏹️ End' });
      const lyricsInput = el('textarea', { class: 'textarea', placeholder: 'Lyrics…', disabled: name === '⏹️ End' }, lyrics);
      const removeBtn = name === '⏹️ End' ? null : el('button', {
        class: 'icon-btn', type: 'button', 'aria-label': 'Remove part',
        onclick: () => {
          const entries = Object.entries(parts);
          const updated = {};
          entries.forEach(([k, v], idx) => { if (idx !== i) updated[k] = v; });
          parts = updated;
          renderParts();
        }
      }, icon(ICONS.trash, 16));

      nameInput.addEventListener('input', () => {
        const entries = Object.entries(parts);
        const newName = nameInput.value.trim() || `Part ${i + 1}`;
        const updated = {};
        entries.forEach(([k, v], idx) => { updated[idx === i ? newName : k] = v; });
        parts = updated;
      });
      lyricsInput.addEventListener('input', () => {
        const key = Object.keys(parts)[i];
        parts[key] = lyricsInput.value;
      });

      partsWrap.appendChild(el('div', { style: { display: 'flex', flexDirection: 'column', gap: 'var(--space-2)', padding: 'var(--space-3)', background: 'var(--bg-raised)', borderRadius: 'var(--radius-md)' } },
        el('div', { style: { display: 'flex', gap: 'var(--space-2)', alignItems: 'center' } },
          nameInput,
          removeBtn
        ),
        lyricsInput
      ));
    });
  };
  renderParts();

  const addPartBtn = el('button', {
    class: 'btn btn-secondary btn-sm', type: 'button',
    onclick: () => {
      const n = Object.keys(parts).filter((k) => k !== '⏹️ End').length + 1;
      const updated = {};
      Object.entries(parts).forEach(([k, v]) => { if (k === '⏹️ End') updated[k] = v; });
      updated[`Part ${n}`] = '';
      parts = updated;
      renderParts();
    }
  }, icon(ICONS.plus), 'Add part');

  const saveBtn = el('button', {
    class: 'btn btn-primary', type: 'button',
    onclick: async () => {
      const title = titleInput.value.trim();
      const artist = artistInput.value.trim();
      if (!title) { toast('Title is required', 'error'); titleInput.focus(); return; }
      if (!artist) { toast('Artist is required', 'error'); artistInput.focus(); return; }
      const validParts = {};
      Object.entries(parts).forEach(([name, lyrics]) => {
        if (name === '⏹️ End') return;
        if (name.trim() && lyrics.trim()) validParts[name.trim()] = lyrics;
      });
      if (Object.keys(validParts).length === 0) { toast('Add at least one part with lyrics', 'error'); return; }
      validParts['⏹️ End'] = '';

      const payload = {
        title, artist, tags: form.tags, notes: notesInput.value.trim(),
        parts: validParts, updated_at: new Date().toISOString()
      };
      setLoading(true, isEdit ? 'Updating…' : 'Saving…');
      try {
        if (isEdit) await updateSong(existing.id, payload);
        else await insertSong(payload);
        await ensureSongsLoaded(true);
        toast(isEdit ? 'Song updated' : 'Song added', 'success');
        api.close();
        rerender();
      } catch (e) {
        toast('Save failed: ' + e.message, 'error');
      } finally {
        setLoading(false);
      }
    }
  }, isEdit ? 'Save changes' : 'Create song');

  const body = el('div', {},
    el('div', { class: 'field' }, el('label', { for: 'f-title' }, 'Title *'), titleInput),
    el('div', { class: 'field' }, el('label', { for: 'f-artist' }, 'Artist *'), artistInput),
    el('div', { class: 'field' }, el('label', {}, 'Tags'), tagsWrap),
    el('div', { class: 'field' }, el('label', {}, 'Parts'), partsWrap, el('div', { style: { marginTop: 'var(--space-2)' } }, addPartBtn)),
    el('div', { class: 'field' }, el('label', { for: 'f-notes' }, 'Presenter notes (private)'), notesInput)
  );

  const cancelBtn = el('button', { class: 'btn btn-secondary', type: 'button', onclick: () => api.close() }, 'Cancel');

  const api = openModal({
    title: isEdit ? 'Edit song' : 'New song',
    body,
    footer: [cancelBtn, saveBtn],
    size: 'lg'
  });
}