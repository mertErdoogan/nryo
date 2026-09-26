import { useEffect } from 'react';
import type { PageMeta } from '../seo';
import { SITE_NAME } from '../seo';

function setMeta(attr: 'name' | 'property', key: string, content: string) {
  let el = document.head.querySelector<HTMLMetaElement>(`meta[${attr}="${key}"]`);
  if (!el) {
    el = document.createElement('meta');
    el.setAttribute(attr, key);
    document.head.append(el);
  }
  el.content = content;
}

/** Keeps <title>, description, Open Graph and canonical tags in sync with the route. */
export function useDocumentMeta(meta: PageMeta): void {
  const { title, description, path } = meta;
  useEffect(() => {
    document.title = title;
    setMeta('name', 'description', description);
    setMeta('property', 'og:title', title);
    setMeta('property', 'og:description', description);
    setMeta('property', 'og:site_name', SITE_NAME);
    setMeta('name', 'twitter:title', title);
    setMeta('name', 'twitter:description', description);
    let canonical = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');
    if (!canonical) {
      canonical = document.createElement('link');
      canonical.rel = 'canonical';
      document.head.append(canonical);
    }
    const url = new URL(path.replace(/^\//, ''), document.baseURI);
    canonical.href = url.href;
    setMeta('property', 'og:url', url.href);
  }, [title, description, path]);
}
