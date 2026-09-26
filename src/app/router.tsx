import type { AnchorHTMLAttributes, MouseEvent, ReactNode } from 'react';
import { useSyncExternalStore } from 'react';

/**
 * A deliberately small History-API router. The app has a handful of static
 * routes, so a dependency would add weight without adding value.
 */
export type Route =
  | { name: 'home' }
  | { name: 'games' }
  | { name: 'categories' }
  | { name: 'favorites' }
  | { name: 'profile' }
  | { name: 'play'; id: string }
  | { name: 'not-found' };

const BASE = (import.meta.env.BASE_URL ?? '/').replace(/\/$/, '');

export function stripBase(pathname: string): string {
  if (BASE && pathname.startsWith(BASE)) return pathname.slice(BASE.length) || '/';
  return pathname;
}

export function withBase(path: string): string {
  return `${BASE}${path}`;
}

export function parseRoute(pathname: string): Route {
  const path = stripBase(pathname).replace(/\/+$/, '') || '/';
  if (path === '/') return { name: 'home' };
  if (path === '/games') return { name: 'games' };
  if (path === '/categories') return { name: 'categories' };
  if (path === '/favorites') return { name: 'favorites' };
  if (path === '/profile') return { name: 'profile' };
  const play = /^\/games\/([a-z0-9-]{1,64})$/.exec(path);
  if (play) return { name: 'play', id: play[1]! };
  return { name: 'not-found' };
}

interface LocationSnapshot {
  pathname: string;
  search: string;
  key: string;
}

let snapshot: LocationSnapshot = readLocation();
const listeners = new Set<() => void>();
const scrollPositions = new Map<string, number>();

function readLocation(): LocationSnapshot {
  if (typeof window === 'undefined') return { pathname: '/', search: '', key: 'initial' };
  const state = window.history.state as { key?: string } | null;
  return { pathname: window.location.pathname, search: window.location.search, key: state?.key ?? 'initial' };
}

function update(): void {
  snapshot = readLocation();
  listeners.forEach((l) => l());
}

if (typeof window !== 'undefined') {
  if ('scrollRestoration' in window.history) window.history.scrollRestoration = 'manual';
  window.addEventListener('popstate', () => {
    update();
    const y = scrollPositions.get(snapshot.key) ?? 0;
    requestAnimationFrame(() => window.scrollTo(0, y));
  });
}

let counter = 0;
const newKey = () => `${Date.now().toString(36)}-${(counter++).toString(36)}`;

export function navigate(to: string, opts: { replace?: boolean; keepScroll?: boolean } = {}): void {
  scrollPositions.set(snapshot.key, window.scrollY);
  const url = to.startsWith('/') ? withBase(to) : to;
  const state = { key: newKey() };
  if (opts.replace) window.history.replaceState(state, '', url);
  else window.history.pushState(state, '', url);
  update();
  if (!opts.keepScroll) window.scrollTo(0, 0);
}

export function goBack(fallback = '/'): void {
  if (window.history.length > 1 && snapshot.key !== 'initial') window.history.back();
  else navigate(fallback, { replace: true });
}

export function useLocation(): LocationSnapshot {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => snapshot,
    () => snapshot,
  );
}

export function useRoute(): Route {
  return parseRoute(useLocation().pathname);
}

export function useSearchParams(): URLSearchParams {
  return new URLSearchParams(useLocation().search);
}

export function isActivePath(pathname: string, target: string): boolean {
  const path = stripBase(pathname);
  if (target === '/') return path === '/';
  return path === target || path.startsWith(`${target}/`);
}

type LinkProps = Omit<AnchorHTMLAttributes<HTMLAnchorElement>, 'href'> & {
  to: string;
  replace?: boolean;
  children: ReactNode;
};

export function Link({ to, replace, onClick, children, ...rest }: LinkProps) {
  const handleClick = (event: MouseEvent<HTMLAnchorElement>) => {
    onClick?.(event);
    if (
      event.defaultPrevented ||
      event.button !== 0 ||
      event.metaKey ||
      event.ctrlKey ||
      event.shiftKey ||
      event.altKey ||
      rest.target === '_blank'
    ) {
      return;
    }
    event.preventDefault();
    navigate(to, { replace });
  };
  return (
    <a href={withBase(to)} onClick={handleClick} {...rest}>
      {children}
    </a>
  );
}
