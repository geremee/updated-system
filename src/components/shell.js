import { el, icon, ICONS } from '../lib/dom.js';
import { getState, setTheme, subscribe } from '../state/store.js';

const NAV = [
  { section: 'Workspace', items: [
    { id: 'dashboard', label: 'Dashboard', icon: ICONS.dashboard },
    { id: 'songs', label: 'Song Library', icon: ICONS.library },
    { id: 'setlist', label: 'Setlist Builder', icon: ICONS.setlist, badgeKey: 'selectedSongs' },
    { id: 'studio', label: 'Worship Studio', icon: ICONS.studio }
  ]},
  { section: 'Content', items: [
    { id: 'announcements', label: 'Announcements', icon: ICONS.announce },
    { id: 'media', label: 'Media', icon: ICONS.media }
  ]},
  { section: 'System', items: [
    { id: 'settings', label: 'Settings', icon: ICONS.settings }
  ]}
];

const MOBILE_NAV = ['dashboard', 'songs', 'setlist', 'studio', 'settings'];

export function renderShell(route, onNavigate, onLogout, onOpenCommand) {
  const app = document.getElementById('app');
  app.innerHTML = '';

  const shell = el('div', { class: 'app-shell' });

  const sidebar = el('aside', { class: 'sidebar', 'aria-label': 'Primary' },
    el('div', { class: 'sidebar-brand' },
      el('img', { src: '/images/jfcmlogo.webp', alt: '' }),
      el('div', { class: 'sidebar-brand-text' },
        el('strong', {}, 'JFCM Pasig'),
        el('small', {}, 'Worship Control')
      )
    )
  );

  const nav = el('nav', { class: 'nav' });
  let setlistNavBtn = null;

  for (const group of NAV) {
    nav.appendChild(el('div', { class: 'nav-section-label' }, group.section));
    for (const item of group.items) {
      const btn = el('button', {
        class: 'nav-item',
        type: 'button',
        dataset: { navId: item.id },
        'aria-current': route === item.id ? 'page' : null,
        onclick: () => onNavigate(item.id)
      },
        icon(item.icon),
        el('span', {}, item.label)
      );
      if (item.badgeKey === 'selectedSongs') {
        setlistNavBtn = btn;
        const count = getState().selectedSongs.length;
        if (count > 0) btn.appendChild(el('span', { class: 'nav-badge' }, String(count)));
      }
      nav.appendChild(btn);
    }
  }
  sidebar.appendChild(nav);

  const logoutBtn = el('button', { class: 'nav-item', type: 'button', onclick: onLogout },
    icon(ICONS.logout),
    el('span', {}, 'Sign out')
  );
  sidebar.appendChild(el('div', { class: 'sidebar-footer' }, logoutBtn));

  const crumbs = breadcrumbsFor(route);
  const searchInput = el('input', {
    type: 'text',
    placeholder: 'Search or jump to…',
    'aria-label': 'Search',
    readonly: true,
    onclick: onOpenCommand
  });

  const theme = getState().theme;
  const themeBtn = el('button', {
    class: 'icon-btn',
    type: 'button',
    'aria-label': 'Toggle theme',
    title: 'Toggle theme (T)',
    onclick: () => setTheme(getState().theme === 'dark' ? 'light' : 'dark')
  }, icon(theme === 'dark' ? ICONS.sun : ICONS.moon));

  const topbar = el('header', { class: 'topbar' },
    el('div', { class: 'topbar-crumbs' },
      el('span', {}, 'JFCM'),
      el('span', { class: 'sep' }, '/'),
      el('strong', {}, crumbs)
    ),
    el('div', { class: 'topbar-spacer' }),
    el('div', { class: 'topbar-search' },
      icon(ICONS.search, 16),
      searchInput,
      el('kbd', {}, '⌘K')
    ),
    themeBtn,
    el('button', { class: 'avatar', type: 'button', 'aria-label': 'Account', title: 'jfcmadmin' }, 'JF')
  );

  const main = el('main', { class: 'main', id: 'main', tabindex: '-1' });

  const mobileNav = el('nav', { class: 'mobile-nav', 'aria-label': 'Primary mobile' });
  const mobileInner = el('div', { class: 'mobile-nav-inner' });
  for (const id of MOBILE_NAV) {
    const found = NAV.flatMap((g) => g.items).find((n) => n.id === id);
    if (!found) continue;
    mobileInner.appendChild(el('button', {
      class: 'mobile-nav-item',
      type: 'button',
      'aria-current': route === id ? 'page' : null,
      onclick: () => onNavigate(id)
    }, icon(found.icon, 20), el('span', {}, found.label)));
  }
  mobileNav.appendChild(mobileInner);

  shell.appendChild(sidebar);
  shell.appendChild(topbar);
  shell.appendChild(main);
  shell.appendChild(mobileNav);
  app.appendChild(shell);

  const unsub = subscribe(() => {
    if (!setlistNavBtn) return;
    const count = getState().selectedSongs.length;
    let badge = setlistNavBtn.querySelector('.nav-badge');
    if (count > 0) {
      if (!badge) {
        badge = el('span', { class: 'nav-badge' });
        setlistNavBtn.appendChild(badge);
      }
      badge.textContent = String(count);
    } else if (badge) {
      badge.remove();
    }
  });

  return {
    main,
    destroy() { unsub(); }
  };
}

function breadcrumbsFor(route) {
  const map = {
    dashboard: 'Dashboard',
    songs: 'Song Library',
    setlist: 'Setlist Builder',
    studio: 'Worship Studio',
    announcements: 'Announcements',
    media: 'Media',
    settings: 'Settings'
  };
  return map[route] || 'Dashboard';
}