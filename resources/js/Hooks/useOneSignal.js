import { useEffect, useRef } from 'react';
import OneSignal from 'react-onesignal';
import axios from 'axios';

/**
 * Inicializa o OneSignal uma única vez por sessão de página e
 * sincroniza o ID de notificação push com o backend.
 */
export default function useOneSignal(appIdFromProps, currentUser) {
    const iniciado = useRef(false);

    useEffect(() => {
        const syncSubscription = async () => {
            try {
                const isOptedIn = OneSignal.User?.PushSubscription?.optedIn;
                const subscriptionId = OneSignal.User?.PushSubscription?.id;
                const userId = await OneSignal.User?.getOnesignalId?.();
                const idToSave = subscriptionId || userId;

                if (idToSave) {
                    axios.post('/user/onesignal', { onesignal_id: idToSave }).catch(() => {});
                }
            } catch (err) {
                // Silencioso se o usuário ainda não permitiu notificações
            }
        };

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

                // Se houver usuário logado, associa o ID externo para segmentação
                if (currentUser?.id && typeof OneSignal.login === 'function') {
                    OneSignal.login(String(currentUser.id)).catch(() => {});
                }

                // Solicita permissão se ainda não foi decidida
                try {
                    if (OneSignal.Slidedown) {
                        OneSignal.Slidedown.promptPush();
                    } else if (typeof OneSignal.ShowSlidedownPrompt === 'function') {
                        OneSignal.ShowSlidedownPrompt();
                    }
                } catch {
                    /* bloqueadores de anúncio derrubam o prompt; não é erro fatal */
                }

                // Sincroniza quando houver mudança de permissão
                OneSignal.User?.PushSubscription?.addEventListener('change', async (event) => {
                    if (event.current.optedIn) {
                        syncSubscription();
                    }
                });

                // Sincronização inicial de garantia
                setTimeout(syncSubscription, 1500);
            } catch (error) {
                console.warn('OneSignal status:', error);
            }
        };

        iniciar();
    }, [appIdFromProps, currentUser?.id]);
}

