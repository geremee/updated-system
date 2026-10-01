import { el, icon, ICONS } from '../lib/dom.js';
import { setState, getState } from '../state/store.js';
import { STORAGE_KEYS } from '../lib/constants.js';
import { store } from '../lib/storage.js';
import { toast } from '../lib/toast.js';

const ADMIN_USERNAME = 'jfcmadmin';
const ADMIN_PASSWORD = 'superadmin123';

export function isLoggedIn() {
  return getState().user != null || store.raw.get(STORAGE_KEYS.auth) === '1';
}

export function login() {
  const app = document.getElementById('app');
  app.innerHTML = '';

  const username = el('input', { class: 'input', type: 'text', autocomplete: 'username', placeholder: 'Username', 'aria-label': 'Username' });
  const password = el('input', { class: 'input', type: 'password', autocomplete: 'current-password', placeholder: 'Password', 'aria-label': 'Password' });
  const error = el('div', { class: 'error', role: 'alert', style: { minHeight: '1em' } });

  const form = el('form', {
    onsubmit: (e) => {
      e.preventDefault();
      error.textContent = '';
      if (username.value === ADMIN_USERNAME && password.value === ADMIN_PASSWORD) {
        store.raw.set(STORAGE_KEYS.auth, '1');
        setState({ user: { name: 'jfcmadmin' } });
        toast('Welcome back', 'success');
      } else {
        error.textContent = 'Invalid credentials. Please try again.';
        password.value = '';
        password.focus();
      }
    }
  });

  form.appendChild(el('div', { class: 'field' },
    el('label', { for: 'login-username' }, 'Username'),
    username
  ));
  username.id = 'login-username';

  form.appendChild(el('div', { class: 'field' },
    el('label', { for: 'login-password' }, 'Password'),
    password
  ));
  password.id = 'login-password';

  form.appendChild(error);

  form.appendChild(el('button', { class: 'btn btn-primary btn-block btn-lg', type: 'submit', style: { marginTop: '8px' } },
    icon(ICONS.user), 'Sign in'
  ));

  const card = el('div', { class: 'card', style: { maxWidth: '380px', width: '100%', padding: 'var(--space-8)' } },
    el('div', { style: { textAlign: 'center', marginBottom: 'var(--space-6)' } },
      el('img', { src: '/images/jfcmlogo.webp', alt: '', style: { width: '56px', height: '56px', margin: '0 auto var(--space-3)' } }),
      el('h1', { style: { fontFamily: 'var(--font-display)', fontSize: 'var(--text-2xl)' } }, 'JFCM Pasig Worship'),
      el('p', { style: { color: 'var(--text-muted)', fontSize: 'var(--text-sm)', marginTop: '4px' } }, 'Sign in to continue')
    ),
    form
  );

  const wrap = el('div', {
    style: {
      minHeight: '100dvh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 'var(--space-4)'
    }
  }, card);

  app.appendChild(wrap);
  setTimeout(() => username.focus(), 50);
}

export function logout() {
  store.raw.remove(STORAGE_KEYS.auth);
  setState({ user: null, selectedSongs: [], currentSongId: null, currentPart: null });
  window.location.hash = '';
  window.location.reload();
}