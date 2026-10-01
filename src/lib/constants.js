export const FONTS = [
  'Cinzel', 'Fraunces', 'Georgia', 'Times New Roman',
  'Inter', 'Arial', 'Helvetica', 'Verdana',
  'Open Sans', 'Montserrat', 'Playfair Display', 'Merriweather'
];

export const GRADIENTS = {
  'gold':    'linear-gradient(135deg, #1a1a2e, #c9a227)',
  'blue':    'linear-gradient(135deg, #0f0c29, #302b63, #24243e)',
  'purple':  'linear-gradient(135deg, #667eea, #764ba2)',
  'sunset':  'linear-gradient(135deg, #f093fb, #f5576c)',
  'ocean':   'linear-gradient(135deg, #2b5876, #4e4376)',
  'forest':  'linear-gradient(135deg, #134e5e, #71b280)',
  'church':  'linear-gradient(135deg, #2c1810, #8b7355)',
  'royal':   'linear-gradient(135deg, #141e30, #2c1b4d)'
};

export const TEXT_COLORS = {
  white: '#ffffff',
  gold: '#c9a227',
  black: '#1a1a1a',
  cream: '#f5e6d3',
  lightblue: '#87ceeb',
  pink: '#ffb6c1'
};

export const TEXT_SIZES = {
  small:  { label: 'S',  factor: 0.75 },
  medium: { label: 'M',  factor: 1 },
  large:  { label: 'L',  factor: 1.4 },
  xlarge: { label: 'XL', factor: 1.8 }
};

export const ANIMATIONS = ['fade', 'slide', 'zoom', 'none'];

export const CATEGORY_TAGS = ['Fast Song', 'Slow Song', 'Hymn', 'Contemporary', 'Communion', 'Christmas', 'Easter'];

export const STORAGE_KEYS = {
  auth: 'jfcm.auth',
  theme: 'jfcm.theme',
  appState: 'jfcm.appState',
  announcements: 'jfcm.announcements',
  pdf: 'jfcm.pdf',
  preferences: 'jfcm.preferences'
};

export const DEFAULT_PREFS = {
  theme: 'dark',
  fontFamily: 'Cinzel',
  presentationFontSize: 3.2,
  previewFontSize: 2.2
};