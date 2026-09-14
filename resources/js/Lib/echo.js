/**
 * Conexão de tempo real (Laravel Echo sobre Pusher), carregada sob demanda.
 *
 * pusher-js e laravel-echo iam no bundle inicial de toda tela, inclusive a de
 * login. Agora são baixados só quando alguém pede um canal — o sininho logo
 * depois da primeira pintura — e a mesma promessa serve a todos.
 */
let promessa = null;

export function obterEcho() {
    if (typeof window === 'undefined') return Promise.resolve(null);
    if (promessa) return promessa;

    const appKey = import.meta.env.VITE_PUSHER_APP_KEY;

    if (!appKey) {
        console.warn('Tempo real desativado: VITE_PUSHER_APP_KEY não definida.');
        promessa = Promise.resolve(null);
        return promessa;
    }

    promessa = Promise.all([import('laravel-echo'), import('pusher-js')])
        .then(([{ default: Echo }, { default: Pusher }]) => {
            window.Pusher = Pusher;

            const cluster = import.meta.env.VITE_PUSHER_APP_CLUSTER || 'sa1';

            const echo = new Echo({
                broadcaster: 'pusher',
                key: appKey,
                cluster,
                forceTLS: true,
                wsHost: import.meta.env.VITE_PUSHER_HOST || `ws-${cluster}.pusher.com`,
                wsPort: 443,
                wssPort: 443,
                disableStats: true,
                enabledTransports: ['ws', 'wss'], // WebSocket puro: mais rápido e estável
            });

            window.Echo = echo;

            // Celular derruba o WebSocket com a tela apagada; ao voltar para o
            // app, reconecta na hora.
            document.addEventListener('visibilitychange', () => {
                if (document.visibilityState !== 'visible') return;

                const estado = echo.connector.pusher.connection.state;

                if (estado !== 'connected' && estado !== 'connecting') {
                    echo.connector.pusher.connect();
                }
            });

            return echo;
        })
        .catch((erro) => {
            console.error('Falha ao iniciar o tempo real:', erro);
            return null;
        });

    return promessa;
}
