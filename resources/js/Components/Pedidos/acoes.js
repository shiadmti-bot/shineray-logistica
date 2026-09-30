import { router } from '@inertiajs/react';
import { pedirTexto } from '@/Lib/alertas';

/** Rejeição pela gestão (ou cancelamento de pedido de peça), com motivo obrigatório. */
export async function rejeitarPedido(pedidoId) {
    const motivo = await pedirTexto({
        titulo: 'Rejeitar Pedido',
        placeholder: 'Motivo...',
        multilinha: true,
        textoConfirmar: 'Rejeitar',
        mensagemObrigatorio: 'Informe o motivo.',
        tom: 'perigo',
    });

    if (motivo) {
        router.post(route('pedidos.rejeitar', pedidoId), { motivo });
    }
}
