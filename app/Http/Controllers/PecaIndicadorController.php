<?php

namespace App\Http\Controllers;

use App\Models\Basqueta;
use App\Models\BasquetaNota;
use App\Models\Peca;
use App\Models\PedidoItem;
use App\Models\RomaneioItem;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Inertia\Inertia;

/**
 * FASE 5 — OS NÚMEROS QUE PROVAM A REGRA.
 *
 * O manual afirma que a dupla confirmação "reduz a zero os índices de envio
 * incorreto". Isso era uma afirmação sem medida: não havia como saber se o
 * processo funcionava, nem onde ele travava.
 *
 * Cada indicador aqui existe para responder uma pergunta operacional concreta:
 *
 *   Call Center     -> quanto tempo a filial espera por um código?
 *   Liberação       -> a assinatura do Pós-Venda é gargalo?
 *   Basqueta        -> quanto tempo o saldo fica reservado sem sair?
 *   Aderência       -> a caixa sai na viagem que foi marcada para ela?
 *   Ajustes         -> quantos erros o Gate 2 pegou na doca?
 *
 * O ÚLTIMO É O QUE IMPORTA MAIS
 * Cada ajuste pedido na conferência é uma viagem que NÃO foi desperdiçada —
 * um erro pego com a caixa aberta ao lado, em vez de na filial, dias depois.
 * Comparado às divergências de recebimento, mostra se a defesa mudou de lugar.
 */
class PecaIndicadorController extends Controller
{
    private const PERIODOS = [30, 90, 365];

    public function index(Request $request)
    {
        $this->autorizar();

        $dias = in_array((int) $request->input('dias'), self::PERIODOS, true)
            ? (int) $request->input('dias')
            : 90;

        $desde = Carbon::now()->subDays($dias)->startOfDay();

        return Inertia::render('Pecas/Indicadores', [
            'periodo'    => ['dias' => $dias, 'opcoes' => self::PERIODOS],
            'atendimento'=> $this->atendimento($desde),
            'basquetas'  => $this->basquetas($desde),
            'qualidade'  => $this->qualidade($desde),
            'porFilial'  => $this->porFilial($desde),
        ]);
    }

    /**
     * Passos 2 e 3: quanto tempo entre pedir e ter o código, e entre ter o
     * código e a assinatura.
     */
    private function atendimento(Carbon $desde): array
    {
        $base = PedidoItem::where('pedido_itens.tipo', 'peca')
            ->join('pedidos', 'pedidos.id', '=', 'pedido_itens.pedido_id')
            ->where('pedidos.created_at', '>=', $desde);

        $tempos = (clone $base)
            ->whereNotNull('pedido_itens.identificado_em')
            ->selectRaw('
                AVG(TIMESTAMPDIFF(HOUR, pedidos.created_at, pedido_itens.identificado_em)) as ate_codigo,
                AVG(TIMESTAMPDIFF(HOUR, pedido_itens.identificado_em, pedido_itens.confirmado_em)) as ate_liberacao,
                COUNT(*) as identificados
            ')
            ->first();

        // Filas de agora — não do período. "Quanto tem parado neste instante"
        // é outra pergunta, e é a que faz alguém agir hoje.
        $semCodigo = PedidoItem::aguardandoIdentificacao()->count();
        $semLiberacao = PedidoItem::aguardandoLiberacao()->count();

        $semCodigoTexto = (clone $base)
            ->whereNull('pedido_itens.peca_id')
            ->whereNotNull('pedido_itens.descricao_solicitada')
            ->count();

        $totalCotas = (clone $base)->count();

        return [
            'horas_ate_codigo'    => $this->arredondar($tempos->ate_codigo ?? null),
            'horas_ate_liberacao' => $this->arredondar($tempos->ate_liberacao ?? null),
            'fila_sem_codigo'     => $semCodigo,
            'fila_sem_liberacao'  => $semLiberacao,
            // Quanto do volume chegou sem código: mede o peso real do caso que
            // o manual descreve e que antes vivia fora do sistema.
            'pct_sem_codigo'      => $totalCotas > 0
                ? round($semCodigoTexto * 100 / $totalCotas)
                : null,
            'cotas_periodo'       => $totalCotas,
        ];
    }

    /** Passos 4 e 5: permanência na caixa e aderência à viagem marcada. */
    private function basquetas(Carbon $desde): array
    {
        $permanencia = Basqueta::whereNotNull('esvaziada_em')
            ->where('created_at', '>=', $desde)
            ->selectRaw('
                AVG(TIMESTAMPDIFF(HOUR, created_at, esvaziada_em)) / 24 as dias_medio,
                MAX(TIMESTAMPDIFF(HOUR, created_at, esvaziada_em)) / 24 as dias_maximo,
                COUNT(*) as total
            ')
            ->first();

        /*
         * Aderência: a caixa embarcou até a data da viagem que estava marcada
         * para ela? Compara a criação da carga com schedules.date — a data
         * nunca foi copiada para a basqueta, justamente para não divergir.
         */
        $comViagem = Basqueta::whereNotNull('romaneio_id')
            ->whereNotNull('schedule_id')
            ->where('basquetas.created_at', '>=', $desde)
            ->join('romaneios', 'romaneios.id', '=', 'basquetas.romaneio_id')
            ->join('schedules', 'schedules.id', '=', 'basquetas.schedule_id')
            ->selectRaw('
                COUNT(*) as total,
                SUM(CASE WHEN DATE(romaneios.created_at) <= schedules.date THEN 1 ELSE 0 END) as no_prazo
            ')
            ->first();

        $abertas = Basqueta::abertas()->get();

        return [
            'dias_medio'    => $this->arredondar($permanencia->dias_medio ?? null, 1),
            'dias_maximo'   => $this->arredondar($permanencia->dias_maximo ?? null, 1),
            'esvaziadas'    => (int) ($permanencia->total ?? 0),
            'aderencia_pct' => ($comViagem->total ?? 0) > 0
                ? round($comViagem->no_prazo * 100 / $comViagem->total)
                : null,
            'aderencia_base'=> (int) ($comViagem->total ?? 0),
            // Caixas abertas sem viagem marcada: saldo reservado sem data para
            // sair. É o número que o CD resolve marcando rota no Calendário.
            'sem_viagem'    => $abertas->whereNull('schedule_id')->count(),
            'abertas'       => $abertas->count(),
        ];
    }

    /**
     * A promessa do manual, medida.
     *
     * Ajuste no Gate 2  = erro pego na doca, viagem economizada.
     * Divergência no recebimento = erro que escapou e custou uma viagem.
     *
     * A leitura que interessa é a razão entre os dois ao longo do tempo: se a
     * dupla confirmação funciona, o primeiro sobe e o segundo cai.
     */
    private function qualidade(Carbon $desde): array
    {
        $conferidas = Basqueta::where('created_at', '>=', $desde)
            ->whereNotNull('conferida_em')
            ->count();

        // ajuste_motivo sobrevive ao ciclo: uma caixa que foi ajustada e depois
        // liberada continua contando como erro pego.
        $ajustadas = Basqueta::where('created_at', '>=', $desde)
            ->whereNotNull('ajuste_motivo')
            ->count();

        $notasCanceladas = BasquetaNota::where('emitida_em', '>=', $desde)
            ->whereNotNull('cancelada_em')
            ->count();

        $divergencias = RomaneioItem::pecas()
            ->where('created_at', '>=', $desde)
            ->where('status', RomaneioItem::STATUS_DIVERGENCIA)
            ->count();

        $recusasGate1 = PedidoItem::where('tipo', 'peca')
            ->where('updated_at', '>=', $desde)
            ->whereNotNull('recusa_motivo')
            ->count();

        return [
            'ajustes_gate2'    => $ajustadas,
            'conferidas'       => $conferidas,
            'taxa_ajuste_pct'  => $conferidas > 0 ? round($ajustadas * 100 / $conferidas) : null,
            'notas_canceladas' => $notasCanceladas,
            'divergencias'     => $divergencias,
            'recusas_gate1'    => $recusasGate1,
        ];
    }

    /** Onde o processo está travando — por filial. */
    private function porFilial(Carbon $desde): array
    {
        $linhas = DB::table('basquetas')
            ->join('estoque_locais', 'estoque_locais.id', '=', 'basquetas.estoque_local_id')
            ->where('basquetas.created_at', '>=', $desde)
            ->groupBy('estoque_locais.id', 'estoque_locais.nome')
            ->selectRaw('
                estoque_locais.nome as filial,
                COUNT(*) as caixas,
                AVG(TIMESTAMPDIFF(HOUR, basquetas.created_at, basquetas.esvaziada_em)) / 24 as dias_medio,
                SUM(CASE WHEN basquetas.ajuste_motivo IS NOT NULL THEN 1 ELSE 0 END) as ajustes
            ')
            ->orderByDesc('caixas')
            ->get();

        return $linhas->map(fn ($l) => [
            'filial'     => $l->filial,
            'caixas'     => (int) $l->caixas,
            'dias_medio' => $this->arredondar($l->dias_medio, 1),
            'ajustes'    => (int) $l->ajustes,
        ])->all();
    }

    /**
     * NULL não é zero.
     *
     * Sem nenhuma caixa esvaziada no período, "0 dias de permanência" seria uma
     * mentira otimista. NULL vira "sem dados" na tela.
     */
    private function arredondar($valor, int $casas = 0)
    {
        return $valor === null ? null : round((float) $valor, $casas);
    }

    private function autorizar(): void
    {
        if (! in_array(Auth::user()->perfil, ['admin', 'gestor', 'cd'], true)) {
            abort(403, 'Indicadores de peça são restritos à gestão e ao Estoque Central.');
        }
    }
}
