<?php

namespace App\Http\Controllers;

use App\Models\EstoqueLocal;
use App\Models\Peca;
use App\Models\PecaEstoque;
use App\Models\PecaMovimento;
use App\Services\Estoque\EstoqueInsuficienteException;
use App\Services\Estoque\EstoquePecaService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Inertia\Inertia;

/**
 * Entrada e inventário de peças — onde o saldo gerenciado passa a existir.
 *
 * É o pré-requisito de todo o resto: sem saldo, não há o que reservar nem o que
 * expedir. O saldo do Microwork não serve para isso porque é agregado de mais
 * de um ponto físico (ver PecaMicroworkProvider).
 *
 * Toda escrita passa por EstoquePecaService, que grava o movimento no ledger na
 * mesma transação.
 */
class PecaEstoqueController extends Controller
{
    public function index(Request $request)
    {
        $user = Auth::user();
        $local = $this->localDoUsuario($request, $user);

        return Inertia::render('Pecas/Entrada', [
            'local'      => $local ? ['id' => $local->id, 'nome' => $local->nome] : null,
            'locais'     => $this->locaisPermitidos($user),
            'movimentos' => $this->ultimosMovimentos($local?->id),
            'resumo'     => [
                'skus'     => PecaEstoque::where('local_id', $local?->id)->where('saldo', '>', 0)->count(),
                'unidades' => (int) PecaEstoque::where('local_id', $local?->id)->sum('saldo'),
            ],
        ]);
    }

    /**
     * Busca uma peça e devolve o saldo dela no local — alimenta o campo de
     * bipagem da tela. Responde JSON porque é chamada a cada digitação.
     */
    public function buscar(Request $request)
    {
        $termo = trim((string) $request->input('termo'));
        $localId = (int) $request->input('local_id');

        if (mb_strlen($termo) < 2) {
            return response()->json(['pecas' => []]);
        }

        $pecas = Peca::where('ativo', true)
            ->busca($termo)
            ->limit(10)
            ->get()
            ->map(function (Peca $p) use ($localId) {
                $estoque = PecaEstoque::where('peca_id', $p->id)
                    ->where('local_id', $localId)
                    ->first();

                return [
                    'id'         => $p->id,
                    'codigo'     => $p->codigo,
                    'descricao'  => $p->descricao,
                    'unidade'    => $p->unidade,
                    'marca'      => $p->marca,
                    'saldo'      => (int) ($estoque->saldo ?? 0),
                    'reservado'  => (int) ($estoque->saldo_reservado ?? 0),
                    'disponivel' => (int) ($estoque->disponivel ?? 0),
                    'minimo'     => (int) ($estoque->saldo_minimo ?? 0),
                ];
            });

        return response()->json(['pecas' => $pecas]);
    }

    /**
     * Entrada de mercadoria: soma ao saldo existente.
     */
    public function entrada(Request $request)
    {
        $dados = $request->validate([
            'peca_id'    => ['required', 'exists:pecas,id'],
            'local_id'   => ['required', 'exists:estoque_locais,id'],
            'quantidade' => ['required', 'integer', 'min:1', 'max:99999'],
            'observacao' => ['nullable', 'string', 'max:255'],
        ]);

        $this->autorizarLocal($dados['local_id']);

        app(EstoquePecaService::class)->darEntrada(
            peca: Peca::findOrFail($dados['peca_id']),
            localId: $dados['local_id'],
            quantidade: $dados['quantidade'],
            observacao: $dados['observacao'] ?: 'Entrada manual',
        );

        return back()->with('success', "Entrada de {$dados['quantidade']} un. registrada.");
    }

    /**
     * Inventário: define o saldo absoluto contado na prateleira.
     *
     * Diferente de entrada — aqui o número informado SUBSTITUI o saldo, não
     * soma. É o caminho para o inventário inicial das 2.385 peças.
     */
    public function inventario(Request $request)
    {
        $dados = $request->validate([
            'peca_id'       => ['required', 'exists:pecas,id'],
            'local_id'      => ['required', 'exists:estoque_locais,id'],
            'saldo_contado' => ['required', 'integer', 'min:0', 'max:99999'],
            'observacao'    => ['required', 'string', 'max:255'],
        ], [
            'observacao.required' => 'Descreva o motivo do ajuste — ajuste sem justificativa torna a auditoria inútil.',
        ]);

        $this->autorizarLocal($dados['local_id']);

        app(EstoquePecaService::class)->ajustar(
            peca: Peca::findOrFail($dados['peca_id']),
            localId: $dados['local_id'],
            saldoContado: $dados['saldo_contado'],
            observacao: $dados['observacao'],
        );

        return back()->with('success', "Saldo ajustado para {$dados['saldo_contado']} un.");
    }

    /**
     * Transferência direta entre locais, fora do fluxo de pedido.
     * Útil para acerto pontual — o fluxo normal é pedido + carga.
     */
    public function transferir(Request $request)
    {
        $dados = $request->validate([
            'peca_id'    => ['required', 'exists:pecas,id'],
            'origem_id'  => ['required', 'exists:estoque_locais,id'],
            'destino_id' => ['required', 'exists:estoque_locais,id', 'different:origem_id'],
            'quantidade' => ['required', 'integer', 'min:1'],
            'observacao' => ['nullable', 'string', 'max:255'],
        ]);

        $this->autorizarLocal($dados['origem_id']);

        try {
            app(EstoquePecaService::class)->transferir(
                peca: Peca::findOrFail($dados['peca_id']),
                localOrigemId: $dados['origem_id'],
                localDestinoId: $dados['destino_id'],
                quantidade: $dados['quantidade'],
                consomeReserva: false, // transferência avulsa não tem reserva
                observacao: $dados['observacao'] ?: 'Transferência manual',
            );
        } catch (EstoqueInsuficienteException $e) {
            return back()->withErrors(['quantidade' => $e->getMessage()]);
        }

        return back()->with('success', 'Transferência registrada.');
    }

    private function localDoUsuario(Request $request, $user): ?EstoqueLocal
    {
        // Loja opera apenas no próprio estoque.
        if ($user->perfil === 'loja') {
            return EstoqueLocal::find($user->estoque_local_id);
        }

        $solicitado = $request->integer('local');

        return $solicitado
            ? EstoqueLocal::find($solicitado)
            : EstoqueLocal::cd();
    }

    /** @return array<int, array{id:int, nome:string}> */
    private function locaisPermitidos($user): array
    {
        if ($user->perfil === 'loja') {
            $local = EstoqueLocal::find($user->estoque_local_id);

            return $local ? [['id' => $local->id, 'nome' => $local->nome]] : [];
        }

        return EstoqueLocal::ativos()
            ->orderByRaw("tipo = 'loja'")
            ->orderBy('nome')
            ->get(['id', 'nome'])
            ->map(fn ($l) => ['id' => $l->id, 'nome' => $l->nome])
            ->all();
    }

    /**
     * Impede que uma loja movimente o estoque de outra.
     */
    private function autorizarLocal(int $localId): void
    {
        $user = Auth::user();

        if ($user->perfil === 'loja' && $user->estoque_local_id !== $localId) {
            abort(403, 'Você só pode movimentar o estoque da sua própria loja.');
        }
    }

    /** @return array<int, array<string, mixed>> */
    private function ultimosMovimentos(?int $localId): array
    {
        if (! $localId) {
            return [];
        }

        return PecaMovimento::with(['peca:id,codigo,descricao', 'user:id,name'])
            ->where('local_id', $localId)
            ->latest('id')
            ->limit(25)
            ->get()
            ->map(fn (PecaMovimento $m) => [
                'id'         => $m->id,
                'tipo'       => $m->tipo,
                'quantidade' => $m->quantidade,
                'saldo'      => $m->saldo_posterior,
                'peca'       => $m->peca?->descricao,
                'codigo'     => $m->peca?->codigo,
                'usuario'    => $m->user?->name,
                'observacao' => $m->observacao,
                'quando'     => $m->created_at?->format('d/m/Y H:i'),
            ])
            ->all();
    }
}
