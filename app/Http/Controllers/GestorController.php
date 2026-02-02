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
        // 1. Pedidos Normais (Fluxo de Venda)
        $pedidos = Pedido::with(['user', 'motos'])
            ->where('status', 'em_analise')
            ->latest()
            ->get();

        // 2. Estornos/Cortes Pendentes (Solicitados por CD ou Loja)
        $estornos = Moto::with(['pedidos.user']) // Carrega quem pediu a moto original
            ->where('estorno_pendente', true)
            ->latest('updated_at')
            ->get();

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
                
                // IMPORTANTE: Exclui a moto pois foi um "erro" de solicitação da loja
                // Se fosse estoque real, mudaria status para 'disponivel', mas aqui limpamos o dado.
                $moto->delete(); 
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
        
        // 1. Remove a moto dos pedidos (Desvincula da loja)
        $moto->pedidos()->detach();

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
            // Retorna os filtros para preencher os inputs da tela (Evita o erro 'toString of null')
            'filters' => $request->only(['search', 'data_inicio', 'data_fim']) 
        ]);
    }
}