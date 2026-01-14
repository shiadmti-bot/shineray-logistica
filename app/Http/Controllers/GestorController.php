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
        $pedidos = Pedido::with(['user', 'motos'])
            ->where('status', 'em_analise')
            ->orderBy('created_at', 'asc')
            ->get();

        return Inertia::render('Gestor/Dashboard', [
            'pedidos' => $pedidos
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