<?php

namespace App\Http\Controllers;

use App\Models\Moto;
use App\Models\PedidoLog;
use App\Models\User;
use Illuminate\Http\Request;
use Inertia\Inertia;

class MotoController extends Controller
{
    // 1. LISTAGEM GERAL (ESTOQUE E FILTROS)
    public function index(Request $request)
    {
        // Carrega as motos com o Pedido ATUAL e o Usuário (Loja) desse pedido, e a Loja Atual (relação direta)
        $query = Moto::with(['loja', 'pedidos' => function($q) {
            // Pega apenas o último pedido vinculado para saber quem está com a moto agora
            $q->latest()->limit(1)->with('user');
        }]);

        /*
         * ESCOPO DA LOJA — no servidor, não na tela (v3.4).
         *
         * Até aqui o método não filtrava por loja em momento nenhum: `loja_id`
         * existe como filtro OPCIONAL, que é o oposto de um escopo. Toda filial
         * recebia a frota inteira da rede e a tela é que escondia — o comentário
         * na rota dizia a intenção com todas as letras ("Loja terá view restrita
         * no Front"). Quem abrisse o DevTools, ou a resposta JSON, via tudo.
         *
         * O módulo de peças já resolve isso do jeito certo em
         * PecaController::resolverLocal; isto é o mesmo movimento para motos.
         *
         * A regra (os três caminhos da loja) mora em Moto::scopeVisivelPara,
         * porque a timeline aplica exatamente a mesma.
         */
        $user = auth()->user();

        $query->visivelPara($user);

        // Filtro de Texto (Chassi ou Modelo)
        if ($request->filled('search')) {
            $term = $request->search;
            $query->where(function($q) use ($term) {
                $q->where('chassi', 'like', "%{$term}%")
                  ->orWhere('modelo', 'like', "%{$term}%");
            });
        }

        // Filtro de Status
        if ($request->filled('status')) {
            $query->where('status', $request->status);
        }

        // Filtro de Loja (Complexo: busca dentro do relacionamento)
        if ($request->filled('loja_id')) {
            $query->whereHas('pedidos', function($q) use ($request) {
                $q->where('user_id', $request->loja_id)
                  ->where(function($sub) {
                      // Filtra apenas se o pedido estiver ativo (não cancelado)
                      $sub->where('status', '!=', 'cancelado');
                  });
            });
        }

        /*
         * Lista de lojas do select de filtro.
         *
         * Para a loja, o select passa a trazer só ela mesma: com o escopo
         * acima, filtrar por outra filial devolveria vazio de qualquer jeito, e
         * um filtro que nunca retorna nada parece defeito, não permissão.
         */
        $lojas = User::lojas()
            ->when($user->isLoja(), fn ($q) => $q->where('id', $user->id))
            ->orderBy('filial')
            ->select('id', 'filial', 'name')
            ->get();

        return Inertia::render('Motos/Index', [
            'motos' => $query->orderBy('updated_at', 'desc')->paginate(20)->withQueryString(),
            'lojas' => $lojas,
            'filters' => $request->only(['search', 'status', 'loja_id'])
        ]);
    }

    // 2. TIMELINE (RASTREABILIDADE DO CHASSI) - NOVO V2
    public function timeline(Request $request)
    {
        $chassi = $request->input('chassi');
        $moto = null;
        $historico = [];

        if ($chassi) {
            /*
             * Escopo antes da busca (v3.7). A rota não tem `check_perfil` e o
             * LIKE aceita qualquer pedaço do chassi: qualquer loja digitava
             * dígitos soltos e lia a linha do tempo inteira de motos de outras
             * filiais — logs dos pedidos delas, motivos de recusa e links das
             * fotos de avaria — exatamente o que PedidoPolicy nega na tela do
             * pedido. A loja continua chegando à timeline das próprias motos
             * pelo link da lista de estoque.
             */
            $moto = Moto::visivelPara($request->user())
                ->where('chassi', 'LIKE', "%{$chassi}%") // Permite buscar pelos últimos dígitos
                ->first();

            if ($moto) {
                // A. Busca Logs dos Pedidos onde essa moto estava inclusa
                // Isso cruza a tabela de logs com a tabela pivo pedido_moto
                $logsPedidos = PedidoLog::whereHas('pedido.motos', function($q) use ($moto) {
                    $q->where('motos.id', $moto->id);
                })->with(['pedido.user', 'pedido.origem', 'pedido.motos' => function($q) use ($moto) {
                    $q->where('motos.id', $moto->id)->withPivot(['detalhes_avaria', 'foto_avaria']);
                }])->get();

                // B. Monta a Linha do Tempo baseada nos Logs
                foreach ($logsPedidos as $log) {
                    
                    // Ícones dinâmicos para facilitar leitura
                    $icon = '📄';
                    if (str_contains(strtolower($log->titulo), 'concluído') || str_contains(strtolower($log->titulo), 'entrega')) $icon = '✅';
                    if (str_contains(strtolower($log->titulo), 'trânsito') || str_contains(strtolower($log->titulo), 'saiu')) $icon = '🚚';
                    if (str_contains(strtolower($log->titulo), 'coleta')) $icon = '📦';
                    if (str_contains(strtolower($log->titulo), 'avaria')) $icon = '⚠️';

                    $avariaInfo = null;
                    if (str_contains(strtolower($log->titulo), 'concluído') || str_contains(strtolower($log->titulo), 'entrega')) {
                        $motoDoPedido = $log->pedido->motos->first();
                        if ($motoDoPedido && $motoDoPedido->pivot->detalhes_avaria) {
                            $icon = '⚠️';
                            $avariaInfo = [
                                'texto' => $motoDoPedido->pivot->detalhes_avaria,
                                'foto'  => $motoDoPedido->pivot->foto_avaria
                            ];
                        }
                    }

                    $historico[] = [
                        'data' => $log->created_at,
                        'tipo' => 'log_pedido',
                        'titulo' => $log->titulo,
                        'descricao' => $log->descricao,
                        // Quem enviou (Origem) e Quem recebeu (Destino) naquele momento
                        'origem' => $log->pedido->origem->filial ?? 'CD (Estoque)',
                        'destino' => $log->pedido->user->filial ?? $log->pedido->user->name,
                        'icon' => $icon,
                        'avaria' => $avariaInfo // REPASSA PRO FRONTEND
                    ];
                }

                // C. Adiciona o Evento de "Nascimento" (Cadastro)
                $historico[] = [
                    'data' => $moto->created_at,
                    'tipo' => 'nascimento',
                    'titulo' => 'Entrada no Sistema',
                    'descricao' => "Moto cadastrada no estoque inicial. Status: {$moto->status}.",
                    'origem' => 'Fábrica/Montadora',
                    'destino' => 'CD Matriz',
                    'icon' => '🏭'
                ];

                // D. Ordenação Cronológica (Do mais recente para o mais antigo)
                usort($historico, fn($a, $b) => $b['data'] <=> $a['data']);
            }
        }

        return Inertia::render('Motos/Timeline', [
            // Só o que a tela mostra. Com o model inteiro iam junto os pedidos e
            // os usuários deles (e-mail, onesignal_id) para o navegador.
            'moto' => $moto?->only(['id', 'chassi', 'modelo', 'cor', 'status', 'localizacao_atual']),
            'timeline' => $historico,
            'filtro' => $chassi
        ]);
    }
}