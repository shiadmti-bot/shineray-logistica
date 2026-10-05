<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Builder;
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
     * RELAÇÃO: Loja Atual (Baseada no loja_atual_id)
     */
    public function loja()
    {
        return $this->belongsTo(User::class, 'loja_atual_id');
    }

    /**
     * RELAÇÃO: Itens de carga (v3)
     * Espelho da moto dentro de romaneio_itens. A fonte do fluxo atual continua
     * sendo romaneio_id — ver Romaneio::sincronizarItemMoto().
     */
    public function itensCarga()
    {
        return $this->morphMany(RomaneioItem::class, 'itemable');
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
                    ->withPivot(['created_at', 'destino', 'motivo']) // Traz dados da tabela pivo
                    ->withTimestamps()
                    ->orderByPivot('created_at', 'desc'); // O mais recente primeiro
    }

    /**
     * As motos que este usuário pode ver (escopo da v3.4, antes inline em
     * MotoController::index).
     *
     * A operação central vê a frota inteira. Qualquer outro perfil vê só o
     * que participa — e a loja precisa dos três caminhos:
     *   está comigo    -> loja_atual_id
     *   estou pedindo  -> pedido.user_id
     *   está saindo    -> pedido.origem_user_id (transferência)
     *
     * Sem o terceiro, a loja que cede a moto a perderia de vista no instante
     * em que ela é prometida a outra filial.
     */
    public function scopeVisivelPara(Builder $query, User $user): Builder
    {
        if ($user->isOperacaoCentral()) {
            return $query;
        }

        return $query->where(function ($q) use ($user) {
            $q->where('loja_atual_id', $user->id)
              ->orWhereHas('pedidos', function ($p) use ($user) {
                  $p->where(function ($sub) use ($user) {
                      $sub->where('user_id', $user->id)
                          ->orWhere('origem_user_id', $user->id);
                  })->where('pedidos.status', '!=', 'cancelado');
              });
        });
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