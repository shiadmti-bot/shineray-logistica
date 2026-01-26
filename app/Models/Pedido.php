<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;

class Pedido extends Model
{
    use HasFactory, SoftDeletes;

    protected $fillable = [
        'user_id', 'status', 'observacao', 'romaneio_id', 
        'arquivo_assinado', 'comprovante_url', 'motivo_rejeicao', 'motivo'
    ];

    public function motos() {
        return $this->belongsToMany(Moto::class, 'pedido_moto')->withTimestamps();
    }

    public function user() {
        return $this->belongsTo(User::class);
    }

    public function romaneio() {
        return $this->belongsTo(Romaneio::class);
    }

    public function logs() {
        return $this->hasMany(PedidoLog::class)->orderBy('created_at', 'desc');
    }

    // --- ESTA É A FUNÇÃO QUE ESTÁ FALTANDO E CAUSA O ERRO ---
    public function messages() {
        return $this->hasMany(Message::class);
    }
}