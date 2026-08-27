<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

/**
 * Nota fiscal emitida para uma basqueta.
 *
 * Uma basqueta pode acumular várias: o Passo 7 do manual manda cancelar e
 * reemitir quando a filial acusa falta na conferência. A vigente é a que não
 * tem cancelada_em — as outras ficam como histórico fiscal.
 *
 * A emissão em si continua no Microwork. Aqui guardamos o vínculo, que é o que
 * o sistema não tinha e sem o qual o ciclo de ajuste não é auditável.
 */
class BasquetaNota extends Model
{
    use HasFactory;

    protected $table = 'basqueta_notas';

    protected $fillable = [
        'basqueta_id',
        'numero',
        'serie',
        'chave',
        'valor_total',
        'emitida_em',
        'emitida_por',
        'cancelada_em',
        'cancelada_por',
        'motivo_cancelamento',
    ];

    protected $casts = [
        'valor_total'  => 'decimal:2',
        'emitida_em'   => 'datetime',
        'cancelada_em' => 'datetime',
    ];

    public function basqueta()
    {
        return $this->belongsTo(Basqueta::class);
    }

    public function emitidaPor()
    {
        return $this->belongsTo(User::class, 'emitida_por');
    }

    public function canceladaPor()
    {
        return $this->belongsTo(User::class, 'cancelada_por');
    }

    public function estaCancelada(): bool
    {
        return $this->cancelada_em !== null;
    }

    /** Rótulo curto para documento e tela: "123.456 / 1". */
    public function getRotuloAttribute(): string
    {
        return $this->serie ? "{$this->numero} / {$this->serie}" : $this->numero;
    }

    public function scopeVigentes($query)
    {
        return $query->whereNull('cancelada_em');
    }
}
