let presentationWin = null;

export function registerPresentationWindow(win) {
  presentationWin = win;
}

export function getPresentationWindow() {
  return presentationWin;
}

export function postToPresentation(payload) {
  if (presentationWin && !presentationWin.closed) {
    try {
      presentationWin.postMessage(payload, window.location.origin);
      return true;
    } catch {
      return false;
    }
  }
  return false;
}

export function isPresentationOpen() {
  return !!(presentationWin && !presentationWin.closed);
}