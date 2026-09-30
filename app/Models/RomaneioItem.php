<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

/**
 * Um item dentro de uma carga: uma moto (quantidade 1) ou N unidades de uma peça.
 *
 * CONVIVÊNCIA COM O FLUXO ATUAL:
 * motos.romaneio_id continua sendo escrita e lida pelo código existente. Esta
 * tabela é populada em paralelo e é a fonte das telas novas. Enquanto as duas
 * existirem, quem move moto para uma carga precisa atualizar as duas — use
 * Romaneio::sincronizarItemMoto() em vez de escrever direto.
 */
class RomaneioItem extends Model
{
    use HasFactory;

    protected $table = 'romaneio_itens';

    protected $fillable = [
        'romaneio_id',
        'itemable_type',
        'itemable_id',
        'pedido_id',
        'pedido_item_id',
        'quantidade',
        'quantidade_recebida',
        'status',
        'local_destino_id',
        'observacao',
        'entregue_em',
        'resolvido_em',
        'resolvido_por',
        'resolucao',
        'resolucao_observacao',
    ];

    protected $casts = [
        'quantidade'          => 'integer',
        'quantidade_recebida' => 'integer',
        'entregue_em'         => 'datetime',
        'resolvido_em'        => 'datetime',
    ];

    public const RESOLUCAO_REENVIO       = 'reenvio';
    public const RESOLUCAO_PERDA         = 'perda';
    public const RESOLUCAO_ERRO_CONTAGEM = 'erro_contagem';
    public const RESOLUCAO_ACEITO        = 'aceito';

    public const STATUS_CARREGADO   = 'carregado';
    public const STATUS_EM_TRANSITO = 'em_transito';
    public const STATUS_ENTREGUE    = 'entregue';
    public const STATUS_DIVERGENCIA = 'divergencia';
    public const STATUS_RETORNADO   = 'retornado';

    /** Moto ou Peca. */
    public function itemable()
    {
        return $this->morphTo();
    }

    public function romaneio()
    {
        return $this->belongsTo(Romaneio::class);
    }

    public function pedido()
    {
        return $this->belongsTo(Pedido::class);
    }

    public function pedidoItem()
    {
        return $this->belongsTo(PedidoItem::class, 'pedido_item_id');
    }

    public function destino()
    {
        return $this->belongsTo(EstoqueLocal::class, 'local_destino_id');
    }

    public function isMoto(): bool
    {
        return $this->itemable_type === Moto::class;
    }

    public function isPeca(): bool
    {
        return $this->itemable_type === Peca::class;
    }

    /**
     * Recebeu menos (ou mais) do que foi carregado.
     * Só faz sentido depois da confirmação do destino.
     */
    public function temDivergencia(): bool
    {
        return $this->quantidade_recebida !== null
            && $this->quantidade_recebida !== $this->quantidade;
    }

    public function scopeMotos($query)
    {
        return $query->where('itemable_type', Moto::class);
    }

    public function scopePecas($query)
    {
        return $query->where('itemable_type', Peca::class);
    }

    public function scopePendentes($query)
    {
        return $query->whereIn('status', [self::STATUS_CARREGADO, self::STATUS_EM_TRANSITO]);
    }

    public function resolvidoPor()
    {
        return $this->belongsTo(User::class, 'resolvido_por');
    }

    /** Quantas unidades faltaram (ou sobraram) na conferência. */
    public function diferenca(): int
    {
        return (int) ($this->quantidade_recebida ?? $this->quantidade) - $this->quantidade;
    }

    /** Divergência que ainda espera decisão do CD. */
    public function scopeDivergenciasAbertas($query)
    {
        return $query->where('status', self::STATUS_DIVERGENCIA)
                     ->whereNull('resolvido_em');
    }
}
