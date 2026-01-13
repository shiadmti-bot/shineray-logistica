<?php

namespace App\Http\Controllers;

use App\Models\Pedido;
use App\Models\PedidoLog;
use App\Notifications\PedidoAtualizado;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Inertia\Inertia;

class GestorController extends Controller
{
    // Dashboard do Gestor (Tablet Friendly)
    public function index()
    {
        $pedidos = Pedido::with(['user', 'motos'])
            ->where('status', 'em_analise') // Só mostra o que precisa aprovar
            ->orderBy('created_at', 'asc') // FIFO (Primeiro que entra, primeiro que sai)
            ->get();

        return Inertia::render('Gestor/Dashboard', [
            'pedidos' => $pedidos
        ]);
    }

    // Tela de Detalhe para Aprovação
    public function show($id)
    {
        $pedido = Pedido::with(['user', 'motos', 'logs'])->findOrFail($id);
        return Inertia::render('Gestor/Show', ['pedido' => $pedido]);
    }

    // Ação de Aprovar (Com lógica de corte de itens)
    public function aprovar(Request $request, $id)
    {
        $pedido = Pedido::with('motos')->findOrFail($id);
        
        // IDs das motos que o gestor DESMARCOU (rejeitou)
        $motosRejeitadasIds = $request->input('rejeitadas', []);
        
        $msgLog = "Pedido conferido e autorizado pelo Gestor " . Auth::user()->name . ".";

        // Lógica de Aprovação Parcial
        if (count($motosRejeitadasIds) > 0) {
            foreach ($pedido->motos as $moto) {
                if (in_array($moto->id, $motosRejeitadasIds)) {
                    // Devolve para o estoque
                    $moto->update([
                        'status' => 'estoque_fabrica',
                        'localizacao_atual' => 'Estoque (Removido pelo Gestor)'
                    ]);
                    // Desvincula do pedido
                    $pedido->motos()->detach($moto->id);
                }
            }
            $msgLog .= " Itens removidos/cortados: " . count($motosRejeitadasIds) . ".";
        }

        // Se sobrou alguma moto, avança para o CD
        if ($pedido->motos()->count() > 0) {
            $pedido->update(['status' => 'solicitado']); // AGORA VAI PRO CD

            // Log na Timeline
            PedidoLog::create([
                'pedido_id' => $pedido->id,
                'titulo' => 'Autorização Comercial',
                'descricao' => $msgLog
            ]);

            // Notifica o CD (Agora sim eles trabalham)
            $cds = \App\Models\User::where('perfil', 'cd')->get();
            foreach ($cds as $cd) {
                $cd->notify(new PedidoAtualizado(
                    'Pedido #' . $pedido->id . ' Autorizado',
                    'Gestão liberou para separação.',
                    route('pedidos.show', $pedido->id)
                ));
            }

            return redirect()->route('gestor.index')->with('success', 'Pedido autorizado e enviado ao CD!');
        } else {
            // Se o gestor rejeitou TUDO, cancela o pedido
            $pedido->delete();
            return redirect()->route('gestor.index')->with('warning', 'Todos os itens foram rejeitados. Pedido cancelado.');
        }
    }
}