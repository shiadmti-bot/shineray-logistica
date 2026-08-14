import { useEffect, useRef } from 'react';
import OneSignal from 'react-onesignal';
import axios from 'axios';

/**
 * Inicializa o OneSignal uma única vez por sessão de página.
 *
 * Extraído do AuthenticatedLayout para que o layout novo (AppLayout) não
 * precise duplicar a lógica — dois layouts inicializando o SDK em paralelo
 * registram o dispositivo duas vezes e geram notificação duplicada.
 *
 * O ref de guarda é intencional: o StrictMode do React roda o efeito duas vezes
 * em desenvolvimento, e sem ele o init dispara em duplicidade.
 */
export default function useOneSignal(appIdFromProps) {
    const iniciado = useRef(false);

    useEffect(() => {
        const iniciar = async () => {
            if (iniciado.current || typeof window === 'undefined') return;
            iniciado.current = true;

            try {
                const appId = appIdFromProps || 'a114f37e-c4b7-4fb4-a580-51d78c8bfa57';

                await OneSignal.init({
                    appId,
                    allowLocalhostAsSecureOrigin: true,
                    notifyButton: { enable: true },
                });

                try {
                    if (OneSignal.Slidedown) {
                        OneSignal.Slidedown.promptPush();
                    } else if (typeof OneSignal.ShowSlidedownPrompt === 'function') {
                        OneSignal.ShowSlidedownPrompt();
                    }
                } catch {
                    /* bloqueadores de anúncio derrubam o prompt; não é erro fatal */
                }

                OneSignal.User.PushSubscription.addEventListener('change', async (event) => {
                    if (event.current.optedIn) {
                        const userId = await OneSignal.User.getOnesignalId();
                        if (userId) {
                            axios.post('/user/onesignal', { onesignal_id: userId }).catch(() => {});
                        }
                    }
                });
            } catch (error) {
                console.warn('OneSignal status:', error);
            }
        };

        iniciar();
    }, [appIdFromProps]);
}
