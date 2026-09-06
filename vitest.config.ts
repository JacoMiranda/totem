import { defineConfig } from 'vitest/config';

/**
 * Config separada da vite.config.ts (que carrega PWA/Laravel/Tailwind e
 * não faz sentido em teste unitário). Cobre a lógica pura em
 * resources/js/shared/ - o classificador local offline em especial.
 */
export default defineConfig({
    test: {
        include: ['resources/js/**/*.test.ts'],
        environment: 'node',
    },
});
