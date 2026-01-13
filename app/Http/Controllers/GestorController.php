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
        
        // IDs que o gestor REJEITOU (Desmarcou na tela)
        $motosRejeitadasIds = $request->input('rejeitadas', []);
        
        $userGestor = Auth::user();
        $detalhesAuditoria = []; // Array para salvar no log

        // 1. Processa Rejeições (Corte de Itens)
        if (count($motosRejeitadasIds) > 0) {
            foreach ($motosRejeitadasIds as $motoId) {
                $moto = Moto::find($motoId);
                if ($moto) {
                    // Guarda info para auditoria
                    $detalhesAuditoria[] = "Chassi {$moto->chassi} ({$moto->modelo}) removido.";

                    // A. Reseta status da moto para livre
                    $moto->update([
                        'status' => 'estoque_fabrica',
                        'localizacao_atual' => 'Estoque (Devolvido pela Gestão)'
                    ]);

                    // B. CRÍTICO: Remove a relação com este pedido
                    // Isso impede que a moto apareça para o CD ou na lista do pedido
                    $pedido->motos()->detach($motoId);
                }
            }
        }

        // 2. Verifica o que sobrou
        // Recarrega a relação para ver quantas motos restaram vinculadas
        $pedido->refresh(); 
        
        if ($pedido->motos()->count() > 0) {
            // Se sobrou moto, avança para o CD
            $pedido->update(['status' => 'solicitado']); 

            // Cria Log de Auditoria Detalhado
            $textoLog = "Aprovado por {$userGestor->name}.";
            if (!empty($detalhesAuditoria)) {
                $textoLog .= " Cortes: " . implode(" | ", $detalhesAuditoria);
            }

            PedidoLog::create([
                'pedido_id' => $pedido->id,
                'titulo' => 'Auditoria Comercial',
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
            // Se tudo foi rejeitado, o pedido morre aqui
            // As motos já foram liberadas no loop acima
            $pedido->delete(); // Soft delete ou delete real
            
            return redirect()->route('gestor.index')->with('warning', 'Todos os itens foram rejeitados. O pedido foi cancelado.');
        }
    }

    // --- NOVO: HISTÓRICO DE AUDITORIA ---
    public function historico()
    {
        // Busca logs onde o título é 'Auditoria Comercial'
        // Traz o pedido (mesmo que excluído, se usar softDeletes, ou traz null se hard delete)
        // O ideal é buscar Logs e carregar user
        $logs = PedidoLog::where('titulo', 'Auditoria Comercial')
            ->with(['pedido' => function($q) {
                $q->withTrashed()->with('user'); // Carrega mesmo se o pedido foi deletado
            }])
            ->orderBy('created_at', 'desc')
            ->paginate(20);

        return Inertia::render('Gestor/History', [
            'logs' => $logs
        ]);
    }
}