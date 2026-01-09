import Echo from 'laravel-echo';
import Pusher from 'pusher-js';

window.Pusher = Pusher;

window.Echo = new Echo({
    broadcaster: 'pusher', // Mudou de 'reverb' para 'pusher'
    key: '8281b5eba58fba87896e', // Cole a KEY aqui direto (ou use import.meta.env.VITE_PUSHER_APP_KEY)
    cluster: 'sa1',   // Ex: 'mt1' ou 'sa1'
    forceTLS: true
});