<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

/**
 * Uma cor que o Microwork já mostrou para um modelo.
 *
 * Existe para a tela de pedido não precisar inventar cores. Até a v3.7,
 * Create.jsx tinha sete cores escritas no código para usar quando o modelo não
 * tinha saldo — a loja escolhia entre opções que podiam não existir para aquele
 * modelo, e o pedido nascia com um nome que não casava com variante nenhuma.
 *
 * `ativo` é decisão humana. A sincronia só acrescenta e atualiza `visto_em`;
 * uma cor ausente numa resposta da API não é prova de que saiu de linha.
 */
class ModeloCor extends Model
{
    protected $table = 'modelo_cores';

    protected $fillable = [
        'modelo_id',
        'cor',
        'origem',
        'visto_em',
        'ativo',
    ];

    protected $casts = [
        'visto_em' => 'datetime',
        'ativo'    => 'boolean',
    ];

    public function modelo()
    {
        return $this->belongsTo(Modelo::class);
    }
}
