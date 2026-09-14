<?php

namespace App\Http\Controllers;

use App\Actions\Pedidos\AprovarPedido;
use App\Actions\Pedidos\CancelarPedido;
use App\Actions\Pedidos\Concerns\RegistraHistorico;
use App\Actions\Pedidos\CriarPedido;
use App\Actions\Pedidos\FinalizarEntregaPedido;
use App\Actions\Pedidos\SepararPedido;
use App\Enums\StatusPedido;
use App\Exceptions\OperacaoPedidoRecusada;
use App\Http\Requests\FinalizarEntregaRequest;
use App\Http\Requests\StorePedidoRequest;
use App\Models\Moto;
use App\Models\Pedido;
use App\Models\PedidoLog;
use App\Models\User;
use App\Notifications\EstornoSolicitado;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Gate;
use Illuminate\Support\Facades\Log;
use Inertia\Inertia;

class PedidoController extends Controller
{
    /*
     * Controller fino (v3.5): criar, aprovar, separar, receber e cancelar vivem
     * em App\Actions\Pedidos. O que resta aqui é leitura, resposta HTTP e os
     * ajustes pontuais do CD e do admin.
     */
    use RegistraHistorico;

    // --- API v2: CÉREBRO LOGÍSTICO ---
    public function calcularLogistica(Request $request) {
        $destino = Auth::user(); // Quem pede
        $origemId = $request->fornecedor_id; // De onde vem

        // Se não tem origem definida, assumimos que é CD (Reposição)
        if (!$origemId) {
            return response()->json([
                'tipo' => 'reposicao',
                'origem' => 'CD / Fábrica',
                'rota_origem' => 'Fluxo CD',
                // 'data_coleta' => now()->format('Y-m-d'), // REMOVIDO: Sem previsão
                // 'data_entrega' => now()->addDays(2)->format('Y-m-d'), // REMOVIDO: Sem previsão
                'mensagem' => 'Saída direta do estoque do CD.'
            ]);
        }

        $origem = User::find($origemId);
        if (!$origem) return response()->json(['erro' => 'Fornecedor não encontrado.'], 404);

        // LÓGICA CAPITAL vs INTERIOR (V2)
        if (!$origem->is_interior) {
            // Capital: Fluxo Direto (Imediato)
            return response()->json([
                'tipo' => 'transferencia',
                'origem' => $origem->filial,
                'rota_origem' => 'Direta (Capital)',
                // 'data_coleta' => now()->format('Y-m-d'), // REMOVIDO
                // 'data_entrega' => now()->addDay()->format('Y-m-d'), // REMOVIDO
                'mensagem' => 'Transferência direta na região metropolitana.'
            ]);
        } 
        
        // Interior: Depende do Calendário (Schedule)
        // A loja pode solicitar a transferência normalmente a qualquer momento.
        // A matriz/CD fará o agendamento através do Calendário posteriormente.
        return response()->json([
            'tipo' => 'transferencia',
            'origem' => $origem->filial,
            'rota_origem' => 'Agendada (Interior)',
            'mensagem' => 'Aguardando definição de rota de envio pelo CD.'
        ]);
    }

    // --- CRUD PEDIDOS ---
    public function index(Request $request)
    {
        $user = Auth::user();
        
        // 2. BUSCA BASE
        $termo = $request->input('search');
        
        // Filtros Avançados
        $dataInicio = $request->input('data_inicio');
        $dataFim = $request->input('data_fim');
        $statusFiltro = $request->input('status');
        $lojaFiltro = $request->input('loja_id');
        $tipoCarga = $request->input('tipo'); // 'moto', 'peca', ou null

        $statusAtivos = StatusPedido::emAndamento();
        $marcadoresAtivos = implode(', ', array_fill(0, count($statusAtivos), '?'));

        $pedidos = Pedido::select('pedidos.*')
            ->with([
                'user:id,name,filial',    
                'origem:id,name,filial,perfil',  
                'romaneio'
            ])
            ->addSelect(['destino_final' => \App\Models\Moto::select('pedido_moto.destino')
                ->join('pedido_moto', 'motos.id', '=', 'pedido_moto.moto_id')
                ->whereColumn('pedido_moto.pedido_id', 'pedidos.id')
                ->limit(1)
            ])
            // V2.6: quantas unidades ainda aguardam o CD informar o chassi (0 em pedidos legados)
            ->addSelect(['saldo_chassi_pendente' => \App\Models\PedidoItem::query()
                ->selectRaw('COALESCE(SUM(GREATEST(quantidade - qtd_atribuida - qtd_cancelada, 0)), 0)')
                ->whereColumn('pedido_itens.pedido_id', 'pedidos.id')
            ])
            ->addSelect(['total_itens_qtd' => \App\Models\PedidoItem::query()
                ->selectRaw('COALESCE(SUM(GREATEST(quantidade - qtd_cancelada, 0)), 0)')
                ->whereColumn('pedido_itens.pedido_id', 'pedidos.id')
            ])
            ->withCount(['motos' => function ($query) {
                $query->whereNotIn('motos.status', ['cancelado', 'cancelada', 'rejeitado']);
            }])
            ->withCount(['motos as motos_separadas_count' => function ($query) {
                // Conta quantas motos AINDA não entraram no fluxo logístico prático
                $query->whereIn('status', ['em_analise', 'solicitado', 'separado', 'aguardando_rota', 'estoque_fabrica']);
            }])
            // Visibilidade (Loja vê seus pedidos e pedidos DELE)
            ->when($user->perfil === 'loja', function($q) use ($user) {
                $q->where(function($sub) use ($user) {
                    $sub->where('user_id', $user->id)
                        ->orWhere('origem_user_id', $user->id);
                });
            })
            // Filtro por Tipo de Carga (Motos vs Peças)
            ->when($tipoCarga === 'moto', fn($q) => $q->where('tipo_carga', '!=', 'peca'))
            ->when($tipoCarga === 'peca', fn($q) => $q->where('tipo_carga', 'peca'))
            // Filtro por Texto (ID, Status, Chassi, Loja)
            ->when($termo, function($q) use ($termo) {
                $q->where(function($sub) use ($termo) {
                    $sub->where('id', 'like', "%{$termo}%")
                        ->orWhere('status', 'like', "%{$termo}%")
                        ->orWhereHas('motos', fn($m) => $m->where('chassi', 'like', "%{$termo}%"))
                        ->orWhereHas('user', fn($u) => $u->where('filial', 'like', "%{$termo}%"))
                        ->orWhereHas('origem', fn($o) => $o->where('filial', 'like', "%{$termo}%"));
                });
            })
            // Filtro por STATUS Específico
            ->when($statusFiltro, fn($q) => $q->where('status', $statusFiltro))
            // Filtro por DATA DE CRIAÇÃO
            ->when($dataInicio, fn($q) => $q->whereDate('created_at', '>=', $dataInicio))
            ->when($dataFim, fn($q) => $q->whereDate('created_at', '<=', $dataFim))
            // Filtro por LOJA (Apenas para Admin/Gestor/CD)
            ->when($lojaFiltro && in_array($user->perfil, ['admin', 'gestor', 'cd']), fn($q) => $q->where('user_id', $lojaFiltro))
            
            // ORDENAÇÃO POR PRIORIDADE: ativos primeiro, na ordem do fluxo (a
            // ordem dos cases de StatusPedido), depois os mais recentes.
            ->orderByRaw("CASE WHEN status IN ({$marcadoresAtivos}) THEN 1 ELSE 2 END", $statusAtivos)
            ->orderByRaw("FIELD(status, {$marcadoresAtivos})", $statusAtivos)
            ->orderByDesc('created_at')
            ->paginate(15)
            ->withQueryString();

        $pedidos->through(function ($pedido) {
            $totalItens = (int) ($pedido->total_itens_qtd ?? 0);
            $pedido->motos_count = $totalItens > 0 ? $totalItens : (int) ($pedido->motos_count ?? 0);
            // Conta as cotas que ainda não possuem chassi atribuído como pendentes no CD para o cálculo de embarque parcial
            $pedido->motos_separadas_count = (int) ($pedido->motos_separadas_count ?? 0) + (int) ($pedido->saldo_chassi_pendente ?? 0);
            return $pedido;
        });

        // Contadores por Tipo para as Abas
        $baseCounts = Pedido::query()
            ->when($user->perfil === 'loja', function($q) use ($user) {
                $q->where(function($sub) use ($user) {
                    $sub->where('user_id', $user->id)
                        ->orWhere('origem_user_id', $user->id);
                });
            });

        $tipoCounts = [
            'all'   => (clone $baseCounts)->count(),
            'moto'  => (clone $baseCounts)->where('tipo_carga', '!=', 'peca')->count(),
            'peca'  => (clone $baseCounts)->where('tipo_carga', 'peca')->count(),
        ];

        return Inertia::render('Pedidos/Index', [
            'pedidos' => $pedidos, 
            'perfil' => $user->perfil, 
            'filters' => $request->only(['search', 'data_inicio', 'data_fim', 'status', 'loja_id', 'tipo']),
            'tipoCounts' => $tipoCounts,
            'currentTipo' => $tipoCarga ?: 'all',
            // Enviar lista de lojas para o filtro (apenas se tiver permissão)
            'lojas' => in_array($user->perfil, ['admin', 'gestor', 'cd']) ? User::where('perfil', 'loja')->orderBy('filial')->get(['id', 'filial']) : []
        ]);
    }

    public function buscarEstoqueLoja(Request $request)
    {
        $lojaId = $request->input('loja_id');
        if (!$lojaId) return response()->json([]);

        // CORREÇÃO: Aceita status 'estoque_loja', 'disponivel' (antigo) e 'concluido' (recém entregue)
        // Desde que pertença à loja selecionada.
        $motos = Moto::where('loja_atual_id', $lojaId)
            ->whereIn('status', ['estoque_loja', 'disponivel', 'concluido']) 
            ->whereDoesntHave('pedidos', function ($query) {
                // Garante que não está em nenhum PROCESSO ATIVO de logística
                // Qualquer pedido vivo segura a moto. A lista antiga esquecia
                // em_analise, rota_confirmada e coletado: a mesma moto aparecia
                // livre para uma segunda transferência.
                $query->whereIn('status', StatusPedido::emAndamento());
            })
            ->select('id', 'chassi', 'modelo', 'cor')
            ->orderBy('modelo')
            ->get();

        return response()->json($motos);
    }

    public function create()
    {
        // Lista lojas para transferência (inclui a própria, conforme solicitado)
        $lojas = User::where('perfil', 'loja')
            ->select('id', 'name', 'filial')
            ->orderBy('filial')
            ->get();

        // Busca ID do CD (ou Admin Admin se não houver CD explícito)
        // Isso permite que devolvamsos motos para "alguém"
        $cdUser = User::whereIn('perfil', ['cd', 'admin'])->orderBy('id')->first();

        // [CORREÇÃO] Lista de locais de entrega para o dropdown (Injeção Backend)
        // Carrega exclusivamente filiais ATIVAS cadastradas
        $filiaisAtivas = \App\Models\Filial::ativas()
            ->orderBy('uf')
            ->orderBy('cidade')
            ->get()
            ->map(fn($f) => $f->chave_filial)
            ->toArray();

        $locaisEntrega = !empty($filiaisAtivas)
            ? $filiaisAtivas
            : User::where('perfil', 'loja')
                ->whereNotNull('filial')
                ->where('filial', '!=', '')
                ->orderBy('filial')
                ->pluck('filial')
                ->unique()
                ->values()
                ->toArray();
        
        // Adiciona destinos padrão que não são lojas (se necessário)
        if (!in_array('Matriz / CD', $locaisEntrega)) {
            array_unshift($locaisEntrega, 'Matriz / CD');
        }

        // [CORREÇÃO] Adiciona Lojas Especiais (PDVs sem Login)
        $pdvsExtras = ['PDV Paar/PA', 'PDV Barcarena/PA'];
        foreach ($pdvsExtras as $pdv) {
            if (!in_array($pdv, $locaisEntrega)) {
                $locaisEntrega[] = $pdv;
            }
        }

        // Ordena novamente para garantir
        sort($locaisEntrega);

        $microwork = app(\App\Services\MicroworkService::class);

        // Busca modelos únicos registrados exatamente como vêm do Microwork
        $estoque = $microwork->getEstoqueCD();
        $modelosMicrowork = [];
        foreach ($estoque as $item) {
            $modelo = mb_strtoupper(trim($item['Modelo'] ?? $item['modelo'] ?? ''), 'UTF-8');
            if ($modelo && !in_array($modelo, $modelosMicrowork)) {
                $modelosMicrowork[] = $modelo;
            }
        }
        sort($modelosMicrowork);

        // Se houver modelos do Microwork, utiliza a lista exata do Microwork; caso contrário usa o DB como fallback
        $listaModelos = !empty($modelosMicrowork) 
            ? array_values(array_unique($modelosMicrowork)) 
            : \App\Models\Modelo::orderBy('nome')->pluck('nome')->toArray();

        // V2.6: Estoque real do CD agregado por Modelo + Cor, para o pedido genérico.
        // Se o cron de sincronia falhar, este array vem vazio e o frontend cai
        // automaticamente no modo digitação livre (não trava a loja).
        $estoqueCD = $microwork->getEstoqueDisponivelAgregado();

        return Inertia::render('Pedidos/Create', [
            'listaModelos' => $listaModelos,
            'lojasDisponiveis' => $lojas,
            'cdUserId' => $cdUser ? $cdUser->id : null,
            'locaisEntrega' => $locaisEntrega, // Variável recuperada
            'estoqueCD' => $estoqueCD,
            'motivosChassiObrigatorio' => CriarPedido::MOTIVOS_EXIGEM_CHASSI,
        ]);
    }

    public function store(StorePedidoRequest $request, CriarPedido $criarPedido)
    {
        $criarPedido->executar($request->user(), $request->validated());

        return redirect()->route('pedidos.index')->with('success', 'Solicitação enviada para aprovação!');
    }

    public function aprovar($id, AprovarPedido $aprovarPedido)
    {
        $pedido = Pedido::with(['user', 'motos', 'origem'])->findOrFail($id);

        Gate::authorize('aprovar', $pedido);

        try {
            $aprovarPedido->executar($pedido);
        } catch (OperacaoPedidoRecusada $e) {
            return back()->with('error', $e->getMessage());
        }

        return back()->with('success', 'Movimentação aprovada! Lojas notificadas.');
    }

    // --- FLUXO DE RETIRADA / ESTORNO ---
    public function solicitarRetiradaItem(Request $request, $id)
    {
        $moto = Moto::with('pedidos')->findOrFail($id);
        $user = Auth::user();
        
        // Validações básicas de permissão e status
        if ($user->perfil === 'cd' && !in_array($moto->status, ['solicitado', 'separado', 'estoque_fabrica'])) 
            return back()->withErrors('CD só cancela item em separação.');
        
        $moto->update([
            'estorno_pendente' => true, 
            'motivo_estorno' => "$user->perfil: $request->motivo", 
            'user_estorno_id' => $user->id
        ]);
        
        // Notifica Gestores
        User::whereIn('perfil', ['gestor', 'admin'])->each(fn($u) => $u->notify(new EstornoSolicitado($moto, $user)));
        
        return back()->with('success', 'Solicitação de estorno enviada.');
    }

    // --- REMOÇÃO DIRETA DE ITEM (EXCLUSIVO ADMIN) ---
    // Remove a moto do pedido imediatamente, sem passar pelo fluxo de estorno/aprovação do Gestor.
    public function removerMotoAdmin(Request $request, $id, $motoId)
    {
        $request->validate(['motivo' => 'required|string|max:500']);

        if (Auth::user()->perfil !== 'admin') {
            abort(403, 'Apenas o Administrador pode remover itens diretamente.');
        }

        return DB::transaction(function () use ($request, $id, $motoId) {
            $pedido = Pedido::with('user', 'origem')->findOrFail($id);

            if (in_array($pedido->status, ['concluido', 'cancelado', 'rejeitado'])) {
                return back()->with('error', 'Este pedido já foi finalizado e não pode ser alterado.');
            }

            $moto = $pedido->motos()->where('motos.id', $motoId)->first();
            if (!$moto) {
                return back()->with('error', 'Esta moto não pertence a este pedido.');
            }

            // 1. Desvincula do pedido
            // V2.6: antes de soltar o vínculo, guarda a cota que este chassi abatia.
            // Sem isso a cota continuaria marcada como "3/3 atribuídas" com apenas 2 motos
            // vinculadas — a moto sumiria do pedido sem gerar pendência para o CD.
            $vinculo = DB::table('pedido_moto')
                ->where('pedido_id', $pedido->id)
                ->where('moto_id', $moto->id)
                ->first();

            $pedido->motos()->detach($moto->id);

            if ($vinculo && !empty($vinculo->pedido_item_id)) {
                $cota = \App\Models\PedidoItem::find($vinculo->pedido_item_id);
                if ($cota && $cota->qtd_atribuida > 0) {
                    $cota->decrement('qtd_atribuida'); // Volta a contar como pendente para o CD
                }
            }

            // 2. Libera eventual reserva de chassi no Microwork atrelada a este pedido
            \App\Models\ReservaMicrowork::where('pedido_id', $pedido->id)
                ->where('chassi', $moto->chassi)
                ->whereIn('status', ['pendente', 'faturada'])
                ->update(['status' => 'cancelada']);

            // 3. Devolve a moto ao estoque de origem (limpa estorno pendente e romaneio por segurança)
            $statusVolta = $pedido->origem_user_id ? 'disponivel' : 'estoque_fabrica';
            $localVolta = $pedido->origem_user_id ? 'Estoque Loja (Removida pelo Admin)' : 'Pátio CD/Fábrica (Removida pelo Admin)';

            $moto->update([
                'romaneio_id' => null,
                'estorno_pendente' => false,
                'motivo_estorno' => null,
                'user_estorno_id' => null,
                'status' => $statusVolta,
                'localizacao_atual' => $localVolta,
            ]);

            $this->registrarLog(
                $pedido,
                'Item Removido pelo Admin ✂️',
                "Moto {$moto->modelo} (Chassi: {$moto->chassi}) removida diretamente do pedido, sem fluxo de aprovação. Motivo: {$request->motivo}"
            );

            // 4. Notifica os envolvidos
            $envolvidos = collect([$pedido->user, $pedido->origem])->filter()->unique('id');
            $this->enviarNotificacao(
                $envolvidos,
                'Item Removido ✂️',
                "O Admin removeu a moto {$moto->chassi} do pedido #{$pedido->id}.",
                route('pedidos.show', $pedido->id)
            );

            // 5. Se o pedido ficou vazio, cancela automaticamente (mesma regra do estorno)
            // V2.6: "vazio" agora exige também que não haja cota aguardando chassi.
            // Um pedido genérico com 4 unidades pendentes e 1 moto atribuída não pode ser
            // cancelado inteiro só porque essa única moto foi removida.
            if ($pedido->motos()->count() === 0 && $pedido->saldoPendente() === 0) {
                PedidoLog::create([
                    'pedido_id' => $pedido->id,
                    'titulo' => 'Pedido Cancelado Automaticamente',
                    'descricao' => 'O pedido foi cancelado porque seu último item foi removido pelo Admin.'
                ]);
                $pedido->update(['status' => 'cancelado']);
                $pedido->delete();

                return redirect()->route('pedidos.index')
                    ->with('warning', 'Moto removida. O pedido ficou vazio e foi cancelado automaticamente.');
            }

            // Se o pedido ainda possui motos e todas as restantes já estão despachadas em trânsito
            $saldoSemChassi = $pedido->saldoPendente();
            $motosEmTransito = $pedido->motos()
                ->whereIn('motos.status', ['transito_loja', 'em_transito'])
                ->count();
            $motosNoCd = $pedido->motos()
                ->whereNotIn('motos.status', ['transito_loja', 'em_transito', 'concluido', 'vendida', 'cancelado', 'avariado'])
                ->count();

            if ($saldoSemChassi === 0 && $motosNoCd === 0 && $motosEmTransito > 0) {
                if ($pedido->status !== 'em_transito' && !in_array($pedido->status, ['concluido', 'cancelado', 'rejeitado'])) {
                    $pedido->update(['status' => 'em_transito']);
                }
            }

            return back()->with('success', 'Moto removida do pedido e devolvida ao estoque.');
        });
    }

    // --- OPERAÇÃO DE SEPARAÇÃO ---
    public function marcarSeparado($id, SepararPedido $separarPedido)
    {
        $pedido = Pedido::with('origem', 'user')->findOrFail($id);

        try {
            $separarPedido->executar($pedido, Auth::user());
        } catch (OperacaoPedidoRecusada $e) {
            return back()->withErrors(['erro' => $e->getMessage()]);
        }

        return back()->with('success', 'Motos separadas fisicamente! O fluxo agora segue para a logística (coleta/agendamento).');
    }

    // --- FINALIZAÇÃO (RECEBIMENTO NO DESTINO) ---
    public function finalizarEntrega(FinalizarEntregaRequest $request, $id, FinalizarEntregaPedido $finalizarEntrega)
    {
        $pedido = Pedido::with('user', 'motos')->findOrFail($id);

        $finalizarEntrega->executar(
            $pedido,
            $request->user(),
            $request->file('arquivo_romaneio'),
            (array) $request->input('avarias', []),
            (array) $request->file('fotos_avarias', []),
        );

        return back()->with('message', 'Recebimento confirmado!');
    }


    // --- V2.6: ATRIBUIÇÃO DE CHASSIS PELO CD ---

    private function autorizarCD(): void
    {
        if (!in_array(Auth::user()->perfil, ['cd', 'admin'], true)) {
            abort(403, 'Apenas a equipe do CD pode atribuir chassis aos pedidos.');
        }
    }

    /**
     * Vincula um chassi físico a uma cota do pedido (Fluxo A: tela do Pedido).
     * Se 'pedido_item_id' não vier, o sistema descobre a cota pelo modelo/cor do chassi.
     */
    public function atribuirChassi(Request $request, $id)
    {
        $this->autorizarCD();

        $request->validate([
            'chassi' => 'required|string|min:11|max:17',
            'pedido_item_id' => 'nullable|integer',
        ]);

        $pedido = Pedido::findOrFail($id);

        $resultado = app(\App\Services\AtribuicaoChassiService::class)
            ->atribuir($pedido, $request->chassi, $request->pedido_item_id);

        $item = $resultado['item'];
        $moto = $resultado['moto'];

        $saldo = $pedido->saldoPendente();
        $msg = "Chassi {$moto->chassi} atribuído a {$item->modelo} {$item->cor}. " .
               ($saldo > 0 ? "Faltam {$saldo} chassi(s) neste pedido." : 'Pedido 100% atribuído!');

        if ($saldo === 0) {
            $this->enviarNotificacao(
                $pedido->user,
                'Chassis Definidos 🔢',
                "O CD definiu todos os chassis do seu pedido #{$pedido->id}.",
                route('pedidos.show', $pedido->id)
            );
        }

        return back()->with('success', $msg);
    }

    /**
     * Desfaz uma atribuição feita por engano.
     */
    public function desatribuirChassi($id, $motoId)
    {
        $this->autorizarCD();

        $pedido = Pedido::findOrFail($id);
        $moto = Moto::findOrFail($motoId);

        app(\App\Services\AtribuicaoChassiService::class)->desatribuir($pedido, $moto);

        return back()->with('success', "Chassi {$moto->chassi} desvinculado e devolvido ao estoque do CD.");
    }

    /**
     * Encerra o saldo não atendido de uma cota (pediram 5, o CD só tinha 3).
     */
    public function encerrarSaldoItem(Request $request, $itemId)
    {
        $this->autorizarCD();

        $request->validate([
            'justificativa' => 'required|string|min:5|max:500',
        ]);

        $item = \App\Models\PedidoItem::with('pedido.user')->findOrFail($itemId);
        $pendenteAntes = $item->qtd_pendente;

        app(\App\Services\AtribuicaoChassiService::class)
            ->encerrarSaldo($item, $request->justificativa);

        $this->enviarNotificacao(
            $item->pedido->user,
            'Saldo Encerrado ✂️',
            "{$pendenteAntes}x {$item->modelo} {$item->cor} do pedido #{$item->pedido_id} não serão enviadas: {$request->justificativa}",
            route('pedidos.show', $item->pedido_id)
        );

        return back()->with('success', "Saldo de {$pendenteAntes} unidade(s) encerrado. A loja foi notificada.");
    }

    // --- CANCELAMENTOS ---
    public function rejeitar(Request $request, $id)
    {
        return $this->cancelar($id, 'rejeitado', $request->motivo);
    }

    public function cancelarSolicitacao($id)
    {
        return $this->cancelar($id, 'cancelado', 'Cancelado pela Loja');
    }

    private function cancelar($id, string $tipo, ?string $motivo)
    {
        $pedido = Pedido::with(['motos', 'user', 'itensPedido.peca'])->findOrFail($id);

        try {
            app(CancelarPedido::class)->executar($pedido, Auth::user(), $tipo, $motivo);
        } catch (OperacaoPedidoRecusada $e) {
            return back()->with('error', $e->getMessage());
        } catch (\Throwable $e) {
            /*
             * A transação já desfez tudo. O que resta é contar ao operador que
             * nada mudou — em vez de uma tela em branco ou, pior, um "cancelado
             * com sucesso" sobre um estado que não foi gravado.
             */
            Log::error("Falha ao {$tipo} pedido #{$id}: " . $e->getMessage(), [
                'pedido_id' => $id,
                'exception' => $e,
            ]);

            return back()->with('error',
                "Não foi possível {$tipo} o pedido: {$e->getMessage()} Nada foi alterado — tente novamente ou chame o suporte."
            );
        }

        if ($pedido->tipo_carga === 'peca') {
            $destino = str_contains((string) url()->previous(), 'atendimento')
                ? redirect()->route('pecas.atendimento')
                : redirect()->route('pedidos.index', ['tipo' => 'peca']);

            return $destino->with('success', "Pedido #{$id} {$tipo} com sucesso.");
        }

        return redirect()->route('dashboard')->with('warning', "Pedido $tipo com sucesso.");
    }
    
    // --- VIEWS ---
    public function sucesso() { return Inertia::render('Pedidos/Sucesso'); }
    public function show($id)
    {
        $pedido = Pedido::with([
            'user',
            'origem', // <--- ADICIONADO: Traz os dados da loja de origem
            'motos' => function($q) {
                $q->withPivot(['id', 'detalhes_avaria', 'foto_avaria', 'motivo', 'pedido_item_id']);
            },
            'itensPedido.canceladoPor:id,name', // V2.6: cotas do pedido
            'itensPedido.peca:id,codigo,descricao,unidade', // v3: cotas de peça
            'itensPedido.identificadoPor:id,name',
            'itensPedido.confirmadoPor:id,name',
            'itensPedido.basqueta:id,status',
            'romaneio',
            'logs' => fn($q) => $q->latest()
        ])->findOrFail($id);

        // Sem isto, trocar o número na URL abria o pedido de outra filial — ver PedidoPolicy.
        Gate::authorize('view', $pedido);

        $ehPeca = $pedido->tipo_carga === 'peca';

        return Inertia::render('Pedidos/Show', [
            'pedido' => $pedido,
            // v3: dados do fluxo de peça. Para pedido de moto vem tudo vazio e
            // a tela se comporta exatamente como antes.
            'peca' => $this->contextoPeca($pedido),
            // V2.6: metadados da atribuição de chassis. Pedido legado ou de peças => tudo zerado,
            // e a tela não exibe fluxo de chassi.
            'atribuicao' => [
                'legado'         => $ehPeca || $pedido->itensPedido->isEmpty(),
                'saldo_pendente' => $ehPeca ? 0 : (int) $pedido->itensPedido->sum(fn($i) => $i->qtd_pendente),
                'permitido'      => ! $ehPeca
                                    && in_array(Auth::user()->perfil, ['cd', 'admin'], true)
                                    && in_array($pedido->status, \App\Services\AtribuicaoChassiService::STATUS_ATRIBUIVEIS, true),
            ],
        ]);
    }
    /**
     * Contexto do fluxo de peça (v3).
     *
     * Pedido de moto devolve tudo neutro, então Pedidos/Show continua se
     * comportando exatamente como antes — nenhuma tela existente muda.
     */
    private function contextoPeca(Pedido $pedido): array
    {
        if ($pedido->tipo_carga !== 'peca') {
            return ['ativo' => false];
        }

        $user = Auth::user();
        $ehCd = in_array($user?->perfil, ['cd', 'admin', 'gestor'], true);

        // Itens já carregados na carga, para a conferência de recebimento.
        $itensCarga = \App\Models\RomaneioItem::with('itemable:id,codigo,descricao,unidade')
            ->where('pedido_id', $pedido->id)
            ->pecas()
            ->get()
            ->map(fn ($i) => [
                'id'         => $i->id,
                'codigo'     => $i->itemable?->codigo,
                'descricao'  => $i->itemable?->descricao,
                'unidade'    => $i->itemable?->unidade,
                'enviado'    => $i->quantidade,
                'recebido'   => $i->quantidade_recebida,
                'status'     => $i->status,
            ]);

        $cd = \App\Models\EstoqueLocal::cd();
        $origemId = $pedido->local_origem_id ?? $cd?->id;

        $saldosCd = [];
        if ($origemId) {
            $pecaIds = $pedido->itensPedido->pluck('peca_id')->filter()->unique();
            if ($pecaIds->isNotEmpty()) {
                $saldosCd = \App\Models\PecaEstoque::where('local_id', $origemId)
                    ->whereIn('peca_id', $pecaIds)
                    ->get()
                    ->mapWithKeys(fn ($pe) => [(int) $pe->peca_id => max(0, (int) ($pe->saldo - $pe->saldo_reservado))])
                    ->all();
            }
        }

        return [
            'ativo'          => true,
            'saldo_pendente' => $pedido->saldoPendente(),
            'itens_carga'    => $itensCarga,
            'saldos_cd'      => $saldosCd,
            // Mesma regra do servidor, consultada na fonte — ver
            // impedimentoCancelamentoPeca. A tela não guarda cópia da lista.
            'pode_cancelar'  => app(CancelarPedido::class)->impedimentoPeca($pedido, $user) === null,
            /*
             * 'solicitado' saiu da lista na v3.1: um pedido recém-chegado ainda
             * não passou pelo Gate 1, e separar antes da liberação é exatamente
             * o que o manual proíbe. A trava de verdade é por item, em
             * PecaAtendimentoController::separar — isto aqui só evita oferecer
             * um botão que vai recusar tudo.
             *
             * v3.3: exige que haja itens com pendência (qtd_pendente > 0).
             * Oferecer o botão quando 100% dos itens já estão separados não faz
             * sentido e só gera erro de "nenhum item informado".
             */
            'pode_separar'   => $ehCd
                                && in_array($pedido->status, ['aprovado', 'separado'], true)
                                && $pedido->itensPedido->contains(fn ($i) => $i->isPeca() && $i->isLiberada() && $i->qtd_pendente > 0),
            /*
             * v3.2: embarcar exige uma basqueta LIBERADA, porque a caixa é a
             * unidade de embarque e o Gate 2 mora nela. Oferecer o botão antes
             * disso só produziria uma recusa — a trava real está em
             * EmbarqueBasquetaService.
             */
            'pode_carregar'  => $ehCd
                                && in_array($pedido->status, Pedido::STATUS_PECA_EMBARCAVEL, true)
                                && $pedido->itensPedido->sum('qtd_atribuida') > 0
                                && \App\Models\Basqueta::whereIn(
                                        'id',
                                        $pedido->itensPedido->pluck('basqueta_id')->filter()->unique()
                                   )
                                   ->where('status', \App\Models\Basqueta::STATUS_LIBERADA)
                                   ->whereNull('romaneio_id')
                                   ->exists(),
            /*
             * Só se recebe o que saiu. O status do pedido não basta: uma
             * separação parcial mantém o pedido em 'aguardando_coleta' mesmo
             * depois de o caminhão partir, e a carga só sai de fato quando os
             * itens vão para 'em_transito' em RomaneioController::iniciarTransito.
             */
            'pode_receber'   => ($ehCd || $user->estoque_local_id === $pedido->local_destino_id)
                                && $itensCarga->contains(
                                    fn ($i) => $i['status'] === \App\Models\RomaneioItem::STATUS_EM_TRANSITO
                                ),
            'basquetas'      => \App\Models\Basqueta::whereIn(
                                    'id',
                                    $pedido->itensPedido->pluck('basqueta_id')->filter()->unique()
                                )
                                ->with(['viagem:id,date', 'notas' => fn ($q) => $q->vigentes(), 'local:id,nome'])
                                ->get()
                                ->map(fn ($b) => [
                                    'id'            => $b->id,
                                    'status'        => $b->status,
                                    'local'         => $b->local?->nome,
                                    'volumes'       => $b->volumes,
                                    'romaneio_id'   => $b->romaneio_id,
                                    'viagem_data'   => $b->viagem?->date,
                                    'nota_fiscal'   => $b->notaVigente()?->numero_nota,
                                    'chave_acesso'  => $b->notaVigente()?->chave_acesso,
                                    'url_romaneio'  => route('pecas.basquetas.romaneio', $b->id),
                                    'pode_faturar'  => $ehCd && in_array($b->status, \App\Models\Basqueta::ABERTAS, true),
                                    'pode_conferir' => in_array($b->status, [
                                        \App\Models\Basqueta::STATUS_FATURADA,
                                        \App\Models\Basqueta::STATUS_EM_CONFERENCIA,
                                        \App\Models\Basqueta::STATUS_LIBERADA,
                                    ], true),
                                ])
                                ->values()
                                ->all(),
            'pode_atender'   => $ehCd && in_array($pedido->status, ['solicitado', 'em_atendimento', 'aguardando_confirmacao'], true),
            'pode_liberar'   => $user->podeValidarPecas() && in_array($pedido->status, ['solicitado', 'em_atendimento', 'aguardando_confirmacao'], true),
            // Cargas abertas, para escolher em qual embarcar.
            'cargas_abertas' => $ehCd
                ? \App\Models\Romaneio::whereNotIn('status', ['concluido', 'cancelado'])
                    ->latest('id')->limit(20)
                    ->get(['id', 'motorista', 'placa', 'rota', 'status'])
                : [],
        ];
    }

}