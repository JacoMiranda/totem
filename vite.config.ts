import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import laravel from 'laravel-vite-plugin';
import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

/**
 * Projeto ÚNICO (não backend+frontend separados) - Laravel serve tudo,
 * o build de assets acontece dentro do MESMO projeto via laravel-vite-
 * plugin, dois pontos de entrada (kiosk e admin), cada um sua própria
 * página Blade (ver resources/views/kiosk.blade.php e admin.blade.php).
 *
 * PWA / Service Worker: DESLIGADO por padrão (`VITE_PWA=true` liga). Um SW
 * registrado por um `npm run build` anterior fica servindo bundle velho do
 * cache mesmo com o dev server no ar - causou muita confusão. Religa na
 * Fase 9 (deploy do totem), quando o offline-SW passa a valer a pena. O
 * offline dos dados (fila de sync em IndexedDB/Dexie) NÃO depende do SW.
 */
const comPwa = process.env.VITE_PWA === 'true';

export default defineConfig({
    plugins: [
        laravel({
            input: [
                'resources/css/app.css',
                'resources/js/site/main.tsx',
                'resources/js/kiosk/main.tsx',
                'resources/js/admin/main.tsx',
                'resources/js/mural/main.tsx',
                'resources/js/pulso/main.tsx',
            ],
            refresh: true,
        }),
        react(),
        tailwindcss(),
        ...(comPwa
            ? [
                  VitePWA({
                      registerType: 'autoUpdate',
                      scope: '/atendimento/',
                      includeAssets: [],
                      manifest: {
                          name: 'Ouvidoria Cidadã - Totem',
                          short_name: 'Ouvidoria',
                          start_url: '/atendimento',
                          scope: '/atendimento/',
                          display: 'fullscreen',
                          background_color: '#0f172a',
                          theme_color: '#0f172a',
                          icons: [],
                      },
                      workbox: {
                          navigateFallback: '/atendimento',
                          globPatterns: ['**/*.{js,css,html}'],
                          globIgnores: ['**/vosk-*.js'],
                          skipWaiting: true,
                          clientsClaim: true,
                          cleanupOutdatedCaches: true,
                          runtimeCaching: [
                              {
                                  urlPattern: ({ url }) => url.pathname.startsWith('/audio/kiosk/'),
                                  handler: 'CacheFirst',
                                  options: {
                                      cacheName: 'kiosk-audio',
                                      expiration: { maxEntries: 60, maxAgeSeconds: 60 * 60 * 24 * 90 },
                                  },
                              },
                              {
                                  urlPattern: ({ url }) => url.pathname.startsWith('/models/vosk/'),
                                  handler: 'CacheFirst',
                                  options: {
                                      cacheName: 'vosk-model',
                                      expiration: { maxEntries: 4, maxAgeSeconds: 60 * 60 * 24 * 180 },
                                      cacheableResponse: { statuses: [0, 200] },
                                  },
                              },
                              {
                                  urlPattern: ({ url }) => /\/assets\/vosk-.*\.js$/.test(url.pathname),
                                  handler: 'CacheFirst',
                                  options: {
                                      cacheName: 'vosk-lib',
                                      expiration: { maxEntries: 3, maxAgeSeconds: 60 * 60 * 24 * 180 },
                                  },
                              },
                          ],
                      },
                  }),
              ]
            : []),
    ],
});
