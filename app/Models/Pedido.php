<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;

class Pedido extends Model
{
    use HasFactory, SoftDeletes;

    // --- AQUI ESTAVA O PROBLEMA ---
    // Adicionei 'romaneio_id' na lista de permitidos
    protected $fillable = [
        'user_id', 
        'status', 
        'observacao', 
        'romaneio_id', 
        'arquivo_assinado'
    ];

    public function motos()
    {
        return $this->belongsToMany(Moto::class, 'pedido_moto');
    }

    public function user()
    {
        return $this->belongsTo(User::class);
    }

    public function romaneio()
    {
        return $this->belongsTo(Romaneio::class);
    }

    public function logs()
    {
        return $this->hasMany(PedidoLog::class)->orderBy('created_at', 'desc');
    }
}