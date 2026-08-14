<?php

namespace App\Models;

use App\Services\Pecas\CatalogoModelos;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

/**
 * Vínculo "esta peça serve neste modelo".
 *
 * `origem` e `confianca` andam juntos com o dado de propósito: a tela precisa
 * mostrar ao usuário se a compatibilidade veio do cadastro oficial ou foi
 * deduzida do nome da peça. Ver migration 2026_08_14_100700.
 */
class PecaAplicacao extends Model
{
    use HasFactory;

    protected $table = 'peca_aplicacoes';

    protected $fillable = [
        'peca_id', 'familia', 'modelo', 'cilindrada',
        'variante', 'origem', 'confianca', 'texto_origem',
    ];

    protected $casts = ['cilindrada' => 'integer'];

    public const ORIGEM_MICROWORK = 'microwork';
    public const ORIGEM_DESCRICAO = 'descricao';
    public const ORIGEM_MANUAL    = 'manual';
    public const ORIGEM_INFERIDO  = 'inferido';

    public function peca()
    {
        return $this->belongsTo(Peca::class);
    }

    /** Confirmado por gente ou pelo cadastro oficial. */
    public function isConfiavel(): bool
    {
        return in_array($this->origem, [self::ORIGEM_MICROWORK, self::ORIGEM_MANUAL], true);
    }

    public function getFamiliaLabelAttribute(): string
    {
        return CatalogoModelos::label($this->familia);
    }

    public function scopeConfiaveis($query)
    {
        return $query->whereIn('origem', [self::ORIGEM_MICROWORK, self::ORIGEM_MANUAL]);
    }

    public function scopeDaFamilia($query, string $familia)
    {
        return $query->where('familia', mb_strtoupper($familia, 'UTF-8'));
    }
}
