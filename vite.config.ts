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
 * PWA (offline-first, Service Worker via Workbox) só no entry do kiosk -
 * o admin não precisa funcionar offline.
 */
export default defineConfig({
    plugins: [
        laravel({
            input: ['resources/css/app.css', 'resources/js/kiosk/main.tsx', 'resources/js/admin/main.tsx'],
            refresh: true,
        }),
        react(),
        tailwindcss(),
        VitePWA({
            // Só o kiosk é PWA - o manifest/service-worker só deve
            // controlar o escopo /atendimento (rota do totem), nunca o
            // /admin.
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
                // Áudios das frases fixas (public/audio/kiosk/*.wav) não
                // passam pelo build do Vite - cacheia em runtime na 1ª
                // reprodução pra ficarem disponíveis offline depois.
                runtimeCaching: [
                    {
                        urlPattern: ({ url }) => url.pathname.startsWith('/audio/kiosk/'),
                        handler: 'CacheFirst',
                        options: {
                            cacheName: 'kiosk-audio',
                            expiration: { maxEntries: 60, maxAgeSeconds: 60 * 60 * 24 * 90 },
                        },
                    },
                ],
            },
        }),
    ],
});
