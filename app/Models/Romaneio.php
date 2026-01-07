<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
// 1. Importar Traits do Spatie
use Spatie\Activitylog\Traits\LogsActivity;
use Spatie\Activitylog\LogOptions;

class Romaneio extends Model
{
    use HasFactory, LogsActivity; // 2. Adicionar aqui

    protected $fillable = ['motorista', 'placa', 'status'];

    // 3. Configurar o que será logado
    public function getActivitylogOptions(): LogOptions
    {
        return LogOptions::defaults()
            ->logOnly(['motorista', 'placa', 'status']) // Vigia estes campos
            ->logOnlyDirty() // Só grava se houver mudança
            ->dontSubmitEmptyLogs()
            ->setDescriptionForEvent(fn(string $eventName) => "Romaneio foi {$eventName}"); // Ex: Romaneio foi updated
    }

    public function motos() { return $this->hasMany(Moto::class); }
    public function pedidos() { return $this->hasMany(Pedido::class); }
}