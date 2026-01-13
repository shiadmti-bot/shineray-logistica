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
        // Carrega as motos separadas E TRAZ JUNTO o pedido e o usuário (loja)
        $motosDisponiveis = Moto::where('status', 'separado')
            ->with(['pedido.user']) // <--- O SEGREDO ESTÁ AQUI
            ->get();

        return Inertia::render('Romaneios/Create', [
            'motosDisponiveis' => $motosDisponiveis
        ]);

        $romaneiosAbertos = \App\Models\Romaneio::where('status', 'aberto')
            ->orderBy('created_at', 'desc')
            ->get();

        return Inertia::render('Romaneios/Create', [
            'motosDisponiveis' => $motosDisponiveis,
            'romaneiosAbertos' => $romaneiosAbertos
        ]);
    }

    // 3. SALVAR CARGA (NOVA OU EXISTENTE)
    public function store(Request $request)
    {
        $request->validate([
            'romaneio_id' => 'nullable|exists:romaneios,id',
            'motos_ids' => 'required|array|min:1',
            'motorista' => 'required_without:romaneio_id', 
            'placa' => 'required_without:romaneio_id',
        ]);

        if ($request->romaneio_id) {
            $romaneio = Romaneio::findOrFail($request->romaneio_id);
            if ($romaneio->status !== 'aberto') {
                return redirect()->back()->with('error', 'ERRO: Carga fechada ou em trânsito.');
            }
        } else {
            $romaneio = Romaneio::create([
                'motorista' => $request->motorista,
                'placa' => strtoupper($request->placa),
                'transportadora' => $request->transportadora,
                'status' => 'aberto'
            ]);
        }

        // Atualiza Motos
        Moto::whereIn('id', $request->motos_ids)->update([
            'romaneio_id' => $romaneio->id,
            'status' => 'expedido',
            'localizacao_atual' => 'Em Carga (Romaneio #' . $romaneio->id . ')'
        ]);

        // --- CORREÇÃO AQUI (Relacionamento Plural) ---
        $pedidosAfetados = Moto::whereIn('id', $request->motos_ids)
            ->with('pedidos') // Plural
            ->get()
            ->pluck('pedidos') // Plural
            ->flatten() // Junta os arrays de arrays
            ->unique('id');

        foreach ($pedidosAfetados as $pedido) {
            if (!$pedido) continue;

            $pendentes = $pedido->motos()->whereNull('romaneio_id')->count();
            $statusNovo = $pendentes === 0 ? 'expedido' : 'separado';
            
            $pedido->update([
                'status' => $statusNovo,
                'romaneio_id' => $romaneio->id 
            ]);

            PedidoLog::create([
                'pedido_id' => $pedido->id,
                'titulo' => 'Expedição (Carga)',
                'descricao' => "Itens adicionados ao Romaneio #{$romaneio->id}. Usuário: " . Auth::user()->name
            ]);
        }

        return redirect()->route('romaneios.show', $romaneio->id)
            ->with('success', 'Carga gerada/atualizada com sucesso!');
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