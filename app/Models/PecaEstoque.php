<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

/**
 * Saldo de uma peça em um local.
 *
 * IMPORTANTE: não escreva `saldo`/`saldo_reservado` diretamente. Toda alteração
 * deve passar por App\Services\Estoque\EstoquePecaService, que grava o
 * PecaMovimento correspondente na mesma transação. Sem isso o ledger deixa de
 * bater com o saldo e a auditoria de peça (que não tem chassi para rastrear)
 * fica impossível de reconstruir.
 */
class PecaEstoque extends Model
{
    use HasFactory;

    protected $table = 'peca_estoques';

    protected $fillable = [
        'peca_id',
        'local_id',
        'saldo',
        'saldo_reservado',
        'saldo_minimo',
        'contado_em',
    ];

    protected $casts = [
        'saldo'           => 'integer',
        'saldo_reservado' => 'integer',
        'saldo_minimo'    => 'integer',
        'contado_em'      => 'datetime',
    ];

    protected $appends = ['disponivel'];

    public function peca()
    {
        return $this->belongsTo(Peca::class);
    }

    public function local()
    {
        return $this->belongsTo(EstoqueLocal::class, 'local_id');
    }

    /**
     * O que pode efetivamente ser prometido a um novo pedido.
     * Sempre derivado — nunca persistido, para não haver duas verdades.
     */
    public function getDisponivelAttribute(): int
    {
        return max(0, $this->saldo - $this->saldo_reservado);
    }

    public function abaixoDoMinimo(): bool
    {
        return $this->saldo_minimo > 0 && $this->disponivel <= $this->saldo_minimo;
    }

    public function scopeComDisponivel($query)
    {
        return $query->whereRaw('saldo > saldo_reservado');
    }

    public function scopeAbaixoDoMinimo($query)
    {
        return $query->where('saldo_minimo', '>', 0)
                     ->whereRaw('(saldo - saldo_reservado) <= saldo_minimo');
    }
}
