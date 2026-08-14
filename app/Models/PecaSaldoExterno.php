<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

/**
 * Saldo de uma peça em uma empresa do Microwork.
 *
 * SOMENTE LEITURA, informativo. Serve para responder "onde tem essa peça?"
 * a quem vai separar e transferir.
 *
 * NÃO use para reserva, baixa ou promessa de disponibilidade: o número é
 * agregado de mais de um local físico e vem de fonte externa que pode estar
 * defasada. Quem responde por isso é PecaEstoque.
 */
class PecaSaldoExterno extends Model
{
    use HasFactory;

    protected $table = 'peca_saldos_externos';

    protected $fillable = ['peca_id', 'codigo_empresa', 'saldo', 'sincronizado_em'];

    protected $casts = [
        'codigo_empresa'  => 'integer',
        'saldo'           => 'integer',
        'sincronizado_em' => 'datetime',
    ];

    public function peca()
    {
        return $this->belongsTo(Peca::class);
    }

    public function empresa()
    {
        return $this->belongsTo(EmpresaMicrowork::class, 'codigo_empresa', 'codigo');
    }

    public function scopeComSaldo($query)
    {
        return $query->where('saldo', '>', 0);
    }
}
