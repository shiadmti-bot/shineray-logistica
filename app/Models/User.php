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

class User extends Authenticatable
{
    /** @use HasFactory<\Database\Factories\UserFactory> */
    // 2. Adicione LogsActivity aqui
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
        // 3. Novos campos personalizados do nosso sistema
        'perfil',       // admin, cd, loja
        'filial',       // Nome da loja/cidade
        'last_seen_at', // Visto por último (Online)
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
            'last_seen_at' => 'datetime', // Importante para o Carbon funcionar direto
        ];
    }

    // 4. Configuração da Auditoria (Spatie)
    public function getActivitylogOptions(): LogOptions
    {
        return LogOptions::defaults()
            ->logOnly(['name', 'email', 'perfil', 'filial']) // O que vigiar
            ->logOnlyDirty() // Só grava se mudar algo
            ->dontSubmitEmptyLogs() // Não grava se salvar sem mudar nada
            ->setDescriptionForEvent(fn(string $eventName) => "Usuário foi {$eventName}");
    }
}