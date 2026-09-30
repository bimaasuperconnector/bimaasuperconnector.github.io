import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

// https://vite.dev/config/
export default defineConfig({
  // Served from the root of https://bimaasuperconnector.github.io/
  base: '/',
  build: {
    chunkSizeWarningLimit: 600,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules/firebase') || id.includes('node_modules/@firebase')) {
            return 'firebase';
          }
          if (id.includes('node_modules/react-router')) {
            return 'router';
          }
        },
      },
    },
  },
  plugins: [
    react(),
    VitePWA({
      // generateSW with no runtimeCaching entries precaches only the built
      // static app shell (JS/CSS/HTML/icons). It never intercepts
      // Firestore/Auth network calls, so private data is never cached by
      // the service worker — see SECURITY_AND_TESTING.md's PWA section.
      registerType: 'autoUpdate',
      injectRegister: false, // we call registerSW() ourselves in main.tsx
      // Listed explicitly (not a *.png glob) so the link-preview image
      // og-image.png is never pulled into the precache.
      includeAssets: [
        'assets/branding/logo-192.png',
        'assets/branding/logo-512.png',
        'assets/branding/apple-touch-icon.png',
        'assets/branding/logo.ico',
      ],
      manifest: {
        name: 'SuperConnector',
        short_name: 'SuperConnector',
        description:
          'A private alumni network, directory, and monthly connection engine.',
        start_url: '/app',
        scope: '/',
        display: 'standalone',
        background_color: '#ffffff',
        theme_color: '#181d26',
        icons: [
          {
            src: '/assets/branding/logo-192.png',
            sizes: '192x192',
            type: 'image/png',
          },
          {
            src: '/assets/branding/logo-512.png',
            sizes: '512x512',
            type: 'image/png',
          },
          {
            src: '/assets/branding/logo-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        // Precache the app shell only; do not add extra runtime caching
        // rules for API calls (Firestore/Auth are never intercepted).
        globPatterns: ['**/*.{js,css,html,svg,png,ico,webmanifest}'],
        // The link-preview image is only ever fetched by social-media
        // crawlers, never by the app itself — keep it out of the
        // precache so it doesn't add to every user's install/download.
        globIgnores: ['**/og-image*'],
        // Phase 15 PWA polish: without this, a direct/refreshed load of
        // a deep route (e.g. /app/directory) while OFFLINE hits a
        // browser network-error page, because that path was never
        // precached under its own name — only index.html was. This
        // makes any navigation request Workbox can't otherwise satisfy
        // fall back to the precached index.html shell, so client-side
        // routing + auth state take over as soon as they can. It only
        // matches full-page navigation requests (GET, mode:'navigate')
        // — it has no effect on the Firestore/Auth fetch/XHR calls
        // SECURITY_AND_TESTING.md's PWA section is about; those were
        // never intercepted before this change and still aren't.
        navigateFallback: '/index.html',
        navigateFallbackDenylist: [/^\/assets\//],
      },
    }),
  ],
});