<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

/**
 * Um modelo de moto do catálogo, com o nome EXATO do Microwork.
 *
 * O formato é o do cadastro da fábrica — "XY150-8 - MOTO JEF S", não "JEF 150".
 * A tradução para o nome de rua que a loja usa fica em
 * App\Services\Pecas\CatalogoModelos, que existe para isso.
 *
 * ESTA TABELA É CATÁLOGO, NÃO ESTOQUE. Um modelo está aqui porque existe, não
 * porque há unidade em pátio. Até a v3.7 a tela de pedido montava a lista a
 * partir dos chassis em estoque e descartava esta tabela inteira sempre que o
 * Microwork respondia algo — então um modelo esgotado não podia ser pedido,
 * que é o contrário do que um pedido de reposição serve para fazer. Ver
 * App\Services\Estoque\CatalogoMotosMicrowork.
 */
class Modelo extends Model
{
    protected $fillable = [
        'nome',
        'origem',    // seed | microwork | manual
        'visto_em',  // última sincronia em que este nome apareceu
        'ativo',     // saiu de linha? decisão humana, nunca da sincronia
    ];

    protected $casts = [
        'visto_em' => 'datetime',
        'ativo'    => 'boolean',
    ];

    public function cores()
    {
        return $this->hasMany(ModeloCor::class);
    }

    public function scopeAtivos($query)
    {
        return $query->where('ativo', true);
    }
}
