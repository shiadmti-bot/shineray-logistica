import { defineConfig } from 'vite';
import laravel from 'laravel-vite-plugin';
import react from '@vitejs/plugin-react';

export default defineConfig({
    plugins: [
        laravel({
            input: 'resources/js/app.jsx',
            refresh: true,
        }),
        react(),
    ],
    build: {
        rollupOptions: {
            output: {
                // React e Inertia mudam pouco entre deploys. Num chunk próprio, o
                // navegador reaproveita o cache deles mesmo quando as telas mudam.
                // (Os nomes com hash já são o padrão do Vite.)
                manualChunks: {
                    vendor: ['react', 'react-dom', '@inertiajs/react'],
                },
            },
        },
    },
});
