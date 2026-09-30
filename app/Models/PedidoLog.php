<?php

namespace App\Models;

use App\Enums\EventoPedido;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

/**
 * Uma entrada na linha do tempo de um pedido.
 *
 * DUAS METADES, COM PAPÉIS DIFERENTES:
 *
 *   `titulo` e `descricao` são para LER. Texto de interface, com emoji, escrito
 *   para um humano na tela do pedido. Muda quando a redação muda.
 *
 *   `evento`, `user_id` e `dados` são para CONSULTAR. É o que o histórico de
 *   auditoria filtra e o que um relatório agrupa. Não muda quando a redação
 *   muda — e é por isso que existem: antes da v3.6 o histórico do gestor
 *   filtrava por `titulo LIKE`, e bastava alguém reescrever um título para o
 *   registro sair do relatório sem ninguém perceber.
 */
class PedidoLog extends Model
{
    use HasFactory;

    protected $fillable = [
        'pedido_id',
        'user_id',
        'titulo',
        'evento',
        'descricao',
        'dados',
    ];

    protected $casts = [
        'dados'      => 'array',
        'created_at' => 'datetime',
        'updated_at' => 'datetime',
    ];

    public function pedido()
    {
        return $this->belongsTo(Pedido::class);
    }

    /** Quem fez. NULL em log de sistema (rotina, comando, rota vencida). */
    public function autor()
    {
        return $this->belongsTo(User::class, 'user_id');
    }

    /**
     * Registros em que alguém desfez algo: rejeição, cancelamento, corte parcial.
     *
     * INCLUI OS LEGADOS. Log gravado antes da v3.6 tem `evento` NULL, e por isso
     * o escopo também aceita os títulos antigos. Sem esta segunda metade, ligar
     * o filtro novo esvaziaria o histórico de tudo que aconteceu até hoje.
     */
    public function scopeRecusas($query)
    {
        return $query->where(function ($q) {
            $q->whereIn('evento', EventoPedido::recusas())
              ->orWhere(function ($legado) {
                  $legado->whereNull('evento')
                         ->where(function ($t) {
                             $t->where('titulo', 'LIKE', 'Rejeitado%')
                               ->orWhere('titulo', 'LIKE', 'Cancelado%')
                               ->orWhere('titulo', 'LIKE', 'Auditoria Comercial%')
                               ->orWhere('titulo', 'Pedido Cancelado Automaticamente');
                         });
              });
        });
    }
}
