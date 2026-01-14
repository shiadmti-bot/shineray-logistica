import axios from 'axios';
window.axios = axios;

window.axios.defaults.headers.common['X-Requested-With'] = 'XMLHttpRequest';

import Echo from 'laravel-echo';
import Pusher from 'pusher-js';

window.Pusher = Pusher;

// Pega as chaves do .env (que agora começam com VITE_)
const appKey = import.meta.env.VITE_PUSHER_APP_KEY;
const cluster = import.meta.env.VITE_PUSHER_APP_CLUSTER || 'sa1';

if (appKey) {
    window.Echo = new Echo({
        broadcaster: 'pusher',
        key: appKey,
        cluster: cluster,
        forceTLS: true,
        wsHost: import.meta.env.VITE_PUSHER_HOST || `ws-${cluster}.pusher.com`,
        wsPort: 443,
        wssPort: 443,
        disableStats: true,
        enabledTransports: ['ws', 'wss'], // Força WebSocket puro (mais rápido e estável)
    });
    
    console.log('✅ Pusher conectado com sucesso no cluster:', cluster);

    // --- FIX MOBILE: RECONEXÃO INTELIGENTE 📱 ---
    // Celulares cortam a conexão WebSocket quando a tela apaga para economizar bateria.
    // Este código detecta quando o usuário volta para o App e reconecta na hora.
    document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') {
            const state = window.Echo.connector.pusher.connection.state;
            
            if (state !== 'connected' && state !== 'connecting') {
                console.log('📱 App voltou para o primeiro plano. Reconectando socket...');
                window.Echo.connector.pusher.connect();
            }
        }
    });

} else {
    console.error('❌ Erro: VITE_PUSHER_APP_KEY não encontrada no .env');
}