// src/lib/present-bus.js
// Cross-window message bus for presenter ↔ output communication.

const CHANNEL_NAME = 'jfcm-present';

let channel = null;

function getChannel() {
  if (channel) return channel;
  if ('BroadcastChannel' in window) {
    channel = new BroadcastChannel(CHANNEL_NAME);
  } else {
    // Fallback: emulate with storage events
    channel = {
      _handlers: new Set(),
      postMessage(msg) {
        localStorage.setItem(CHANNEL_NAME, JSON.stringify({ ...msg, _t: Date.now() }));
      },
      addEventListener(type, fn) { if (type === 'message') this._handlers.add(fn); },
      removeEventListener(type, fn) { if (type === 'message') this._handlers.delete(fn); },
      close() { this._handlers.clear(); }
    };
    window.addEventListener('storage', (e) => {
      if (e.key !== CHANNEL_NAME || !e.newValue) return;
      try {
        const msg = JSON.parse(e.newValue);
        channel._handlers.forEach((fn) => fn({ data: msg }));
      } catch {}
    });
  }
  return channel;
}

export function sendMessage(msg) {
  getChannel().postMessage(msg);
}

export function onMessage(fn) {
  const ch = getChannel();
  const handler = (e) => fn(e.data);
  ch.addEventListener('message', handler);
  return () => ch.removeEventListener('message', handler);
}

/** Presenter registers itself so the output can ping it. */
export function announcePresenter(meta = {}) {
  sendMessage({ type: 'presenter:hello', meta, ts: Date.now() });
}