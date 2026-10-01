import { el, icon, ICONS } from '../lib/dom.js';
import { getState } from '../state/store.js';
import { navigate } from '../router.js';

export function renderDashboard(main) {
  const state = getState();

  main.appendChild(el('div', { class: 'page-header' },
    el('div', {},
      el('h1', {}, 'Good to see you'),
      el('p', { class: 'subtitle' }, new Date().toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }))
    ),
    el('div', { class: 'page-header-actions' },
      el('button', { class: 'btn btn-secondary', onclick: () => navigate('songs') }, icon(ICONS.plus), 'Add Song'),
      el('button', { class: 'btn btn-primary', onclick: () => navigate('setlist') }, icon(ICONS.setlist), 'Build Setlist')
    )
  ));

  /* Stats */
  const totalSongs = state.songs.length;
  const totalTags = new Set(state.songs.flatMap((s) => s.tags || [])).size;
  const selectedCount = state.selectedSongs.length;
  const announcements = (getState().announcements || []).length;

  const grid = el('div', { class: 'grid grid-4', style: { marginBottom: 'var(--space-6)' } });
  grid.appendChild(statCard('Songs in library', totalSongs, 'Across all artists'));
  grid.appendChild(statCard('Categories', totalTags, 'Fast, slow, seasonal'));
  grid.appendChild(statCard('In current setlist', selectedCount, selectedCount ? 'Ready to present' : 'Setlist is empty'));
  grid.appendChild(statCard('Announcement slides', announcements, 'Available to display'));
  main.appendChild(grid);

  /* Quick actions */
  main.appendChild(el('h2', { style: { marginBottom: 'var(--space-4)' } }, 'Quick actions'));
  const qa = el('div', { class: 'quick-actions', style: { marginBottom: 'var(--space-6)' } });
  qa.appendChild(quickAction(ICONS.setlist, 'Build a setlist', 'Pick songs for this service', () => navigate('setlist')));
  qa.appendChild(quickAction(ICONS.studio, 'Open worship studio', 'Control live presentation', () => navigate('studio')));
  qa.appendChild(quickAction(ICONS.announce, 'New announcement', 'Create a welcome slide', () => navigate('announcements')));
  qa.appendChild(quickAction(ICONS.media, 'Upload media', 'Add a PDF presentation', () => navigate('media')));
  main.appendChild(qa);

  /* Upcoming / recent */
  const twoCol = el('div', { class: 'grid grid-2' });
  twoCol.appendChild(recentSongsCard(state.songs));
  twoCol.appendChild(recentAnnouncementsCard(getState().announcements || []));
  main.appendChild(twoCol);
}

function statCard(label, value, hint) {
  return el('div', { class: 'stat' },
    el('div', { class: 'stat-label' }, label),
    el('div', { class: 'stat-value' }, String(value)),
    el('div', { class: 'stat-hint' }, hint)
  );
}

function quickAction(iconPath, title, desc, onClick) {
  return el('button', { class: 'quick-action', type: 'button', onclick: onClick },
    el('span', { class: 'icon-wrap' }, icon(iconPath, 18)),
    el('strong', {}, title),
    el('span', {}, desc)
  );
}

function recentSongsCard(songs) {
  const card = el('div', { class: 'card' });
  card.appendChild(el('div', { class: 'card-header' },
    el('div', {},
      el('div', { class: 'card-title' }, 'Song library'),
      el('div', { class: 'card-subtitle' }, `${songs.length} song${songs.length === 1 ? '' : 's'} available`)
    ),
    el('button', { class: 'btn btn-ghost btn-sm', onclick: () => navigate('songs') }, 'View all')
  ));

  if (!songs.length) {
    card.appendChild(el('p', { style: { color: 'var(--text-muted)', fontSize: 'var(--text-sm)' } }, 'No songs yet. Add your first song to get started.'));
    return card;
  }

  const list = el('div', { style: { display: 'flex', flexDirection: 'column', gap: '4px' } });
  songs.slice(0, 5).forEach((s) => {
    list.appendChild(el('div', { class: 'song-row', onclick: () => navigate('songs') },
      el('div', { class: 'grow' },
        el('div', { class: 'title' }, s.title),
        el('div', { class: 'artist' }, s.artist || 'Unknown')
      ),
      el('div', { class: 'tags' }, ...(s.tags || []).slice(0, 2).map((t) => el('span', { class: 'badge' }, t)))
    ));
  });
  card.appendChild(list);
  return card;
}

function recentAnnouncementsCard(slides) {
  const card = el('div', { class: 'card' });
  card.appendChild(el('div', { class: 'card-header' },
    el('div', {},
      el('div', { class: 'card-title' }, 'Announcements'),
      el('div', { class: 'card-subtitle' }, `${slides.length} slide${slides.length === 1 ? '' : 's'}`)
    ),
    el('button', { class: 'btn btn-ghost btn-sm', onclick: () => navigate('announcements') }, 'Manage')
  ));
  if (!slides.length) {
    card.appendChild(el('p', { style: { color: 'var(--text-muted)', fontSize: 'var(--text-sm)' } }, 'No announcement slides yet.'));
    return card;
  }
  const list = el('div', { style: { display: 'flex', flexDirection: 'column', gap: '4px' } });
  slides.slice(0, 5).forEach((s) => {
    list.appendChild(el('div', { class: 'song-row' },
      el('div', { class: 'grow' },
        el('div', { class: 'title' }, s.title),
        el('div', { class: 'artist' }, s.message || '')
      ),
      s.active ? el('span', { class: 'badge badge-brand' }, 'Live') : null
    ));
  });
  card.appendChild(list);
  return card;
}