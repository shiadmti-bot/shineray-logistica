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
        'default_route_id', // <--- NOVO (v2): Vincula a loja a uma rota logística
        'estoque_local_id', // <--- NOVO (v3): Local de estoque desta loja/CD
        'valida_pecas',     // <--- NOVO (v3.1): Assina a liberação de pedidos de peça
        'valida_motos',     // <--- NOVO (v3.2): Assina a aprovação de pedidos de motos
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
            'valida_pecas' => 'boolean',
            'valida_motos' => 'boolean',
        ];
    }

    /**
     * Pode aprovar ou rejeitar pedidos de motos e estornos (Gestão Comercial).
     */
    public function podeValidarMotos(): bool
    {
        if ($this->perfil === 'admin') {
            return true;
        }

        return (bool) ($this->valida_motos ?? ($this->perfil === 'gestor'));
    }

    /**
     * Pode liberar um pedido de peça para separação (Gate 1 do manual do
     * Call Center).
     *
     * Atribuição, não perfil: é ortogonal a `perfil` de propósito, para que a
     * pessoa continue com o acesso que já tem. Ver a migration
     * 2026_08_26_100100 para o raciocínio completo.
     *
     * Admin entra por herança — sem isso, um sistema sem validador marcado
     * ficaria sem ninguém capaz de destravar a fila.
     */
    public function podeValidarPecas(): bool
    {
        return (bool) $this->valida_pecas || $this->perfil === 'admin';
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

    /**
     * Local de estoque deste usuário (v3).
     * Loja -> seu próprio local; usuário do CD -> o local do CD.
     */
    public function estoqueLocal()
    {
        return $this->belongsTo(EstoqueLocal::class, 'estoque_local_id');
    }

    /**
     * Pedidos feitos PELA loja (destino)
     */
    public function pedidos()
    {
        return $this->hasMany(Pedido::class, 'user_id');
    }

    /**
     * Pedidos feitos PARA a loja (origem/transferência)
     */
    public function pedidosOrigem()
    {
        return $this->hasMany(Pedido::class, 'origem_user_id');
    }
}