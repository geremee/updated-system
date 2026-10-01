import { getState, setState, setTheme, restoreAppState } from './state/store.js';
import { STORAGE_KEYS, DEFAULT_PREFS } from './lib/constants.js';
import { store } from './lib/storage.js';
import { toast } from './lib/toast.js';
import { renderShell } from './components/shell.js';
import { openCommandPalette } from './components/command.js';
import { openModalCount } from './components/modal.js';
import { registerRoute, mountRouter, navigate } from './router.js';
import { isLoggedIn, login, logout } from './features/auth.js';
import { renderDashboard } from './features/dashboard.js';
import { renderSongs, ensureSongsLoaded } from './features/songs.js';
import { renderSetlist } from './features/setlist.js';
import { renderStudio } from './features/studio.js';
import { renderAnnouncements, ensureAnnouncementsLoaded } from './features/announcements.js';
import { renderMedia } from './features/media.js';
import { renderSettings } from './features/settings.js';

function bootstrap() {
  const savedTheme = store.get(STORAGE_KEYS.theme) || DEFAULT_PREFS.theme;
  setTheme(savedTheme);

  const savedPrefs = store.get(STORAGE_KEYS.preferences);
  if (savedPrefs) setState({ prefs: { ...DEFAULT_PREFS, ...savedPrefs } });

  if (!isLoggedIn()) {
    login();
    return;
  }

  setState({ user: { name: 'jfcmadmin' } });

  registerRoute('dashboard', (main) => renderDashboard(main));
  registerRoute('songs', (main) => renderSongs(main));
  registerRoute('setlist', (main) => renderSetlist(main));
  registerRoute('studio', (main) => renderStudio(main));
  registerRoute('announcements', (main) => renderAnnouncements(main));
  registerRoute('media', (main) => renderMedia(main));
  registerRoute('settings', (main) => renderSettings(main));

  mountRouter(document.getElementById('app'), (route) => {
    return renderShell(
      route,
      (id) => navigate(id),
      () => logout(),
      () => openCommandPalette({
        commands: buildCommands(),
        songs: getState().songs,
        onPick: (song) => {
          const s = getState();
          if (!s.selectedSongs.some((x) => x.id === song.id)) {
            setState({ selectedSongs: [...s.selectedSongs, song] });
          }
          navigate('setlist');
          toast(`Added "${song.title}" to setlist`, 'success');
        }
      })
    );
  });

  ensureAnnouncementsLoaded();
  ensureSongsLoaded().then(() => {
    restoreAppState();
    window.dispatchEvent(new HashChangeEvent('hashchange'));
  });

  document.addEventListener('keydown', (e) => {
    if (e.target.matches('input, textarea, select')) return;
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
      e.preventDefault();
      openCommandPalette({
        commands: buildCommands(),
        songs: getState().songs,
        onPick: (song) => {
          const s = getState();
          if (!s.selectedSongs.some((x) => x.id === song.id)) {
            setState({ selectedSongs: [...s.selectedSongs, song] });
          }
          navigate('setlist');
        }
      });
    } else if (e.key.toLowerCase() === 't') {
      if (openModalCount() > 0) return;
      const next = getState().theme === 'dark' ? 'light' : 'dark';
      setTheme(next);
    }
  });
}

function buildCommands() {
  const nav = (id, label, hint) => ({ label, hint, run: () => navigate(id) });
  return [
    nav('dashboard', 'Go to Dashboard', 'Navigation'),
    nav('songs', 'Go to Song Library', 'Navigation'),
    nav('setlist', 'Go to Setlist Builder', 'Navigation'),
    nav('studio', 'Open Worship Studio', 'Navigation'),
    nav('announcements', 'Go to Announcements', 'Navigation'),
    nav('media', 'Go to Media', 'Navigation'),
    nav('settings', 'Go to Settings', 'Navigation'),
    { label: 'Toggle theme', hint: 'Appearance', run: () => setTheme(getState().theme === 'dark' ? 'light' : 'dark') }
  ];
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', bootstrap);
} else {
  bootstrap();
}

console.log('✅ JFCM Worship v2 loaded');