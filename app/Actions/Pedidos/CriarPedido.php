<?php

namespace App\Actions\Pedidos;

use App\Actions\Pedidos\Concerns\RegistraHistorico;
use App\Enums\Perfil;
use App\Models\Moto;
use App\Models\Pedido;
use App\Models\PedidoItem;
use App\Models\User;
use App\Services\AtribuicaoChassiService;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

/**
 * Abre um pedido de moto: reposição do CD ou transferência entre unidades.
 *
 * Extraído de PedidoController::store (v3.5) sem mudar a regra — ver
 * PedidoMotoFluxoTest. O formato da requisição é conferido em
 * StorePedidoRequest; aqui ficam as travas que dependem do estado do sistema.
 */
final class CriarPedido
{
    use RegistraHistorico;

    /**
     * V2.6: Motivos em que a loja continua obrigada a informar o chassi.
     * "Venda Confirmada" é mantida por compatibilidade com pedidos legados,
     * onde o vendedor fecha a venda olhando um chassi específico.
     */
    public const MOTIVOS_EXIGEM_CHASSI = ['Venda Confirmada (Cliente)'];

    /** Moto nestes status já está comprometida e não pode sair numa transferência. */
    private const MOTO_INDISPONIVEL_PARA_TRANSFERENCIA = [
        'vendida', 'reservado', 'solicitado', 'separado', 'aguardando_coleta', 'em_transito', 'expedido', 'transito_loja',
    ];

    public function __construct(private AtribuicaoChassiService $atribuicao)
    {
    }

    /**
     * @param  array{itens: array<int, array>, modo?: ?string, origem_id?: mixed, destino_id?: mixed, cd_user_id?: mixed, observacao?: ?string}  $dados
     */
    public function executar(User $user, array $dados): Pedido
    {
        return DB::transaction(function () use ($user, $dados) {
            $this->barrarCargaNaoFinalizada($user);

            [$destinoUserId, $origemUserId] = $this->resolverOrigemEDestino($user, $dados);
            $isTransferencia = ! empty($origemUserId);

            $itens = $this->normalizarItens($dados['itens'], $isTransferencia);

            if ($isTransferencia && ! User::whereKey($origemUserId)->exists()) {
                throw ValidationException::withMessages(['origem_id' => 'Fornecedor não encontrado.']);
            }

            $pedido = Pedido::create([
                'user_id'        => $destinoUserId,  // quem recebe a moto
                'origem_user_id' => $origemUserId,   // de onde a moto sai
                'status'         => 'em_analise',
                'observacao'     => $dados['observacao'] ?? null,
                // JSON mantido como espelho da solicitação (telas legadas + auditoria)
                'itens'          => $itens,
            ]);

            // Regra compartilhada com a atribuição do CD, para que criar um
            // pedido e bipar um chassi apliquem exatamente o mesmo bloqueio.
            $this->atribuicao->validarChassisLivres(array_column($itens, 'chassi'));

            $syncLogs = [];        // ajustes automáticos no cadastro, para a linha do tempo
            $motosParaAttach = []; // vínculo em lote, uma query só
            $totalUnidades = 0;
            $unidadesSemChassi = 0;

            foreach ($itens as $item) {
                $chassi = $item['chassi'];

                // Cota do pedido (v2.6) — criada sempre, com ou sem chassi.
                $pedidoItem = PedidoItem::create([
                    'pedido_id'     => $pedido->id,
                    'modelo'        => $item['modelo'],
                    'cor'           => $item['cor'],
                    'motivo'        => $item['motivo'],
                    'local'         => $item['local'],
                    'quantidade'    => $item['quantidade'],
                    'qtd_atribuida' => $chassi ? 1 : 0,
                    'exige_chassi'  => $item['exige_chassi'],
                ]);

                $totalUnidades += $item['quantidade'];

                // Pedido genérico: sem chassi agora, o CD atribui depois.
                if (! $chassi) {
                    $unidadesSemChassi += $item['quantidade'];
                    continue;
                }

                $moto = $isTransferencia
                    ? $this->motoDaTransferencia($chassi, $item, (int) $origemUserId, $syncLogs)
                    : $this->motoDoCd($chassi, $item, $syncLogs);

                $motosParaAttach[$moto->id] = [
                    'destino'        => $item['local'],
                    'motivo'         => $item['motivo'],
                    'pedido_item_id' => $pedidoItem->id,
                ];
            }

            if (! empty($motosParaAttach)) {
                $pedido->motos()->attach($motosParaAttach);
            }

            $origemNome = $isTransferencia
                ? (((int) $destinoUserId !== (int) $user->id) ? 'Transferência de Saída (Envio da Loja)' : 'Transferência (Inter-lojas)')
                : 'Reposição CD';

            $logDesc = "Solicitação via sistema ($origemNome) — {$totalUnidades} unidade(s)";

            if ($unidadesSemChassi > 0) {
                $logDesc .= "\n\n📋 {$unidadesSemChassi} unidade(s) solicitadas sem chassi. O CD deve atribuir os chassis físicos antes da separação.";
            }

            if (! empty($syncLogs)) {
                $logDesc .= "\n\n📝 Ajustes Automáticos na Abertura do Pedido:\n" . implode("\n", $syncLogs);
            }

            $this->registrarLog($pedido, 'Criado', $logDesc);

            try {
                $this->enviarNotificacao(
                    User::comPerfil(Perfil::Gestor)->get(),
                    'Nova Solicitação 🆕',
                    "Loja {$user->filial} criou pedido #{$pedido->id}.",
                    route('pedidos.show', $pedido->id)
                );
            } catch (\Exception) {
                // Aviso aos gestores não interrompe a abertura do pedido.
            }

            return $pedido;
        });
    }

    /**
     * TRAVA DE GESTÃO: carga que já chegou precisa ser conferida e finalizada
     * antes de a loja pedir mais. Pedido com embarque parcial (moto ainda no
     * CD) não bloqueia.
     */
    private function barrarCargaNaoFinalizada(User $user): void
    {
        if (! $user->isLoja()) {
            return;
        }

        $totalmenteEmTransito = Pedido::where('user_id', $user->id)
            ->whereIn('status', ['em_transito', 'em_transito_cd'])
            ->withCount(['motos as motos_no_cd' => function ($query) {
                // Moto com status abaixo já não está no CD; contamos as que ainda estão.
                $query->whereNotIn('status', ['em_transito', 'em_transito_cd', 'estoque_loja', 'vendida', 'recebido']);
            }])
            ->get()
            ->filter(fn ($pedido) => $pedido->motos_no_cd == 0)
            ->count();

        if ($totalmenteEmTransito > 0) {
            throw ValidationException::withMessages([
                'itens' => "BLOQUEIO DE SISTEMA: Sua loja possui $totalmenteEmTransito carga(s) 'Em Trânsito'. Por determinação da diretoria, você deve realizar a Conferência e Finalização de todos os pedidos que já chegaram fisicamente na sua loja antes de poder solicitar novas motos.",
            ]);
        }
    }

    /** @return array{0: int|string, 1: int|string|null} destino e origem */
    private function resolverOrigemEDestino(User $user, array $dados): array
    {
        $modo = $dados['modo'] ?? 'cd'; // padrão: reposição simples
        $destinoUserId = $user->id;     // quem pede é o destino
        $origemUserId = $dados['origem_id'] ?? null;

        // V2.6: o modo "Devolução" foi desativado. Devolver para o CD agora é
        // uma Transferência com o CD escolhido como destino. Este ramo só
        // existe para navegadores com o bundle antigo em cache.
        if ($modo === 'devolucao') {
            $modo = 'transferencia';
            $destinoUserId = ($dados['cd_user_id'] ?? null)
                ?: User::comPerfil(Perfil::Cd, Perfil::Admin)->orderBy('id')->value('id');
            $origemUserId = $user->id;

            if (! $destinoUserId) {
                throw ValidationException::withMessages(['modo' => 'Nenhum usuário de CD encontrado para receber a devolução.']);
            }
        }
        // Transferência de saída: a loja escolheu enviar para outro destino (ex: Matriz/CD).
        elseif ($modo === 'transferencia' && ! empty($dados['destino_id']) && (int) $dados['destino_id'] !== (int) $user->id) {
            $destinoUserId = (int) $dados['destino_id'];
            $origemUserId = $user->id;
        }

        if ($modo === 'transferencia' && empty($origemUserId)) {
            throw ValidationException::withMessages(['origem_id' => 'Selecione a loja de origem da transferência.']);
        }

        if (! empty($origemUserId) && (int) $origemUserId === (int) $destinoUserId) {
            throw ValidationException::withMessages(['origem_id' => 'A origem e o destino da transferência não podem ser a mesma unidade.']);
        }

        return [$destinoUserId, $origemUserId];
    }

    /**
     * V2.6: chassi condicional e quantidade. Transferência e Venda Confirmada
     * exigem o chassi (a moto física já está definida); o resto vai ao CD só
     * com modelo, cor e quantidade.
     */
    private function normalizarItens(array $itens, bool $isTransferencia): array
    {
        $normalizados = [];

        foreach ($itens as $i => $item) {
            $chassi = isset($item['chassi']) && trim((string) $item['chassi']) !== ''
                ? mb_strtoupper(trim($item['chassi']))
                : null;

            $exigeChassi = $this->itemExigeChassi($item['motivo'] ?? null, $isTransferencia);
            $quantidade = max(1, (int) ($item['quantidade'] ?? 1));

            if ($exigeChassi) {
                if (! $chassi) {
                    $porque = $isTransferencia
                        ? 'transferências exigem o chassi da moto que está saindo da loja'
                        : 'o motivo "' . $item['motivo'] . '" exige o chassi específico';

                    throw ValidationException::withMessages([
                        'itens' => 'Item #' . ($i + 1) . ": informe o chassi ({$porque}).",
                    ]);
                }

                $quantidade = 1; // um chassi = uma unidade
            }

            $normalizados[] = [
                'modelo'       => mb_strtoupper(trim($item['modelo'])),
                'cor'          => mb_strtoupper(trim($item['cor'])),
                'motivo'       => $item['motivo'],
                'local'        => mb_strtoupper(trim($item['local'])),
                'chassi'       => $chassi,
                'quantidade'   => $quantidade,
                'exige_chassi' => $exigeChassi,
            ];
        }

        return $normalizados;
    }

    private function itemExigeChassi(?string $motivo, bool $isTransferencia): bool
    {
        if ($isTransferencia) {
            return true;
        }

        $motivoLimpo = mb_strtolower(trim((string) $motivo), 'UTF-8');

        foreach (self::MOTIVOS_EXIGEM_CHASSI as $exige) {
            if ($motivoLimpo === mb_strtolower($exige, 'UTF-8')) {
                return true;
            }
        }

        return false;
    }

    /** A moto sai do estoque de uma loja (inclui o envio da loja para o CD). */
    private function motoDaTransferencia(string $chassi, array $item, int $origemUserId, array &$syncLogs): Moto
    {
        $moto = Moto::where('chassi', $chassi)->first();

        if (! $moto) {
            $nomeLoja = User::find($origemUserId)?->filial ?? 'Loja Externa';

            return Moto::create([
                'chassi'            => $chassi,
                'modelo'            => $item['modelo'],
                'cor'               => $item['cor'],
                'status'            => 'solicitado',
                'loja_atual_id'     => $origemUserId,
                'localizacao_atual' => "Estoque Loja: {$nomeLoja}",
            ]);
        }

        // Moto já cadastrada: modelo e cor da solicitação sobrescrevem dados
        // antigos (de pedidos cancelados).
        $moto->update(['modelo' => $item['modelo'], 'cor' => $item['cor']]);

        // Sincroniza o pátio da moto com a loja que está enviando.
        if ($moto->loja_atual_id != $origemUserId) {
            $oldPatio = $moto->localizacao_atual;
            $newPatio = 'Estoque Loja: ' . (User::find($origemUserId)?->filial ?? 'Sincronizada via Transferência');

            $moto->update(['loja_atual_id' => $origemUserId, 'localizacao_atual' => $newPatio]);

            $syncLogs[] = "✓ Chassi {$chassi} ajustado sistemicamente: de '{$oldPatio}' para '{$newPatio}'.";
        }

        if (in_array($moto->status, self::MOTO_INDISPONIVEL_PARA_TRANSFERENCIA) && ! $moto->wasRecentlyCreated) {
            throw ValidationException::withMessages([
                'itens' => "A moto {$chassi} está com status '{$moto->status}' e não pode ser transferida.",
            ]);
        }

        // Marca já, para outra loja não pedir a mesma moto em paralelo.
        $moto->update(['status' => 'solicitado']);

        return $moto;
    }

    /** Pedido ao CD com chassi definido (Venda Confirmada / legado). */
    private function motoDoCd(string $chassi, array $item, array &$syncLogs): Moto
    {
        $moto = Moto::firstOrCreate(
            ['chassi' => $chassi],
            [
                'modelo'            => $item['modelo'],
                'cor'               => $item['cor'],
                'status'            => 'solicitado',
                'localizacao_atual' => 'Fábrica/CD',
            ]
        );

        if ($moto->wasRecentlyCreated) {
            return $moto;
        }

        $dados = ['modelo' => $item['modelo'], 'cor' => $item['cor']];

        if (! in_array($moto->status, ['estoque_fabrica', 'solicitado'])) {
            $oldPatio = $moto->localizacao_atual;

            $dados['status'] = 'solicitado';
            $dados['loja_atual_id'] = null;
            $dados['localizacao_atual'] = 'Fábrica/CD (Sincronizado na Saída)';

            $syncLogs[] = "✓ Chassi {$chassi} devolvido sistemicamente ao CD: de '{$oldPatio}' para 'Fábrica/CD'.";
        }

        $moto->update($dados);

        return $moto;
    }
}
