<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Spatie\Activitylog\Traits\LogsActivity;
use Spatie\Activitylog\LogOptions;

class Romaneio extends Model
{
    use HasFactory, LogsActivity;

    // Atualizei o fillable com todos os campos que usamos no Controller
    protected $fillable = [
        'user_id', 
        'status', 
        'motorista', 
        'placa', 
        'transportadora', 
        'observacao',
        'rota',      // Adicionado
        'tipo',      // Adicionado
        'saida_em'   // Adicionado
    ];

    // Carrega a contagem de motos automaticamente (útil para as listas)
    protected $withCount = ['motos'];

    // --- BLINDAGEM (Correção da Tela Branca) ---

    // 1. Se o status for NULL no banco, retorna 'aberto' automaticamente
    public function getStatusAttribute($value)
    {
        return $value ?: 'aberto';
    }

    // 2. Garante string vazia se motorista for null
    public function getMotoristaAttribute($value)
    {
        return $value ?: 'Motorista Não Informado';
    }

    // --- CONFIGURAÇÃO DE LOGS (Spatie) ---
    public function getActivitylogOptions(): LogOptions
    {
        return LogOptions::defaults()
            ->logOnly(['motorista', 'placa', 'transportadora', 'status']) 
            ->logOnlyDirty() 
            ->dontSubmitEmptyLogs()
            ->setDescriptionForEvent(fn(string $eventName) => "Romaneio foi {$eventName}");
    }

    // --- RELACIONAMENTOS ---

    public function user() {
        return $this->belongsTo(User::class); // CD que criou a carga
    }

    public function motos() {
        return $this->hasMany(Moto::class);
    }

    public function pedidos() {
        return $this->hasMany(Pedido::class);
    }

    // --- CARGA MISTA (v3) ---

    /**
     * Itens da carga: motos E peças.
     *
     * Convive com motos() — que continua sendo a fonte do fluxo atual de moto.
     * Telas novas devem ler daqui; o código existente segue usando motos().
     */
    public function itens()
    {
        return $this->hasMany(RomaneioItem::class);
    }

    public function itensMotos()
    {
        return $this->itens()->motos();
    }

    public function itensPecas()
    {
        return $this->itens()->pecas();
    }

    /**
     * Espelha em romaneio_itens o vínculo de uma moto com esta carga.
     *
     * Enquanto motos.romaneio_id e romaneio_itens coexistirem, as duas precisam
     * ser escritas juntas. Chame este método sempre que atribuir uma moto à
     * carga, em vez de gravar motos.romaneio_id diretamente.
     */
    /**
     * Fecha a carga se nada mais nela estiver pendente.
     *
     * A regra existia inline dentro de PedidoController::finalizarEntrega, o
     * único lugar que fechava carga. Com a devolução (v3) tendo recebimento
     * próprio — o checklist do CD, em DevolucaoController::receber — passaram a
     * ser dois, e uma regra de fechamento em duas cópias é uma carga que fica
     * "em trânsito" para sempre assim que as cópias divergirem.
     *
     * 'no_cd' conta como resolvido de propósito: é transbordo, e o pedido
     * seguirá numa carga nova.
     *
     * @return bool true se a carga foi fechada agora
     */
    public function fecharSeTudoEntregue(): bool
    {
        if ($this->status === 'concluido') {
            return false;
        }

        $this->loadMissing('motos.pedidos');

        foreach ($this->motos as $moto) {
            $pedido = $moto->pedidos->first();

            if (! $pedido || ! in_array($pedido->status, ['concluido', 'cancelado', 'no_cd'], true)) {
                return false;
            }
        }

        // Carga mista: peça pendente também segura o fechamento.
        $pecasPendentes = RomaneioItem::where('romaneio_id', $this->id)
            ->where('itemable_type', Peca::class)
            ->whereNotIn('status', [
                RomaneioItem::STATUS_ENTREGUE,
                RomaneioItem::STATUS_DIVERGENCIA,
                RomaneioItem::STATUS_RETORNADO,
            ])
            ->exists();

        if ($pecasPendentes) {
            return false;
        }

        $this->update(['status' => 'concluido']);

        return true;
    }

    public function sincronizarItemMoto(Moto $moto, ?Pedido $pedido = null, ?int $localDestinoId = null): RomaneioItem
    {
        $pedido ??= $moto->pedido_atual;

        return $this->itens()->updateOrCreate(
            [
                'itemable_type' => Moto::class,
                'itemable_id'   => $moto->id,
            ],
            [
                'pedido_id'        => $pedido?->id,
                'pedido_item_id'   => $pedido?->pivot->pedido_item_id ?? null,
                'quantidade'       => 1,
                'local_destino_id' => $localDestinoId ?? $moto->loja?->estoque_local_id,
            ]
        );
    }
}