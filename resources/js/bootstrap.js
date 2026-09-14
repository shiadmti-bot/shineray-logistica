import axios from 'axios';

window.axios = axios;

window.axios.defaults.headers.common['X-Requested-With'] = 'XMLHttpRequest';

// O tempo real (Echo/Pusher) não entra no bundle inicial: é carregado sob
// demanda por Lib/echo.js.
