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
                // React e Inertia mudam pouco entre deploys: num chunk próprio, o
                // navegador reaproveita o cache mesmo quando as telas mudam. As
                // bibliotecas pesadas ficam cada uma no seu e só descem com a
                // tela que as usa.
                //
                // Tem de ser função, não objeto. No formato objeto o Rollup leva
                // junto as dependências de cada pacote listado, e o
                // react/jsx-runtime foi parar no vendor-editor: a primeira tela
                // de qualquer usuário baixava e executava o Quill.
                manualChunks(id) {
                    if (!id.includes('/node_modules/')) return;

                    if (/\/node_modules\/(react|react-dom|scheduler|@inertiajs)\//.test(id)) return 'vendor';
                    if (/\/node_modules\/(apexcharts|react-apexcharts)\//.test(id)) return 'vendor-charts';
                    if (id.includes('/node_modules/@fullcalendar/')) return 'vendor-calendar';
                    if (/\/node_modules\/(react-quill-new|quill|quill-delta|parchment)\//.test(id)) return 'vendor-editor';
                    if (id.includes('/node_modules/sweetalert2/')) return 'vendor-swal';
                },
            },
        },
    },
});
