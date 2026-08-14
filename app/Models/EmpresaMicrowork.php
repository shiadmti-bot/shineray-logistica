<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

/**
 * Empresa do Microwork — uma unidade contábil que pode agrupar mais de um
 * ponto físico (a empresa 3 cobre CD e Ananindeua).
 *
 * Existe para dar nome legível ao saldo externo. Não é um local de estoque:
 * quem responde por reserva e baixa é EstoqueLocal.
 */
class EmpresaMicrowork extends Model
{
    use HasFactory;

    protected $table = 'empresas_microwork';

    protected $fillable = ['codigo', 'rotulo', 'agrupa', 'ativo'];

    protected $casts = [
        'codigo' => 'integer',
        'ativo'  => 'boolean',
    ];

    public function saldos()
    {
        return $this->hasMany(PecaSaldoExterno::class, 'codigo_empresa', 'codigo');
    }

    /**
     * Empresa que mistura mais de um local físico — a tela precisa avisar
     * que o saldo é agregado e não diz em qual prateleira a peça está.
     */
    public function isAgrupada(): bool
    {
        return ! empty($this->agrupa);
    }

    public function scopeAtivas($query)
    {
        return $query->where('ativo', true);
    }

    /** @return array<int, string> codigo => rotulo */
    public static function rotulos(): array
    {
        return static::pluck('rotulo', 'codigo')->all();
    }
}
