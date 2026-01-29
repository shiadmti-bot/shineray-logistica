<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Spatie\Activitylog\Traits\LogsActivity;
use Spatie\Activitylog\LogOptions;

class Romaneio extends Model
{
    use HasFactory, LogsActivity;

    // Atualizei o fillable com todos os campos que usamos no Controller
    protected $fillable = [
        'user_id', 
        'status', 
        'motorista', 
        'placa', 
        'transportadora', 
        'observacao'
    ];

    // Carrega a contagem de motos automaticamente (útil para as listas)
    protected $withCount = ['motos'];

    // --- BLINDAGEM (Correção da Tela Branca) ---

    // 1. Se o status for NULL no banco, retorna 'aberto' automaticamente
    public function getStatusAttribute($value)
    {
        return $value ?: 'aberto';
    }

    // 2. Garante string vazia se motorista for null
    public function getMotoristaAttribute($value)
    {
        return $value ?: 'Motorista Não Informado';
    }

    // --- CONFIGURAÇÃO DE LOGS (Spatie) ---
    public function getActivitylogOptions(): LogOptions
    {
        return LogOptions::defaults()
            ->logOnly(['motorista', 'placa', 'transportadora', 'status']) 
            ->logOnlyDirty() 
            ->dontSubmitEmptyLogs()
            ->setDescriptionForEvent(fn(string $eventName) => "Romaneio foi {$eventName}");
    }

    // --- RELACIONAMENTOS ---

    public function user() {
        return $this->belongsTo(User::class); // CD que criou a carga
    }

    public function motos() { 
        return $this->hasMany(Moto::class); 
    }

    public function pedidos() { 
        return $this->hasMany(Pedido::class); 
    }
}