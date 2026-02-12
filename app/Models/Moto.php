<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Moto extends Model
{
    use HasFactory;

    protected $fillable = [
        'modelo',
        'chassi',
        'cor',
        'ano_fabricacao',
        'status',             // Ex: disponivel, separado, aguardando_coleta, transito_loja, no_cd, avariado
        'localizacao_atual',  // Texto livre: "Estoque CD", "Caminhão placa XXX", "Loja Belém"
        'romaneio_id',        // Vínculo com a carga atual (se houver)
        
        // Campos de Controle
        'motivo_solicitacao',
        'detalhes_avaria',
        'foto_avaria',
        'estorno_pendente',
        'motivo_estorno',
        'user_estorno_id',
        'loja_atual_id'

    ];

    /**
     * RELAÇÃO: Carga Atual
     * Uma moto só pode estar em UM caminhão (Romaneio) por vez.
     */
    public function romaneio()
    {
        return $this->belongsTo(Romaneio::class);
    }

    /**
     * RELAÇÃO: Histórico de Pedidos
     * Uma moto pode ter passado por vários pedidos (Venda, Transferência, Devolução).
     * * ATUALIZAÇÃO IMPORTANTE:
     * Adicionamos o 'orderByPivot' para garantir que $moto->pedidos->first() 
     * traga sempre o pedido ATUAL (o último criado), e não um antigo.
     */
    public function pedidos()
    {
        return $this->belongsToMany(Pedido::class, 'pedido_moto')
                    ->withPivot(['created_at', 'destino']) // Traz dados da tabela pivo
                    ->withTimestamps()
                    ->orderByPivot('created_at', 'desc'); // O mais recente primeiro
    }

    /**
     * ACESSOR MÁGICO (Opcional)
     * Permite usar $moto->pedido_atual para pegar o pedido ativo sem fazer query complexa.
     */
    public function getPedidoAtualAttribute()
    {
        return $this->pedidos->first();
    }
}