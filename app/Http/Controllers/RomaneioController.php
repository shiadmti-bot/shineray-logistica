<?php

namespace App\Http\Controllers;

use App\Models\Moto;
use App\Models\Romaneio;
use App\Models\Pedido;
use App\Models\PedidoLog;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Illuminate\Support\Facades\Auth;

class RomaneioController extends Controller
{
    // 1. LISTA DE CARGAS (HISTÓRICO)
    public function index(Request $request)
    {
        $termo = $request->input('search');

        $query = Romaneio::withCount('motos')
            ->with(['motos.pedidos']) // Carrega pedidos para ver o status real
            ->orderBy('created_at', 'desc');

        if ($termo) {
            $query->where(function($q) use ($termo) {
                $q->where('id', 'like', "%{$termo}%")
                  ->orWhere('motorista', 'like', "%{$termo}%")
                  ->orWhere('placa', 'like', "%{$termo}%")
                  ->orWhere('transportadora', 'like', "%{$termo}%");
            });
        }

        $romaneios = $query->paginate(10)->through(function ($romaneio) {
            
            // --- CÁLCULO DINÂMICO DO STATUS REAL ---
            // Ignoramos o $romaneio->status do banco para a visualização, 
            // calculando com base na situação real dos pedidos.
            
            $motos = $romaneio->motos;
            $totalMotos = $motos->count();
            
            // Conta quantas motos já foram concluídas ou canceladas
            $concluidas = $motos->filter(function ($moto) {
                // Verifica o status do pedido vinculado à moto
                $pedido = $moto->pedidos->first();
                return $pedido && in_array($pedido->status, ['concluido', 'cancelado']);
            })->count();

            // Lógica de Status Visual
            if ($totalMotos > 0 && $concluidas === $totalMotos) {
                $statusVisual = 'finalizado';
            } elseif ($romaneio->status === 'aberto') {
                $statusVisual = 'aberto';
            } else {
                $statusVisual = 'em_transito';
            }

            return [
                'id' => $romaneio->id,
                'motorista' => $romaneio->motorista,
                'placa' => $romaneio->placa,
                'transportadora' => $romaneio->transportadora,
                'created_at' => $romaneio->created_at,
                'motos_count' => $romaneio->motos_count,
                'status' => $statusVisual // Envia o status calculado
            ];
        });

        return Inertia::render('Romaneios/Index', [
            'romaneios' => $romaneios,
            'filters' => $request->only(['search'])
        ]);
    }

    // 2. TELA DE MONTAGEM (NOVA CARGA)
    public function create()
    {
        // 1. Busca motos separadas (disponíveis para carga)
        // Usa o 'map' para injetar o objeto 'pedido' facilitado para o frontend
        $motosDisponiveis = Moto::where('status', 'separado')
            ->with(['pedidos.user']) 
            ->get()
            ->map(function ($moto) {
                $moto->pedido = $moto->pedidos->last(); 
                return $moto;
            });

        // 2. Busca Romaneios que estão ABERTOS (ainda não saíram)
        // Assumindo que 'aberto' é o status inicial. Se não tiver status, usamos lógica de não estar em trânsito.
        // Aqui filtro por status diferente de 'em_transito' e 'finalizado'
        $romaneiosAbertos = Romaneio::whereNotIn('status', ['em_transito', 'finalizado', 'cancelado'])
            ->orderBy('created_at', 'desc')
            ->get();

        return Inertia::render('Romaneios/Create', [
            'motosDisponiveis' => $motosDisponiveis,
            'romaneiosAbertos' => $romaneiosAbertos // Enviando para o Frontend
        ]);
    }

    public function store(Request $request)
    {
        $request->validate([
            'motos_ids' => 'required|array|min:1',
            // Validações condicionais
            'motorista' => 'required_without:romaneio_id', 
            'placa'     => 'required_without:romaneio_id',
            'romaneio_id' => 'nullable|exists:romaneios,id'
        ]);

        // LÓGICA INTELIGENTE: Novo ou Existente?
        if ($request->romaneio_id) {
            // A. Adicionar a uma Carga Existente
            $romaneio = Romaneio::findOrFail($request->romaneio_id);
        } else {
            // B. Criar Nova Carga
            $romaneio = Romaneio::create([
                'motorista' => mb_strtoupper($request->motorista),
                'placa'     => mb_strtoupper($request->placa),
                'transportadora' => mb_strtoupper($request->transportadora),
                'status'    => 'aberto', // Status inicial
                'user_id'   => Auth::id()
            ]);
        }

        // Vincula as motos ao Romaneio (Seja novo ou velho)
        foreach ($request->motos_ids as $id) {
            $moto = Moto::find($id);
            if ($moto && $moto->status === 'separado') {
                $moto->update([
                    'status' => 'expedido', // Muda status para 'Em Carga'
                    'romaneio_id' => $romaneio->id,
                    'localizacao_atual' => 'Em Carga (Romaneio #' . $romaneio->id . ')'
                ]);

                // Atualiza o status do pedido dessa moto para 'expedido' também
                // (Para a barra de progresso da loja andar)
                if ($moto->pedidos->isNotEmpty()) {
                    $moto->pedidos->last()->update(['status' => 'expedido']);
                }
            }
        }

        return redirect()->route('romaneios.index')->with('success', 'Carga atualizada com sucesso!');
    }

    // 4. VISUALIZAR ROMANEIO MASTER
    public function show($id)
    {
        // CORREÇÃO: Plural 'pedidos'
        $romaneio = Romaneio::with(['motos.pedidos.user'])->findOrFail($id);
        
        $cargasPorLoja = $romaneio->motos->groupBy(function($moto) {
            // Pega o primeiro pedido da lista (assumindo que a moto está em um pedido ativo)
            return $moto->pedidos->first()->user->name ?? 'Outros';
        });

        return Inertia::render('Romaneios/Show', [
            'romaneio' => $romaneio,
            'cargasPorLoja' => $cargasPorLoja
        ]);
    }

    // 5. INICIAR TRÂNSITO (LIBERAR SAÍDA)
    public function iniciarTransito($id)
    {
        // Carrega relação 'pedidos' (plural)
        $romaneio = Romaneio::with('motos.pedidos')->findOrFail($id);
        
        $romaneio->update(['status' => 'em_transito']);

        $romaneio->motos()->update([
            'status' => 'em_transito', 
            'localizacao_atual' => 'Em Trânsito'
        ]);

        // CORREÇÃO: Pluck 'pedidos' e Flatten
        $pedidosIds = $romaneio->motos->pluck('pedidos')->flatten()->pluck('id')->unique();
        
        \App\Models\Pedido::whereIn('id', $pedidosIds)->update(['status' => 'em_transito']);

        foreach ($pedidosIds as $pid) {
            if(!$pid) continue;
            PedidoLog::create([
                'pedido_id' => $pid,
                'titulo' => 'Em Trânsito',
                'descricao' => "Carga #{$id} saiu do CD. Motorista: {$romaneio->motorista}."
            ]);
        }

        return redirect()->back()->with('success', 'Saída confirmada! Status atualizado para Em Trânsito.');
    }

    // 6. DESFAZER CARGA
    public function destroy($id)
    {
        $romaneio = Romaneio::with('motos.pedidos')->findOrFail($id);

        if ($romaneio->status === 'finalizado' || $romaneio->motos->contains('status', 'concluido')) {
            return redirect()->back()->with('error', 'Não é possível excluir cargas já entregues/finalizadas.');
        }

        // CORREÇÃO: Pluck 'pedidos' e Flatten
        $pedidosIds = $romaneio->motos->pluck('pedidos')->flatten()->pluck('id')->unique();

        $romaneio->motos()->update([
            'romaneio_id' => null,
            'status' => 'separado',
            'localizacao_atual' => 'Devolvido ao Pátio (Romaneio Cancelado)'
        ]);

        \App\Models\Pedido::whereIn('id', $pedidosIds)->update([
            'status' => 'separado',
            'romaneio_id' => null
        ]);

        foreach ($pedidosIds as $pid) {
            if(!$pid) continue;
            PedidoLog::create([
                'pedido_id' => $pid,
                'titulo' => 'Carga Cancelada',
                'descricao' => "O Romaneio #{$id} foi excluído pelo CD. Itens retornaram ao status de separação."
            ]);
        }

        $romaneio->delete();

        return redirect()->route('romaneios.index')->with('warning', 'Romaneio excluído e itens devolvidos ao pátio.');
    }
}