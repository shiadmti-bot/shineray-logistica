<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\DB;

/**
 * O caixote reservado a uma filial no galpão do CD.
 *
 * Acumula peças separadas ao longo de dias e é esvaziado inteiro quando o CD
 * monta a carga daquela filial. Uma basqueta reúne itens de VÁRIOS pedidos —
 * é por isso que faturamento, conferência e despacho são atributos dela, e não
 * do pedido.
 *
 * A basqueta não guarda quantidade própria: ela referencia cotas
 * (pedido_itens.basqueta_id), e a verdade sobre saldo continua sendo o ledger
 * em peca_movimentos. Duplicar quantidade aqui criaria um segundo estoque para
 * divergir do primeiro.
 */
class Basqueta extends Model
{
    use HasFactory;

    protected $table = 'basquetas';

    protected $fillable = [
        'estoque_local_id',
        'status',
        'local_aberto_id',
        'schedule_id',
        'romaneio_id',
        'volumes',
        'romaneio_versao',
        'esvaziada_em',
        'conferida_em',
        'conferida_por',
        'foto_romaneio_url',
        'conferencia_observacao',
        'ajuste_motivo',
    ];

    protected $casts = [
        'volumes'         => 'integer',
        'romaneio_versao' => 'integer',
        'esvaziada_em'    => 'datetime',
        'conferida_em'    => 'datetime',
    ];

    public const STATUS_ABERTA           = 'aberta';
    public const STATUS_ROTA_CONFIRMADA  = 'rota_confirmada';
    public const STATUS_FATURADA         = 'faturada';
    public const STATUS_EM_CONFERENCIA   = 'em_conferencia';
    public const STATUS_AJUSTE           = 'ajuste_solicitado';
    public const STATUS_LIBERADA         = 'liberada';
    public const STATUS_DESPACHADA       = 'despachada';

    /**
     * Estados em que a basqueta ainda aceita peças novas.
     *
     * `ajuste_solicitado` está aqui de propósito: é exatamente o Passo 7 do
     * manual — a filial acusou falta, a caixa foi reaberta e o estoque precisa
     * poder inserir o item que faltava.
     */
    public const ABERTAS = [
        self::STATUS_ABERTA,
        self::STATUS_ROTA_CONFIRMADA,
        self::STATUS_AJUSTE,
    ];

    // --- RELACIONAMENTOS ---

    public function local()
    {
        return $this->belongsTo(EstoqueLocal::class, 'estoque_local_id');
    }

    /** Cotas depositadas nesta basqueta. */
    public function itens()
    {
        return $this->hasMany(PedidoItem::class);
    }

    /** Viagem do Calendário que vai levar esta caixa. */
    public function viagem()
    {
        return $this->belongsTo(Schedule::class, 'schedule_id');
    }

    public function romaneio()
    {
        return $this->belongsTo(Romaneio::class);
    }

    public function conferidaPor()
    {
        return $this->belongsTo(User::class, 'conferida_por');
    }

    /** Todas as notas já emitidas — inclusive as canceladas. */
    public function notas()
    {
        return $this->hasMany(BasquetaNota::class)->latest('emitida_em');
    }

    /** A nota que está valendo. NULL antes de faturar. */
    public function notaVigente(): ?BasquetaNota
    {
        return $this->notas()->vigentes()->first();
    }

    /**
     * Valor da caixa somando o preço combinado em cada cota.
     *
     * Usa preco_unitario do item, não o preço de catálogo: o que vale é o
     * valor informado à filial no atendimento e aprovado no Gate 1.
     * Cota sem preço entra como zero — some do total, mas não trava o
     * faturamento, que é feito com o número da nota real do Microwork.
     */
    public function valorEstimado(): float
    {
        return (float) $this->itens()
            ->selectRaw('COALESCE(SUM(COALESCE(preco_unitario, 0) * qtd_atribuida), 0) as total')
            ->value('total');
    }

    // --- COMPORTAMENTO ---

    public function estaAberta(): bool
    {
        return in_array($this->status, self::ABERTAS, true);
    }

    /**
     * A basqueta aberta da filial, criando-a se ainda não existir.
     *
     * TRAVA DE CORRIDA
     * Duas separações simultâneas para a mesma filial poderiam ler "não existe"
     * ao mesmo tempo e criar duas basquetas abertas. O índice UNIQUE em
     * local_aberto_id impede a segunda de gravar; o retry relê a que venceu.
     *
     * Chamar sempre dentro de uma transação — o retry depende disso para não
     * deixar meia separação registrada.
     */
    public static function abertaPara(int $estoqueLocalId): self
    {
        $existente = static::where('local_aberto_id', $estoqueLocalId)->lockForUpdate()->first();

        if ($existente) {
            return $existente;
        }

        try {
            return static::create([
                'estoque_local_id' => $estoqueLocalId,
                'local_aberto_id'  => $estoqueLocalId,
                'status'           => self::STATUS_ABERTA,
            ]);
        } catch (\Illuminate\Database\UniqueConstraintViolationException $e) {
            // Outra requisição criou primeiro. A dela é a válida.
            return static::where('local_aberto_id', $estoqueLocalId)->firstOrFail();
        }
    }

    /**
     * Fecha a basqueta para novas peças.
     *
     * Zerar local_aberto_id é o que libera a filial para abrir a próxima —
     * e o que impede esta de continuar recebendo item depois de faturada.
     */
    public function fechar(string $novoStatus): void
    {
        $this->update([
            'status'          => $novoStatus,
            'local_aberto_id' => null,
            'esvaziada_em'    => $this->esvaziada_em ?? now(),
        ]);
    }

    /**
     * Reabre a caixa depois de uma recusa na conferência (Passo 7).
     *
     * Devolver local_aberto_id é o que permite ao estoque separar o item que
     * faltava para DENTRO desta caixa, em vez de abrir uma segunda para a mesma
     * filial. Só é possível porque a filial não tem outra aberta: esta nunca
     * deixou de ser a caixa dela — foi fechada para faturar e volta ao mesmo
     * lugar.
     *
     * A conferência anterior é apagada de propósito: o conteúdo mudou, então a
     * assinatura que valia para o conteúdo antigo não vale mais.
     */
    public function reabrirParaAjuste(string $motivo): void
    {
        $this->update([
            'status'                 => self::STATUS_AJUSTE,
            'local_aberto_id'        => $this->estoque_local_id,
            'ajuste_motivo'          => $motivo,
            'conferida_em'           => null,
            'conferida_por'          => null,
            'foto_romaneio_url'      => null,
            'conferencia_observacao' => null,
        ]);
    }

    /** Unidades efetivamente separadas dentro da caixa. */
    public function totalUnidades(): int
    {
        return (int) $this->itens()->sum('qtd_atribuida');
    }

    /**
     * Há quantos dias a peça mais antiga está esperando.
     *
     * É o número que denuncia filial sem rota marcada: peça parada em basqueta
     * é saldo reservado que ninguém consegue usar.
     */
    public function diasEmEspera(): int
    {
        $maisAntiga = $this->itens()->min('pedido_itens.updated_at');

        return $maisAntiga ? (int) now()->diffInDays($maisAntiga) : 0;
    }

    public function scopeAbertas($query)
    {
        return $query->whereIn('status', self::ABERTAS);
    }

    /**
     * Basquetas das lojas paradas numa viagem do Calendário.
     *
     * A ponte entre os dois mundos: schedule_stops aponta para users, e a
     * basqueta vive em estoque_locais. users.estoque_local_id liga os dois.
     */
    public static function dasParadasDaViagem(Schedule $viagem)
    {
        $locais = DB::table('schedule_stops')
            ->join('users', 'users.id', '=', 'schedule_stops.user_id')
            ->where('schedule_stops.schedule_id', $viagem->id)
            ->whereNotNull('users.estoque_local_id')
            ->pluck('users.estoque_local_id');

        return static::abertas()->whereIn('estoque_local_id', $locais)->get();
    }
}
