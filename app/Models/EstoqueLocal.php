<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

/**
 * Local físico de estoque: o CD ou uma loja.
 *
 * Dá identidade a "onde a coisa está". Para moto isso hoje é resolvido por
 * motos.loja_atual_id (com NULL = CD); para peça, que é fungível, o local
 * precisa ser uma chave real — ver comentário da migration.
 */
class EstoqueLocal extends Model
{
    use HasFactory;

    protected $table = 'estoque_locais';

    protected $fillable = [
        'nome', 'slug', 'tipo', 'user_id', 'ativo',
        'codigo_empresa_microwork', // empresa correspondente no Microwork
        'participa_pecas',          // entra na distribuição de peças
    ];

    protected $casts = [
        'ativo'                    => 'boolean',
        'codigo_empresa_microwork' => 'integer',
        'participa_pecas'          => 'boolean',
    ];

    public const TIPO_CD   = 'cd';
    public const TIPO_LOJA = 'loja';

    /** Usuário (loja) correspondente. NULL no CD. */
    public function user()
    {
        return $this->belongsTo(User::class);
    }

    public function estoques()
    {
        return $this->hasMany(PecaEstoque::class, 'local_id');
    }

    public function movimentos()
    {
        return $this->hasMany(PecaMovimento::class, 'local_id');
    }

    public function isCd(): bool
    {
        return $this->tipo === self::TIPO_CD;
    }

    public function scopeAtivos($query)
    {
        return $query->where('ativo', true);
    }

    public function scopeLojas($query)
    {
        return $query->where('tipo', self::TIPO_LOJA);
    }

    /**
     * Filiais que recebem peça — as únicas que ganham basqueta e aparecem na
     * fila do Call Center.
     *
     * O CD tem participa_pecas = true porque é a origem de toda peça, mas não
     * é filial: por isso o filtro por tipo aqui, e não só pela flag.
     */
    public function scopeFiliaisDePeca($query)
    {
        return $query->where('tipo', self::TIPO_LOJA)
                     ->where('participa_pecas', true)
                     ->where('ativo', true);
    }

    /**
     * O CD. Memoizado por request: é consultado em praticamente toda
     * operação de estoque.
     */
    public static function cd(): ?self
    {
        static $cd = null;

        return $cd ??= static::where('tipo', self::TIPO_CD)->first();
    }
}
