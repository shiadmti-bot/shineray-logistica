<?php

namespace App\Actions\Pedidos;

use App\Actions\Pedidos\Concerns\RegistraHistorico;
use App\Enums\Perfil;
use App\Exceptions\ComprovanteNaoArmazenadoException;
use App\Models\Devolucao;
use App\Models\Pedido;
use App\Models\Romaneio;
use App\Models\User;
use App\Services\ArquivoComprovante;
use App\Services\GoogleDriveComprovantes;
use Illuminate\Auth\Access\AuthorizationException;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

/**
 * Recebimento de um pedido de moto no destino, com canhoto e avarias.
 *
 * Extraído de PedidoController::finalizarEntrega (v3.5). Tudo numa transação:
 * se a foto não puder ser guardada, o recebimento inteiro é desfeito em vez de
 * concluído sem comprovante.
 */
final class FinalizarEntregaPedido
{
    use RegistraHistorico;

    /**
     * A moto já saiu do CD/origem. Só com todas assim o pedido pode ser
     * recebido — regra da diretoria contra baixa de carga parcial.
     */
    private const MOTO_DESPACHADA = [
        'em_transito', 'em_transito_cd', 'expedido', 'coletado', 'transito_loja',
        'concluido', 'estoque_loja', 'vendida', 'cancelado', 'rejeitado', 'avariado',
    ];

    public function __construct(private ArquivoComprovante $comprovantes)
    {
    }

    /**
     * @param  Pedido  $pedido  com `user` e `motos` carregados
     * @param  array<int|string, string>  $avarias  texto da avaria por id da moto
     * @param  array<int|string, UploadedFile>  $fotos  foto da avaria por id da moto
     *
     * @throws ValidationException|AuthorizationException
     */
    public function executar(Pedido $pedido, User $user, UploadedFile $romaneio, array $avarias, array $fotos): void
    {
        DB::transaction(function () use ($pedido, $user, $romaneio, $avarias, $fotos) {
            // v3.3: peças são recebidas em PecaAtendimentoController::receber, onde o
            // EstoquePecaService transfere o saldo e consome a reserva. Este fluxo
            // opera por chassi — sem o guard, a reserva ficaria presa no CD.
            if ($pedido->tipo_carga === 'peca') {
                throw ValidationException::withMessages([
                    'arquivo_romaneio' => 'Pedidos de peça são recebidos pela tela do pedido, usando o painel de conferência de peças.',
                ]);
            }

            if ($user->isLoja() && $pedido->user_id !== $user->id) {
                throw new AuthorizationException('Acesso não autorizado.');
            }

            $isDestinoCD = User::whereKey($pedido->user_id)->comPerfil(Perfil::Cd, Perfil::Admin)->exists();

            if ($user->isCd() && ! $isDestinoCD) {
                throw new AuthorizationException('O CD não tem permissão para finalizar pedidos. O recebimento oficial deve ser feito pela loja de destino.');
            }

            $this->barrarRecebimentoIncompleto($pedido);

            $filialDrive = $pedido->user?->filial;

            try {
                $pedido->comprovante_url = $this->comprovantes->guardar(
                    $romaneio,
                    'comprovantes',
                    "PEDIDO_{$pedido->id}_RECEBIMENTO",
                    $filialDrive,
                    GoogleDriveComprovantes::PASTA_COMPROVANTES,
                );
            } catch (ComprovanteNaoArmazenadoException $e) {
                throw $e->paraCampo('arquivo_romaneio');
            }

            $qtdAvarias = 0;

            foreach ($pedido->motos as $moto) {
                $motivo = mb_strtolower($moto->pivot->motivo ?? $pedido->motivo_solicitacao ?? 'Estoque Regular (Giro)', 'UTF-8');

                $novoStatus = (str_contains($motivo, 'venda') || str_contains($motivo, 'cliente'))
                    ? 'vendida'
                    : 'estoque_loja';

                $obsAvaria = null;
                $linkFoto = null;

                if (! empty($avarias[$moto->id])) {
                    $qtdAvarias++;
                    $novoStatus = 'avariado';
                    $obsAvaria = $avarias[$moto->id];

                    if (isset($fotos[$moto->id])) {
                        try {
                            $linkFoto = $this->comprovantes->guardar(
                                $fotos[$moto->id],
                                'avarias',
                                "AVARIA_{$moto->chassi}",
                                $filialDrive,
                                GoogleDriveComprovantes::PASTA_AVARIAS,
                            );
                        } catch (ComprovanteNaoArmazenadoException $e) {
                            throw $e->paraCampo('fotos_avarias');
                        }
                    }
                }

                $moto->update([
                    'status'            => $isDestinoCD ? (! empty($avarias[$moto->id]) ? 'avariado' : 'estoque_fabrica') : $novoStatus,
                    'localizacao_atual' => $isDestinoCD ? 'Pátio CD/Fábrica' : "Estoque Loja: {$pedido->user->filial}",
                    'loja_atual_id'     => $isDestinoCD ? null : $pedido->user_id,
                    'detalhes_avaria'   => $obsAvaria,
                    'foto_avaria'       => $linkFoto,
                    // romaneio_id é mantido: guarda o histórico do último romaneio.
                ]);

                // Histórico permanente da avaria no pedido.
                if ($obsAvaria || $linkFoto) {
                    $pedido->motos()->updateExistingPivot($moto->id, [
                        'detalhes_avaria' => $obsAvaria,
                        'foto_avaria'     => $linkFoto,
                    ]);
                }
            }

            $pedido->update(['status' => 'concluido']);

            // A regra de fechamento vive em Romaneio::fecharSeTudoEntregue(), porque
            // a devolução (v3) também fecha carga pelo caminho dela.
            foreach ($pedido->motos->pluck('romaneio_id')->filter()->unique() as $romaneioId) {
                Romaneio::with('motos.pedidos')->find($romaneioId)?->fecharSeTudoEntregue();
            }

            $this->registrarLog($pedido, 'Concluído', $qtdAvarias ? "Finalizado com $qtdAvarias avarias." : 'Recebimento 100%.');

            $this->avisarRecebimento($pedido, $user);
        });
    }

    private function barrarRecebimentoIncompleto(Pedido $pedido): void
    {
        // V3: pedido que é o frete de uma devolução fecha na tela da devolução.
        // Fechar por aqui pularia o checklist de destino — e uma moto que chega
        // avariada entraria no estoque do CD como boa, sem ninguém assinar.
        $devolucao = $pedido->devolucao;

        if ($devolucao && $devolucao->status !== Devolucao::STATUS_RECEBIDA) {
            throw ValidationException::withMessages([
                'arquivo_romaneio' => "Este pedido é o transporte da Devolução #{$devolucao->id}. "
                    . 'O recebimento é feito na tela da devolução, com o checklist de conferência do CD preenchido moto a moto.',
            ]);
        }

        // Qualificado com 'motos.status' por causa da tabela pivô.
        $motosPendentes = $pedido->motos()->whereNotIn('motos.status', self::MOTO_DESPACHADA)->count();

        if ($motosPendentes > 0) {
            throw ValidationException::withMessages([
                'arquivo_romaneio' => "BLOQUEIO DE RECEBIMENTO: Não é possível finalizar este pedido pois $motosPendentes moto(s) ainda se encontra(m) no CD/Origem aguardando logística. A diretoria determinou que a baixa no sistema só pode ser efetuada quando 100% da carga do pedido for despachada.",
            ]);
        }

        // V2.6: cotas sem chassi atribuído também travam o recebimento.
        $saldoSemChassi = $pedido->saldoPendente();

        if ($saldoSemChassi > 0) {
            throw ValidationException::withMessages([
                'arquivo_romaneio' => "BLOQUEIO DE RECEBIMENTO: $saldoSemChassi moto(s) deste pedido ainda não tiveram o chassi definido pelo CD. Solicite ao CD que atribua os chassis ou encerre o saldo em falta antes de finalizar.",
            ]);
        }
    }

    private function avisarRecebimento(Pedido $pedido, User $user): void
    {
        try {
            $link = route('pedidos.show', $pedido->id);

            $this->enviarNotificacao(
                User::operacaoCentral()->get(),
                'Entrega Confirmada ✅',
                "Loja {$pedido->user->filial} finalizou pedido #{$pedido->id}.",
                $link
            );

            if ($pedido->origem_user_id && $pedido->origem) {
                $this->enviarNotificacao(
                    $pedido->origem,
                    'Transferência Concluída 🏁',
                    "As motos do pedido #{$pedido->id} foram recebidas pela {$pedido->user->filial}!",
                    $link
                );
            }

            // Finalizado por outra pessoa (ex: admin): o solicitante precisa saber.
            if ($user->id !== $pedido->user_id) {
                $this->enviarNotificacao(
                    $pedido->user,
                    'Recebimento Confirmado ✅',
                    "Seu pedido #{$pedido->id} foi marcado como entregue/concluído.",
                    $link
                );
            }
        } catch (\Exception) {
            // Aviso não desfaz um recebimento já registrado.
        }
    }
}
