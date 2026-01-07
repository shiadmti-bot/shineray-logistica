<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;

class Moto extends Model
{
    use HasFactory, SoftDeletes;

    protected $fillable = [
        'chassi',
        'modelo',
        'cor',
        'ano_fabricacao',
        'status',
        'localizacao_atual',
        'romaneio_id'
    ];

    public function romaneio()
    {
        return $this->belongsTo(Romaneio::class);
    }

    // Relação inversa: Uma moto pode estar em vários pedidos (histórico)
    public function pedidos()
    {
        return $this->belongsToMany(Pedido::class, 'pedido_moto');
    }
}