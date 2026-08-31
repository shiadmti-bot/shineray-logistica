<?php

namespace App\Http\Controllers;

use App\Models\Devolucao;
use App\Models\DevolucaoAnexo;
use App\Models\DevolucaoItem;
use App\Models\Moto;
use App\Models\Pedido;
use App\Models\PedidoItem;
use App\Models\PedidoLog;
use App\Models\User;
use App\Notifications\PedidoAtualizado;
use App\Services\ArquivoComprovante;
use App\Services\Devolucao\ChecklistMoto;
use App\Services\OneSignalService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;
use Inertia\Inertia;

/**
 * DEVOLUÇÃO DE MOTOS — LOJA → CD (v3)
 *
 * A v2.2 tinha um fluxo de devolução; a v2.6 o desativou e transformou em "uma
 * transferência com o CD como destino". Movia a moto e não guardava a única
 * coisa que uma devolução precisa guardar: PROVA do estado em que ela saiu e do
 * estado em que chegou. Sem isso, cada avaria virava discussão sobre quem
 * quebrou — e a discussão sempre acabava no valor do prejuízo.
 *
 * O DESENHO EM UMA FRASE
 * A devolução é o DOSSIÊ (checklist nas duas pontas + fotos); o frete continua
 * sendo um Pedido de transferência Loja → CD, criado na aprovação do gestor.
 * Assim romaneio, coleta milk-run, trânsito e Timeline do chassi funcionam sem
 * uma linha nova de logística.
 *
 * OS TRÊS PORTÕES
 *   1. A LOJA só envia com o checklist de origem assinado, item por item, com
 *      descrição e foto para toda não conformidade.
 *   2. O GESTOR aprova ou recusa — é ele, e só ele, quem autoriza a moto a sair
 *      da loja. Antes disso a moto não entra em fila de coleta nenhuma.
 *   3. O CD só fecha com o checklist de destino assinado. É a comparação entre
 *      os dois que responde: já saiu assim, ou aconteceu no caminho?
 *
 * ESCOPO: SOMENTE MOTO
 * Peça tem outro ciclo (saldo fungível, ledger em peca_movimentos) e outro
 * documento de conferência. Este módulo não finge cobri-la.
 */
class DevolucaoController extends Controller
{
    /**
     * Status de moto que admitem devolução.
     *
     * 'vendida' entra por causa do motivo "venda cancelada pelo cliente": é
     * justamente a moto que já saiu do estoque no papel e precisa voltar.
     * 'avariado' entra porque devolver moto quebrada é o caso mais comum de
     * todos — bloqueá-la seria bloquear a razão de ser do módulo.
     */
    private const STATUS_MOTO_DEVOLVIVEL = ['estoque_loja', 'avariado', 'vendida'];

    // ==================================================================
    // LEITURA
    // ==================================================================

    public function index(Request $request)
    {
        $user = Auth::user();

        $devolucoes = Devolucao::with([
                'loja:id,name,filial',
                'destino:id,name,filial',
                'itens:id,devolucao_id,chassi,modelo,cor,origem_resultado,destino_resultado',
                'pedido:id,status,romaneio_id',
            ])
            // A loja enxerga o que ela devolveu; CD, gestor e admin veem tudo.
            ->when($user->perfil === 'loja', fn ($q) => $q->where('user_id', $user->id))
            ->when($request->filled('status'), fn ($q) => $q->where('status', $request->status))
            ->latest()
            ->paginate(20)
            ->withQueryString()
            ->through(fn (Devolucao $d) => $this->resumir($d));

        return Inertia::render('Devolucoes/Index', [
            'devolucoes' => $devolucoes,
            'filtros'    => $request->only(['status']),
            'motivos'    => Devolucao::MOTIVOS,
            'podeCriar'  => in_array($user->perfil, ['loja', 'admin'], true),
        ]);
    }

    public function create(Request $request)
    {
        $user = Auth::user();
        $ehLoja = $user->perfil === 'loja';

        /*
         * O admin escolhe a loja ANTES de ver o pátio, e a lista volta do
         * servidor já filtrada. Mandar as motos de todas as lojas de uma vez
         * seriam mais de mil linhas para o navegador filtrar — a loja, que é
         * quem de fato usa esta tela, nunca precisou disso.
         */
        $lojaId = $ehLoja ? $user->id : ($request->integer('loja_id') ?: null);

        return Inertia::render('Devolucoes/Create', [
            'motos'   => ($ehLoja || $lojaId) ? $this->motosElegiveis($lojaId) : [],
            'lojaId'  => $lojaId,
            'lojas'   => $ehLoja
                ? []
                : User::where('perfil', 'loja')->orderBy('filial')->get(['id', 'name', 'filial']),
            'motivos' => Devolucao::MOTIVOS,
        ]);
    }

    public function show(Devolucao $devolucao)
    {
        $this->autorizarVer($devolucao);

        $devolucao->load([
            'loja:id,name,filial',
            'destino:id,name,filial',
            'aprovadoPor:id,name',
            'recebidoPor:id,name',
            'pedido:id,status,romaneio_id',
            'itens.moto:id,chassi,status,localizacao_atual',
            'itens.anexos.enviadoPor:id,name',
            'anexos.enviadoPor:id,name',
        ]);

        $user = Auth::user();
        $ehCd = in_array($user->perfil, ['cd', 'admin'], true);
        $ehDono = $devolucao->user_id === $user->id || $user->perfil === 'admin';

        return Inertia::render('Devolucoes/Show', [
            'devolucao' => $this->detalhar($devolucao),
            'checklist' => ChecklistMoto::grupos(),
            'permissoes' => [
                // Cada portão é uma pergunta separada: quem confere na origem
                // não é quem confere no destino, e nenhum dos dois aprova.
                'conferir_origem'  => $ehDono && $devolucao->podeEditar(),
                'conferir_destino' => $ehCd && $devolucao->emTransporte(),
                'editar'           => $ehDono && $devolucao->podeEditar(),
                'enviar'           => $ehDono && $devolucao->podeEditar(),
                'decidir'          => in_array($user->perfil, ['gestor', 'admin'], true)
                                      && $devolucao->status === Devolucao::STATUS_AGUARDANDO,
                'receber'          => $ehCd && $devolucao->emTransporte(),
                'cancelar'         => $ehDono && in_array($devolucao->status, [
                                          Devolucao::STATUS_RASCUNHO,
                                          Devolucao::STATUS_AGUARDANDO,
                                      ], true),
            ],
        ]);
    }

    /**
     * O formulário em papel, com tudo que já foi preenchido.
     *
     * Continua existindo porque a conferência acontece com a moto na frente e
     * o celular no bolso: o conferente imprime, marca na prancheta e depois
     * lança. Imprimir com as marcações já feitas serve à outra ponta — o CD
     * recebe a via da loja e confere contra ela.
     */
    public function imprimir(Devolucao $devolucao)
    {
        $this->autorizarVer($devolucao);

        // Mesmo conjunto de show(): detalhar() percorre anexos e conferências de
        // cada moto, e sem o eager load isso vira uma consulta por item.
        $devolucao->load([
            'loja:id,name,filial',
            'destino:id,name,filial',
            'aprovadoPor:id,name',
            'recebidoPor:id,name',
            'pedido:id,status,romaneio_id',
            'itens.moto:id,chassi,status,localizacao_atual',
            'itens.anexos.enviadoPor:id,name',
            'anexos.enviadoPor:id,name',
        ]);

        return Inertia::render('Devolucoes/Imprimir', [
            'devolucao' => $this->detalhar($devolucao),
            'checklist' => ChecklistMoto::grupos(),
        ]);
    }

    // ==================================================================
    // ABERTURA E EDIÇÃO (LOJA)
    // ==================================================================

    public function store(Request $request)
    {
        $user = Auth::user();

        $dados = $request->validate([
            'loja_id'        => ['nullable', 'exists:users,id'],
            'motos'          => ['required', 'array', 'min:1', 'max:20'],
            'motos.*'        => ['integer', 'distinct'],
            'motivo'         => ['required', Rule::in(array_keys(Devolucao::MOTIVOS))],
            'observacao'     => ['nullable', 'string', 'max:1000'],
            'nf_numero'      => ['nullable', 'string', 'max:60'],
            'transportadora' => ['nullable', 'string', 'max:120'],
            'placa'          => ['nullable', 'string', 'max:10'],
            'lacre'          => ['nullable', 'string', 'max:60'],
        ], [
            'motos.required' => 'Selecione ao menos uma moto para devolver.',
            'motivo.required' => 'Informe por que estas motos estão voltando ao CD.',
        ]);

        $lojaId = $user->perfil === 'loja' ? $user->id : (int) ($dados['loja_id'] ?? 0);

        if (! $lojaId) {
            throw ValidationException::withMessages([
                'loja_id' => 'Informe de qual loja partem estas motos.',
            ]);
        }

        // Reconsulta a elegibilidade no servidor: a lista que o navegador tem
        // pode ter minutos de idade, e nesse intervalo a moto pode ter entrado
        // em outro pedido.
        $elegiveis = $this->motosElegiveis($lojaId)->keyBy('id');
        $escolhidas = collect($dados['motos'])->map(fn ($id) => (int) $id);

        $invalidas = $escolhidas->reject(fn ($id) => $elegiveis->has($id));

        if ($invalidas->isNotEmpty()) {
            throw ValidationException::withMessages([
                'motos' => 'Alguma das motos escolhidas não está mais disponível para devolução '
                    . '(pode ter entrado em outro pedido ou em outra devolução). Recarregue a página e refaça a seleção.',
            ]);
        }

        $devolucao = DB::transaction(function () use ($dados, $lojaId, $escolhidas, $elegiveis) {
            $devolucao = Devolucao::create([
                'user_id'         => $lojaId,
                'destino_user_id' => $this->usuarioDoCd()?->id,
                'status'          => Devolucao::STATUS_RASCUNHO,
                'motivo'          => $dados['motivo'],
                'observacao'      => $dados['observacao'] ?? null,
                'nf_numero'       => $dados['nf_numero'] ?? null,
                'transportadora'  => $dados['transportadora'] ?? null,
                'placa'           => $dados['placa'] ?? null,
                'lacre'           => $dados['lacre'] ?? null,
            ]);

            foreach ($escolhidas as $motoId) {
                $moto = $elegiveis[$motoId];

                // Snapshot: o checklist é documento datado. Ver DevolucaoItem.
                DevolucaoItem::create([
                    'devolucao_id' => $devolucao->id,
                    'moto_id'      => $moto->id,
                    'chassi'       => $moto->chassi,
                    'modelo'       => $moto->modelo,
                    'cor'          => $moto->cor,
                    'ano_modelo'   => $moto->ano_fabricacao,
                ]);
            }

            return $devolucao;
        });

        return redirect()
            ->route('devolucoes.show', $devolucao->id)
            ->with('success', 'Devolução aberta. Preencha o checklist de cada moto antes de enviar para aprovação.');
    }

    /** Dados da movimentação: NF, transportadora, placa, lacre, saída. */
    public function update(Request $request, Devolucao $devolucao)
    {
        $this->autorizarLoja($devolucao);

        if (! $devolucao->podeEditar()) {
            return back()->withErrors(['geral' => 'Esta devolução já foi enviada e não aceita mais alterações.']);
        }

        $dados = $request->validate([
            'motivo'         => ['required', Rule::in(array_keys(Devolucao::MOTIVOS))],
            'observacao'     => ['nullable', 'string', 'max:1000'],
            'nf_numero'      => ['nullable', 'string', 'max:60'],
            'transportadora' => ['nullable', 'string', 'max:120'],
            'placa'          => ['nullable', 'string', 'max:10'],
            'lacre'          => ['nullable', 'string', 'max:60'],
            'saida_em'       => ['nullable', 'date'],
        ]);

        $devolucao->update($dados);

        return back()->with('success', 'Dados da movimentação atualizados.');
    }

    // ==================================================================
    // A CONFERÊNCIA (os dois checklists)
    // ==================================================================

    /**
     * Assina o checklist de uma moto numa das duas pontas.
     *
     * É assinatura, não rascunho: por isso exige a lista inteira marcada. Meia
     * conferência gravada não distingue "está tudo bem" de "ninguém olhou" — e
     * é exatamente essa ambiguidade que o formulário de papel evita obrigando o
     * conferente a rubricar cada linha.
     *
     * Pode ser refeita enquanto a etapa estiver aberta (a loja em rascunho, o
     * CD antes de fechar): quem confere erra, e reabrir uma devolução inteira
     * por causa de um clique trocado seria pior que o erro.
     */
    public function conferir(Request $request, Devolucao $devolucao, DevolucaoItem $item)
    {
        $this->garantirItemDaDevolucao($devolucao, $item);

        $dados = $request->validate([
            'etapa'       => ['required', Rule::in(ChecklistMoto::ETAPAS)],
            'respostas'   => ['required', 'array'],
            'resultado'   => ['required', Rule::in(ChecklistMoto::RESULTADOS)],
            'responsavel' => ['required', 'string', 'max:120'],
            'matricula'   => ['nullable', 'string', 'max:50'],
            'observacao'  => ['nullable', 'string', 'max:1000'],
            'numero_motor' => ['nullable', 'string', 'max:60'],
        ], [
            'responsavel.required' => 'Informe o nome de quem fez a inspeção — o formulário exige assinatura.',
            'resultado.required'   => 'Marque o veredito: conforme, com ressalva ou não conforme.',
        ]);

        $etapa = $dados['etapa'];

        $this->autorizarEtapa($devolucao, $etapa);

        $respostas = ChecklistMoto::normalizar($dados['respostas']);
        $faltantes = ChecklistMoto::faltantes($respostas);

        if ($faltantes !== []) {
            throw ValidationException::withMessages([
                'respostas' => 'CHECKLIST INCOMPLETO: marque C ou NC em todos os itens. '
                    . 'Faltam ' . count($faltantes) . ': ' . implode(', ', array_slice($faltantes, 0, 5))
                    . (count($faltantes) > 5 ? '…' : ''),
            ]);
        }

        if (! ChecklistMoto::resultadoCompativel($dados['resultado'], $respostas)) {
            $temNc = ChecklistMoto::naoConformes($respostas) !== [];

            throw ValidationException::withMessages([
                'resultado' => $temNc
                    ? 'Há itens marcados como NC: o veredito não pode ser "Conforme". Use "Com ressalva" ou "Não conforme".'
                    : 'Nenhum item foi marcado como NC: o veredito tem de ser "Conforme".',
            ]);
        }

        $naoConformes = ChecklistMoto::naoConformes($respostas);

        if ($naoConformes !== [] && ! trim((string) ($dados['observacao'] ?? ''))) {
            throw ValidationException::withMessages([
                'observacao' => 'Todo item não conforme exige descrição. Não conformes: '
                    . implode(', ', $naoConformes),
            ]);
        }

        // 'origem' e 'destino' nomeiam tanto as colunas JSON quanto o prefixo
        // das colunas de assinatura — a etapa validada serve para as duas.
        $item->update([
            "checklist_{$etapa}"   => $respostas,
            "observacao_{$etapa}"  => $dados['observacao'] ?? null,
            "{$etapa}_resultado"   => $dados['resultado'],
            "{$etapa}_responsavel" => $dados['responsavel'],
            "{$etapa}_matricula"   => $dados['matricula'] ?? null,
            "{$etapa}_assinado_em" => now(),
            "{$etapa}_user_id"     => Auth::id(),
            // O número do motor está no cabeçalho do formulário e não vive em
            // `motos`. Quem tem a moto na frente é quem consegue lê-lo — e não
            // apaga o que já foi lido se vier em branco na segunda conferência.
            'numero_motor'         => ($dados['numero_motor'] ?? null) ?: $item->numero_motor,
        ]);

        $this->registrarNoPedido(
            $devolucao,
            'Checklist conferido 📋',
            "Moto {$item->chassi} conferida na {$etapa} por {$dados['responsavel']}: {$dados['resultado']}."
            . ($naoConformes !== [] ? ' Não conformidades: ' . implode(', ', $naoConformes) . '.' : '')
        );

        $aviso = $naoConformes !== [] && $item->anexosDaEtapa($etapa)->isEmpty()
            ? ' Anexe a foto da não conformidade — sem ela a devolução não avança.'
            : '';

        return back()->with('success', "Checklist da moto {$item->chassi} registrado.{$aviso}");
    }

    // ==================================================================
    // ANEXOS
    // ==================================================================

    public function anexar(Request $request, Devolucao $devolucao)
    {
        $dados = $request->validate([
            'etapa'    => ['required', Rule::in(ChecklistMoto::ETAPAS)],
            'item_id'  => ['nullable', 'integer'],
            'arquivo'  => ['required', 'file', 'mimes:jpg,jpeg,png,webp,pdf', 'max:10240'],
            'descricao' => ['nullable', 'string', 'max:255'],
        ], [
            'arquivo.required' => 'Escolha a foto ou o documento a anexar.',
            'arquivo.max'      => 'O arquivo passou de 10 MB. Tire a foto com resolução menor.',
        ]);

        $this->autorizarEtapa($devolucao, $dados['etapa']);

        $item = null;

        if (! empty($dados['item_id'])) {
            $item = $devolucao->itens()->find($dados['item_id']);

            if (! $item) {
                throw ValidationException::withMessages([
                    'item_id' => 'Esta moto não pertence à devolução informada.',
                ]);
            }
        }

        // Fora de transação: upload é I/O de rede e não deve segurar linha de
        // banco esperando — mesma decisão de BasquetaController::conferir.
        $url = app(ArquivoComprovante::class)->guardar(
            $dados['arquivo'],
            'devolucoes',
            "devolucao_{$devolucao->id}_{$dados['etapa']}" . ($item ? "_{$item->chassi}" : '')
        );

        DevolucaoAnexo::create([
            'devolucao_id'      => $devolucao->id,
            'devolucao_item_id' => $item?->id,
            'etapa'             => $dados['etapa'],
            'url'               => $url,
            'nome_original'     => $dados['arquivo']->getClientOriginalName(),
            'descricao'         => $dados['descricao'] ?? null,
            'enviado_por'       => Auth::id(),
        ]);

        return back()->with('success', 'Anexo enviado.');
    }

    public function removerAnexo(Devolucao $devolucao, DevolucaoAnexo $anexo)
    {
        if ($anexo->devolucao_id !== $devolucao->id) {
            abort(404);
        }

        $this->autorizarEtapa($devolucao, $anexo->etapa);

        $anexo->delete();

        return back()->with('success', 'Anexo removido.');
    }

    // ==================================================================
    // PORTÃO 1 — A LOJA ENVIA
    // ==================================================================

    public function enviar(Devolucao $devolucao)
    {
        $this->autorizarLoja($devolucao);

        if (! $devolucao->podeEditar()) {
            return back()->withErrors(['geral' => 'Esta devolução já foi enviada.']);
        }

        $devolucao->load('itens.anexos');

        $pendencias = $devolucao->pendenciasParaEnvio();

        if ($pendencias !== []) {
            throw ValidationException::withMessages([
                'geral' => "CHECKLIST DE ORIGEM INCOMPLETO: nenhuma moto sai da loja sem conferência assinada.\n"
                    . '• ' . implode("\n• ", $pendencias),
            ]);
        }

        $devolucao->update(['status' => Devolucao::STATUS_AGUARDANDO]);

        $this->notificar(
            User::whereIn('perfil', ['gestor', 'admin'])->get(),
            'Devolução para aprovar 🔁',
            "Loja {$devolucao->loja->filial} quer devolver {$devolucao->totalMotos()} moto(s) ao CD.",
            route('devolucoes.show', $devolucao->id)
        );

        return back()->with('success', 'Devolução enviada para aprovação da diretoria.');
    }

    // ==================================================================
    // PORTÃO 2 — A DIRETORIA DECIDE
    // ==================================================================

    /**
     * Aprova e cria o frete.
     *
     * É aqui que a devolução encontra a logística existente: nasce um Pedido de
     * transferência com origem na loja e destino no CD, exatamente a forma que
     * RomaneioController::create já procura na aba de Coletas. A moto passa a
     * 'aguardando_coleta' (ou 'aguardando_rota', se a loja é do interior — a
     * mesma exceção organizacional de PedidoController::marcarSeparado) e entra
     * na fila do milk run sozinha.
     */
    public function aprovar(Devolucao $devolucao)
    {
        if ($devolucao->status !== Devolucao::STATUS_AGUARDANDO) {
            return back()->withErrors(['geral' => 'Esta devolução não está aguardando aprovação.']);
        }

        $devolucao->load(['itens.moto', 'loja']);

        // Entre o envio e a aprovação a moto pode ter sido puxada para outro
        // pedido. Aprovar assim mesmo criaria dois donos para o mesmo chassi.
        $presas = $devolucao->itens
            ->filter(fn (DevolucaoItem $item) => $this->motoPresaEmPedido($item->moto_id))
            ->pluck('chassi');

        if ($presas->isNotEmpty()) {
            return back()->withErrors([
                'geral' => 'CHASSI PRESO: ' . $presas->implode(', ')
                    . ' já está vinculado a outro pedido ativo. Resolva o pedido em aberto antes de aprovar esta devolução.',
            ]);
        }

        DB::transaction(function () use ($devolucao) {
            $cd = $devolucao->destino ?: $this->usuarioDoCd();

            if (! $cd) {
                throw ValidationException::withMessages([
                    'geral' => 'Nenhum usuário de CD cadastrado para receber a devolução.',
                ]);
            }

            $loja = $devolucao->loja;

            /*
             * Loja do interior separa e espera o CD montar rota; loja da capital
             * fica pronta para coleta direta. Regra da operação, copiada de
             * PedidoController::marcarSeparado para que os dois caminhos
             * produzam o mesmo estado.
             */
            $statusFluxo = $loja->is_interior ? 'aguardando_rota' : 'aguardando_coleta';

            $itensJson = $devolucao->itens->map(fn (DevolucaoItem $i) => [
                'modelo'     => $i->modelo,
                'cor'        => $i->cor,
                'chassi'     => $i->chassi,
                'motivo'     => 'Devolução ao CD',
                'local'      => 'CD',
                'quantidade' => 1,
            ])->all();

            $pedido = Pedido::create([
                'user_id'        => $cd->id,          // quem recebe
                'origem_user_id' => $devolucao->user_id, // quem envia
                'status'         => $statusFluxo,
                'tipo_carga'     => 'moto',
                'observacao'     => "Devolução #{$devolucao->id} — {$devolucao->motivoRotulo()}."
                    . ($devolucao->observacao ? " {$devolucao->observacao}" : ''),
                'itens'          => $itensJson,
            ]);

            $vinculos = [];

            foreach ($devolucao->itens as $item) {
                $cota = PedidoItem::create([
                    'pedido_id'     => $pedido->id,
                    'tipo'          => 'moto',
                    'modelo'        => $item->modelo,
                    'cor'           => $item->cor,
                    'motivo'        => 'Devolução ao CD',
                    'local'         => 'CD',
                    'quantidade'    => 1,
                    'qtd_atribuida' => 1, // o chassi já é conhecido: nada a atribuir
                    'exige_chassi'  => true,
                ]);

                $vinculos[$item->moto_id] = [
                    'destino'        => 'CD',
                    'motivo'         => 'Devolução ao CD',
                    'pedido_item_id' => $cota->id,
                ];
            }

            $pedido->motos()->attach($vinculos);

            /*
             * A moto continua fisicamente na loja — `loja_atual_id` não muda.
             * O que muda é que ela agora está comprometida com uma coleta.
             */
            Moto::whereIn('id', array_keys($vinculos))->update([
                'status'            => $statusFluxo,
                'localizacao_atual' => "Estoque Loja: {$loja->filial} (devolução #{$devolucao->id})",
            ]);

            $devolucao->update([
                'status'          => Devolucao::STATUS_APROVADA,
                'pedido_id'       => $pedido->id,
                'destino_user_id' => $cd->id,
                'aprovado_por'    => Auth::id(),
                'aprovado_em'     => now(),
            ]);

            PedidoLog::create([
                'pedido_id' => $pedido->id,
                'titulo'    => 'Devolução aprovada ✅',
                'descricao' => "Devolução #{$devolucao->id} autorizada por " . Auth::user()->name
                    . ". {$devolucao->totalMotos()} moto(s) da loja {$loja->filial} liberadas para coleta. "
                    . "Motivo: {$devolucao->motivoRotulo()}.",
            ]);
        });

        $devolucao->refresh();

        $this->notificar(
            User::where('perfil', 'cd')->get(),
            'Coleta de devolução 🚚',
            "Loja {$devolucao->loja->filial} teve a devolução #{$devolucao->id} aprovada. Agende a coleta.",
            route('romaneios.create')
        );

        $this->notificar(
            $devolucao->loja,
            'Devolução aprovada ✅',
            "Sua devolução #{$devolucao->id} foi autorizada. Aguarde a coleta do CD.",
            route('devolucoes.show', $devolucao->id)
        );

        return back()->with('success', "Devolução aprovada. Pedido de coleta #{$devolucao->pedido_id} criado.");
    }

    public function recusar(Request $request, Devolucao $devolucao)
    {
        $dados = $request->validate([
            'motivo' => ['required', 'string', 'min:5', 'max:500'],
        ], [
            'motivo.required' => 'Diga por que a devolução foi negada — a loja precisa saber o que fazer com a moto.',
        ]);

        if ($devolucao->status !== Devolucao::STATUS_AGUARDANDO) {
            return back()->withErrors(['geral' => 'Esta devolução não está aguardando aprovação.']);
        }

        $devolucao->update([
            'status'        => Devolucao::STATUS_RECUSADA,
            'recusa_motivo' => $dados['motivo'],
            'aprovado_por'  => Auth::id(),
            'aprovado_em'   => now(),
        ]);

        $this->notificar(
            $devolucao->loja,
            'Devolução negada ❌',
            "A devolução #{$devolucao->id} foi negada: {$dados['motivo']}",
            route('devolucoes.show', $devolucao->id)
        );

        return back()->with('success', 'Devolução negada e a loja foi avisada.');
    }

    public function cancelar(Devolucao $devolucao)
    {
        $this->autorizarLoja($devolucao);

        if (! in_array($devolucao->status, [Devolucao::STATUS_RASCUNHO, Devolucao::STATUS_AGUARDANDO], true)) {
            return back()->withErrors([
                'geral' => 'Só dá para cancelar antes da aprovação. Depois disso a moto já está comprometida com uma coleta.',
            ]);
        }

        $devolucao->update(['status' => Devolucao::STATUS_CANCELADA]);

        return redirect()
            ->route('devolucoes.index')
            ->with('success', "Devolução #{$devolucao->id} cancelada.");
    }

    // ==================================================================
    // PORTÃO 3 — O CD RECEBE
    // ==================================================================

    /**
     * Fecha a devolução: a moto volta ao pátio do CD com o veredito do destino.
     *
     * Só passa com o checklist de destino assinado em TODAS as motos. É o ponto
     * do fluxo em que o dinheiro muda de lado — uma moto que chega avariada e é
     * lançada como estoque bom vira prejuízo silencioso.
     */
    public function receber(Request $request, Devolucao $devolucao)
    {
        if (! $devolucao->emTransporte()) {
            return back()->withErrors([
                'geral' => 'Só uma devolução aprovada e em trânsito pode ser recebida. Esta está como: ' . $devolucao->status,
            ]);
        }

        $dados = $request->validate([
            'chegada_em'           => ['nullable', 'date'],
            'entregador_nome'      => ['nullable', 'string', 'max:120'],
            'entregador_resultado' => ['nullable', Rule::in(ChecklistMoto::RESULTADOS)],
        ]);

        $devolucao->load(['itens.anexos', 'itens.moto', 'pedido', 'loja']);

        $pendencias = [];

        foreach ($devolucao->itens as $item) {
            foreach ($item->pendenciasDaEtapa(ChecklistMoto::ETAPA_DESTINO) as $pendencia) {
                $pendencias[] = "Moto {$item->chassi}: {$pendencia}";
            }
        }

        if ($pendencias !== []) {
            throw ValidationException::withMessages([
                'geral' => "CHECKLIST DE DESTINO INCOMPLETO: a devolução não fecha sem a conferência do CD.\n"
                    . '• ' . implode("\n• ", $pendencias),
            ]);
        }

        $retidas = DB::transaction(function () use ($devolucao, $dados) {
            $retidas = 0;

            foreach ($devolucao->itens as $item) {
                $novoStatus = $item->statusMotoNoRetorno();
                $avaria     = $item->naoConformes(ChecklistMoto::ETAPA_DESTINO);

                if ($novoStatus === 'avariado') {
                    $retidas++;
                }

                $descricaoAvaria = $avaria === []
                    ? null
                    : implode('; ', $avaria) . '. ' . trim((string) $item->observacao_destino);

                $foto = $item->anexosDaEtapa(ChecklistMoto::ETAPA_DESTINO)->first()?->url;

                $item->moto?->update([
                    'status'            => $novoStatus,
                    'loja_atual_id'     => null, // voltou ao pátio do CD
                    'localizacao_atual' => "Estoque CD (devolução #{$devolucao->id})",
                    'detalhes_avaria'   => $descricaoAvaria,
                    'foto_avaria'       => $foto,
                ]);

                // Espelha a avaria na pivot do pedido, como faz o recebimento de
                // moto na loja: é dali que a Timeline do chassi lê o histórico.
                if ($devolucao->pedido && $descricaoAvaria) {
                    $devolucao->pedido->motos()->updateExistingPivot($item->moto_id, [
                        'detalhes_avaria' => $descricaoAvaria,
                        'foto_avaria'     => $foto,
                    ]);
                }
            }

            if ($devolucao->pedido) {
                $devolucao->pedido->update(['status' => 'concluido']);

                PedidoLog::create([
                    'pedido_id' => $devolucao->pedido->id,
                    'titulo'    => 'Devolução recebida no CD 🏁',
                    'descricao' => "Devolução #{$devolucao->id} conferida por " . Auth::user()->name
                        . ". {$devolucao->totalMotos()} moto(s) de volta ao pátio"
                        . ($retidas ? ", {$retidas} retida(s) por não conformidade." : ' sem retenções.'),
                ]);

                $devolucao->pedido->romaneio?->fecharSeTudoEntregue();
            }

            $devolucao->update([
                'status'               => Devolucao::STATUS_RECEBIDA,
                'recebido_por'         => Auth::id(),
                'recebido_em'          => now(),
                'chegada_em'           => $dados['chegada_em'] ?? now(),
                'entregador_nome'      => $dados['entregador_nome'] ?? $devolucao->entregador_nome,
                'entregador_resultado' => $dados['entregador_resultado'] ?? $devolucao->entregador_resultado,
                'entregador_assinado_em' => ($dados['entregador_nome'] ?? null) ? now() : $devolucao->entregador_assinado_em,
            ]);

            return $retidas;
        });

        $this->notificar(
            $devolucao->loja,
            'Devolução recebida 🏁',
            "O CD recebeu sua devolução #{$devolucao->id}."
                . ($retidas ? " {$retidas} moto(s) foram retidas por não conformidade." : ''),
            route('devolucoes.show', $devolucao->id)
        );

        return back()->with(
            'success',
            $retidas
                ? "Devolução fechada. {$retidas} moto(s) retida(s) como avariada(s) no CD."
                : 'Devolução fechada. Motos de volta ao estoque do CD.'
        );
    }

    // ==================================================================
    // INTERNOS
    // ==================================================================

    /**
     * Motos que a loja pode devolver agora.
     *
     * Três filtros, cada um evitando um problema concreto:
     *   - está no pátio dela e num status devolvível;
     *   - não está presa a outro pedido ativo (senão duas cargas disputam o
     *     mesmo chassi — a TRAVA 1 de AtribuicaoChassiService);
     *   - não está em outra devolução ainda aberta (o mesmo problema, do lado
     *     de cá).
     *
     * @param  int|null  $lojaId  null = todas as lojas (visão do admin)
     */
    private function motosElegiveis(?int $lojaId)
    {
        $emOutraDevolucao = DevolucaoItem::query()
            ->select('moto_id')
            ->whereHas('devolucao', fn ($q) => $q->whereNotIn('status', Devolucao::STATUS_ENCERRADOS));

        return Moto::query()
            ->whereNotNull('loja_atual_id')
            ->when($lojaId, fn ($q) => $q->where('loja_atual_id', $lojaId))
            ->whereIn('status', self::STATUS_MOTO_DEVOLVIVEL)
            ->whereDoesntHave('pedidos', fn ($q) => $q->whereNotIn('pedidos.status', ['concluido', 'cancelado', 'rejeitado']))
            ->whereNotIn('id', $emOutraDevolucao)
            ->with('loja:id,name,filial')
            ->orderBy('modelo')
            ->get(['id', 'chassi', 'modelo', 'cor', 'ano_fabricacao', 'status', 'loja_atual_id'])
            ->map(function (Moto $moto) {
                $moto->loja_nome = $moto->loja?->filial ?? $moto->loja?->name ?? '—';

                return $moto;
            });
    }

    private function motoPresaEmPedido(int $motoId): bool
    {
        return Moto::where('id', $motoId)
            ->whereHas('pedidos', fn ($q) => $q->whereNotIn('pedidos.status', ['concluido', 'cancelado', 'rejeitado']))
            ->exists();
    }

    /** O usuário que representa o CD. Preferimos o perfil dedicado ao admin. */
    private function usuarioDoCd(): ?User
    {
        return User::where('perfil', 'cd')->orderBy('id')->first()
            ?: User::where('perfil', 'admin')->orderBy('id')->first();
    }

    private function autorizarVer(Devolucao $devolucao): void
    {
        $user = Auth::user();

        if (in_array($user->perfil, ['cd', 'admin', 'gestor'], true)) {
            return;
        }

        if ($devolucao->user_id !== $user->id) {
            abort(403, 'Esta devolução não é da sua loja.');
        }
    }

    private function autorizarLoja(Devolucao $devolucao): void
    {
        $user = Auth::user();

        if ($user->perfil === 'admin') {
            return;
        }

        if ($devolucao->user_id !== $user->id) {
            abort(403, 'Só a loja que abriu a devolução pode alterá-la.');
        }
    }

    /**
     * Quem pode escrever em cada ponta — e quando.
     *
     * A separação é o ponto do desenho: o valor do documento vem de as duas
     * conferências serem feitas por lados opostos da entrega. Deixar o CD
     * preencher o checklist de origem, ou a loja o de destino, transformaria o
     * dossiê numa formalidade.
     */
    private function autorizarEtapa(Devolucao $devolucao, string $etapa): void
    {
        $user = Auth::user();

        if ($etapa === ChecklistMoto::ETAPA_DESTINO) {
            if (! in_array($user->perfil, ['cd', 'admin'], true)) {
                abort(403, 'A conferência de destino é do CD, que é quem recebe a moto.');
            }

            if (! $devolucao->emTransporte()) {
                throw ValidationException::withMessages([
                    'geral' => 'A conferência de destino só é possível depois da aprovação, quando a moto está a caminho.',
                ]);
            }

            return;
        }

        $this->autorizarLoja($devolucao);

        if (! $devolucao->podeEditar()) {
            throw ValidationException::withMessages([
                'geral' => 'A conferência de origem já foi encerrada: esta devolução saiu do rascunho.',
            ]);
        }
    }

    private function garantirItemDaDevolucao(Devolucao $devolucao, DevolucaoItem $item): void
    {
        if ($item->devolucao_id !== $devolucao->id) {
            abort(404);
        }
    }

    /** Registra no histórico do pedido de frete, quando ele já existe. */
    private function registrarNoPedido(Devolucao $devolucao, string $titulo, string $descricao): void
    {
        if (! $devolucao->pedido_id) {
            return;
        }

        PedidoLog::create([
            'pedido_id' => $devolucao->pedido_id,
            'titulo'    => $titulo,
            'descricao' => $descricao . ' (Por: ' . (Auth::user()->name ?? 'Sistema') . ')',
        ]);
    }

    /**
     * Sininho + push. Espelha PedidoController::enviarNotificacao: `defer` para
     * que a latência do OneSignal não entre no tempo de resposta do galpão.
     */
    private function notificar($usuarios, string $titulo, string $mensagem, string $link): void
    {
        \Illuminate\Support\defer(function () use ($usuarios, $titulo, $mensagem, $link) {
            $usuarios = is_iterable($usuarios) ? $usuarios : collect([$usuarios]);

            foreach ($usuarios as $user) {
                if ($user) {
                    $user->notify(new PedidoAtualizado($titulo, $mensagem, $link));
                }
            }

            $ids = collect($usuarios)->pluck('onesignal_id')->filter()->all();

            if ($ids !== []) {
                try {
                    (new OneSignalService())->sendToUser($ids, $titulo, $mensagem, $link);
                } catch (\Throwable $e) {
                    Log::warning('OneSignal (devolução): ' . $e->getMessage());
                }
            }
        });
    }

    // --- SERIALIZAÇÃO ---

    private function resumir(Devolucao $devolucao): array
    {
        return [
            'id'         => $devolucao->id,
            'status'     => $devolucao->status,
            'motivo'     => $devolucao->motivoRotulo(),
            'loja'       => $devolucao->loja?->filial ?? $devolucao->loja?->name ?? '—',
            'destino'    => $devolucao->destino?->filial ?? 'CD',
            'qtd_motos'  => $devolucao->itens->count(),
            'chassis'    => $devolucao->itens->pluck('chassi')->all(),
            'pedido_id'  => $devolucao->pedido_id,
            'pedido_status' => $devolucao->pedido?->status,
            'criada_em'  => $devolucao->created_at,
            // Quantas motos o destino já retirou de circulação por avaria.
            'retidas'    => $devolucao->itens
                ->where('destino_resultado', ChecklistMoto::RESULTADO_NAO_CONFORME)
                ->count(),
        ];
    }

    private function detalhar(Devolucao $devolucao): array
    {
        return [
            'id'             => $devolucao->id,
            'status'         => $devolucao->status,
            'motivo'         => $devolucao->motivo,
            'motivo_rotulo'  => $devolucao->motivoRotulo(),
            'observacao'     => $devolucao->observacao,
            'loja'           => $devolucao->loja?->filial ?? $devolucao->loja?->name ?? '—',
            'destino'        => $devolucao->destino?->filial ?? $devolucao->destino?->name ?? 'CD',
            'nf_numero'      => $devolucao->nf_numero,
            'transportadora' => $devolucao->transportadora,
            'placa'          => $devolucao->placa,
            'lacre'          => $devolucao->lacre,
            'saida_em'       => $devolucao->saida_em,
            'chegada_em'     => $devolucao->chegada_em,
            'entregador_nome'      => $devolucao->entregador_nome,
            'entregador_resultado' => $devolucao->entregador_resultado,
            'pedido_id'      => $devolucao->pedido_id,
            'pedido_status'  => $devolucao->pedido?->status,
            'romaneio_id'    => $devolucao->pedido?->romaneio_id,
            'aprovado_por'   => $devolucao->aprovadoPor?->name,
            'aprovado_em'    => $devolucao->aprovado_em,
            'recusa_motivo'  => $devolucao->recusa_motivo,
            'recebido_por'   => $devolucao->recebidoPor?->name,
            'recebido_em'    => $devolucao->recebido_em,
            'criada_em'      => $devolucao->created_at,
            'anexos_gerais'  => $devolucao->anexos
                ->whereNull('devolucao_item_id')
                ->map(fn (DevolucaoAnexo $a) => $this->serializarAnexo($a))
                ->values(),
            'itens' => $devolucao->itens->map(fn (DevolucaoItem $item) => [
                'id'           => $item->id,
                'moto_id'      => $item->moto_id,
                'chassi'       => $item->chassi,
                'modelo'       => $item->modelo,
                'cor'          => $item->cor,
                'ano_modelo'   => $item->ano_modelo,
                'numero_motor' => $item->numero_motor,
                'moto_status'  => $item->moto?->status,
                'origem' => [
                    'respostas'   => $item->checklist(ChecklistMoto::ETAPA_ORIGEM),
                    'resultado'   => $item->origem_resultado,
                    'responsavel' => $item->origem_responsavel,
                    'matricula'   => $item->origem_matricula,
                    'assinado_em' => $item->origem_assinado_em,
                    'observacao'  => $item->observacao_origem,
                    'nao_conformes' => array_values($item->naoConformes(ChecklistMoto::ETAPA_ORIGEM)),
                    'anexos'      => $item->anexosDaEtapa(ChecklistMoto::ETAPA_ORIGEM)
                        ->map(fn (DevolucaoAnexo $a) => $this->serializarAnexo($a))
                        ->values(),
                    'pendencias'  => $item->pendenciasDaEtapa(ChecklistMoto::ETAPA_ORIGEM),
                ],
                'destino' => [
                    'respostas'   => $item->checklist(ChecklistMoto::ETAPA_DESTINO),
                    'resultado'   => $item->destino_resultado,
                    'responsavel' => $item->destino_responsavel,
                    'matricula'   => $item->destino_matricula,
                    'assinado_em' => $item->destino_assinado_em,
                    'observacao'  => $item->observacao_destino,
                    'nao_conformes' => array_values($item->naoConformes(ChecklistMoto::ETAPA_DESTINO)),
                    'anexos'      => $item->anexosDaEtapa(ChecklistMoto::ETAPA_DESTINO)
                        ->map(fn (DevolucaoAnexo $a) => $this->serializarAnexo($a))
                        ->values(),
                    'pendencias'  => $item->pendenciasDaEtapa(ChecklistMoto::ETAPA_DESTINO),
                ],
            ])->values(),
        ];
    }

    private function serializarAnexo(DevolucaoAnexo $anexo): array
    {
        return [
            'id'        => $anexo->id,
            'url'       => $anexo->url,
            'nome'      => $anexo->nome_original,
            'descricao' => $anexo->descricao,
            'etapa'     => $anexo->etapa,
            'autor'     => $anexo->enviadoPor?->name,
            'em'        => $anexo->created_at,
        ];
    }
}
