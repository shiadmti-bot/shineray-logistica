<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

/**
 * Livro-razão de peças: uma linha por alteração de saldo.
 *
 * Imutável por natureza — corrigir um erro significa lançar um movimento de
 * 'ajuste' contrário, nunca editar ou apagar a linha original.
 */
class PecaMovimento extends Model
{
    use HasFactory;

    protected $table = 'peca_movimentos';

    protected $fillable = [
        'peca_id',
        'local_id',
        'tipo',
        'quantidade',
        'saldo_anterior',
        'saldo_posterior',
        'pedido_id',
        'pedido_item_id',
        'romaneio_id',
        'local_contraparte_id',
        'user_id',
        'observacao',
    ];

    protected $casts = [
        'quantidade'      => 'integer',
        'saldo_anterior'  => 'integer',
        'saldo_posterior' => 'integer',
    ];

    public const TIPO_ENTRADA       = 'entrada';
    public const TIPO_SAIDA         = 'saida';
    public const TIPO_RESERVA       = 'reserva';
    public const TIPO_LIBERACAO     = 'liberacao';
    public const TIPO_TRANSFERENCIA = 'transferencia';
    public const TIPO_AJUSTE        = 'ajuste';
    public const TIPO_SYNC          = 'sync';

    /**
     * Tipos que alteram saldo FÍSICO. Reserva e liberação mexem apenas em
     * saldo_reservado, por isso ficam de fora da conferência de saldo.
     */
    public const TIPOS_FISICOS = [
        self::TIPO_ENTRADA,
        self::TIPO_SAIDA,
        self::TIPO_TRANSFERENCIA,
        self::TIPO_AJUSTE,
        self::TIPO_SYNC,
    ];

    public function peca()
    {
        return $this->belongsTo(Peca::class);
    }

    public function local()
    {
        return $this->belongsTo(EstoqueLocal::class, 'local_id');
    }

    public function contraparte()
    {
        return $this->belongsTo(EstoqueLocal::class, 'local_contraparte_id');
    }

    public function pedido()
    {
        return $this->belongsTo(Pedido::class);
    }

    public function romaneio()
    {
        return $this->belongsTo(Romaneio::class);
    }

    public function user()
    {
        return $this->belongsTo(User::class);
    }

    public function scopeFisicos($query)
    {
        return $query->whereIn('tipo', self::TIPOS_FISICOS);
    }
}
