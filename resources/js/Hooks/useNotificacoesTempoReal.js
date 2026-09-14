import { useEffect, useRef } from 'react';
import { usePage } from '@inertiajs/react';
import { obterEcho } from '@/Lib/echo';

/**
 * Ouve as notificações do usuário logado no canal privado do Echo.
 *
 * O sininho e algumas telas (lista e detalhe de pedido, painel do gestor)
 * ouvem o MESMO canal. Cada um precisa remover só o próprio handler ao
 * desmontar: `stopListening('Notification')` não removia nada, e `Echo.leave`
 * derrubava o canal dos outros. Com o layout persistente o sininho não
 * desmonta entre telas — sem esta limpeza, cada navegação somaria um handler e
 * o mesmo aviso recarregaria a tela várias vezes.
 *
 * O callback é lido por ref: a tela pode passar uma função nova a cada render
 * sem reassinar o canal.
 */
export default function useNotificacoesTempoReal(aoReceber) {
    const userId = usePage().props.auth?.user?.id;
    const callback = useRef(aoReceber);
    callback.current = aoReceber;

    useEffect(() => {
        if (!userId) return undefined;

        let canal = null;
        let ativo = true;
        const handler = (notificacao) => callback.current?.(notificacao);

        // O Echo chega depois (carregado sob demanda); se a tela já desmontou
        // até lá, não assina.
        obterEcho().then((echo) => {
            if (!echo || !ativo) return;

            canal = echo.private(`App.Models.User.${userId}`);
            canal.notification(handler);
        });

        return () => {
            ativo = false;
            canal?.stopListeningForNotification(handler);
        };
    }, [userId]);
}
