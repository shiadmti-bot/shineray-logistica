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
            ->with(['motos' => function($q) {
                $q->select('id', 'romaneio_id', 'status');
            }])
            ->orderBy('created_at', 'desc');

        if ($termo) {
            $query->where(function($q) use ($termo) {
                $q->where('id', 'like', "%{$termo}%")
                  ->orWhere('motorista', 'like', "%{$termo}%")
                  ->orWhere('placa', 'like', "%{$termo}%");
            });
        }

        $romaneios = $query->paginate(10)->through(function ($romaneio) {
            $statusGeral = 'expedido'; // Padrão: Pátio / Carregando
            
            $total = $romaneio->motos->count();
            $emTransito = $romaneio->motos->where('status', 'em_transito')->count();
            $entregues = $romaneio->motos->whereIn('status', ['entregue', 'concluido'])->count();

            if ($total > 0 && $entregues == $total) {
                $statusGeral = 'concluido';
            } elseif ($emTransito > 0 || $entregues > 0) {
                $statusGeral = 'em_transito';
            }

            return [
                'id' => $romaneio->id,
                'motorista' => $romaneio->motorista,
                'placa' => $romaneio->placa,
                'created_at' => $romaneio->created_at,
                'motos_count' => $romaneio->motos_count,
                'status_geral' => $statusGeral
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
        // Motos disponíveis (Separadas e sem romaneio)
        $motosDisponiveis = Moto::where('status', 'separado')
            ->whereNull('romaneio_id')
            ->with(['pedidos.user'])
            ->get()
            ->map(function ($moto) {
                $pedido = $moto->pedidos->first();
                return [
                    'id' => $moto->id,
                    'modelo' => $moto->modelo,
                    'chassi' => $moto->chassi,
                    'cor' => $moto->cor,
                    'loja' => $pedido ? $pedido->user->name : 'Desconhecido',
                    'pedido_id' => $pedido ? $pedido->id : null,
                ];
            });

        // --- FILTRO INTELIGENTE ---
        // Busca apenas romaneios que estão "NO PÁTIO"
        // Exclui qualquer romaneio que já saiu (em_transito) ou finalizou
        $romaneiosAbertos = Romaneio::withCount('motos')
            ->whereDoesntHave('motos', function($q) {
                $q->whereIn('status', ['em_transito', 'concluido', 'entregue']);
            })
            ->orderBy('id', 'desc')
            ->take(10)
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
            'tipo_acao' => 'required|in:novo,existente',
            'motos_selecionadas' => 'required|array|min:1',
            'motorista' => 'required_if:tipo_acao,novo',
            'placa' => 'required_if:tipo_acao,novo',
            // 'nullable' permite passar vazio se for nova carga
            'romaneio_id' => 'nullable|required_if:tipo_acao,existente|exists:romaneios,id',
        ]);

        if ($request->tipo_acao === 'novo') {
            $romaneio = Romaneio::create([
                'motorista' => $request->motorista,
                'placa' => $request->placa
            ]);
        } else {
            $romaneio = Romaneio::findOrFail($request->romaneio_id);
            
            // --- TRAVA DE SEGURANÇA ---
            // Verifica se a carga já saiu antes de permitir adicionar itens
            $jaSaiu = $romaneio->motos()->whereIn('status', ['em_transito', 'concluido', 'entregue'])->exists();
            
            if ($jaSaiu) {
                return redirect()->back()->with('error', 'ERRO: Esta carga já saiu para entrega. Não é possível adicionar novos itens.');
            }

            if($request->motorista) $romaneio->update(['motorista' => $request->motorista]);
            if($request->placa) $romaneio->update(['placa' => $request->placa]);
        }

        // Atualiza motos
        Moto::whereIn('id', $request->motos_selecionadas)->update([
            'romaneio_id' => $romaneio->id,
            'status' => 'expedido',
            'localizacao_atual' => 'Em Carga (Romaneio #' . $romaneio->id . ')'
        ]);

        // Atualiza pedidos
        $pedidosAfetados = Moto::whereIn('id', $request->motos_selecionadas)
                                ->with('pedidos')
                                ->get()
                                ->pluck('pedidos')
                                ->flatten()
                                ->unique('id');

        foreach ($pedidosAfetados as $pedido) {
            $pendentes = $pedido->motos()->whereNull('romaneio_id')->count();
            // Se ainda tem moto sobrando, fica separado. Se acabou, vira expedido.
            $statusNovo = $pendentes === 0 ? 'expedido' : 'separado';
            
            $pedido->update(['status' => $statusNovo]);

            PedidoLog::create([
                'pedido_id' => $pedido->id,
                'titulo' => 'Expedição (Carga)',
                'descricao' => "Itens adicionados ao Romaneio #{$romaneio->id}. Usuário: " . Auth::user()->name
            ]);
        }

        return redirect()->route('romaneios.show', $romaneio->id)
            ->with('success', 'Carga gerada e motos atualizadas com sucesso!');
    }

    // 4. VISUALIZAR ROMANEIO MASTER
    public function show($id)
    {
        $romaneio = Romaneio::with(['motos.pedidos.user'])->findOrFail($id);
        
        $cargasPorLoja = $romaneio->motos->groupBy(function($moto) {
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
        $romaneio = Romaneio::with('motos.pedidos')->findOrFail($id);
        
        // Atualiza motos
        $romaneio->motos()->update([
            'status' => 'em_transito', 
            'localizacao_atual' => 'Em Trânsito'
        ]);

        // Identifica pedidos afetados
        $pedidosIds = $romaneio->motos->pluck('pedidos')->flatten()->pluck('id')->unique();
        
        // Atualiza pedidos
        \App\Models\Pedido::whereIn('id', $pedidosIds)->update(['status' => 'em_transito']);

        // Gera logs para rastreamento
        foreach ($pedidosIds as $pid) {
            PedidoLog::create([
                'pedido_id' => $pid,
                'titulo' => 'Em Trânsito',
                'descricao' => "Carga #{$id} saiu do CD. Motorista: {$romaneio->motorista}."
            ]);
        }

        return redirect()->back()->with('success', 'Saída confirmada! Status atualizado para Em Trânsito.');
    }

    // 6. DESFAZER CARGA (ESTORNO / BOTÃO DE PÂNICO)
    public function destroy($id)
    {
        $romaneio = Romaneio::with('motos')->findOrFail($id);

        // Segurança: Não permite apagar se já foi finalizado/entregue
        if ($romaneio->motos->contains('status', 'concluido')) {
            return redirect()->back()->with('error', 'Não é possível excluir cargas já entregues/finalizadas.');
        }

        // 1. Identificar pedidos afetados
        $pedidosIds = $romaneio->motos->pluck('pedidos')->flatten()->pluck('id')->unique();

        // 2. Devolver Motos para o Pátio ('separado')
        $romaneio->motos()->update([
            'romaneio_id' => null,      // Remove vínculo
            'status' => 'separado',     // Volta para o pátio
            'localizacao_atual' => 'Devolvido ao Pátio (Romaneio Cancelado)'
        ]);

        // 3. Atualizar Pedidos para 'separado'
        \App\Models\Pedido::whereIn('id', $pedidosIds)->update(['status' => 'separado']);

        // 4. Registrar Log
        foreach ($pedidosIds as $pid) {
            PedidoLog::create([
                'pedido_id' => $pid,
                'titulo' => 'Carga Cancelada',
                'descricao' => "O Romaneio #{$id} foi excluído pelo CD. Itens retornaram ao status de separação."
            ]);
        }

        // 5. Apagar o Romaneio
        $romaneio->delete();

        return redirect()->route('romaneios.index')->with('warning', 'Romaneio excluído e itens devolvidos ao pátio.');
    }
}