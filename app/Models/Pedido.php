<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;

class Pedido extends Model
{
    use HasFactory, SoftDeletes;

    protected $fillable = [
        'user_id', 
        'status', 
        'observacao', 
        'romaneio_id', 
        
        // Campos de Upload e Finalização
        'arquivo_assinado', // Do seu snippet original
        'comprovante_url',  // Usado na integração com Google Drive
        
        // Campo de Cancelamento/Rejeição
        'motivo_rejeicao'
    ];

    // --- RELAÇÕES ---

    public function motos()
    {
        // withTimestamps garante que a data do vínculo seja salva na tabela 'pedido_moto'
        return $this->belongsToMany(Moto::class, 'pedido_moto')->withTimestamps();
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

    // --- CORREÇÃO DO ERRO NO CHAT ---
    // Essa função permite usar $pedido->messages() no Controller
    public function messages()
    {
        return $this->hasMany(Message::class);
    }
}