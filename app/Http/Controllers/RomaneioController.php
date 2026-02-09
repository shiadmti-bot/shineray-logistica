<?php

namespace App\Http\Controllers;

use App\Models\Romaneio;
use App\Models\Pedido;
use App\Models\PedidoLog;
use App\Models\Moto;
use App\Models\User;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;

class RomaneioController extends Controller
{
    // 1. LISTA DE CARGAS (DASHBOARD)
    public function index(Request $request)
    {
        $termo = $request->input('search');

        $query = Romaneio::withCount('motos')
            ->with(['motos.pedidos', 'user'])
            ->orderBy('created_at', 'desc');

        if ($termo) {
            $query->where(function($q) use ($termo) {
                $q->where('id', 'like', "%{$termo}%")
                  ->orWhere('motorista', 'like', "%{$termo}%")
                  ->orWhere('placa', 'like', "%{$termo}%")
                  ->orWhere('rota', 'like', "%{$termo}%");
            });
        }

        $romaneios = $query->paginate(10)->through(function ($romaneio) {
            $motos = $romaneio->motos;
            $total = $motos->count();
            
            // Lógica visual de conclusão baseada nos itens
            // Considera concluído se o pedido vinculado já foi entregue ou cancelado
            $concluidas = $motos->filter(function($m) {
                $pedido = $m->pedidos->first();
                return $pedido && in_array($pedido->status, ['concluido', 'cancelado', 'no_cd']);
            })->count();

            $statusVisual = $romaneio->status;
            if ($total > 0 && $concluidas === $total && $statusVisual !== 'no_cd') {
                $statusVisual = 'concluido';
            }

            return [
                'id' => $romaneio->id,
                'motorista' => $romaneio->motorista,
                'placa' => $romaneio->placa,
                'rota' => $romaneio->rota,
                'origem' => $romaneio->user->filial ?? 'CD Matriz',
                'created_at' => $romaneio->created_at,
                'motos_count' => $romaneio->motos_count,
                'status' => $statusVisual,
                'tipo' => $romaneio->tipo 
            ];
        });

        return Inertia::render('Romaneios/Index', [
            'romaneios' => $romaneios,
            'filters' => $request->only(['search'])
        ]);
    }

    // 2. PAINEL DE MONTAGEM DE CARGA (MESA DE OPERAÇÃO)
    public function create()
    {
        // 1. EXPEDIÇÃO (Saindo do CD)
        // Pedidos que estão 'separado' e são saída de estoque próprio (sem origem de outra loja)
        // OU pedidos que estão 'no_cd' (Transbordos que chegaram e vão sair de novo)
        $expedicao = Pedido::whereIn('status', ['separado', 'no_cd'])
            ->whereNull('origem_user_id') // É estoque do CD ou Transbordo já processado
            ->with(['user', 'motos']) // Carrega cliente e motos
            ->get();

        // 2. COLETAS (Milk Run)
        // Pedidos que são transferências (tem origem definida) e ainda não foram coletados
        // Status pode ser 'separado' (na loja de origem) ou 'solicitado' (aprovado comercial)
        $coletas = Pedido::whereNotNull('origem_user_id')
            ->whereIn('status', ['solicitado', 'separado'])
            ->with(['user', 'origem', 'motos'])
            ->get();

        // 3. Cargas em Aberto (Para adicionar itens nelas)
        $cargasEmAberto = Romaneio::where('status', 'aberto')
            ->withCount('motos')
            ->orderBy('id', 'desc')
            ->get();

        return Inertia::render('Romaneios/Create', [
            'expedicao' => $expedicao,
            'coletas' => $coletas,
            'cargasEmAberto' => $cargasEmAberto
        ]);
    }

    // 3. SALVAR CARGA (CORAÇÃO DA LOGÍSTICA)
    public function store(Request $request)
    {
        $request->validate([
            'motorista' => 'required_without:romaneio_id|string|nullable',
            'placa' => 'required_without:romaneio_id|string|nullable',
            'rota_nome' => 'required_without:romaneio_id|string|nullable',
            'romaneio_id' => 'nullable|exists:romaneios,id',
            'pedidos_ids' => 'required|array|min:1' // IDs dos PEDIDOS selecionados
        ]);

        return DB::transaction(function () use ($request) {
            
            // A) Cria ou Recupera o Romaneio
            if ($request->romaneio_id) {
                $romaneio = Romaneio::findOrFail($request->romaneio_id);
            } else {
                $romaneio = Romaneio::create([
                    'user_id' => Auth::id(),
                    'status' => 'aberto',
                    'motorista' => mb_strtoupper($request->motorista),
                    'placa' => mb_strtoupper($request->placa),
                    'rota' => mb_strtoupper($request->rota_nome),
                    'tipo' => 'misto', // Milk Run (Coleta + Entrega)
                    'saida_em' => now()
                ]);
            }

            // B) Processa os Pedidos Selecionados
            $pedidos = Pedido::with(['origem', 'user', 'motos'])->whereIn('id', $request->pedidos_ids)->get();
            
            foreach ($pedidos as $pedido) {
                
                // --- LÓGICA INTELIGENTE DE STATUS (MILK RUN) ---
                
                $isColeta = ($pedido->origem_user_id != null);
                
                // Se for coleta, verificamos se passa pelo CD (Interior) ou Direto (Capital)
                // Se origem ou destino for interior, geralmente passa pelo hub.
                $passaPeloCD = ($isColeta && ($pedido->origem->is_interior || $pedido->user->is_interior));

                if ($isColeta) {
                    // Cenário: Caminhão sai do CD vazio e pega na Loja A
                    // Status deve indicar que AINDA NÃO ESTÁ NO CAMINHÃO
                    $novoStatusPedido = 'aguardando_coleta'; 
                    $novoStatusMoto = 'aguardando_coleta';
                    $localizacaoTexto = "Aguardando Coleta em: {$pedido->origem->filial}";
                } 
                else {
                    // Cenário: Sai do CD cheio
                    // Antes: 'em_transito'. Agora: 'expedido' (Está no caminhão, mas no pátio)
                    $novoStatusPedido = 'expedido';
                    $novoStatusMoto = 'expedido'; 
                    $localizacaoTexto = "Em Carga (Docas CD) - Romaneio #{$romaneio->id}";
                }

                // Atualiza Pedido
                $pedido->update([
                    'status' => $novoStatusPedido,
                    'romaneio_id' => $romaneio->id
                ]);

                // Atualiza Motos vinculadas a este pedido
                foreach ($pedido->motos as $moto) {
                    // Só mexe se a moto estiver 'separado', 'disponivel' ou 'no_cd'
                    // Evita mexer em moto que já foi entregue ou cancelada
                    if (in_array($moto->status, ['separado', 'disponivel', 'no_cd', 'solicitado'])) {
                        $moto->update([
                            'status' => $novoStatusMoto,
                            'romaneio_id' => $romaneio->id,
                            'localizacao_atual' => $localizacaoTexto
                        ]);
                    }
                }
            }

            return redirect()->route('romaneios.show', $romaneio->id)
                ->with('success', 'Carga atualizada com sucesso!');
        });
    }

    // 4. VISUALIZAR DETALHES
    public function show($id)
    {
        $romaneio = Romaneio::with([
            'user', 
            'motos' => function($query) {
                $query->orderBy('status', 'asc') // Agrupa 'aguardando_coleta' primeiro
                      ->orderBy('modelo', 'asc');
                
                // Carrega pedidos relacionados para saber Destino/Origem
                $query->with(['pedidos.user', 'pedidos.origem']); 
            }
        ])->findOrFail($id);

        return Inertia::render('Romaneios/Show', [
            'romaneio' => $romaneio
        ]);
    }

    // 5. INICIAR TRÂNSITO (LIBERAR SAÍDA)
    public function iniciarTransito($id)
    {
        return DB::transaction(function () use ($id) {
            // Carrega o romaneio com pedidos E as motos desses pedidos
            $romaneio = Romaneio::with(['pedidos.motos'])->findOrFail($id);
            
            if ($romaneio->status !== 'aberto') {
                return back()->withErrors(['erro' => 'Esta carga já saiu ou foi concluída.']);
            }

            // 1. Atualiza o Romaneio
            $romaneio->update(['status' => 'em_transito']);

            // 2. Atualiza os Itens (Apenas os que estavam 'expedido')
            // Itens 'aguardando_coleta' NÃO mudam aqui, pois o motorista ainda vai buscar.
            foreach ($romaneio->pedidos as $pedido) {
                
                if ($pedido->status === 'expedido') {
                    // Vira Em Trânsito Real
                    $pedido->update(['status' => 'em_transito']);
                    
                    // Atualiza as motos deste pedido
                    foreach ($pedido->motos as $moto) {
                        $moto->update([
                            'status' => 'transito_loja',
                            'localizacao_atual' => "Em Trânsito para {$pedido->user->filial}"
                        ]);
                    }

                    // Log de Auditoria
                    PedidoLog::create([
                        'pedido_id' => $pedido->id,
                        'titulo' => 'Saiu para Entrega 🚚',
                        'descricao' => "Carga #{$romaneio->id} deixou o pátio com motorista {$romaneio->motorista}."
                    ]);
                }
            }

            return back()->with('success', 'Saída confirmada! Itens do CD agora estão em trânsito.');
        });
    }

    // 6. RECEBER CARGA (BAIXA LOGÍSTICA / TRANSBORDO)
    public function receber($id)
    {
        return DB::transaction(function () use ($id) {
            $romaneio = Romaneio::with(['pedidos.motos'])->findOrFail($id);
            $user = Auth::user();

            // --- CASO 1: CHEGADA NO CD (TRANSBORDO) ---
            // O motorista trouxe coletas do interior para o Hub (CD/Admin)
            if ($user->perfil === 'cd' || $user->perfil === 'admin') {
                
                $itensRecebidos = 0;

                foreach ($romaneio->pedidos as $pedido) {
                    // Só processa o que estava previsto para vir ao CD (Coletas Interior ou Transbordo)
                    // Ou pedidos que estavam 'aguardando_coleta' e agora chegaram fisicamente
                    if (in_array($pedido->status, ['aguardando_coleta', 'em_transito', 'em_transito_cd'])) {
                        
                        // Verifica se este pedido é uma transferência (tem origem)
                        // Se for transferência, ao chegar no CD, ele fica 'no_cd' aguardando nova rota.
                        if ($pedido->origem_user_id) {
                            
                            $pedido->update(['status' => 'no_cd', 'romaneio_id' => null]); // LIBERA PARA NOVA CARGA
                            
                            foreach ($pedido->motos as $moto) {
                                $moto->update([
                                    'status' => 'no_cd',
                                    'localizacao_atual' => 'Depósito CD (Aguardando Rota Final)',
                                    'romaneio_id' => null
                                ]);
                            }
                            $itensRecebidos++;
                        }
                    }
                }

                if ($itensRecebidos > 0) {
                    return back()->with('success', "$itensRecebidos pedidos deram entrada no CD (Transbordo).");
                }
            }

            // --- CASO 2: CHEGADA NA LOJA (RECEBIMENTO FINAL) ---
            // A loja recebe pelo painel de "Meus Pedidos", mas se tentar por aqui avisamos:
            if ($user->perfil === 'loja') {
                return back()->withErrors(['erro' => 'Por favor, realize o recebimento pelo menu "Meus Pedidos".']);
            }

            return back()->with('info', 'Nenhum item de transbordo encontrado para baixar nesta carga.');
        });
    }

    // 7. IMPRIMIR MANIFESTO
    public function imprimir($id) {
        // A lógica de impressão está no Frontend (Romaneios/Show.jsx) 
        // mas se precisar de uma rota dedicada, pode redirecionar para o Show
        return redirect()->route('romaneios.show', $id);
    }

    // 8. DESFAZER (ROLLBACK DE EMERGÊNCIA)
    public function destroy($id)
    {
        $romaneio = Romaneio::with('pedidos.motos')->findOrFail($id);

        // Bloqueia exclusão se já foi entregue (segurança)
        if ($romaneio->status === 'concluido') {
            return back()->withErrors(['erro' => 'Cargas concluídas não podem ser excluídas.']);
        }

        DB::transaction(function () use ($romaneio) {
            foreach ($romaneio->pedidos as $pedido) {
                
                // Lógica de Regressão de Status:
                // 1. Se estava 'aguardando_coleta', volta para 'separado' (na loja origem).
                // 2. Se estava 'expedido' ou 'em_transito', volta para 'separado' (no CD ou Loja).
                // 3. Se era um item de transbordo ('no_cd'), mantemos 'no_cd' para não obrigar coleta nova.
                
                $statusVolta = 'separado';
                
                // Se o pedido JÁ ERA um transbordo parado no CD antes dessa carga, ele volta a ser transbordo
                if ($pedido->status === 'no_cd') {
                    $statusVolta = 'no_cd';
                }

                $pedido->update([
                    'status' => $statusVolta,
                    'romaneio_id' => null
                ]);

                // Atualiza as motos para ficarem visíveis novamente na montagem de carga
                foreach ($pedido->motos as $moto) {
                    $moto->update([
                        'status' => $statusVolta,
                        'romaneio_id' => null,
                        'localizacao_atual' => 'Devolvido ao Estoque (Carga Desfeita)'
                    ]);
                }

                // Registra o evento no histórico do pedido
                PedidoLog::create([
                    'pedido_id' => $pedido->id,
                    'titulo' => 'Carga Desfeita ↩️',
                    'descricao' => "Romaneio #{$romaneio->id} foi excluído manualmente. Itens retornaram para o status '{$statusVolta}'."
                ]);
            }

            // Exclui o cabeçalho da carga
            $romaneio->delete();
        });

        return redirect()->route('romaneios.index')
            ->with('success', 'Carga desfeita com sucesso! As motos voltaram para a lista de separação.');
    }

    // 9. CONFIRMAÇÃO DE COLETA (MILK RUN)
    // Motorista clica no botão "Bipar/Coletar" ao passar na loja de origem
    public function confirmarColetaItem($moto_id)
    {
        // Carrega a moto com seus pedidos para não perder o vínculo
        $moto = Moto::with('pedidos')->findOrFail($moto_id);

        if ($moto->status !== 'aguardando_coleta') {
            return back()->withErrors(['erro' => 'Item não está aguardando coleta ou já foi processado.']);
        }

        DB::transaction(function () use ($moto) {
            // 1. Atualiza a Moto -> Agora ela está física no caminhão
            $moto->update([
                'status' => 'transito_loja', 
                'localizacao_atual' => 'A Bordo do Caminhão (Coletado)'
            ]);

            // 2. Verifica o Pedido Pai
            // Pegamos o primeiro da lista (relacionamento many-to-many)
            $pedido = $moto->pedidos->first();

            if ($pedido) {
                // Conta quantas motos desse pedido ainda faltam coletar
                $pendentes = $pedido->motos()
                                    ->where('status', 'aguardando_coleta')
                                    ->count();
                
                // Se não tem mais nada pendente (todas coletadas), o pedido inteiro vira "Em Trânsito"
                if ($pendentes === 0) {
                    $pedido->update(['status' => 'em_transito']);
                    
                    // Log
                    PedidoLog::create([
                        'pedido_id' => $pedido->id,
                        'titulo' => 'Coleta Realizada 📦',
                        'descricao' => "Todos os itens foram coletados pelo motorista. Pedido segue em trânsito."
                    ]);
                }
            }
        });

        return back()->with('success', 'Coleta confirmada! Item a bordo.');
    }
}