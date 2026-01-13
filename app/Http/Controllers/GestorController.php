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

    // --- CORREÇÃO DA LÓGICA DE APROVAÇÃO ---
    public function aprovar(Request $request, $id)
    {
        $pedido = Pedido::with('motos')->findOrFail($id);
        
        // Recebe os dados do Frontend
        $motosRejeitadasIds = $request->input('rejeitadas', []);
        $justificativa = $request->input('justificativa'); // Novo campo opcional
        
        $userGestor = Auth::user();
        $detalhesAuditoria = []; 

        // 1. PROCESSAMENTO DOS CORTES (REJEIÇÕES)
        if (!empty($motosRejeitadasIds)) {
            // Busca as motos que serão removidas
            $motosParaRemover = Moto::whereIn('id', $motosRejeitadasIds)->get();

            foreach ($motosParaRemover as $moto) {
                // Guarda info para auditoria
                $detalhesAuditoria[] = "Chassi {$moto->chassi} removido";

                // A. Reseta status da moto para livre no estoque
                $moto->update([
                    'status' => 'estoque_fabrica',
                    'localizacao_atual' => 'Estoque (Devolvido pela Gestão)'
                ]);
            }

            // B. CRÍTICO: Remove a relação da tabela pivô (pedido_moto)
            // Passamos o array inteiro de IDs para garantir que todos saiam
            $pedido->motos()->detach($motosRejeitadasIds);
        }

        // 2. VERIFICAÇÃO PÓS-CORTE
        // Recarrega a relação do banco para ter certeza do que sobrou
        $pedido->load('motos'); 
        
        if ($pedido->motos->count() > 0) {
            // Se sobrou moto, avança para o CD
            $pedido->update(['status' => 'solicitado']); 

            // Monta o texto do Log
            $textoLog = "Aprovado por {$userGestor->name}.";
            
            if ($justificativa) {
                $textoLog .= " Obs do Gestor: \"{$justificativa}\".";
            }
            
            if (!empty($detalhesAuditoria)) {
                $textoLog .= " Cortes realizados: " . implode(", ", $detalhesAuditoria) . ".";
            }

            PedidoLog::create([
                'pedido_id' => $pedido->id,
                'titulo' => 'Autorização Comercial',
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

            return redirect()->route('gestor.index')->with('success', 'Pedido processado e enviado ao CD.');
        } else {
            // Se o gestor cortou tudo, o pedido é cancelado/excluído
            $motivoCancelamento = "Cancelado pelo Gestor. ";
            if ($justificativa) $motivoCancelamento .= "Motivo: " . $justificativa;
            else $motivoCancelamento .= "Todos os itens foram rejeitados.";

            $pedido->SoftDeletes(); 
            
            return redirect()->route('gestor.index')->with('warning', $motivoCancelamento);
        }
    }

    // --- HISTÓRICO DE AUDITORIA ---
    public function historico()
    {
        $logs = PedidoLog::where('titulo', 'Auditoria Comercial')
            ->with(['pedido' => function($q) {
                $q->withTrashed()->with('user');
            }])
            ->orderBy('created_at', 'desc')
            ->paginate(20);

        return Inertia::render('Gestor/History', [
            'logs' => $logs
        ]);
    }
}