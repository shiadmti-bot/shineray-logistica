import '../css/app.css';
import './bootstrap';

import { createInertiaApp } from '@inertiajs/react';
import { resolvePageComponent } from 'laravel-vite-plugin/inertia-helpers';
import { createRoot } from 'react-dom/client';

// 1. Importar NProgress
import NProgress from 'nprogress';
import { router } from '@inertiajs/react';

const appName = import.meta.env.VITE_APP_NAME || 'Shineray By Sabel';

// 2. Configurar os eventos
router.on('start', () => NProgress.start());
router.on('finish', () => NProgress.done());

createInertiaApp({
    title: (title) => `${title} - ${appName}`,
    resolve: (name) => resolvePageComponent(`./Pages/${name}.jsx`, import.meta.glob('./Pages/**/*.jsx')),
    setup({ el, App, props }) {
        const root = createRoot(el);
        root.render(<App {...props} />);
    },
    progress: {
        color: '#DC2626', // Vermelho Shineray (red-600)
    },
});