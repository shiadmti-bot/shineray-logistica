<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;
use Spatie\Activitylog\Traits\LogsActivity;
use Spatie\Activitylog\LogOptions;

class Pedido extends Model
{
    use HasFactory, SoftDeletes, LogsActivity;

    protected $fillable = [
        'user_id',
        'origem_user_id', // <--- Origem da Carga (Loja ou NULL para CD)
        'status',
        'observacao',
        'itens',          // <--- OBRIGATÓRIO: Salva o JSON da solicitação
        'romaneio_id',
        'motivo_rejeicao',
        'comprovante_url',
        'previsao_coleta',  // Logística V2
        'previsao_entrega'  // Logística V2
    ];

    protected $casts = [
        'created_at' => 'datetime',
        'updated_at' => 'datetime',
        'previsao_coleta' => 'date',
        'previsao_entrega' => 'date',
        'itens' => 'array', // <--- Converte JSON <-> Array automaticamente
    ];

    // --- RELACIONAMENTOS ---

    // Quem pediu (Destino)
    public function user()
    {
        return $this->belongsTo(User::class);
    }

    // Quem fornece (Origem - NOVO V2)
    public function origem()
    {
        return $this->belongsTo(User::class, 'origem_user_id');
    }

    // Motos vinculadas (Quando o pedido é processado e ganha chassis reais)
    public function motos()
    {
        return $this->belongsToMany(Moto::class, 'pedido_moto')
                    ->withPivot(['destino', 'motivo', 'detalhes_avaria', 'foto_avaria']) // Garante que avarias históricas venham junto
                    ->withTimestamps();
    }

    public function romaneio()
    {
        return $this->belongsTo(Romaneio::class);
    }

    public function logs()
    {
        return $this->hasMany(PedidoLog::class);
    }

    // Chat do Pedido
    public function messages()
    {
        return $this->hasMany(Message::class)->orderBy('created_at', 'asc');
    }

    // --- LOGS (Auditoria) ---
    public function getActivitylogOptions(): LogOptions
    {
        return LogOptions::defaults()
            ->logOnly(['status', 'user_id', 'origem_user_id', 'itens'])
            ->useLogName('pedido')
            ->setDescriptionForEvent(fn(string $eventName) => "Pedido foi {$eventName}");
    }
}