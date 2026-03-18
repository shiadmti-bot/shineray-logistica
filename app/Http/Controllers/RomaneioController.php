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
        $status = $request->input('status');
        $dataInicio = $request->input('data_inicio');
        $dataFim = $request->input('data_fim');

        $query = Romaneio::with(['motos.pedidos', 'user', 'pedidos.motos']) 
            ->orderByRaw("CASE WHEN status = 'concluido' THEN 2 ELSE 1 END ASC")
            ->orderBy('created_at', 'desc');

        // Filtro por DATA
        if ($dataInicio) $query->whereDate('created_at', '>=', $dataInicio);
        if ($dataFim) $query->whereDate('created_at', '<=', $dataFim);

        // Filtro por STATUS
        if ($status) $query->where('status', $status);

        // Busca Textual
        if ($termo) {
            $query->where(function($q) use ($termo) {
                $q->where('id', 'like', "%{$termo}%")
                  ->orWhere('motorista', 'like', "%{$termo}%")
                  ->orWhere('placa', 'like', "%{$termo}%")
                  ->orWhere('rota', 'like', "%{$termo}%");
            });
        }

        $romaneios = $query->paginate(10)->through(function ($romaneio) {
            // UNIFICAÇÃO DE MOTOS (Diretas + Via Pedidos)
            $motosDiretas = $romaneio->motos;
            $motosViaPedidos = $romaneio->pedidos->flatMap->motos;
            
            // Merge usando chassi como chave única para evitar duplicatas
            $todasMotos = $motosDiretas->merge($motosViaPedidos)->unique('id');
            
            $total = $todasMotos->count();
            
            // Lógica visual de conclusão baseada nos itens
            // Considera concluído se o pedido vinculado já foi entregue ou cancelado
            $concluidas = $todasMotos->filter(function($m) {
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
                'motos_count' => $total, // Usa o total unificado
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
        // Pedidos que estão 'separado' e são saída de estoque próprio (origem nula ou Origem = CD)
        // OU pedidos que estão 'no_cd' (Transbordos que chegaram e vão sair de novo)
        $expedicao = Pedido::whereIn('status', ['separado', 'no_cd', 'rota_confirmada'])
            ->where(function ($query) {
                $query->whereNull('origem_user_id')
                      ->orWhereHas('origem', function ($q) {
                          $q->where('perfil', '!=', 'loja'); // CD ou Admin
                      });
            })
            ->with(['user', 'motos']) // Carrega cliente e motos
            ->get();

        // 2. COLETAS (Milk Run)
        // Pedidos que são transferências (tem origem em uma Loja definida)
        $coletas = Pedido::whereNotNull('origem_user_id')
            ->whereHas('origem', function ($q) {
                $q->where('perfil', 'loja');
            })
            ->whereIn('status', ['aguardando_rota', 'aguardando_coleta', 'rota_confirmada'])
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
            'placa'     => 'required_without:romaneio_id|string|nullable',
            'rota_nome' => 'required_without:romaneio_id|string|nullable',
            'romaneio_id' => 'nullable|exists:romaneios,id',
            'motos_ids'   => 'required|array|min:1' // CORREÇÃO: Agora recebe IDs das MOTOS
        ]);

        return DB::transaction(function () use ($request) {
            
            // A) Cria ou Recupera o Romaneio (Cabeçalho da Carga)
            if ($request->romaneio_id) {
                $romaneio = Romaneio::findOrFail($request->romaneio_id);
            } else {
                $romaneio = Romaneio::create([
                    'user_id'   => Auth::id(),
                    'status'    => 'aberto',
                    'motorista' => mb_strtoupper($request->motorista),
                    'placa'     => mb_strtoupper($request->placa),
                    'rota'      => mb_strtoupper($request->rota_nome),
                    'tipo'      => 'misto', // Milk Run
                    'saida_em'  => now()
                ]);
            }

            // B) Busca as MOTOS selecionadas (e seus pedidos vinculados para contexto)
            $motos = Moto::with(['pedidos.origem', 'pedidos.user'])
                         ->whereIn('id', $request->motos_ids)
                         ->get();
            
            // Array para controlar quais pedidos tiveram status alterado (evita update repetido)
            $pedidosAfetados = [];

            foreach ($motos as $moto) {
                
                // Pega o pedido ATIVO vinculado a esta moto para saber Origem/Destino
                // Assumimos que o primeiro da coleção é o atual (devido ao latest() no model ou lógica de negócio)
                $pedido = $moto->pedidos->first(); 

                if (!$pedido) continue; // Segurança caso a moto esteja órfã

                // --- LÓGICA INTELIGENTE (MILK RUN) ---
                
                // CORREÇÃO: Só é coleta de loja se a origem for uma loja. Origem nula ou CD é Expedição direta do CD.
                $isColeta = ($pedido->origem_user_id && $pedido->origem && $pedido->origem->perfil === 'loja');
                
                if ($isColeta) {
                    // Cenário 1: Coleta (Milk Run) - Motorista vai buscar na loja
                    $novoStatusPedido = 'aguardando_coleta'; 
                    $novoStatusMoto   = 'aguardando_coleta';
                    $localizacaoTexto = "Aguardando Coleta em: " . ($pedido->origem->filial ?? 'Origem');
                } 
                else {
                    // Cenário 2: Expedição (Saindo do CD)
                    $novoStatusPedido = 'expedido';
                    $novoStatusMoto   = 'expedido'; 
                    $localizacaoTexto = "Em Carga (Docas CD) - Romaneio #{$romaneio->id}";
                }

                // 1. Atualiza a MOTO (Item Individual)
                // Só atualiza se ela estiver disponível para movimentação
                if (in_array($moto->status, ['separado', 'disponivel', 'no_cd', 'aguardando_rota', 'aguardando_coleta', 'rota_confirmada'])) {
                    $moto->update([
                        'status'            => $novoStatusMoto,
                        'romaneio_id'       => $romaneio->id,
                        'localizacao_atual' => $localizacaoTexto
                    ]);
                }

                // 2. Prepara atualização do PEDIDO PAI
                // Se a moto mudou, o pedido também muda de status
                $pedidosAfetados[$pedido->id] = [
                    'model' => $pedido,
                    'status' => $novoStatusPedido
                ];
            }

            // C) Atualiza os Pedidos Pai (em lote/único por pedido)
            foreach ($pedidosAfetados as $dados) {
                $dados['model']->update([
                    'status' => $dados['status'],
                    'romaneio_id' => $romaneio->id
                ]);
            }

            return redirect()->route('romaneios.show', $romaneio->id)
                ->with('success', 'Romaneio salvo! Itens vinculados à carga com sucesso.');
        });
    }

    // 4. VISUALIZAR DETALHES
    public function show($id)
    {
        $romaneio = Romaneio::with([
            'user', 
            // Carrega motos diretas e seus pedidos
            'motos' => function($query) {
                $query->with(['pedidos.user', 'pedidos.origem']);
            },
            // Carrega motos via pedidos (Histórico)
            'pedidos.motos' => function($query) {
                $query->with(['pedidos.user', 'pedidos.origem']);
            }
        ])->findOrFail($id);

        // UNIFICAÇÃO (Mesma lógica do Index)
        $motosDiretas = $romaneio->motos;
        $motosViaPedidos = $romaneio->pedidos->flatMap->motos;
        
        // Merge e Ordenação
        $todasMotos = $motosDiretas->merge($motosViaPedidos)
            ->unique('id')
            ->sortBy(function($moto) {
                // Ordena por status e depois modelo
                return sprintf('%s-%s', $moto->status, $moto->modelo);
            })
            ->values(); // Reindexa o array

        // Sobrescreve a relação 'motos' para a View receber a lista completa
        $romaneio->setRelation('motos', $todasMotos);

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

            // Valida se há itens pendentes de coleta neste romaneio
            $pendentesColeta = $romaneio->pedidos()->where('status', 'aguardando_coleta')->count();
            if ($pendentesColeta > 0) {
                return back()->withErrors(['erro' => 'Existem coletas pendentes. O motorista deve confirmar a bipagem das coletas antes de liberar a carga para trânsito final.']);
            }

            // 1. Atualiza o Romaneio
            $romaneio->update(['status' => 'em_transito']);

            // 2. Atualiza os Itens (Expedidos do CD ou já Coletados na Loja)
            // Agora eles entram em trânsito real rumo ao destino final
            foreach ($romaneio->pedidos as $pedido) {
                
                if (in_array($pedido->status, ['expedido', 'coletado'])) {
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

                    // NOTIFICAÇÃO (ONESIGNAL)
                    try {
                        (new \App\Services\OneSignalService())->sendToUser(
                            [$pedido->user->onesignal_id],
                            'Pedido em Trânsito 🚚',
                            "Seu pedido #{$pedido->id} saiu para entrega! Acompanhe o rastreio.",
                            route('pedidos.show', $pedido->id)
                        );
                    } catch (\Exception $e) {}
                }
            }

            return back()->with('success', 'Saída confirmada! Itens do CD agora estão em trânsito.');
        });
    }

    // 6. RECEBER CARGA (BAIXA LOGÍSTICA / TRANSBORDO)
    public function receber($id)
    {
        return DB::transaction(function () use ($id) {
            $romaneio = Romaneio::with(['pedidos.motos', 'pedidos.user'])->findOrFail($id);
            $user = Auth::user();

            // --- CASO 1: CHEGADA NO CD (TRANSBORDO) ---
            // O motorista trouxe coletas do interior para o Hub (CD/Admin)
            if ($user->perfil === 'cd' || $user->perfil === 'admin') {
                
                $itensRecebidos = 0;

                foreach ($romaneio->pedidos as $pedido) {
                    // Só processa o que estava previsto para vir ao CD (Coletas Interior ou Transbordo)
                    // Ou pedidos que estavam 'aguardando_coleta' e agora chegaram fisicamente
                    if (in_array($pedido->status, ['aguardando_coleta', 'coletado', 'em_transito', 'em_transito_cd'])) {
                        
                        // Verifica se este pedido é uma transferência (tem origem)
                        // Se for transferência, ao chegar no CD, ele fica 'no_cd' aguardando nova rota.
                        if ($pedido->origem_user_id) {
                            
                            $pedido->update(['status' => 'no_cd', 'romaneio_id' => null]); // LIBERA PARA NOVA CARGA

                            // LOG E NOTIFICAÇÃO
                            PedidoLog::create([
                                'pedido_id' => $pedido->id,
                                'titulo' => 'Chegou no CD 🏢',
                                'descricao' => "Transferência recebida no Hub Logístico. Aguardando rota final."
                            ]);

                            try {
                                (new \App\Services\OneSignalService())->sendToUser(
                                    [$pedido->user->onesignal_id],
                                    'Chegou no CD 🏢',
                                    "Seu pedido #{$pedido->id} chegou ao Centro de Distribuição e aguarda rota final.",
                                    route('pedidos.show', $pedido->id)
                                );
                            } catch (\Exception $e) {}

                            
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
                'status' => 'coletado', 
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
                
                // Se não tem mais nada pendente (todas coletadas), o pedido inteiro vira "Coletado"
                if ($pendentes === 0) {
                    $pedido->update(['status' => 'coletado']);
                    
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