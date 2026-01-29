<?php

namespace App\Http\Controllers;

use App\Models\Moto;
use App\Models\Romaneio;
use App\Models\Pedido;
use App\Models\PedidoLog;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB; // Importante para o destroy

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
            $motos = $romaneio->motos;
            $totalMotos = $motos->count();
            
            // Conta quantas motos já foram concluídas ou canceladas
            $concluidas = $motos->filter(function ($moto) {
                $pedido = $moto->pedidos->first();
                return $pedido && in_array($pedido->status, ['concluido', 'cancelado']);
            })->count();

            // Lógica de Status Visual
            if ($totalMotos > 0 && $concluidas === $totalMotos) {
                $statusVisual = 'concluido';
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
                'status' => $statusVisual
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
        $motosDisponiveis = Moto::where('status', 'separado')
            // Carrega o pedido E o pivot com o destino
            ->with(['pedidos' => function($q) {
                $q->withPivot('destino')->with('user');
            }]) 
            ->get()
            ->map(function ($moto) {
                $moto->pedido = $moto->pedidos->last(); 
                // Atalho para facilitar acesso ao destino no front
                if ($moto->pedido) {
                    $moto->pivot = $moto->pedido->pivot; 
                }
                return $moto;
            });

        // 2. Busca Romaneios que estão ABERTOS
        $romaneiosAbertos = Romaneio::whereNotIn('status', ['em_transito', 'concluido', 'cancelado'])
            ->orderBy('created_at', 'desc')
            ->get();

        return Inertia::render('Romaneios/Create', [
            'motosDisponiveis' => $motosDisponiveis,
            'romaneiosAbertos' => $romaneiosAbertos
        ]);
    }

    public function store(Request $request)
    {
        $request->validate([
            'motos_ids' => 'required|array|min:1',
            'motorista' => 'required_without:romaneio_id', 
            'placa'     => 'required_without:romaneio_id',
            'romaneio_id' => 'nullable|exists:romaneios,id'
        ]);

        if ($request->romaneio_id) {
            // A. Adicionar a uma Carga Existente
            $romaneio = Romaneio::findOrFail($request->romaneio_id);
        } else {
            // B. Criar Nova Carga
            $romaneio = Romaneio::create([
                'motorista' => mb_strtoupper($request->motorista),
                'placa'     => mb_strtoupper($request->placa),
                'transportadora' => mb_strtoupper($request->transportadora),
                'status'    => 'aberto',
                'user_id'   => Auth::id()
            ]);
        }

        foreach ($request->motos_ids as $id) {
            $moto = Moto::find($id);
            if ($moto && $moto->status === 'separado') {
                $moto->update([
                    'status' => 'expedido',
                    'romaneio_id' => $romaneio->id,
                    'localizacao_atual' => 'Em Carga (Romaneio #' . $romaneio->id . ')'
                ]);

                if ($moto->pedidos->isNotEmpty()) {
                    $moto->pedidos->last()->update(['status' => 'expedido']);
                }
            }
        }

        return redirect()->route('romaneios.index')->with('success', 'Carga atualizada com sucesso!');
    }

    // 4. VISUALIZAR ROMANEIO (CORRIGIDO PARA MOSTRAR DESTINO CORRETO)
    public function show($id)
    {
        // Carrega o romaneio e, dentro das motos, carrega os pedidos COM O PIVOT DESTINO
        $romaneio = Romaneio::with(['motos' => function($q) {
            $q->with(['pedidos' => function($q2) {
                // IMPORTANTE: withPivot('destino') traz o campo salvo na tabela pedido_moto
                $q2->withPivot('destino')->with('user')->latest(); 
            }]);
        }, 'user'])->findOrFail($id);
        
        // Agrupa as motos pelo DESTINO REAL (Pivot) e não pelo usuário
        $cargasPorLoja = $romaneio->motos->groupBy(function($moto) {
            $pedido = $moto->pedidos->first();
            
            // 1. Tenta pegar o destino específico da moto (Ex: Aldeota/CE)
            if ($pedido && $pedido->pivot && !empty($pedido->pivot->destino)) {
                return mb_strtoupper($pedido->pivot->destino);
            }

            // 2. Se não tiver, tenta a filial do usuário (Ex: Filial Acará)
            if ($pedido && $pedido->user && !empty($pedido->user->filial)) {
                return mb_strtoupper($pedido->user->filial);
            }

            // 3. Último caso: Nome do usuário
            return $pedido->user->name ?? 'DESTINO NÃO INFORMADO';
        })->sortKeys(); // Ordena alfabeticamente (Acará, Aldeota, Belém...)

        return Inertia::render('Romaneios/Show', [
            'romaneio' => $romaneio,
            'cargasPorLoja' => $cargasPorLoja
        ]);
    }

    // 5. INICIAR TRÂNSITO
    public function iniciarTransito($id)
    {
        $romaneio = Romaneio::with('motos.pedidos')->findOrFail($id);
        
        $romaneio->update(['status' => 'em_transito']);

        $romaneio->motos()->update([
            'status' => 'em_transito', 
            'localizacao_atual' => 'Em Trânsito'
        ]);

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

    // 6. DESFAZER CARGA (COM ROLLBACK CORRETO)
    public function destroy($id)
    {
        $romaneio = Romaneio::with('motos.pedido')->findOrFail($id);

        if ($romaneio->status === 'concluido') {
            return back()->withErrors(['erro' => 'Não é possível desfazer uma carga já concluída/entregue.']);
        }

        DB::transaction(function () use ($romaneio) {
            
            $pedidosAfetados = collect();

            // Volta as motos para o pátio
            foreach ($romaneio->motos as $moto) {
                $moto->update([
                    'status' => 'separado', 
                    'localizacao_atual' => 'Separado no Pátio (Retorno de Carga #' . $romaneio->id . ')',
                    'romaneio_id' => null   
                ]);

                if ($moto->pedido) {
                    $pedidosAfetados->push($moto->pedido);
                }
            }

            // Volta os pedidos para 'separado'
            foreach ($pedidosAfetados->unique('id') as $pedido) {
                if (in_array($pedido->status, ['expedido', 'em_transito'])) {
                    $pedido->update(['status' => 'separado']);
                }
            }

            $romaneio->delete();
        });

        return redirect()->route('romaneios.index')
            ->with('success', 'Carga desfeita com sucesso! As motos voltaram para o status "Separado".');
    }
}