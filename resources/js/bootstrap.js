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
        broadcaster: 'pusher', // Mudamos de 'reverb' para 'pusher' pois você tem chaves do Pusher
        key: appKey,
        cluster: cluster,
        forceTLS: true,
        wsHost: import.meta.env.VITE_PUSHER_HOST || `ws-${cluster}.pusher.com`,
        wsPort: 443,
        wssPort: 443,
        disableStats: true,
        enabledTransports: ['ws', 'wss'],
    });
    
    console.log('✅ Pusher conectado com sucesso no cluster:', cluster);
} else {
    console.error('❌ Erro: VITE_PUSHER_APP_KEY não encontrada no .env');
}