<?php

namespace App\Models;

// use Illuminate\Contracts\Auth\MustVerifyEmail;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Illuminate\Database\Eloquent\SoftDeletes;
// 1. Importações do Spatie Activitylog
use Spatie\Activitylog\Traits\LogsActivity;
use Spatie\Activitylog\LogOptions;
// 2. Importar o Model Route para o relacionamento
use App\Models\Route; 

class User extends Authenticatable
{
    /** @use HasFactory<\Database\Factories\UserFactory> */
    use HasFactory, Notifiable, LogsActivity, SoftDeletes;

    /**
     * The attributes that are mass assignable.
     *
     * @var list<string>
     */
    protected $fillable = [
        'name',
        'email',
        'password',
        'onesignal_id',
        // 3. Novos campos personalizados do nosso sistema
        'perfil',           // admin, cd, loja
        'filial',
        'is_interior',      // Nome da loja/cidade
        'last_seen_at',     // Visto por último (Online)
        'default_route_id'  // <--- NOVO (v2): Vincula a loja a uma rota logística
    ];

    /**
     * The attributes that should be hidden for serialization.
     *
     * @var list<string>
     */
    protected $hidden = [
        'password',
        'remember_token',
    ];

    /**
     * Get the attributes that should be cast.
     *
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'email_verified_at' => 'datetime',
            'password' => 'hashed',
            'last_seen_at' => 'datetime',
            'is_interior' => 'boolean',
        ];
    }

    // 4. Configuração da Auditoria (Spatie)
    public function getActivitylogOptions(): LogOptions
    {
        return LogOptions::defaults()
            ->logOnly(['name', 'email', 'perfil', 'filial', 'default_route_id'])
            ->logOnlyDirty()
            ->dontSubmitEmptyLogs()
            ->setDescriptionForEvent(fn(string $eventName) => "Usuário foi {$eventName}");
    }

    // --- RELACIONAMENTOS (v2) ---

    /**
     * Rota padrão logística desta loja (Ex: Loja Castanhal pertence à Rota BR-316)
     */
    public function defaultRoute()
    {
        return $this->belongsTo(Route::class, 'default_route_id');
    }
}