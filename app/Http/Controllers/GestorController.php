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
        return Inertia::render('Gestor/Show', ['pedido' => $pedido]);
    }

    // --- LÓGICA DE APROVAÇÃO ---
    public function aprovar(Request $request, $id)
    {
        $pedido = Pedido::with('motos')->findOrFail($id);
        
        $motosRejeitadasIds = $request->input('rejeitadas', []);
        $justificativa = $request->input('justificativa');
        
        $userGestor = Auth::user();
        $detalhesCortes = []; 

        // 1. PROCESSAMENTO DOS CORTES (REJEIÇÕES)
        if (!empty($motosRejeitadasIds)) {
            // Busca as motos antes de excluir para pegar os nomes
            $motosParaRemover = Moto::whereIn('id', $motosRejeitadasIds)->get();

            foreach ($motosParaRemover as $moto) {
                // Guarda info formatada para o Log da Loja
                $detalhesCortes[] = "🚫 {$moto->modelo} (Chassi: {$moto->chassi})";
            }

            // A. Remove vínculo com o pedido
            $pedido->motos()->detach($motosRejeitadasIds);

            // B. EXCLUI DO BANCO (Limpeza de dados incorretos)
            Moto::destroy($motosRejeitadasIds);
        }

        // 2. VERIFICAÇÃO PÓS-CORTE
        $pedido->refresh(); // Recarrega do banco
        
        if ($pedido->motos->count() > 0) {
            // Avança para o CD
            $pedido->update(['status' => 'solicitado']); 

            // Monta Texto do Log (Formatado para leitura fácil)
            $textoLog = "✅ Autorizado por {$userGestor->name}.";
            
            if ($justificativa) {
                $textoLog .= "\n💬 Obs: \"{$justificativa}\"";
            }
            
            if (!empty($detalhesCortes)) {
                $textoLog .= "\n\nITENS REJEITADOS E EXCLUÍDOS:\n" . implode("\n", $detalhesCortes);
            }

            PedidoLog::create([
                'pedido_id' => $pedido->id,
                'titulo' => 'Auditoria Comercial (Gestor)',
                'descricao' => $textoLog
            ]);

            // Notifica CD
            $cds = \App\Models\User::where('perfil', 'cd')->get();
            foreach ($cds as $cd) {
                $cd->notify(new PedidoAtualizado(
                    'Pedido #' . $pedido->id . ' Aprovado',
                    'Gestão liberou para separação.',
                    route('pedidos.show', $pedido->id)
                ));
            }

            return redirect()->route('gestor.index')->with('success', 'Pedido auditado e enviado ao CD.');
        } else {
            // Se tudo foi rejeitado, o pedido é cancelado
            $pedido->delete();
            return redirect()->route('gestor.index')->with('warning', 'Todos os itens foram rejeitados e excluídos. Pedido cancelado.');
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