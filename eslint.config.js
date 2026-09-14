import js from '@eslint/js';
import globals from 'globals';
import react from 'eslint-plugin-react';
import reactHooks from 'eslint-plugin-react-hooks';

/**
 * Lint do front (v3.5).
 *
 * O build do Vite não pega variável fora de escopo: um componente quebrado ao
 * meio compila e só explode no navegador. `no-undef` e `react/jsx-no-undef`
 * são a rede de segurança para refatorar tela grande.
 */
export default [
    { ignores: ['public/**', 'vendor/**', 'node_modules/**', 'bootstrap/**', 'storage/**'] },
    {
        files: ['resources/js/**/*.{js,jsx}'],
        languageOptions: {
            ecmaVersion: 'latest',
            sourceType: 'module',
            parserOptions: { ecmaFeatures: { jsx: true } },
            globals: {
                ...globals.browser,
                route: 'readonly', // Ziggy, injetado por @routes
            },
        },
        settings: { react: { version: 'detect' } },
        plugins: { react, 'react-hooks': reactHooks },
        rules: {
            ...js.configs.recommended.rules,
            ...react.configs.recommended.rules,
            ...react.configs['jsx-runtime'].rules,
            'react-hooks/rules-of-hooks': 'error',
            'react-hooks/exhaustive-deps': 'warn',
            'react/prop-types': 'off',
            'react/no-unescaped-entities': 'off',
            'no-unused-vars': ['warn', { args: 'none', varsIgnorePattern: '^_' }],
            'no-empty': ['error', { allowEmptyCatch: true }],
        },
    },
];
