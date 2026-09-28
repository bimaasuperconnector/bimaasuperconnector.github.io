import { useEffect, useRef } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { TopNav } from './TopNav';
import { Footer } from './Footer';

/**
 * React Router doesn't scroll to #hash targets or reset scroll on navigation,
 * so the header's "How it works" / "The network" links did nothing. This
 * scrolls to the target section (smoothly — see index.css; the sticky
 * header's height is accounted for via scroll-padding), and returns to the
 * top when moving between public pages. The very first render is left alone
 * so a browser-restored scroll position on refresh isn't undone.
 */
function ScrollManager() {
  const { pathname, hash, key } = useLocation();
  const isFirstRender = useRef(true);

  useEffect(() => {
    const isFirst = isFirstRender.current;
    isFirstRender.current = false;

    if (hash) {
      const target = document.getElementById(decodeURIComponent(hash.slice(1)));
      if (target) {
        target.scrollIntoView();
        return;
      }
    }
    if (!isFirst) window.scrollTo(0, 0);
  }, [pathname, hash, key]);

  return null;
}

export function PublicLayout() {
  return (
    <div className="flex min-h-screen flex-col bg-canvas">
      {/* Accessibility: skip link, same pattern as AppShell. */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:left-lg focus:top-lg focus:z-40 focus:rounded-sm focus:bg-primary focus:px-md focus:py-sm focus:text-on-primary"
      >
        Skip to content
      </a>
      <ScrollManager />
      <TopNav />
      <main id="main-content" className="flex-1">
        <Outlet />
      </main>
      <Footer />
    </div>
  );
}
