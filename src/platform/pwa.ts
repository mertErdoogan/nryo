/**
 * Registers the build-generated service worker (production only). It caches
 * the app shell and every game chunk so the arcade keeps working offline
 * after the first visit.
 */
export function registerServiceWorker(): void {
  if (!import.meta.env.PROD || !('serviceWorker' in navigator)) return;
  window.addEventListener('load', () => {
    navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`).catch(() => {
      /* offline support is progressive enhancement */
    });
  });
}
