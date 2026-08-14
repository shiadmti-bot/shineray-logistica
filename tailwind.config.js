import defaultTheme from 'tailwindcss/defaultTheme';
import forms from '@tailwindcss/forms';

/**
 * DESIGN TOKENS — Shineray By Sabel (v3)
 *
 * As telas atuais usam cores cruas (red-700, gray-50, bg-white). Isso funcionou
 * enquanto o sistema tinha um só módulo; com Motos + Peças + Logística, cada
 * tela nova reinventa a paleta e o resultado deixa de parecer um sistema só.
 *
 * Os tokens abaixo nomeiam a INTENÇÃO, não a cor:
 *   brand    -> identidade Shineray (vermelho)
 *   surface  -> fundos (página, cartão, elevado)
 *   content  -> textos por hierarquia
 *   line     -> bordas e divisores
 *   status   -> semântica de estado (sucesso/alerta/erro/info/neutro)
 *
 * Usar `bg-surface-card` em vez de `bg-white` é o que permite ajustar o tema
 * inteiro num lugar só — e é pré-requisito para o modo escuro, que os tokens
 * já acomodam via CSS custom properties em app.css.
 */
export default {
    content: [
        './vendor/laravel/framework/src/Illuminate/Pagination/resources/views/*.blade.php',
        './storage/framework/views/*.php',
        './resources/views/**/*.blade.php',
        './resources/js/**/*.jsx',
    ],

    theme: {
        extend: {
            fontFamily: {
                sans: ['Figtree', ...defaultTheme.fontFamily.sans],
            },

            colors: {
                brand: {
                    50:  '#fef2f2',
                    100: '#fee2e2',
                    200: '#fecaca',
                    300: '#fca5a5',
                    400: '#f87171',
                    500: '#ef4444',
                    600: '#dc2626', // cor primária de ação
                    700: '#b91c1c',
                    800: '#991b1b',
                    900: '#7f1d1d', // topo do gradiente da navegação
                    950: '#450a0a',
                },

                surface: {
                    page:     'rgb(var(--surface-page) / <alpha-value>)',
                    card:     'rgb(var(--surface-card) / <alpha-value>)',
                    raised:   'rgb(var(--surface-raised) / <alpha-value>)',
                    sunken:   'rgb(var(--surface-sunken) / <alpha-value>)',
                    inverted: 'rgb(var(--surface-inverted) / <alpha-value>)',
                },

                content: {
                    primary:   'rgb(var(--content-primary) / <alpha-value>)',
                    secondary: 'rgb(var(--content-secondary) / <alpha-value>)',
                    muted:     'rgb(var(--content-muted) / <alpha-value>)',
                    inverted:  'rgb(var(--content-inverted) / <alpha-value>)',
                },

                line: {
                    DEFAULT: 'rgb(var(--line-default) / <alpha-value>)',
                    strong:  'rgb(var(--line-strong) / <alpha-value>)',
                },

                // Semântica de estado. Cada uma tem fg (texto/ícone),
                // bg (fundo suave do badge) e solid (preenchimento forte).
                status: {
                    'success-fg':    '#15803d',
                    'success-bg':    '#dcfce7',
                    'success-solid': '#16a34a',
                    'warning-fg':    '#a16207',
                    'warning-bg':    '#fef9c3',
                    'warning-solid': '#ca8a04',
                    'danger-fg':     '#b91c1c',
                    'danger-bg':     '#fee2e2',
                    'danger-solid':  '#dc2626',
                    'info-fg':       '#1d4ed8',
                    'info-bg':       '#dbeafe',
                    'info-solid':    '#2563eb',
                    'neutral-fg':    '#374151',
                    'neutral-bg':    '#f3f4f6',
                    'neutral-solid': '#6b7280',
                },
            },

            borderRadius: {
                card: '0.875rem',
            },

            boxShadow: {
                card:       '0 1px 2px 0 rgb(0 0 0 / 0.04), 0 1px 3px 0 rgb(0 0 0 / 0.06)',
                'card-hover': '0 4px 12px -2px rgb(0 0 0 / 0.10), 0 2px 6px -2px rgb(0 0 0 / 0.06)',
                overlay:    '0 20px 40px -12px rgb(0 0 0 / 0.25)',
            },

            spacing: {
                sidebar: '16rem',
                'sidebar-collapsed': '4.5rem',
                topbar: '4rem',
            },

            zIndex: {
                sidebar: '40',
                topbar: '45',
                overlay: '50',
                toast: '60',
            },

            keyframes: {
                'slide-in-right': {
                    '0%':   { transform: 'translateX(100%)', opacity: '0' },
                    '100%': { transform: 'translateX(0)', opacity: '1' },
                },
                'fade-in-up': {
                    '0%':   { transform: 'translateY(6px)', opacity: '0' },
                    '100%': { transform: 'translateY(0)', opacity: '1' },
                },
            },

            animation: {
                'slide-in-right': 'slide-in-right 0.25s ease-out',
                'fade-in-up': 'fade-in-up 0.2s ease-out',
            },
        },
    },

    plugins: [forms],
};
