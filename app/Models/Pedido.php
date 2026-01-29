<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;

class Pedido extends Model
{
    use HasFactory, SoftDeletes;

    // Campos permitidos para gravação em massa
    protected $fillable = [
        'user_id', 
        'origem_user_id', // Novo: Para saber de qual loja saiu (se for transferência)
        'romaneio_id', 
        'status', 
        'tipo',           // Novo: 'compra_fabrica' ou 'transferencia'
        'observacao', 
        'arquivo_assinado', 
        'comprovante_url', 
        'motivo_rejeicao'
    ];

    // Carrega o usuário automaticamente para evitar erro no React
    protected $with = ['user'];

    // Atributos virtuais que vão para o JSON (Frontend)
    protected $appends = ['data_formatada', 'status_formatado'];

    // --- BLINDAGEM (Proteção contra Tela Branca) ---

    // 1. Se status for NULL no banco, retorna 'indefinido' (string)
    public function getStatusAttribute($value)
    {
        return $value ?? 'indefinido';
    }

    // 2. Se observação for NULL, retorna vazio
    public function getObservacaoAttribute($value)
    {
        return $value ?? '';
    }

    // --- ACESSORES VIRTUAIS (Formatadores) ---

    public function getDataFormatadaAttribute()
    {
        return $this->created_at ? $this->created_at->format('d/m/Y H:i') : '-';
    }

    public function getStatusFormatadoAttribute()
    {
        $status = $this->status ?? 'indefinido';
        return ucfirst(str_replace('_', ' ', $status));
    }

    // --- RELACIONAMENTOS ---

    public function motos() {
        // CORREÇÃO CRÍTICA AQUI:
        // Adicionado 'withPivot' para trazer o campo 'destino' da tabela de ligação
        return $this->belongsToMany(Moto::class, 'pedido_moto')
                    ->withPivot('destino') 
                    ->withTimestamps();
    }

    public function user() {
        return $this->belongsTo(User::class); // Quem RECEBE (Solicitante/Destino)
    }

    // Novo: Loja de Origem (Para transferências entre lojas)
    public function origem_user() {
        return $this->belongsTo(User::class, 'origem_user_id');
    }

    public function romaneio() {
        return $this->belongsTo(Romaneio::class);
    }

    public function logs() {
        return $this->hasMany(PedidoLog::class)->orderBy('created_at', 'desc');
    }

    public function messages() {
        return $this->hasMany(Message::class);
    }
}