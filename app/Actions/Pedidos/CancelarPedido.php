<?php

namespace App\Actions\Pedidos;

use App\Actions\Pedidos\Concerns\RegistraHistorico;
use App\Enums\Perfil;
use App\Exceptions\OperacaoPedidoRecusada;
use App\Models\Basqueta;
use App\Models\EstoqueLocal;
use App\Models\Pedido;
use App\Models\PedidoLog;
use App\Models\ReservaMicrowork;
use App\Models\User;
use App\Services\Estoque\EstoquePecaService;
use Illuminate\Support\Facades\DB;

/**
 * Cancelamento (pela loja) ou rejeição (pela gestão) de um pedido.
 *
 * Moto volta ao estoque de onde saiu; peça tem a reserva liberada. O pedido é
 * soft-deleted com o motivo registrado. Extraído de
 * PedidoController::cancelarGenerico (v3.5).
 */
final class CancelarPedido
{
    use RegistraHistorico;

    /**
     * Estágios em que um pedido de peça ainda não teve peça tirada da prateleira.
     * Até aqui cancelar não move nada físico: não há reserva nem basqueta.
     */
    private const PECA_CANCELAVEL_PRE_SEPARACAO = [
        'solicitado', 'aguardando_confirmacao', 'em_atendimento', 'aprovado',
    ];

    public function __construct(private EstoquePecaService $estoque)
    {
    }

    /**
     * @param  Pedido  $pedido  com `motos`, `user` e `itensPedido.peca` carregados
     * @param  string  $tipo  'cancelado' ou 'rejeitado'
     *
     * @throws OperacaoPedidoRecusada
     */
    public function executar(Pedido $pedido, ?User $user, string $tipo, ?string $motivo): void
    {
        $ehStaff = (bool) $user?->temPerfil(...Perfil::operacaoCentral());
        $ehDono = $user && ($pedido->user_id === $user->id || $pedido->origem_user_id === $user->id);

        if (! $ehStaff && ! $ehDono) {
            throw new OperacaoPedidoRecusada('Você não tem permissão para cancelar este pedido.');
        }

        if ($pedido->tipo_carga === 'peca') {
            $impedimento = $this->impedimentoPeca($pedido, $user);

            if ($impedimento !== null) {
                throw new OperacaoPedidoRecusada($impedimento);
            }
        } elseif ($tipo === 'cancelado' && ! in_array($pedido->status, ['solicitado', 'em_analise'], true)) {
            throw new OperacaoPedidoRecusada('Não é possível cancelar neste estágio.');
        }

        DB::transaction(function () use ($pedido, $user, $tipo, $motivo) {
            $pedido->tipo_carga === 'peca'
                ? $this->liberarPecas($pedido)
                : $this->liberarMotos($pedido);

            $pedido->update([
                'status'          => $tipo,
                'motivo_rejeicao' => $motivo,
            ]);

            PedidoLog::create([
                'pedido_id' => $pedido->id,
                'titulo'    => ucfirst($tipo) . ' ❌',
                'descricao' => ($user?->name ?? 'Sistema') . " {$tipo} o pedido: " . ($motivo ?: 'Sem observação'),
            ]);

            $this->enviarNotificacao($pedido->user, ucfirst($tipo), "Pedido #{$pedido->id} $tipo: $motivo", route('pedidos.index'));

            $pedido->delete(); // soft delete
        });
    }

    /**
     * Por que este pedido de peça NÃO pode ser cancelado — ou null se pode.
     *
     * FONTE ÚNICA DA REGRA (v3.3). A tela (`pode_cancelar`, em
     * PedidoController::contextoPeca) e o servidor consultam este mesmo método.
     * Manter duas listas de status equivalentes em lugares diferentes é como
     * nasceu a segunda porta da carga: uma delas envelhece e vira brecha.
     *
     * DUAS TRAVAS, POR MOTIVOS DIFERENTES:
     *
     *   1. Depois de SEPARADO, quem desfaz é quem separou. A loja cancela até
     *      o CD tirar a peça da prateleira — mesma regra que o fluxo de motos
     *      já aplica ao cancelamento pela loja.
     *
     *   2. Depois de FATURADA a basqueta, ninguém cancela por aqui. A caixa
     *      foi lacrada sob uma NF; esvaziá-la deixaria a nota cobrindo
     *      mercadoria que não está mais lá. O caminho certo é o ciclo de
     *      ajuste do Passo 7, que cancela a nota e reabre a caixa antes de
     *      qualquer coisa sair.
     */
    public function impedimentoPeca(Pedido $pedido, ?User $user): ?string
    {
        if (! $user) {
            return 'Sessão expirada. Entre novamente para cancelar o pedido.';
        }

        $ehStaff = $user->temPerfil(...Perfil::operacaoCentral());
        $ehDono = $pedido->user_id === $user->id || $pedido->origem_user_id === $user->id;

        if (! $ehStaff && ! $ehDono) {
            return 'Você não tem permissão para cancelar este pedido.';
        }

        if (in_array($pedido->status, self::PECA_CANCELAVEL_PRE_SEPARACAO, true)) {
            return null;
        }

        if ($pedido->status !== 'separado') {
            return "Não é possível cancelar um pedido de peças no estágio '{$pedido->status}'.";
        }

        // --- Daqui para baixo o pedido já foi separado. ---

        if (! $ehStaff) {
            return 'O Estoque Central já separou estas peças. Peça ao CD para cancelar o pedido.';
        }

        $pedido->loadMissing('itensPedido');

        $basquetaIds = $pedido->itensPedido->pluck('basqueta_id')->filter()->unique();

        if ($basquetaIds->isEmpty()) {
            return null;
        }

        $fechada = Basqueta::whereIn('id', $basquetaIds)
            ->whereNotIn('status', Basqueta::ABERTAS)
            ->first();

        if ($fechada) {
            $nota = $fechada->notaVigente();

            return "A basqueta #{$fechada->id} já foi faturada"
                . ($nota ? " sob a NF {$nota->rotulo}" : '')
                . '. Cancelar agora deixaria a nota cobrindo mercadoria fora da caixa.'
                . ' Use o ajuste na conferência para cancelar a nota e reabrir a caixa antes.';
        }

        return null;
    }

    private function liberarPecas(Pedido $pedido): void
    {
        $origemId = $pedido->local_origem_id ?? EstoqueLocal::cd()?->id;

        foreach ($pedido->itensPedido as $item) {
            /*
             * Sem try/catch aqui, de propósito.
             *
             * Engolir a falha e seguir até o soft delete cancelava o pedido
             * deixando a reserva presa no CD — saldo prometido a um pedido que
             * não existe mais. Deixar a exceção subir derruba a transação
             * inteira: o cancelamento falha, o operador vê o motivo e nada fica
             * pela metade.
             */
            if ($item->isPeca() && $item->qtd_atribuida > 0 && $item->peca && $origemId) {
                $this->estoque->liberarReserva(
                    peca: $item->peca,
                    localId: $origemId,
                    quantidade: $item->qtd_atribuida,
                    pedido: $pedido,
                    pedidoItem: $item,
                    observacao: "Cancelamento do pedido #{$pedido->id}",
                );
            }

            if ($item->basqueta_id) {
                $item->update(['basqueta_id' => null]);
            }
        }
    }

    private function liberarMotos(Pedido $pedido): void
    {
        // Transferência volta para a loja dona; reposição volta para o CD.
        $statusVolta = $pedido->origem_user_id ? 'disponivel' : 'estoque_fabrica';
        $localVolta = $pedido->origem_user_id ? 'Estoque Loja' : 'Pátio CD/Fábrica';

        foreach ($pedido->motos as $moto) {
            $moto->update(['status' => $statusVolta, 'localizacao_atual' => $localVolta]);
        }

        $pedido->motos()->detach();

        ReservaMicrowork::where('pedido_id', $pedido->id)
            ->whereIn('status', ['pendente', 'faturada'])
            ->update(['status' => 'cancelada']);
    }
}
