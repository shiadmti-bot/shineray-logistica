import '../css/app.css';
import './bootstrap';

import { createInertiaApp } from '@inertiajs/react';
import { resolvePageComponent } from 'laravel-vite-plugin/inertia-helpers';
import { createRoot } from 'react-dom/client';

const appName = import.meta.env.VITE_APP_NAME || 'Shineray By Sabel';

// Telas fora do shell autenticado: login e afins, erro e manutenção.
const SEM_SHELL = /^(Auth\/|Error$|Maintenance$)/;

// A barra de progresso é a do próprio Inertia (`progress`, abaixo). Havia um
// NProgress manual ligado aos mesmos eventos: duas barras na mesma navegação.

createInertiaApp({
    title: (title) => `${title} - ${appName}`,
    resolve: async (name) => {
        const pagina = await resolvePageComponent(`./Pages/${name}.jsx`, import.meta.glob('./Pages/**/*.jsx'));

        /*
         * LAYOUT PERSISTENTE (v3.5)
         *
         * Cada tela envolvia o próprio conteúdo em <AppLayout>, então o shell
         * inteiro desmontava e montava de novo a cada clique: o sininho saía e
         * reassinava o canal privado (um /broadcasting/auth por navegação), o
         * OneSignal reiniciava e o menu perdia o estado. Declarado aqui, o
         * React reaproveita a mesma instância entre telas.
         *
         * Uma tela que precise de outra moldura define `Pagina.layout`, e este
         * padrão não a sobrescreve.
         */
        if (!SEM_SHELL.test(name)) {
            const { default: AppLayout } = await import('./Layouts/AppLayout');
            pagina.default.layout ??= (conteudo) => <AppLayout>{conteudo}</AppLayout>;
        }

        return pagina;
    },
    setup({ el, App, props }) {
        const root = createRoot(el);
        root.render(<App {...props} />);
    },
    progress: {
        color: '#DC2626', // Vermelho Shineray (red-600)
    },
});
