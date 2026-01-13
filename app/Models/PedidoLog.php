<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class PedidoLog extends Model
{
    use HasFactory;

    protected $fillable = [
        'pedido_id',
        'titulo',
        'descricao',
    ];

    public function pedido()
    {
        return $this->belongsTo(Pedido::class);
    }
}