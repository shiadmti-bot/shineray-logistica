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
                  ->orWhere('placa', 'like', "%{$termo}%")
                  ->orWhere('transportadora', 'like', "%{$termo}%");
            });
        }

        $romaneios = $query->paginate(10)->through(function ($romaneio) {
            
            // Lógica visual para o status geral da carga na lista
            // (Mesmo que exista o campo 'status' no banco, essa lógica é boa para exibir progresso real)
            $statusGeral = $romaneio->status; // Usa o do banco primeiro (aberto, em_transito, finalizado)
            
            // Se não tiver status no banco (migration antiga), calcula:
            if (!$statusGeral) {
                $total = $romaneio->motos->count();
                $entregues = $romaneio->motos->whereIn('status', ['entregue', 'concluido'])->count();
                
                if ($total > 0 && $entregues == $total) {
                    $statusGeral = 'finalizado';
                } elseif ($romaneio->motos->contains('status', 'em_transito')) {
                    $statusGeral = 'em_transito';
                } else {
                    $statusGeral = 'aberto';
                }
            }

            return [
                'id' => $romaneio->id,
                'motorista' => $romaneio->motorista,
                'placa' => $romaneio->placa,
                'transportadora' => $romaneio->transportadora,
                'created_at' => $romaneio->created_at,
                'motos_count' => $romaneio->motos_count,
                'status' => $statusGeral
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
        // Motos prontas para sair (Status Separado)
        // Incluímos 'pedido.user' para mostrar a filial na tela de seleção
        $motosDisponiveis = Moto::with(['pedido.user'])
            ->where('status', 'separado')
            ->get();

        // Cargas que estão ABERTAS (permitido adicionar mais itens)
        // Ignora cargas que já saíram (em_transito) ou acabaram (finalizado)
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
            // 'tipo_acao' não vem do form, inferimos pelo romaneio_id ou motorista
            'romaneio_id' => 'nullable|exists:romaneios,id',
            'motos_ids' => 'required|array|min:1',
            // Se for nova carga (sem ID), exige motorista e placa
            'motorista' => 'required_without:romaneio_id', 
            'placa' => 'required_without:romaneio_id',
        ]);

        // Cenário 1: Adicionar a Carga Existente
        if ($request->romaneio_id) {
            $romaneio = Romaneio::findOrFail($request->romaneio_id);
            
            // TRAVA DE SEGURANÇA: Só pode mexer se estiver 'aberto'
            if ($romaneio->status !== 'aberto') {
                return redirect()->back()->with('error', 'ERRO: Esta carga já saiu ou foi finalizada. Não é possível editar.');
            }
        } 
        // Cenário 2: Criar Nova Carga
        else {
            $romaneio = Romaneio::create([
                'motorista' => $request->motorista,
                'placa' => strtoupper($request->placa),
                'transportadora' => $request->transportadora,
                'status' => 'aberto' // Nasce aberta
            ]);
        }

        // --- ATUALIZAÇÃO DAS MOTOS ---
        Moto::whereIn('id', $request->motos_ids)->update([
            'romaneio_id' => $romaneio->id,
            'status' => 'expedido', // Muda status da moto para 'expedido' (pronta pra carga)
            'localizacao_atual' => 'Em Carga (Romaneio #' . $romaneio->id . ')'
        ]);

        // --- ATUALIZAÇÃO DOS PEDIDOS ---
        // Pegamos todos os pedidos envolvidos nessas motos
        $pedidosAfetados = Moto::whereIn('id', $request->motos_ids)
            ->with('pedido') // Use a relação correta 'pedido' (singular) se for BelongsTo
            ->get()
            ->pluck('pedido')
            ->unique('id');

        foreach ($pedidosAfetados as $pedido) {
            if (!$pedido) continue;

            // Verifica se TODAS as motos desse pedido já estão em algum romaneio
            $pendentes = $pedido->motos()->whereNull('romaneio_id')->count();
            
            // Se pendentes == 0, o pedido todo foi expedido. Se não, continua separado (parcial).
            $statusNovo = $pendentes === 0 ? 'expedido' : 'separado';
            
            // Vincula o pedido ao romaneio também para facilitar rastreio
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
        // Trazemos motos -> pedido -> user para agrupar por Loja no relatório
        $romaneio = Romaneio::with(['motos.pedido.user'])->findOrFail($id);
        
        $cargasPorLoja = $romaneio->motos->groupBy(function($moto) {
            return $moto->pedido->user->name ?? 'Outros';
        });

        return Inertia::render('Romaneios/Show', [
            'romaneio' => $romaneio,
            'cargasPorLoja' => $cargasPorLoja
        ]);
    }

    // 5. INICIAR TRÂNSITO (LIBERAR SAÍDA)
    public function iniciarTransito($id)
    {
        $romaneio = Romaneio::with('motos.pedido')->findOrFail($id);
        
        // 1. Muda status do Romaneio (Trava edição)
        $romaneio->update(['status' => 'em_transito']);

        // 2. Atualiza Motos
        $romaneio->motos()->update([
            'status' => 'em_transito', 
            'localizacao_atual' => 'Em Trânsito'
        ]);

        // 3. Atualiza Pedidos
        $pedidosIds = $romaneio->motos->pluck('pedido_id')->unique();
        \App\Models\Pedido::whereIn('id', $pedidosIds)->update(['status' => 'em_transito']);

        // 4. Logs
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

    // 6. DESFAZER CARGA (ESTORNO / BOTÃO DE PÂNICO)
    public function destroy($id)
    {
        $romaneio = Romaneio::with('motos')->findOrFail($id);

        // Segurança: Não permite apagar se já foi finalizado
        if ($romaneio->status === 'finalizado' || $romaneio->motos->contains('status', 'concluido')) {
            return redirect()->back()->with('error', 'Não é possível excluir cargas já entregues/finalizadas.');
        }

        // 1. Identificar pedidos afetados
        $pedidosIds = $romaneio->motos->pluck('pedido_id')->unique();

        // 2. Devolver Motos para o Pátio ('separado')
        $romaneio->motos()->update([
            'romaneio_id' => null,      // Remove vínculo
            'status' => 'separado',     // Volta para o pátio
            'localizacao_atual' => 'Devolvido ao Pátio (Romaneio Cancelado)'
        ]);

        // 3. Atualizar Pedidos para 'separado' (e remove vínculo do romaneio)
        \App\Models\Pedido::whereIn('id', $pedidosIds)->update([
            'status' => 'separado',
            'romaneio_id' => null
        ]);

        // 4. Registrar Log
        foreach ($pedidosIds as $pid) {
            if(!$pid) continue;
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