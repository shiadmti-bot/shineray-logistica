<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

/**
 * Cota de um pedido: "5x NEW JEF VERMELHA para a Loja Ananindeua".
 *
 * Existe apenas para pedidos criados a partir da v2.6. Pedidos legados não
 * possuem linhas aqui e são tratados como 100% atribuídos.
 */
class PedidoItem extends Model
{
    use HasFactory;

    protected $table = 'pedido_itens';

    protected $fillable = [
        'pedido_id',
        'tipo',     // v3: moto | peca
        'peca_id',  // v3: preenchido apenas quando tipo = 'peca'
        'modelo',
        'cor',
        'motivo',
        'local',
        'quantidade',
        'qtd_atribuida',
        'qtd_cancelada',
        'motivo_cancelamento',
        'cancelado_por',
        'cancelado_em',
        'exige_chassi',
    ];

    protected $casts = [
        'quantidade'    => 'integer',
        'qtd_atribuida' => 'integer',
        'qtd_cancelada' => 'integer',
        'exige_chassi'  => 'boolean',
        'cancelado_em'  => 'datetime',
    ];

    protected $appends = ['qtd_pendente'];

    public function pedido()
    {
        return $this->belongsTo(Pedido::class);
    }

    /** Peça solicitada. NULL quando a cota é de moto. */
    public function peca()
    {
        return $this->belongsTo(Peca::class);
    }

    public function isPeca(): bool
    {
        return $this->tipo === 'peca';
    }

    public function isMoto(): bool
    {
        return $this->tipo !== 'peca';
    }

    /**
     * Rótulo do que foi pedido, independente do tipo.
     * Evita espalhar `if (tipo === peca)` por controllers e views.
     */
    public function getDescricaoAttribute(): string
    {
        if ($this->isPeca()) {
            return $this->peca
                ? "{$this->peca->codigo} — {$this->peca->descricao}"
                : 'Peça não identificada';
        }

        return trim("{$this->modelo} {$this->cor}");
    }

    /**
     * Motos (chassis) já vinculadas a esta cota.
     */
    public function motos()
    {
        return $this->belongsToMany(Moto::class, 'pedido_moto', 'pedido_item_id', 'moto_id')
                    ->withPivot(['destino', 'motivo'])
                    ->withTimestamps();
    }

    public function canceladoPor()
    {
        return $this->belongsTo(User::class, 'cancelado_por');
    }

    /**
     * Quantos chassis o CD ainda precisa bipar para esta cota.
     */
    public function getQtdPendenteAttribute(): int
    {
        return max(0, $this->quantidade - $this->qtd_atribuida - $this->qtd_cancelada);
    }

    public function scopePendentes($query)
    {
        return $query->whereRaw('quantidade > (qtd_atribuida + qtd_cancelada)');
    }
}
