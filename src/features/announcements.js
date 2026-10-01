import { el, icon, ICONS } from '../lib/dom.js';
import { STORAGE_KEYS, GRADIENTS, TEXT_COLORS, TEXT_SIZES, ANIMATIONS } from '../lib/constants.js';
import { store } from '../lib/storage.js';
import { toast } from '../lib/toast.js';
import { openModal } from '../components/modal.js';
import { confirmDialog } from '../components/confirm.js';
import { emptyState } from '../components/empty.js';
import { getState, setState } from '../state/store.js';
import { postToPresentation, isPresentationOpen } from '../lib/presentation-bus.js';

function loadSlides() {
  const saved = store.get(STORAGE_KEYS.announcements);
  if (Array.isArray(saved)) return saved;
  const seed = [
    { id: 1, title: 'Welcome to JFCM Pasig!', message: 'We are so glad you are here today.', subtitle: 'Jesus First Christian Ministries', bgStyle: 'gold', textColor: 'white', textSize: 'medium', animation: 'fade', bgImage: null, active: true },
    { id: 2, title: 'Upcoming Events', message: 'Join us for our Youth Conference on October 15th.', subtitle: '10:00 AM – 6:00 PM', bgStyle: 'blue', textColor: 'white', textSize: 'medium', animation: 'fade', bgImage: null, active: false }
  ];
  store.set(STORAGE_KEYS.announcements, seed);
  return seed;
}

function saveSlides(slides) {
  store.set(STORAGE_KEYS.announcements, slides);
  setState({ announcements: slides });
}

export function ensureAnnouncementsLoaded() {
  setState({ announcements: loadSlides() });
}

export function renderAnnouncements(main) {
  ensureAnnouncementsLoaded();
  const state = getState();
  const slides = state.announcements || [];

  main.appendChild(el('div', { class: 'page-header' },
    el('div', {},
      el('h1', {}, 'Announcements'),
      el('p', { class: 'subtitle' }, `${slides.length} slide${slides.length === 1 ? '' : 's'} available to display`)
    ),
    el('div', { class: 'page-header-actions' },
      el('button', { class: 'btn btn-primary', onclick: () => openBuilder(null) }, icon(ICONS.plus), 'New slide')
    )
  ));

  if (!slides.length) {
    main.appendChild(emptyState({
      iconPath: ICONS.announce,
      title: 'No announcement slides yet',
      description: 'Create your first welcome or event slide to display between songs.',
      action: el('button', { class: 'btn btn-primary', onclick: () => openBuilder(null) }, icon(ICONS.plus), 'Create slide')
    }));
    return;
  }

  const grid = el('div', { class: 'grid grid-3' });
  slides.forEach((slide) => grid.appendChild(renderSlideCard(slide)));
  main.appendChild(grid);
}

function renderSlideCard(slide) {
  const bg = slide.bgImage
    ? `url(${slide.bgImage}) center / cover no-repeat`
    : GRADIENTS[slide.bgStyle] || GRADIENTS.gold;
  const color = TEXT_COLORS[slide.textColor] || '#fff';

  const preview = el('div', {
    class: 'slide-preview',
    style: { background: bg, color, minHeight: '160px', padding: 'var(--space-5)' }
  },
    el('div', { class: 't', style: { fontSize: 'var(--text-xl)' } }, slide.title),
    el('div', { class: 'm', style: { fontSize: 'var(--text-sm)' } }, slide.message || ''),
    slide.subtitle ? el('div', { class: 's' }, slide.subtitle) : null
  );

  return el('div', { class: 'card', style: { padding: 0, overflow: 'hidden' } },
    preview,
    el('div', { style: { padding: 'var(--space-4)' } },
      el('div', { style: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 'var(--space-2)', marginBottom: 'var(--space-3)' } },
        el('div', { style: { minWidth: 0 } },
          el('div', { style: { fontWeight: 600, fontSize: 'var(--text-sm)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' } }, slide.title),
          el('div', { style: { fontSize: 'var(--text-xs)', color: 'var(--text-muted)' } }, slide.active ? 'Currently live' : 'Not live')
        ),
        slide.active ? el('span', { class: 'badge badge-brand' }, 'Live') : null
      ),
      el('div', { style: { display: 'flex', gap: 'var(--space-2)' } },
        el('button', { class: 'btn btn-primary btn-sm', onclick: () => showSlide(slide.id) }, icon(ICONS.play, 14), 'Show'),
        el('button', { class: 'btn btn-secondary btn-sm', onclick: () => openBuilder(slide) }, icon(ICONS.edit, 14), 'Edit'),
        el('button', { class: 'btn btn-ghost btn-sm', 'aria-label': 'Delete', onclick: () => removeSlide(slide) }, icon(ICONS.trash, 14))
      )
    )
  );
}

function showSlide(id) {
  const slides = loadSlides().map((s) => ({ ...s, active: s.id === id }));
  saveSlides(slides);
  const slide = slides.find((s) => s.id === id);
  toast(`Live: ${slide.title}`, 'success');

  if (isPresentationOpen()) {
    const gradient = slide.bgImage ? null : (GRADIENTS[slide.bgStyle] || GRADIENTS.gold);
    postToPresentation({
      type: 'announcement',
      title: slide.title,
      message: slide.message,
      subtitle: slide.subtitle,
      bgImage: slide.bgImage,
      gradient,
      textColor: TEXT_COLORS[slide.textColor] || '#fff'
    });
  }

  window.dispatchEvent(new HashChangeEvent('hashchange'));
}

async function removeSlide(slide) {
  const ok = await confirmDialog({
    title: 'Delete announcement?',
    message: `"${slide.title}" will be permanently removed.`,
    confirmText: 'Delete'
  });
  if (!ok) return;
  const slides = loadSlides().filter((s) => s.id !== slide.id);
  saveSlides(slides);
  toast('Announcement deleted', 'success');
  window.dispatchEvent(new HashChangeEvent('hashchange'));
}

export function openBuilder(existing) {
  const isEdit = !!existing;
  const draft = {
    title: existing?.title || '',
    message: existing?.message || '',
    subtitle: existing?.subtitle || '',
    bgStyle: existing?.bgStyle || 'gold',
    textColor: existing?.textColor || 'white',
    textSize: existing?.textSize || 'medium',
    animation: existing?.animation || 'fade',
    bgImage: existing?.bgImage || null
  };

  const titleInput = el('input', { class: 'input', value: draft.title, placeholder: 'Welcome to JFCM Pasig!', oninput: (e) => { draft.title = e.target.value; updatePreview(); } });
  const msgInput = el('textarea', { class: 'textarea', placeholder: 'We are so glad you are here today.', oninput: (e) => { draft.message = e.target.value; updatePreview(); } }, draft.message);
  const subInput = el('input', { class: 'input', value: draft.subtitle, placeholder: 'Optional subtitle', oninput: (e) => { draft.subtitle = e.target.value; updatePreview(); } });

  const bgChips = el('div', { class: 'chip-grid' });
  Object.keys(GRADIENTS).forEach((key) => {
    const chip = el('button', {
      class: `chip ${draft.bgStyle === key ? 'active' : ''}`,
      type: 'button',
      onclick: () => {
        draft.bgStyle = key;
        draft.bgImage = null;
        bgChips.querySelectorAll('.chip').forEach((c) => c.classList.toggle('active', c.dataset.key === key));
        updatePreview();
      }
    }, key.charAt(0).toUpperCase() + key.slice(1));
    chip.dataset.key = key;
    bgChips.appendChild(chip);
  });

  const colorRow = el('div', { style: { display: 'flex', gap: 'var(--space-2)', flexWrap: 'wrap' } });
  Object.entries(TEXT_COLORS).forEach(([key, hex]) => {
    const sw = el('button', {
      class: `swatch ${draft.textColor === key ? 'active' : ''}`,
      type: 'button',
      style: { background: hex },
      title: key,
      'aria-label': `Text color ${key}`,
      onclick: () => {
        draft.textColor = key;
        colorRow.querySelectorAll('.swatch').forEach((s) => s.classList.toggle('active', s.title === key));
        updatePreview();
      }
    });
    colorRow.appendChild(sw);
  });

  const sizeChips = el('div', { class: 'chip-grid' });
  Object.entries(TEXT_SIZES).forEach(([key, cfg]) => {
    const chip = el('button', {
      class: `chip ${draft.textSize === key ? 'active' : ''}`,
      type: 'button',
      onclick: () => {
        draft.textSize = key;
        sizeChips.querySelectorAll('.chip').forEach((c) => c.classList.toggle('active', c.dataset.key === key));
        updatePreview();
      }
    }, cfg.label);
    chip.dataset.key = key;
    sizeChips.appendChild(chip);
  });

  const animChips = el('div', { class: 'chip-grid' });
  ANIMATIONS.forEach((a) => {
    const chip = el('button', {
      class: `chip ${draft.animation === a ? 'active' : ''}`,
      type: 'button',
      onclick: () => {
        draft.animation = a;
        animChips.querySelectorAll('.chip').forEach((c) => c.classList.toggle('active', c.dataset.key === a));
      }
    }, a.charAt(0).toUpperCase() + a.slice(1));
    chip.dataset.key = a;
    animChips.appendChild(chip);
  });

  const fileInput = el('input', { type: 'file', accept: 'image/*', class: 'input', onchange: (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => { draft.bgImage = ev.target.result; updatePreview(); };
    reader.readAsDataURL(file);
  }});

  const previewBox = el('div', { class: 'slide-preview', id: 'slide-preview-box' });

  function updatePreview() {
    const bg = draft.bgImage ? `url(${draft.bgImage}) center / cover no-repeat` : GRADIENTS[draft.bgStyle];
    const color = TEXT_COLORS[draft.textColor] || '#fff';
    const sizeCfg = TEXT_SIZES[draft.textSize] || TEXT_SIZES.medium;
    previewBox.style.background = bg;
    previewBox.style.color = color;
    previewBox.innerHTML = '';
    previewBox.appendChild(el('div', { class: 't', style: { fontSize: `calc(var(--text-2xl) * ${sizeCfg.factor})` } }, draft.title || 'Slide title'));
    previewBox.appendChild(el('div', { class: 'm', style: { fontSize: `calc(var(--text-lg) * ${sizeCfg.factor})` } }, draft.message || 'Your message appears here'));
    if (draft.subtitle) previewBox.appendChild(el('div', { class: 's', style: { fontSize: `calc(var(--text-sm) * ${sizeCfg.factor})` } }, draft.subtitle));
  }
  updatePreview();

  const body = el('div', { class: 'builder-grid' },
    el('div', {},
      el('div', { class: 'field' }, el('label', {}, 'Title *'), titleInput),
      el('div', { class: 'field' }, el('label', {}, 'Message *'), msgInput),
      el('div', { class: 'field' }, el('label', {}, 'Subtitle'), subInput),
      el('div', { class: 'field' }, el('label', {}, 'Background'), bgChips),
      el('div', { class: 'field' }, el('label', {}, 'Custom background image'), fileInput),
      el('div', { class: 'field' }, el('label', {}, 'Text color'), colorRow),
      el('div', { class: 'field' }, el('label', {}, 'Text size'), sizeChips),
      el('div', { class: 'field' }, el('label', {}, 'Animation'), animChips)
    ),
    el('div', {},
      el('div', { class: 'card-title', style: { marginBottom: 'var(--space-3)' } }, 'Live preview'),
      previewBox
    )
  );

  const saveBtn = el('button', { class: 'btn btn-primary', onclick: () => {
    if (!draft.title.trim() || !draft.message.trim()) { toast('Title and message are required', 'error'); return; }
    const slides = loadSlides();
    if (isEdit) {
      const idx = slides.findIndex((s) => s.id === existing.id);
      slides[idx] = { ...slides[idx], ...draft };
    } else {
      slides.push({ id: Date.now(), ...draft, active: false });
    }
    saveSlides(slides);
    toast(isEdit ? 'Slide updated' : 'Slide created', 'success');
    api.close();
    window.dispatchEvent(new HashChangeEvent('hashchange'));
  }}, isEdit ? 'Save changes' : 'Create slide');

  const cancelBtn = el('button', { class: 'btn btn-secondary', onclick: () => api.close() }, 'Cancel');

  const api = openModal({ title: isEdit ? 'Edit slide' : 'New announcement slide', body, footer: [cancelBtn, saveBtn], size: 'lg' });
}