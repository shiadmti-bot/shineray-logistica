<?php

namespace App\Http\Controllers;

use App\Actions\Pedidos\AprovarPedido;
use App\Actions\Pedidos\CancelarPedido;
use App\Exceptions\OperacaoPedidoRecusada;
use App\Models\Pedido;
use App\Models\PedidoLog;
use App\Models\Moto;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Inertia\Inertia;

class GestorController extends Controller
{
    /**
     * Dashboard do Gestor
     * Exibe Pedidos em Análise e Estornos Pendentes.
     */
    public function index()
    {
        $this->autorizarGestorMotos();

        // 1. Pedidos Normais de Motos (Fluxo de Venda + Transferências) - Peças não entram aqui
        $pedidos = Pedido::with(['user', 'motos', 'origem', 'itensPedido'])
            ->where('status', 'em_analise')
            ->where('tipo_carga', '!=', 'peca')
            ->latest()
            ->get()
            ->map(function ($pedido) {
                $qtdMotos = $pedido->isLegado()
                    ? $pedido->motos->count()
                    : max($pedido->motos->count(), (int) $pedido->itensPedido->sum('quantidade'));

                $itensSummary = [];
                if ($pedido->isLegado()) {
                    $itensSummary = $pedido->motos
                        ->groupBy(fn($m) => $m->modelo . '|' . $m->cor)
                        ->map(fn($group) => [
                            'qtd' => $group->count(),
                            'modelo' => $group->first()->modelo,
                            'cor' => $group->first()->cor,
                        ])->values()->all();
                } else {
                    $itensSummary = $pedido->itensPedido
                        ->map(fn($item) => [
                            'qtd' => $item->quantidade,
                            'modelo' => $item->modelo,
                            'cor' => $item->cor,
                        ])->all();
                }

                return [
                    'id' => $pedido->id,
                    'user_id' => $pedido->user_id,
                    'solicitante' => ($pedido->user->filial ?? 'Matriz') . ' - ' . $pedido->user->name,
                    'tipo' => $pedido->origem_user_id ? 'transferencia' : 'reposicao',
                    'origem_nome' => $pedido->origem_user_id ? ($pedido->origem->filial ?? 'Loja Origem') : 'CD / Fábrica',
                    'created_at' => $pedido->created_at->format('d/m H:i'),
                    'qtd_motos' => $qtdMotos,
                    'itens_summary' => $itensSummary,
                    'observacao' => $pedido->observacao
                ];
            });

        // 2. Estornos/Cortes Pendentes (CORREÇÃO DE QUERY)
        // Agora buscamos motos que estão marcadas como estorno_pendente
        // E usamos 'pedidos' (plural) para tentar achar a loja dona
        $estornos = Moto::where('estorno_pendente', true)
            ->with(['pedidos.user']) // Carrega relacionamentos para exibir nome da loja
            ->latest('updated_at')
            ->get()
            ->map(function ($moto) {
                // Tenta pegar o primeiro pedido vinculado (geralmente é o atual)
                $pedido = $moto->pedidos->first();
                
                // Se não tiver pedido vinculado (foi detach), tentamos pegar o user_estorno_id se existir
                // Se não, fica como "Desconhecido"
                $nomeLoja = 'Loja/CD Desconhecido';
                
                if ($pedido && $pedido->user) {
                    $nomeLoja = $pedido->user->filial;
                }

                return [
                    'id' => $moto->id,
                    'modelo' => $moto->modelo,
                    'chassi' => $moto->chassi,
                    'motivo_estorno' => $moto->motivo_estorno ?? 'Motivo não informado',
                    'solicitante_original' => $nomeLoja,
                    'pedido_id' => $pedido?->id,
                    'data_solicitacao' => $moto->updated_at->format('d/m H:i')
                ];
            });

        return Inertia::render('Gestor/Dashboard', [
            'pedidos' => $pedidos,
            'estornos' => $estornos,
        ]);
    }

    /**
     * Detalhes de um Pedido específico para auditoria.
     */
    public function show($id)
    {
        $this->autorizarGestorMotos();

        // withTrashed: o histórico de auditoria lista recusas, e o pedido
        // recusado está soft-deleted. Sem isto o próprio link do histórico do
        // gestor caía em 404.
        $pedido = Pedido::withTrashed()
            ->with(['user', 'motos', 'itensPedido', 'origem', 'logs' => fn ($q) => $q->with('autor:id,name')])
            ->findOrFail($id);

        // Busca a última mensagem do chat 'Gestor' enviada pela Loja
        // Filtra msg onde o 'canal' é gestor e o autor NÃO é o usuário atual
        $ultimaMensagemChat = $pedido->messages()
            ->where('canal', 'gestor')
            ->where('user_id', '!=', Auth::id()) 
            ->latest()
            ->first();

        return Inertia::render('Gestor/Show', [
            'pedido' => $pedido,
            'mensagemChat' => $ultimaMensagemChat
        ]);
    }

    /**
     * Lógica de Aprovação Comercial
     * Processa cortes (rejeições) e aprova o restante via AprovarPedido.
     */
    public function aprovar(Request $request, $id, AprovarPedido $aprovarPedido)
    {
        $this->autorizarGestorMotos();

        $dados = $request->validate([
            'rejeitadas'         => ['nullable', 'array'],
            'rejeitadas.*'       => ['integer'],
            'itens_rejeitados'   => ['nullable', 'array'],
            'itens_rejeitados.*' => ['integer'],
            'motivos'            => ['nullable', 'array'],
            'motivos.*'          => ['nullable', 'string'],
            'justificativa'      => ['nullable', 'string'],
        ]);

        $pedido = Pedido::with(['user', 'motos', 'origem', 'itensPedido'])->findOrFail($id);

        try {
            $aprovado = $aprovarPedido->executar($pedido, [
                'rejeitadas'       => $dados['rejeitadas'] ?? [],
                'itens_rejeitados' => $dados['itens_rejeitados'] ?? [],
                'motivos'          => $dados['motivos'] ?? [],
                'justificativa'    => $dados['justificativa'] ?? null,
            ]);
        } catch (OperacaoPedidoRecusada $e) {
            return redirect()->route('gestor.index')->with('error', $e->getMessage());
        }

        if (! $aprovado) {
            return redirect()->route('gestor.index')->with('warning', 'Pedido cancelado (todos os itens foram rejeitados).');
        }

        return redirect()->route('gestor.index')->with('success', 'Análise concluída! Pedido liberado para separação física.');
    }

    /**
     * Rejeição total do pedido pelo Gestor Comercial.
     *
     * Mesmo caminho do cancelamento comum (CancelarPedido): moto volta ao
     * estoque de onde saiu, reservas são canceladas, status e motivo ficam
     * gravados e a loja é avisada. A trava de status é a da aprovação — antes
     * dava para "rejeitar" pedido já separado ou em trânsito, e as motos
     * voltavam ao estoque com a carga na estrada.
     */
    public function rejeitar(Request $request, $id, CancelarPedido $cancelarPedido)
    {
        $this->autorizarGestorMotos();

        $pedido = Pedido::with(['motos', 'user', 'itensPedido.peca'])->findOrFail($id);
        $motivo = $request->input('justificativa') ?: $request->input('motivo', 'Rejeitado pelo Gestor Comercial');

        try {
            DB::transaction(function () use ($pedido, $motivo, $cancelarPedido) {
                // Relido com trava: não rejeita o que outro gestor acabou de aprovar.
                $statusAtual = Pedido::whereKey($pedido->id)->lockForUpdate()->value('status');

                if ($statusAtual !== 'em_analise') {
                    throw new OperacaoPedidoRecusada('Este pedido já foi processado.');
                }

                if ($pedido->tipo_carga === 'peca') {
                    throw new OperacaoPedidoRecusada('Pedidos de peça não passam pela análise comercial.');
                }

                $cancelarPedido->executar($pedido, Auth::user(), 'rejeitado', $motivo);
            });
        } catch (OperacaoPedidoRecusada $e) {
            return redirect()->route('gestor.index')->with('error', $e->getMessage());
        }

        return redirect()->route('gestor.index')->with('warning', "Pedido #{$pedido->id} foi rejeitado e cancelado.");
    }

    /**
     * Aprovação de Estorno/Devolução
     * Usado quando Loja ou CD solicitam devolução de um item.
     */
    public function aprovarEstorno(Request $request, $id)
    {
        $this->autorizarGestorMotos();

        $moto = Moto::findOrFail($id);
        
        // 1. Guarda apenas os pedidos ATIVOS aos quais ela pertencia (para não apagar histórico de concluídos)
        $pedidosAtivos = $moto->pedidos()->whereNotIn('status', ['concluido', 'cancelado', 'rejeitado'])->get();
        
        // Remove a moto APENAS desses pedidos (evita conflitar com outros pedidos caso houvesse duplicidade)
        foreach ($pedidosAtivos as $pedido) {
            $pedido->motos()->detach($moto->id);
        }

        // 1.5. Verifica se os pedidos ficaram vazios e limpa se necessário
        foreach ($pedidosAtivos as $pedido) {
            if ($pedido->motos()->count() === 0) {
                // Se o pedido ficou com 0 motos reais, ele é inútil. Cancela.
                PedidoLog::create([
                    'pedido_id' => $pedido->id,
                    'titulo' => 'Pedido Cancelado Automaticamente',
                    'descricao' => "O pedido foi cancelado porque seu último item foi removido/estornado."
                ]);
                $pedido->update(['status' => 'cancelado']);
                $pedido->delete();
            }
        }

        // 2. Tira do romaneio se por acaso já tivesse sido bipada (segurança)
        $moto->romaneio_id = null;

        // 3. Define o destino da moto. 
        // Volta para 'disponivel' para ser auditada ou consertada
        $moto->update([
            'estorno_pendente' => false,
            'motivo_estorno' => null,
            'user_estorno_id' => null,
            'status' => 'disponivel', 
            'localizacao_atual' => 'Estoque (Retorno de Estorno CD/Loja)' 
        ]);

        return back()->with('success', 'Corte aprovado! A moto foi removida do pedido e voltou ao estoque.');
    }

    /**
     * Histórico de Auditoria com Filtros
     * IMPORTANTE: Inclui lógica de filtros para evitar erro no Frontend.
     */
    public function historico(Request $request)
    {
        $this->autorizarGestorMotos();

        /*
         * O QUE MUDOU NA V3.6 E POR QUÊ.
         *
         * Este filtro era `titulo LIKE 'Auditoria Comercial%'`. Título é texto
         * de interface, e o de uma rejeição TOTAL é "Rejeitado ❌" — ou seja, a
         * tela chamada "histórico de auditoria" nunca mostrou uma rejeição
         * total. Só corte parcial. Um gestor podia rejeitar o pedido inteiro e
         * isso não aparecia em relatório nenhum.
         *
         * Agora o filtro é o escopo `recusas()`, que casa pela coluna `evento`
         * e, para os registros anteriores à v3.6 (evento NULL), ainda aceita os
         * títulos antigos — de outro modo ligar a coluna nova esvaziaria o
         * histórico de tudo que já aconteceu.
         */
        $query = PedidoLog::recusas()
            ->with([
                'autor:id,name,perfil',
                'pedido' => function ($q) {
                    // Traz o pedido e o usuário mesmo depois do soft delete.
                    $q->withTrashed()->with('user');
                },
            ]);

        // --- FILTRO 0: TIPO DE RECUSA (rejeitado / cancelado / corte_parcial) ---
        if ($request->filled('evento')) {
            $query->where('evento', $request->input('evento'));
        }

        // --- FILTRO 1: BUSCA (Nome da Loja, ID do Pedido ou Texto do Log) ---
        if ($request->filled('search')) {
            $search = $request->search;
            $query->where(function($q) use ($search) {
                $q->where('descricao', 'LIKE', "%{$search}%")
                  ->orWhere('pedido_id', 'LIKE', "%{$search}%")
                  // v3.6: quem recusou passa a ser pesquisável de verdade. Antes
                  // o nome só existia dentro da frase da descrição, então buscar
                  // por gestor dependia de a redação do log não ter mudado.
                  ->orWhereHas('autor', fn ($a) => $a->where('name', 'LIKE', "%{$search}%"))
                  ->orWhereHas('pedido.user', function($subQ) use ($search) {
                      $subQ->where('name', 'LIKE', "%{$search}%")
                           ->orWhere('filial', 'LIKE', "%{$search}%");
                  });
            });
        }

        // --- FILTRO 2: DATA INÍCIO ---
        if ($request->filled('data_inicio')) {
            $query->whereDate('created_at', '>=', $request->data_inicio);
        }

        // --- FILTRO 3: DATA FIM ---
        if ($request->filled('data_fim')) {
            $query->whereDate('created_at', '<=', $request->data_fim);
        }

        // Executa com paginação e mantém a query string na URL
        $logs = $query->orderBy('created_at', 'desc')
            ->paginate(15)
            ->withQueryString();

        return Inertia::render('Gestor/History', [
            'logs' => $logs,
            // AQUI ESTÁ A CORREÇÃO: Usamos o operador ?? '' para garantir que nunca vá NULL
            'filters' => [
                'search'      => $request->input('search') ?? '',
                'evento'      => $request->input('evento') ?? '',
                'data_inicio' => $request->input('data_inicio') ?? '',
                'data_fim'    => $request->input('data_fim') ?? '',
            ]
        ]);
    }

    /**
     * Validação de autorização do Gestor de Motos / Diretoria Comercial.
     * Quem valida apenas peças NÃO tem acesso a este módulo.
     */
    private function autorizarGestorMotos(): void
    {
        if (! Auth::user()->podeValidarMotos()) {
            abort(403, 'Acesso restrito ao Gestor de Motos ou Administrador.');
        }
    }
}