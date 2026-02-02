<?php

namespace App\Http\Controllers;

use App\Models\Pedido;
use App\Models\PedidoLog;
use App\Models\Moto; // Importante
use App\Notifications\PedidoAtualizado;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Inertia\Inertia;

class GestorController extends Controller
{
    public function index()
    {
        // Pedidos Normais (Em análise)
        $pedidos = Pedido::with(['user', 'motos'])
            ->where('status', 'em_analise')
            ->latest()
            ->get();

        // Estornos/Cortes Pendentes (Motos marcadas pelo CD ou Loja)
        $estornos = Moto::with(['pedidos.user']) // Carrega quem pediu a moto original
            ->where('estorno_pendente', true)
            ->latest('updated_at')
            ->get();

        return Inertia::render('Gestor/Dashboard', [
            'pedidos' => $pedidos,
            'estornos' => $estornos, // <--- Nova Prop
        ]);
    }

    public function show($id)
    {
        $pedido = Pedido::with(['user', 'motos', 'logs'])->findOrFail($id);

        // --- NOVO: Busca a última mensagem do chat 'Gestor' enviada pela Loja ---
        // Filtra msg onde o 'canal' é gestor e o autor NÃO é o usuário atual (ou seja, é a loja)
        $ultimaMensagemChat = $pedido->messages()
            ->where('canal', 'gestor')
            ->where('user_id', '!=', Auth::id()) 
            ->latest() // Pega a mais recente
            ->first();

        return Inertia::render('Gestor/Show', [
            'pedido' => $pedido,
            'mensagemChat' => $ultimaMensagemChat // Envia para o Frontend
        ]);
    }

    // --- LÓGICA DE APROVAÇÃO ---
    public function aprovar(Request $request, $id)
    {
        $pedido = Pedido::with('motos')->findOrFail($id);
        
        $motosRejeitadasIds = $request->input('rejeitadas', []);
        $motivosMap = $request->input('motivos', []); // Novo: Mapa [id => motivo]
        $justificativaGeral = $request->input('justificativa');
        
        $userGestor = Auth::user();
        $detalhesCortes = []; 

        if (!empty($motosRejeitadasIds)) {
            $motosParaRemover = Moto::whereIn('id', $motosRejeitadasIds)->get();

            foreach ($motosParaRemover as $moto) {
                // Pega o motivo específico ou usa um padrão
                $motivo = $motivosMap[$moto->id] ?? 'Motivo não informado';
                
                $detalhesCortes[] = "🚫 {$moto->modelo} ({$moto->chassi})\n   ↳ Motivo: {$motivo}";

                $pedido->motos()->detach($moto->id);
                $moto->delete(); // Exclui a moto errada
            }
        }

        $pedido->refresh();
        
        if ($pedido->motos->count() > 0) {
            $pedido->update(['status' => 'solicitado']); 

            $textoLog = "✅ Autorizado por {$userGestor->name}.";
            
            if ($justificativaGeral) {
                $textoLog .= "\n💬 Obs Geral: \"{$justificativaGeral}\"";
            }
            
            if (!empty($detalhesCortes)) {
                $textoLog .= "\n\n❌ ITENS REJEITADOS:\n" . implode("\n", $detalhesCortes);
            }

            PedidoLog::create([
                'pedido_id' => $pedido->id,
                'titulo' => 'Auditoria Comercial (Gestor)',
                'descricao' => $textoLog
            ]);

            // Notifica
            $cds = \App\Models\User::where('perfil', 'cd')->get();
            foreach ($cds as $cd) {
                $cd->notify(new PedidoAtualizado('Pedido #' . $pedido->id . ' Aprovado', 'Nova solicitação liberada.', route('pedidos.show', $pedido->id)));
            }

            return redirect()->route('gestor.index')->with('success', 'Análise concluída com sucesso.');
        } else {
            $pedido->delete();
            return redirect()->route('gestor.index')->with('warning', 'Pedido cancelado (todos os itens rejeitados).');
        }
    }

    public function aprovarEstorno(Request $request, $id)
    {
        $moto = Moto::findOrFail($id);
        
        // 1. Remove a moto dos pedidos (Desvincula da loja)
        $moto->pedidos()->detach();

        // 2. Tira do romaneio se por acaso já tivesse sido bipada (segurança)
        $moto->romaneio_id = null;

        // 3. Define o destino da moto. 
        // Se o CD estornou, geralmente é avaria ou erro de estoque.
        // Vamos voltar para 'disponivel' para ela poder ser auditada, 
        // ou você pode criar um status 'bloqueado'.
        $moto->update([
            'estorno_pendente' => false,
            'motivo_estorno' => null,
            'user_estorno_id' => null,
            'status' => 'disponivel', 
            'localizacao_atual' => 'Estoque (Retorno de Estorno CD)' 
        ]);

        return back()->with('success', 'Corte aprovado! A moto foi removida do pedido.');
    }

    // --- HISTÓRICO DE AUDITORIA ---
    public function historico()
    {
        // CORREÇÃO: Usamos 'LIKE' com '%' para pegar "Auditoria Comercial", "Auditoria Comercial (Gestor)", etc.
        $logs = PedidoLog::where('titulo', 'LIKE', 'Auditoria Comercial%')
            ->with(['pedido' => function($q) {
                // Traz o pedido e o usuário, mesmo que o pedido tenha sido excluído (withTrashed)
                $q->withTrashed()->with('user'); 
            }])
            ->orderBy('created_at', 'desc')
            ->paginate(20);

        return Inertia::render('Gestor/History', [
            'logs' => $logs
        ]);
    }
}