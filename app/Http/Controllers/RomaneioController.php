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
    /** Moto pronta para subir no caminhão — a régua da mesa de montagem. */
    private const MOTO_EMBARCAVEL = ['separado', 'disponivel', 'no_cd', 'aguardando_rota', 'aguardando_coleta', 'rota_confirmada'];

    /** Pedido que ainda não foi liberado (análise, separação) ou que já acabou. */
    private const PEDIDO_NAO_EMBARCAVEL = ['em_analise', 'solicitado', 'concluido', 'cancelado', 'rejeitado'];

    /** Carga que já saiu do CD: desfazê-la registraria no estoque o que está na estrada. */
    private const CARGA_NAO_DESFAZIVEL = ['concluido', 'em_transito', 'em_transito_cd'];

    /** Só se dá entrada no CD de carga que está na estrada. */
    private const CARGA_RECEBIVEL_NO_CD = ['em_transito', 'em_transito_cd'];

    /**
     * Moto a bordo do caminhão. 'aguardando_coleta' fica de fora: a moto ainda
     * está na loja de origem.
     */
    private const MOTO_RECEBIVEL_NO_CD = ['coletado', 'transito_loja', 'em_transito'];

    // 1. LISTA DE CARGAS (DASHBOARD)
    public function index(Request $request)
    {
        $termo = $request->input('search');
        $status = $request->input('status');
        $dataInicio = $request->input('data_inicio');
        $dataFim = $request->input('data_fim');

        $query = Romaneio::with(['motos.pedidos', 'user'])
            // v3: carga mista — contagem de itens de peça desta carga.
            ->withCount(['itens as pecas_count' => fn ($q) => $q->where('itemable_type', \App\Models\Peca::class)])
            ->withSum(['itens as pecas_unidades' => fn ($q) => $q->where('itemable_type', \App\Models\Peca::class)], 'quantidade') 
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

        // withQueryString: sem ele a página 2 perdia status e datas do filtro.
        $romaneios = $query->paginate(10)->withQueryString()->through(function ($romaneio) {
            // Usa apenas as motos especificamente vinculadas a este romaneio logístico (Impede puxar o pedido pai inteiro)
            $todasMotos = $romaneio->motos;
            
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
                // v3: a mesma carga pode levar peças. Sem estes números a
                // listagem mostraria "0 itens" para uma carga só de peças.
                'pecas_count' => (int) ($romaneio->pecas_count ?? 0),
                'pecas_unidades' => (int) ($romaneio->pecas_unidades ?? 0),
                'status' => $statusVisual,
                'tipo' => $romaneio->tipo 
            ];
        });

        return Inertia::render('Romaneios/Index', [
            'romaneios' => $romaneios,
            // A tela lê os quatro filtros; só a busca voltava, e status e
            // datas apareciam vazios logo depois de filtrar.
            'filters' => $request->only(['search', 'status', 'data_inicio', 'data_fim'])
        ]);
    }

    // 2. PAINEL DE MONTAGEM DE CARGA (MESA DE OPERAÇÃO)
    public function create()
    {
        // 1. EXPEDIÇÃO (Saindo do CD)
        // Pedidos que possuem motos que estão 'separado', 'no_cd', etc e são saída de CD
        // V2.6: Ignora pedidos que ainda estão aguardando definição de chassi (esses aparecem na seção aguardandoChassi)
        $expedicao = Pedido::whereNotIn('status', ['concluido', 'cancelado', 'rejeitado'])
            ->whereDoesntHave('itensPedido', fn ($q) => $q->pendentes())
            ->whereHas('motos', function ($q) {
                $q->whereIn('status', ['separado', 'no_cd', 'rota_confirmada']);
            })
            ->where(function ($query) {
                $query->whereNull('origem_user_id')
                      ->orWhereHas('origem', function ($q) {
                          $q->where('perfil', '!=', \App\Enums\Perfil::Loja->value); // CD ou Admin
                      });
            })
            ->with(['user', 'motos' => function ($q) {
                // Apenas carrega as motos que ainda estão aptas a serem expedidas
                $q->whereIn('status', ['separado', 'no_cd', 'rota_confirmada']);
            }])
            ->get();

        // 2. COLETAS (Milk Run)
        // Pedidos que são transferências (tem origem em uma Loja definida) e possuem motos aptas
        $coletas = Pedido::whereNotIn('status', ['concluido', 'cancelado', 'rejeitado'])
            ->whereDoesntHave('itensPedido', fn ($q) => $q->pendentes())
            ->whereNotNull('origem_user_id')
            ->whereHas('origem', function ($q) {
                $q->where('perfil', \App\Enums\Perfil::Loja->value);
            })
            ->whereHas('motos', function ($q) {
                $q->whereIn('status', ['separado', 'aguardando_rota', 'aguardando_coleta', 'rota_confirmada']);
            })
            ->with(['user', 'origem', 'motos' => function ($q) {
                // Apenas carrega as motos que precisam ser coletadas
                $q->whereIn('status', ['separado', 'aguardando_rota', 'aguardando_coleta', 'rota_confirmada']);
            }])
            ->get();

        // 3. Cargas em Aberto (Para adicionar itens nelas)
        $cargasEmAberto = Romaneio::where('status', 'aberto')
            ->withCount(['motos', 'itensPecas'])
            ->orderBy('id', 'desc')
            ->get();

        // Rotas ativas cadastradas para sugestão/seleção rápida
        $rotas = \App\Models\Route::where('active', true)
            ->orderBy('name')
            ->get(['id', 'name', 'code']);

        // 4. V2.6: Pedidos genéricos aguardando o CD informar os chassis.
        // Sem isto o pedido sem chassi jamais apareceria nesta tela, pois as
        // consultas acima dependem de motos já vinculadas.
        $aguardandoChassi = Pedido::whereIn('status', \App\Services\AtribuicaoChassiService::STATUS_ATRIBUIVEIS)
            ->whereHas('itensPedido', fn ($q) => $q->pendentes())
            ->with(['user:id,name,filial', 'itensPedido'])
            ->orderBy('created_at') // FIFO: quem pediu primeiro é atendido primeiro
            ->get()
            ->map(function ($pedido) {
                return [
                    'id'         => $pedido->id,
                    'loja'       => $pedido->user->filial ?? $pedido->user->name ?? 'Loja',
                    'created_at' => $pedido->created_at,
                    'status'     => $pedido->status,
                    'itens'      => $pedido->itensPedido
                        ->filter(fn ($i) => $i->qtd_pendente > 0)
                        ->map(fn ($i) => [
                            'id'            => $i->id,
                            'modelo'        => $i->modelo,
                            'cor'           => $i->cor,
                            'local'         => $i->local,
                            'quantidade'    => $i->quantidade,
                            'qtd_atribuida' => $i->qtd_atribuida,
                            'qtd_pendente'  => $i->qtd_pendente,
                        ])->values(),
                ];
            })
            ->values();

        /*
         * 5. BASQUETAS DE PEÇA PRONTAS PARA EMBARCAR.
         *
         * Ficam de fora as que já estão em alguma carga (romaneio_id preenchido).
         *
         * v3.1: a unidade de embarque virou a BASQUETA, não o pedido.
         *
         * O manual é explícito: todos os itens da basqueta da filial são
         * recolhidos de uma vez. Listar pedido a pedido permitia embarcar meia
         * caixa — e uma caixa meio embarcada não bate com a NF que já foi
         * emitida para o conteúdo inteiro.
         *
         * GATE 2: só entram as LIBERADAS — faturadas e já conferidas pela
         * filial. É a segunda metade da regra do manual: nenhuma embalagem é
         * despachada sem a confirmação do Pós-Venda. Uma caixa faturada mas
         * ainda não conferida não aparece aqui de propósito.
         */
        $pecasProntas = \App\Models\Basqueta::where('status', \App\Models\Basqueta::STATUS_LIBERADA)
            ->whereNull('romaneio_id')
            ->with([
                'local:id,nome',
                'viagem:id,date',
                'itens' => fn ($q) => $q->where('qtd_atribuida', '>', 0),
                'itens.peca:id,codigo,descricao,unidade',
            ])
            ->orderBy('esvaziada_em') // FIFO, igual à fila de chassi
            ->get()
            ->map(fn ($b) => [
                'id'         => $b->id,
                'loja'       => $b->local->nome ?? 'Filial removida',
                'created_at' => $b->esvaziada_em,
                'volumes'    => $b->volumes,
                'nota'       => $b->notaVigente()?->rotulo,
                'viagem'     => $b->viagem?->date,
                'total_un'   => (int) $b->itens->sum('qtd_atribuida'),
                'itens'      => $b->itens->map(fn ($i) => [
                    'id'        => $i->id,
                    'codigo'    => $i->peca->codigo ?? '-',
                    'descricao' => $i->peca->descricao ?? 'Peça',
                    'unidade'   => $i->peca->unidade ?? 'UN',
                    'quantidade'=> $i->qtd_atribuida,
                ])->values(),
            ])
            ->values();

        return Inertia::render('Romaneios/Create', [
            'expedicao' => $expedicao,
            'coletas' => $coletas,
            'cargasEmAberto' => $cargasEmAberto,
            'aguardandoChassi' => $aguardandoChassi,
            'pecasProntas' => $pecasProntas,
            'rotas' => $rotas,
        ]);
    }

    /**
     * V2.6 — Fluxo B: bipagem durante a montagem da carga.
     *
     * O operador do CD bipa um chassi; o sistema descobre o modelo/cor no Microwork
     * e o vincula automaticamente ao pedido mais antigo que ainda aguarda aquela moto.
     * Usa exatamente o mesmo serviço da tela de detalhes do Pedido (Fluxo A).
     */
    public function atribuirChassiCarga(Request $request)
    {
        if (!in_array(Auth::user()->perfil, ['cd', 'admin'], true)) {
            abort(403, 'Apenas a equipe do CD pode atribuir chassis.');
        }

        $request->validate([
            'chassi'    => 'required|string|min:11|max:17',
            'pedido_id' => 'nullable|integer|exists:pedidos,id',
        ]);

        $chassi  = mb_strtoupper(trim($request->chassi));
        $servico = app(\App\Services\AtribuicaoChassiService::class);

        // Pedido explícito (operador escolheu na tela) ou descoberta automática
        $pedido = $request->pedido_id
            ? Pedido::findOrFail($request->pedido_id)
            : $this->descobrirPedidoParaChassi($chassi);

        $resultado = $servico->atribuir($pedido, $chassi);
        $item = $resultado['item'];

        $saldoPedido = $pedido->saldoPendente();

        return back()->with('success',
            "Chassi {$chassi} → Pedido #{$pedido->id} ({$item->modelo} {$item->cor}). " .
            ($saldoPedido > 0
                ? "Faltam {$saldoPedido} chassi(s) neste pedido."
                : "Pedido #{$pedido->id} 100% atribuído e pronto para embarque.")
        );
    }

    /**
     * Descobre a qual pedido pendente um chassi bipado pertence.
     * Critério: modelo + cor iguais e o pedido mais antigo primeiro (FIFO).
     */
    private function descobrirPedidoParaChassi(string $chassi): Pedido
    {
        $microwork = app(\App\Services\MicroworkService::class);
        $info = $microwork->getInfoChassi($chassi);

        $modelo = $info['modelo'] ?? null;
        $cor    = $info['cor'] ?? null;

        // Fallback quando o cache do Microwork está vazio/defasado
        if (!$modelo) {
            $motoLocal = Moto::where('chassi', $chassi)->first();
            $modelo = $motoLocal ? mb_strtoupper(trim((string) $motoLocal->modelo)) : null;
            $cor    = $motoLocal ? mb_strtoupper(trim((string) $motoLocal->cor)) : null;
        }

        if (!$modelo) {
            throw \Illuminate\Validation\ValidationException::withMessages([
                'chassi' => "Chassi {$chassi} não encontrado no estoque do Microwork nem no cadastro local. Confira a digitação ou escolha o pedido manualmente.",
            ]);
        }

        $pedido = Pedido::whereIn('status', \App\Services\AtribuicaoChassiService::STATUS_ATRIBUIVEIS)
            ->whereHas('itensPedido', function ($q) use ($modelo, $cor) {
                $q->pendentes()
                  ->whereRaw('UPPER(TRIM(modelo)) = ?', [$modelo])
                  ->whereRaw('UPPER(TRIM(cor)) = ?', [(string) $cor]);
            })
            ->orderBy('created_at')
            ->first();

        if (!$pedido) {
            throw \Illuminate\Validation\ValidationException::withMessages([
                'chassi' => "Nenhum pedido em aberto está aguardando um(a) {$modelo} " . ($cor ?: 'SEM COR') . ". O chassi {$chassi} não foi atribuído.",
            ]);
        }

        return $pedido;
    }

    // 3. SALVAR CARGA (CORAÇÃO DA LOGÍSTICA)
    public function store(Request $request)
    {
        $request->validate([
            'motorista' => 'required_without:romaneio_id|string|nullable',
            'placa'     => 'required_without:romaneio_id|string|nullable',
            'rota_nome' => 'required_without:romaneio_id|string|nullable',
            'romaneio_id' => 'nullable|exists:romaneios,id',
            // v3: carga mista. A carga precisa de motos OU de peças — antes
            // motos_ids era sempre obrigatório e uma carga só de peças não passava.
            'motos_ids'          => 'required_without:basquetas_ids|array',
            'motos_ids.*'        => 'integer|exists:motos,id',
            // v3.1: a seleção de peça passou a ser por BASQUETA. O nome do
            // campo mudou junto para não aceitar silenciosamente ids de pedido
            // vindos de uma tela em cache.
            'basquetas_ids'      => 'required_without:motos_ids|array',
            'basquetas_ids.*'    => 'integer|exists:basquetas,id',
        ], [
            'motos_ids.required_without' => 'Selecione ao menos uma moto ou uma basqueta de peças.',
        ]);

        return DB::transaction(function () use ($request) {
            
            // A) Cria ou Recupera o Romaneio (Cabeçalho da Carga)
            if ($request->romaneio_id) {
                $romaneio = Romaneio::whereKey($request->romaneio_id)->lockForUpdate()->firstOrFail();

                // A mesa de montagem só oferece cargas abertas. Item posto numa
                // carga que já saiu nunca ganha a transição de trânsito
                // (iniciarTransito exige 'aberto') e fica preso em 'expedido'.
                if ($romaneio->status !== 'aberto') {
                    throw \Illuminate\Validation\ValidationException::withMessages([
                        'romaneio_id' => "A carga #{$romaneio->id} não está mais aberta (status '{$romaneio->status}'). Monte uma carga nova.",
                    ]);
                }
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
            // input(...,[]) e não ->motos_ids: numa carga só de peças a chave nem
            // vem no payload, e whereIn(null) derruba a requisição com 500.
            $motos = Moto::with(['pedidos.origem', 'pedidos.user'])
                         ->whereIn('id', $request->input('motos_ids', []))
                         ->get();
            
            // Array para controlar quais pedidos tiveram status alterado (evita update repetido)
            $pedidosAfetados = [];
            $motosEmbarcadas = 0;

            foreach ($motos as $moto) {

                // Pega o pedido ATIVO vinculado a esta moto para saber Origem/Destino
                // Assumimos que o primeiro da coleção é o atual (devido ao latest() no model ou lógica de negócio)
                $pedido = $moto->pedidos->first();

                if (!$pedido) continue; // Segurança caso a moto esteja órfã

                /*
                 * Só embarca o que está pronto para sair. Antes a moto fora da
                 * régua era pulada, mas o PEDIDO dela avançava do mesmo jeito:
                 * um id enviado à mão levava um pedido ainda em análise — sem
                 * aprovação do gestor — direto para 'expedido', ou reabria um
                 * pedido já concluído.
                 */
                if (! in_array($moto->status, self::MOTO_EMBARCAVEL, true)
                    || in_array($pedido->status, self::PEDIDO_NAO_EMBARCAVEL, true)) {
                    continue;
                }

                // --- LÓGICA INTELIGENTE (MILK RUN) ---
                
                // CORREÇÃO: Só é coleta de loja se a origem for uma loja. Origem nula ou CD é Expedição direta do CD.
                $isColeta = ($pedido->origem_user_id && $pedido->origem && $pedido->origem->isLoja());
                
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

                // 1. Atualiza a MOTO (Item Individual) — a régua já foi checada acima.
                $moto->update([
                    'status'            => $novoStatusMoto,
                    'romaneio_id'       => $romaneio->id,
                    'localizacao_atual' => $localizacaoTexto
                ]);
                $motosEmbarcadas++;

                // 2. Prepara atualização do PEDIDO PAI
                // V2.6: Só marca o pedido pai como expedido/coleta se todas as cotas já tiverem chassis atribuídos
                if ($pedido->saldoPendente() === 0) {
                    $pedidosAfetados[$pedido->id] = [
                        'model' => $pedido,
                        'status' => $novoStatusPedido,
                        'romaneio_id' => $romaneio->id,
                    ];
                }
            }

            // C) Atualiza os Pedidos Pai (em lote/único por pedido)
            foreach ($pedidosAfetados as $dados) {
                $dados['model']->update([
                    'status' => $dados['status'],
                    'romaneio_id' => $dados['romaneio_id']
                ]);
            }

            // D) v3: embarca os pedidos de peça selecionados.
            // O saldo NÃO se move aqui — a peça continua sendo do CD enquanto
            // está no caminhão. A baixa acontece no recebimento pela loja.
            $pecasEmbarcadas = $this->embarcarPecas($request->input('basquetas_ids', []), $romaneio);

            // Nada da seleção estava apto: não nasce carga vazia (a transação desfaz o cabeçalho).
            if ($motosEmbarcadas === 0 && $pecasEmbarcadas === 0) {
                throw \Illuminate\Validation\ValidationException::withMessages([
                    'motos_ids' => 'Nenhum dos itens selecionados está pronto para embarcar. Recarregue a mesa de montagem e refaça a seleção.',
                ]);
            }

            $msg = 'Romaneio salvo! Itens vinculados à carga com sucesso.';
            if ($pecasEmbarcadas > 0) {
                $msg .= " {$pecasEmbarcadas} item(ns) de peça embarcado(s).";
            }

            return redirect()->route('romaneios.show', $romaneio->id)
                ->with('success', $msg);
        });
    }

    /**
     * Embarca as basquetas selecionadas nesta carga (v3).
     *
     * A mecânica vive em EmbarqueBasquetaService, que é o ponto único de
     * embarque de peça — a mesa de montagem e a tela do pedido passam pelo
     * MESMO código, então o Gate 2 não depende de por onde o operador entrou.
     *
     * NÃO MOVE SALDO. A peça continua sendo do CD enquanto está no caminhão; a
     * transferência acontece quando a loja confere o recebimento.
     *
     * @param  array<int, int>  $basquetaIds
     * @return int  itens de peça criados
     */
    private function embarcarPecas(array $basquetaIds, Romaneio $romaneio): int
    {
        return app(\App\Services\Pecas\EmbarqueBasquetaService::class)
            ->embarcar($basquetaIds, $romaneio)['itens'];
    }

    // 4. VISUALIZAR DETALHES
    public function show($id)
    {
        $romaneio = Romaneio::with([
            'user', 
            // Carrega motos diretas e seus pedidos
            'motos' => function($query) {
                $query->with(['pedidos.user', 'pedidos.origem', 'pedidos.devolucao:id,pedido_id,status']);
            }
        ])->findOrFail($id);

        // Apenas as motos vinculadas diretamente
        $todasMotos = $romaneio->motos
            ->sortBy(function($moto) {
                // Ordena por status e depois modelo
                return sprintf('%s-%s', $moto->status, $moto->modelo);
            })
            ->values(); // Reindexa o array

        // Sobrescreve a relação 'motos' para a View receber a lista completa
        $romaneio->setRelation('motos', $todasMotos);

        return Inertia::render('Romaneios/Show', [
            'romaneio' => $romaneio,
            // v3: carga mista. Vem como prop separada, e não dentro de
            // $romaneio, para não alterar o formato que o fluxo de moto já
            // consome nesta tela.
            'pecas'    => $this->pecasDaCarga($romaneio),
        ]);
    }

    /**
     * Peças embarcadas nesta carga, achatadas para a tela (v3).
     *
     * Sem isto o manifesto de carga lista apenas motos: o motorista assina um
     * documento que não menciona as caixas que estão no caminhão, e a loja não
     * tem contra o que conferir no recebimento.
     *
     * O destino usa a mesma prioridade do agrupamento de motos (filial do
     * solicitante) para que uma carga mista para a mesma loja apareça num
     * bloco só, em vez de dois blocos com o mesmo nome.
     *
     * @return array<int, array<string, mixed>>
     */
    private function pecasDaCarga(Romaneio $romaneio): array
    {
        $itens = \App\Models\RomaneioItem::pecas()
            ->where('romaneio_id', $romaneio->id)
            ->with(['itemable', 'pedido.user', 'destino'])
            ->get();

        return $itens->map(function (\App\Models\RomaneioItem $item) {
            $peca = $item->itemable;

            $destino = $item->pedido?->user?->filial
                ?: $item->destino?->nome
                ?: 'DESTINO NÃO IDENTIFICADO';

            return [
                'id'          => $item->id,
                'codigo'      => $peca?->codigo ?? '---',
                'descricao'   => $peca?->descricao ?? 'Peça fora do catálogo',
                'unidade'     => $peca?->unidade ?? 'UN',
                'marca'       => $peca?->marca,
                'quantidade'  => (int) $item->quantidade,
                'recebida'    => $item->quantidade_recebida,
                'status'      => $item->status,
                'pedido_id'   => $item->pedido_id,
                'destino'     => mb_strtoupper(trim($destino)),
            ];
        })->values()->all();
    }

    // 5. INICIAR TRÂNSITO (LIBERAR SAÍDA)
    public function iniciarTransito($id)
    {
        return DB::transaction(function () use ($id) {
            // Carrega o romaneio com as motos e seus pedidos. Com trava: no
            // duplo clique, a segunda requisição espera a primeira e encontra a
            // carga já em trânsito, em vez de repetir logs e avisos de saída.
            $romaneio = Romaneio::with(['motos.pedidos.user'])->lockForUpdate()->findOrFail($id);
            
            if ($romaneio->status !== 'aberto') {
                return back()->withErrors(['erro' => 'Esta carga já saiu ou foi concluída.']);
            }

            // Valida se há itens pendentes de coleta neste romaneio
            $pendentesColeta = $romaneio->motos()->where('status', 'aguardando_coleta')->count();
            if ($pendentesColeta > 0) {
                return back()->withErrors(['erro' => 'Existem coletas pendentes. O motorista deve confirmar a bipagem das coletas antes de liberar a carga para trânsito final.']);
            }

            // 1. Atualiza o Romaneio
            $romaneio->update(['status' => 'em_transito']);

            // 2. Atualiza os Itens de Moto (Expedidos do CD ou já Coletados na Loja)
            $pedidosAfetados = [];

            foreach ($romaneio->motos as $moto) {
                if (in_array($moto->status, ['expedido', 'coletado'])) {
                    $pedido = $moto->pedidos->first();
                    if (!$pedido) continue;

                    // Atualiza apenas a moto vinculada a ESTE romaneio
                    $moto->update([
                        'status' => 'transito_loja',
                        'localizacao_atual' => "Em Trânsito para {$pedido->user->filial}"
                    ]);

                    $pedidosAfetados[$pedido->id] = $pedido;
                }
            }

            // 3. Atualiza os Itens de Peça da Carga (v3)
            $itensPecas = \App\Models\RomaneioItem::where('romaneio_id', $romaneio->id)
                ->where('itemable_type', \App\Models\Peca::class)
                ->where('status', \App\Models\RomaneioItem::STATUS_CARREGADO)
                ->with('pedido.user')
                ->get();

            foreach ($itensPecas as $itemPeca) {
                $itemPeca->update(['status' => \App\Models\RomaneioItem::STATUS_EM_TRANSITO]);
                if ($itemPeca->pedido) {
                    $pedidosAfetados[$itemPeca->pedido->id] = $itemPeca->pedido;
                }
            }

            // 4. Atualiza os pedidos vinculados (Motos e Peças)
            foreach ($pedidosAfetados as $pedido) {
                // 'solicitado' entrou pelo hotfix 8dab1d8 da main (v2.6): um pedido
                // aprovado cujas motos ja foram bipadas na carga precisa receber o
                // log e o aviso de despacho, mesmo sem ter passado por 'separado'.
                if (in_array($pedido->status, ['expedido', 'coletado', 'em_transito', 'separado', 'aguardando_coleta', 'solicitado'])) {
                    $saldoSemChassi = $pedido->saldoPendente();
                    $motosNaoDespachadas = $pedido->motos()
                        ->whereNotIn('motos.status', ['transito_loja', 'em_transito', 'concluido', 'vendida', 'cancelado', 'avariado'])
                        ->count();

                    $isTotalmenteDespachado = ($saldoSemChassi === 0 && $motosNaoDespachadas === 0);

                    // Só avança o pedido pai para 'em_transito' se 100% dos itens solicitados foram despachados
                    if ($isTotalmenteDespachado) {
                        $pedido->update(['status' => 'em_transito']);
                    }

                    // Log de Auditoria
                    $tipoItemTexto = $pedido->tipo_carga === 'peca' ? 'Peças' : 'Motos';
                    $detalheParcial = $isTotalmenteDespachado ? '' : ' (Embarque Parcial — itens restantes permanecem no CD)';
                    PedidoLog::create([
                        'pedido_id' => $pedido->id,
                        'titulo' => $isTotalmenteDespachado ? 'Saiu para Entrega 🚚' : 'Embarque Parcial Despachado 🚚',
                        'descricao' => "{$tipoItemTexto} vinculadas à Carga #{$romaneio->id} deixaram o pátio com motorista {$romaneio->motorista}.{$detalheParcial}"
                    ]);

                    // NOTIFICAÇÃO (ONESIGNAL)
                    try {
                        if ($pedido->user?->onesignal_id) {
                            $msgPush = $isTotalmenteDespachado
                                ? "O(s) item(ns) do seu pedido #{$pedido->id} saiu/saíram para entrega! Acompanhe o rastreio."
                                : "Parte dos itens do seu pedido #{$pedido->id} saiu para entrega (Embarque Parcial). Acompanhe o rastreio.";

                            (new \App\Services\OneSignalService())->sendToUser(
                                [$pedido->user->onesignal_id],
                                $isTotalmenteDespachado ? 'Pedido em Trânsito 🚚' : 'Embarque Parcial em Trânsito 🚚',
                                $msgPush,
                                route('pedidos.show', $pedido->id)
                            );
                        }
                    } catch (\Exception $e) {}
                }
            }

            return back()->with('success', 'Saída confirmada! Itens do CD agora estão em trânsito.');
        });
    }

    // 6. RECEBER CARGA (BAIXA LOGÍSTICA / DEVOLUÇÃO / TRANSBORDO NO CD)
    public function receber(Request $request, $id)
    {
        return DB::transaction(function () use ($request, $id) {
            $romaneio = Romaneio::with(['motos.pedidos.user', 'motos.pedidos.origem', 'itens.destino', 'itens.pedido.user'])->findOrFail($id);
            $user = Auth::user();

            // --- CASO 1: CHEGADA NO CD (DEVOLUÇÃO / RETORNO / TRANSBORDO) ---
            if ($user->isCd() || $user->isAdmin()) {
                /*
                 * Só chega ao CD o que saiu. Mesma régua da tela
                 * (Romaneios/Show.jsx, `podeReceberNoCd`): carga em trânsito e
                 * moto já a bordo.
                 *
                 * O servidor não conferia nenhuma das duas. Uma carga ainda
                 * ABERTA, com a moto esperando coleta na loja, podia ser
                 * "recebida": a moto entrava no pátio do CD enquanto seguia na
                 * loja, o pedido era concluído e a carga fechava antes de sair.
                 */
                if (! in_array($romaneio->status, self::CARGA_RECEBIVEL_NO_CD, true)) {
                    return back()->withErrors([
                        'erro' => "A carga #{$romaneio->id} ainda não saiu (status '{$romaneio->status}'). "
                            . 'Confirme a coleta e libere a saída antes de dar entrada no CD.',
                    ]);
                }

                $itensRecebidosDevolucao = 0;
                $itensRecebidosTransbordo = 0;
                $pedidosDevolucao = [];
                $pedidosTransbordo = [];
                $devolucoesChecklistPendente = [];
                $motoFiltroId = $request->input('moto_id');

                foreach ($romaneio->motos as $moto) {
                    if ($motoFiltroId && (int) $moto->id !== (int) $motoFiltroId) {
                        continue;
                    }

                    if (in_array($moto->status, self::MOTO_RECEBIVEL_NO_CD, true)) {
                        $pedido = $moto->pedidos->first();
                        if (!$pedido) continue;

                        $destinoTexto = mb_strtoupper(trim((string) ($moto->pivot?->destino ?? $pedido->user?->filial ?? '')));
                        $isDestinoCD = !$pedido->user_id 
                            || in_array($pedido->user?->perfil, ['cd', 'admin'])
                            || in_array($destinoTexto, ['MATRIZ / CD', 'CD', 'MATRIZ', 'CENTRO DE DISTRIBUIÇÃO', 'CD MATRIZ', 'CD ANANINDEUA'])
                            || in_array(mb_strtoupper((string) ($pedido->user?->filial ?? '')), ['MATRIZ ADMINISTRATIVA', 'CD MATRIZ', 'CD ANANINDEUA', 'CENTRO DE DISTRIBUIÇÃO']);

                        if ($isDestinoCD) {
                            $pedido->loadMissing('devolucao');
                            // v3: Se o pedido é o frete de uma devolução formal (com checklist e dossiê),
                            // o encerramento oficial é feito com a conferência do CD no módulo de Devoluções.
                            if ($pedido->devolucao && !$pedido->devolucao->estaEncerrada()) {
                                $devolucoesChecklistPendente[$pedido->devolucao->id] = $pedido->devolucao->id;
                                continue;
                            }

                            // Devolução direta / Retorno ao CD concluído: integra ao pátio/estoque do CD
                            $moto->update([
                                'status'            => 'estoque_fabrica',
                                'localizacao_atual' => 'Pátio CD/Fábrica (Recebido no CD)',
                                'loja_atual_id'     => null,
                            ]);
                            $itensRecebidosDevolucao++;
                            $pedidosDevolucao[$pedido->id] = $pedido;
                        } elseif ($pedido->origem_user_id) {
                            // Transbordo: descarrega no hub do CD para aguardar rota final
                            $moto->update([
                                'status'            => 'no_cd',
                                'localizacao_atual' => 'Depósito CD (Aguardando Rota Final)',
                                'romaneio_id'       => null,
                            ]);
                            $itensRecebidosTransbordo++;
                            $pedidosTransbordo[$pedido->id] = $pedido;
                        }
                    }
                }

                // Trata devoluções concluídas
                foreach ($pedidosDevolucao as $pedido) {
                    $motosAindaNaEstrada = $pedido->motos()
                        ->whereIn('motos.status', ['transito_loja', 'em_transito', 'aguardando_coleta', 'coletado'])
                        ->count();

                    if ($motosAindaNaEstrada === 0) {
                        $pedido->update(['status' => 'concluido']);
                    }

                    PedidoLog::create([
                        'pedido_id' => $pedido->id,
                        'titulo'    => 'Recebido no CD 🏢',
                        'descricao' => "Devolução/Retorno (#{$pedido->id}) recebido no CD. Moto integrada ao estoque da Matriz/CD."
                    ]);

                    try {
                        $destinatarios = array_filter([$pedido->user?->onesignal_id, $pedido->origem?->onesignal_id]);
                        if (!empty($destinatarios)) {
                            (new \App\Services\OneSignalService())->sendToUser(
                                $destinatarios,
                                'Devolução Recebida no CD 🏢',
                                "A devolução da moto do pedido #{$pedido->id} foi recebida e concluída no Centro de Distribuição.",
                                route('pedidos.show', $pedido->id)
                            );
                        }
                    } catch (\Exception $e) {}
                }

                // Trata transbordo (aguardando próxima rota)
                foreach ($pedidosTransbordo as $pedido) {
                    $pedido->update(['status' => 'no_cd', 'romaneio_id' => null]);

                    PedidoLog::create([
                        'pedido_id' => $pedido->id,
                        'titulo'    => 'Chegou no CD 🏢',
                        'descricao' => "Transferência recebida no Hub Logístico. Aguardando rota final."
                    ]);

                    try {
                        if ($pedido->user?->onesignal_id) {
                            (new \App\Services\OneSignalService())->sendToUser(
                                [$pedido->user->onesignal_id],
                                'Chegou no CD 🏢',
                                "Seus itens do pedido #{$pedido->id} chegaram ao Centro de Distribuição e aguardam rota final.",
                                route('pedidos.show', $pedido->id)
                            );
                        }
                    } catch (\Exception $e) {}
                }

                // Trata eventuais peças destinadas ao CD
                $pecasRecebidas = 0;
                foreach ($romaneio->itens as $item) {
                    if ($item->isPeca() && $item->status !== \App\Models\RomaneioItem::STATUS_ENTREGUE) {
                        $destinoItem = mb_strtoupper((string) ($item->destino?->nome ?? $item->pedido?->user?->filial ?? ''));
                        if (in_array($destinoItem, ['MATRIZ / CD', 'CD', 'MATRIZ', 'CENTRO DE DISTRIBUIÇÃO', 'CD MATRIZ', 'CD ANANINDEUA'])) {
                            $item->update([
                                'status'              => \App\Models\RomaneioItem::STATUS_ENTREGUE,
                                'quantidade_recebida' => $item->quantidade,
                                'recebido_em'         => now(),
                            ]);
                            $pecasRecebidas++;
                        }
                    }
                }

                $totalBaixados = $itensRecebidosDevolucao + $itensRecebidosTransbordo + $pecasRecebidas;

                if ($totalBaixados > 0) {
                    $romaneio->fresh()->fecharSeTudoEntregue();

                    $msgs = [];
                    if ($itensRecebidosDevolucao > 0) {
                        $msgs[] = "{$itensRecebidosDevolucao} devolução/retorno recebida(s) no CD";
                    }
                    if ($itensRecebidosTransbordo > 0) {
                        $msgs[] = "{$itensRecebidosTransbordo} item(ns) de transbordo recebido(s)";
                    }
                    if ($pecasRecebidas > 0) {
                        $msgs[] = "{$pecasRecebidas} item(ns) de peça recebido(s)";
                    }

                    $msg = implode(', ', $msgs) . ' com sucesso!';

                    $pecasEmAberto = \App\Models\RomaneioItem::where('romaneio_id', $romaneio->id)
                        ->pecas()
                        ->whereNotIn('status', [
                            \App\Models\RomaneioItem::STATUS_ENTREGUE,
                            \App\Models\RomaneioItem::STATUS_DIVERGENCIA,
                            \App\Models\RomaneioItem::STATUS_RETORNADO,
                        ])
                        ->count();

                    if ($pecasEmAberto > 0 && $itensRecebidosTransbordo > 0) {
                        $msg .= " Atenção: {$pecasEmAberto} item(ns) de peça continuam vinculados a esta carga"
                              . ' e não entram no transbordo automático. Trate a basqueta manualmente com o Pós-Venda.';
                    }

                    if (!empty($devolucoesChecklistPendente)) {
                        $ids = implode(', #', $devolucoesChecklistPendente);
                        $msg .= " Nota: a(s) Devolução(ões) #{$ids} possui(em) checklist pendente no módulo de Devoluções.";
                    }

                    return back()->with('success', $msg);
                }

                if (!empty($devolucoesChecklistPendente)) {
                    $ids = implode(', #', $devolucoesChecklistPendente);
                    return back()->with('warning', "O item desta carga pertence à Devolução #{$ids}. O recebimento deve ser realizado pelo módulo de Devoluções com o Checklist de Destino.");
                }
            }

            // --- CASO 2: CHEGADA NA LOJA (RECEBIMENTO FINAL) ---
            if ($user->isLoja()) {
                return back()->withErrors(['erro' => 'Por favor, realize o recebimento pelo menu "Meus Pedidos".']);
            }

            /*
             * Nada baixado é ERRO para quem clicou, não aviso. Isto era
             * `with('info')` — chave que o layout não exibe —, e a tela tratava
             * a resposta como sucesso: o CD via "Recebido! Entrada no CD
             * registrada" sem que nada tivesse entrado.
             */
            return back()->withErrors([
                'erro' => 'Nenhum item desta carga tem destino ao CD ou transbordo pendente de baixa. Nada foi recebido.',
            ]);
        });
    }

    // 7. IMPRIMIR MANIFESTO
    public function imprimir($id) {
        // A lógica de impressão está no Frontend (Romaneios/Show.jsx) 
        // mas se precisar de uma rota dedicada, pode redirecionar para o Show
        return redirect()->route('romaneios.show', $id);
    }

    public function destroy($id)
    {
        $romaneio = Romaneio::with('motos.pedidos')->findOrFail($id);

        /*
         * Mesma régua da tela (Romaneios/Show.jsx, `podeDesfazer`). O servidor
         * só barrava a concluída: uma carga NA ESTRADA podia ser desfeita, e
         * motos e peças que estavam no caminhão voltavam a 'separado' como se
         * nunca tivessem saído.
         */
        if (in_array($romaneio->status, self::CARGA_NAO_DESFAZIVEL, true)) {
            return back()->withErrors(['erro' => $romaneio->status === 'concluido'
                ? 'Cargas concluídas não podem ser excluídas.'
                : 'Esta carga já saiu do CD e não pode ser desfeita. Os itens são baixados no recebimento.']);
        }

        DB::transaction(function () use ($romaneio) {
            $pedidosParaReverter = [];

            foreach ($romaneio->motos as $moto) {
                $pedido = $moto->pedidos->first();
                $statusVolta = 'separado';

                if ($pedido && $pedido->status === 'no_cd') {
                    $statusVolta = 'no_cd';
                }

                $moto->update([
                    'status' => $statusVolta,
                    'romaneio_id' => null,
                    'localizacao_atual' => 'Devolvido ao Estoque (Carga Desfeita)'
                ]);

                if ($pedido) {
                    $pedidosParaReverter[$pedido->id] = [
                        'model' => $pedido,
                        'status' => $statusVolta
                    ];
                }
            }

            /*
             * v3.3: Reverter os itens de PEÇA embarcados nesta carga.
             *
             * Sem isto, desfazer uma carga mista deixava os RomaneioItem de peça
             * com romaneio_id de um registro que não existe mais — e as basquetas
             * continuavam marcadas como despachadas, invisíveis para a mesa de
             * montagem e segurando saldo reservado que nunca mais seria liberado.
             */
            $itensPeca = \App\Models\RomaneioItem::where('romaneio_id', $romaneio->id)
                ->pecas()
                ->with('pedido')
                ->get();

            $basquetasAfetadas = collect();

            foreach ($itensPeca as $itemPeca) {
                if ($itemPeca->pedido) {
                    $pedidosParaReverter[$itemPeca->pedido->id] = [
                        'model'  => $itemPeca->pedido,
                        'status' => 'separado',
                    ];
                }
            }

            // Apaga os itens de carga de peça — a basqueta e o ledger continuam
            // intocados, então o saldo reservado não se perde.
            \App\Models\RomaneioItem::where('romaneio_id', $romaneio->id)
                ->pecas()
                ->delete();

            // Limpa o vínculo de romaneio das basquetas que estavam nesta carga.
            \App\Models\Basqueta::where('romaneio_id', $romaneio->id)
                ->update(['romaneio_id' => null]);

            foreach ($pedidosParaReverter as $dados) {
                $pedido = $dados['model'];
                $pedido->update([
                    'status' => $dados['status'],
                    'romaneio_id' => null
                ]);

                PedidoLog::create([
                    'pedido_id' => $pedido->id,
                    'titulo' => 'Carga Desfeita ↩️',
                    'descricao' => "Romaneio #{$romaneio->id} foi excluído manualmente. Itens associados retornaram para o status '{$dados['status']}'."
                ]);
            }

            $romaneio->delete();
        });

        return redirect()->route('romaneios.index')
            ->with('success', 'Carga desfeita com sucesso! Motos e peças retornaram para seus estoques de origem.');
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