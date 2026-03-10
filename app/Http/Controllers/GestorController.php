<?php

namespace App\Http\Controllers;

use App\Models\Pedido;
use App\Models\PedidoLog;
use App\Models\Moto;
use App\Models\User;
use App\Notifications\PedidoAtualizado;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Inertia\Inertia;

class GestorController extends Controller
{
    /**
     * Dashboard do Gestor
     * Exibe Pedidos em Análise e Estornos Pendentes.
     */
    public function index()
    {
        // 1. Pedidos Normais (Fluxo de Venda + Transferências)
        $pedidos = Pedido::with(['user', 'motos', 'origem'])
            ->where('status', 'em_analise')
            ->latest()
            ->get()
            ->map(function ($pedido) {
                return [
                    'id' => $pedido->id,
                    'user_id' => $pedido->user_id,
                    'solicitante' => ($pedido->user->filial ?? 'Matriz') . ' - ' . $pedido->user->name,
                    'tipo' => $pedido->origem_user_id ? 'transferencia' : 'reposicao',
                    'origem_nome' => $pedido->origem_user_id ? ($pedido->origem->filial ?? 'Loja Origem') : 'CD / Fábrica',
                    'created_at' => $pedido->created_at->format('d/m H:i'),
                    'qtd_motos' => $pedido->motos->count(),
                    'resumo_itens' => $pedido->motos->map(fn($m) => $m->modelo . ' (' . $m->cor . ')')->unique()->implode(', '),
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
        $pedido = Pedido::with(['user', 'motos', 'logs'])->findOrFail($id);

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
     * Processa cortes (rejeições) e aprova o restante.
     */
    public function aprovar(Request $request, $id)
    {
        $pedido = Pedido::with('motos')->findOrFail($id);
        
        $motosRejeitadasIds = $request->input('rejeitadas', []);
        $motivosMap = $request->input('motivos', []); // Mapa [id => motivo]
        $justificativaGeral = $request->input('justificativa');
        
        $userGestor = Auth::user();
        $detalhesCortes = []; 

        // 1. Processa os cortes (Itens rejeitados)
        if (!empty($motosRejeitadasIds)) {
            $motosParaRemover = Moto::whereIn('id', $motosRejeitadasIds)->get();

            foreach ($motosParaRemover as $moto) {
                // Pega o motivo específico ou usa um padrão
                $motivo = $motivosMap[$moto->id] ?? 'Motivo não informado';
                
                $detalhesCortes[] = "🚫 {$moto->modelo} ({$moto->chassi})\n   ↳ Motivo: {$motivo}";

                $pedido->motos()->detach($moto->id);
                
                // IMPORTANTE: Se o pedido for de transferência/devolução (origem_user_id existe), 
                // a moto é de uma loja e não pode ser apagada. Deve apenas voltar a ficar disponível.
                if ($pedido->origem_user_id) {
                    $moto->update([
                        'status' => 'disponivel',
                        'localizacao_atual' => "Estoque Loja"
                    ]);
                } else {
                    // Se for um pedido do CD, a moto foi criada como placeholder. Pode apagar.
                    $moto->delete(); 
                }
            }
        }

        $pedido->refresh();
        
        // 2. Se sobrou alguma moto, aprova o pedido
        if ($pedido->motos->count() > 0) {
            $pedido->update(['status' => 'solicitado']); // Libera para o CD

            // Monta o Log
            $textoLog = "✅ Autorizado por {$userGestor->name}.";
            
            if ($justificativaGeral) {
                $textoLog .= "\n💬 Obs Geral: \"{$justificativaGeral}\"";
            }
            
            if (!empty($detalhesCortes)) {
                $textoLog .= "\n\n❌ ITENS REJEITADOS:\n" . implode("\n", $detalhesCortes);
            }

            // Grava Log
            PedidoLog::create([
                'pedido_id' => $pedido->id,
                'titulo' => 'Auditoria Comercial (Gestor)',
                'descricao' => $textoLog
            ]);

            // Notifica usuários do CD
            $cds = User::where('perfil', 'cd')->get();
            foreach ($cds as $cd) {
                $cd->notify(new PedidoAtualizado(
                    'Pedido #' . $pedido->id . ' Aprovado', 
                    'Nova solicitação liberada para separação.', 
                    route('pedidos.show', $pedido->id)
                ));
            }

            return redirect()->route('gestor.index')->with('success', 'Análise concluída com sucesso.');
        } else {
            // Se tudo foi rejeitado, apaga o pedido
            $pedido->delete();
            return redirect()->route('gestor.index')->with('warning', 'Pedido cancelado (todos os itens foram rejeitados).');
        }
    }

    /**
     * Aprovação de Estorno/Devolução
     * Usado quando Loja ou CD solicitam devolução de um item.
     */
    public function aprovarEstorno(Request $request, $id)
    {
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
        // Inicia Query no PedidoLog filtrando apenas auditorias
        $query = PedidoLog::where('titulo', 'LIKE', 'Auditoria Comercial%')
            ->with(['pedido' => function($q) {
                // Traz o pedido e o usuário, mesmo que o pedido tenha sido excluído (withTrashed)
                $q->withTrashed()->with('user'); 
            }]);

        // --- FILTRO 1: BUSCA (Nome da Loja, ID do Pedido ou Texto do Log) ---
        if ($request->filled('search')) {
            $search = $request->search;
            $query->where(function($q) use ($search) {
                $q->where('descricao', 'LIKE', "%{$search}%")
                  ->orWhere('pedido_id', 'LIKE', "%{$search}%")
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
                'data_inicio' => $request->input('data_inicio') ?? '',
                'data_fim'    => $request->input('data_fim') ?? '',
            ]
        ]);
    }
}