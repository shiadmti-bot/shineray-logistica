<?php

namespace App\Http\Controllers;

use App\Models\Moto;
use App\Models\PedidoLog;
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

        // Pega lista de lojas para o select de filtro
        $lojas = \App\Models\User::where('perfil', 'loja')
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
            // Busca a moto (inclusive se foi deletada/vendida, caso use SoftDeletes)
            // Carrega todos os pedidos que essa moto já participou
            $moto = Moto::with(['pedidos.user', 'pedidos.origem'])
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
            'moto' => $moto,
            'timeline' => $historico,
            'filtro' => $chassi
        ]);
    }
}