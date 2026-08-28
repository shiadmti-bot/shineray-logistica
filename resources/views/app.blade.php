<!DOCTYPE html>
<html lang="{{ str_replace('_', '-', app()->getLocale()) }}">
        <head>
        <meta charset="utf-8">
        {{-- viewport-fit=cover é o que faz env(safe-area-inset-*) devolver valor
             real no iOS. Sem ele, a barra fixa da montagem de carga fica sob o
             indicador de gestos do iPhone. Ver .safe-area-bottom em app.css. --}}
        <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">

        <title inertia>{{ config('app.name', 'Shineray Sabel') }}</title>

        <link rel="icon" type="image/png" href="/img/logo.png">
        <link rel="shortcut icon" href="/img/logo.png">

        <link rel="manifest" href="/manifest.json">
        <meta name="theme-color" content="#DC2626">
        <meta name="apple-mobile-web-app-capable" content="yes">
        <meta name="mobile-web-app-capable" content="yes">
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">

        <link rel="preconnect" href="https://fonts.bunny.net">
        <link href="https://fonts.bunny.net/css?family=figtree:400,500,600&display=swap" rel="stylesheet" />

        @routes
        @viteReactRefresh
        @vite(['resources/js/app.jsx', "resources/js/Pages/{$page['component']}.jsx"])
        @inertiaHead
    </head>
    <body class="font-sans antialiased">
        @inertia
    </body>
</html>
