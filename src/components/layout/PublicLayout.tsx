import { Outlet } from 'react-router-dom';
import { TopNav } from './TopNav';
import { Footer } from './Footer';

export function PublicLayout() {
  return (
    <div className="flex min-h-screen flex-col bg-canvas">
      {/* Accessibility: skip link, same pattern as AppShell. */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:left-lg focus:top-lg focus:z-10 focus:rounded-sm focus:bg-primary focus:px-md focus:py-sm focus:text-on-primary"
      >
        Skip to content
      </a>
      <TopNav />
      <main id="main-content" className="flex-1">
        <Outlet />
      </main>
      <Footer />
    </div>
  );
}
