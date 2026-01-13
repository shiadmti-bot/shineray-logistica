<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes; // Se estiver usando soft deletes

class Moto extends Model
{
    use HasFactory;
    // use SoftDeletes; // Descomente se sua tabela usa deleted_at

    protected $fillable = [
        'modelo',
        'chassi',
        'cor',
        'ano_fabricacao',
        'status',
        'localizacao_atual',
        'romaneio_id'
        // Nota: Não colocamos pedido_id aqui pois usamos tabela pivo
    ];

    // --- RELAÇÃO COM ROMANEIO ---
    public function romaneio()
    {
        return $this->belongsTo(Romaneio::class);
    }

    // --- ADICIONE ESTA FUNÇÃO (CORREÇÃO DO ERRO) ---
    public function pedidos()
    {
        // Uma moto pertence a pedidos via tabela pivô 'pedido_moto'
        return $this->belongsToMany(Pedido::class, 'pedido_moto')
                    ->withTimestamps();
    }
}