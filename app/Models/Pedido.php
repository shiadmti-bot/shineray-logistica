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
        'tipo_carga',       // v3: moto | peca | misto
        'local_origem_id',  // v3: local de estoque que atende
        'local_destino_id', // v3: local de estoque que recebe
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

    /**
     * Estados em que um pedido de peça já separado ainda pode entrar numa carga.
     *
     * Depois de separado, o pedido de peça anda nos MESMOS trilhos da moto: o
     * calendário o leva para 'aguardando_rota' e, na confirmação da viagem,
     * para 'rota_confirmada' (ver CalendarController::store). Aceitar só
     * 'separado' fazia a peça sumir da mesa de montagem assim que o gerente do
     * CD confirmava a rota — com o saldo reservado e sem caminho de volta,
     * porque 'rota_confirmada' também não está entre os estados que permitem
     * separar de novo.
     *
     * A lista espelha a das motos em RomaneioController::create.
     */
    public const STATUS_PECA_EMBARCAVEL = [
        'separado',
        'aguardando_rota',
        'aguardando_coleta',
        'rota_confirmada',
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

    // --- LOCAIS DE ESTOQUE (v3) ---

    public function localOrigem()
    {
        return $this->belongsTo(EstoqueLocal::class, 'local_origem_id');
    }

    public function localDestino()
    {
        return $this->belongsTo(EstoqueLocal::class, 'local_destino_id');
    }

    /** Cotas de peça deste pedido. */
    public function itensPecas()
    {
        return $this->itensPedido()->where('tipo', 'peca');
    }

    /** Cotas de moto deste pedido. */
    public function itensMotos()
    {
        return $this->itensPedido()->where('tipo', 'moto');
    }

    public function movimentosPeca()
    {
        return $this->hasMany(PecaMovimento::class);
    }

    // Motos vinculadas (Quando o pedido é processado e ganha chassis reais)
    public function motos()
    {
        return $this->belongsToMany(Moto::class, 'pedido_moto')
                    ->withPivot(['destino', 'motivo', 'detalhes_avaria', 'foto_avaria', 'pedido_item_id']) // Garante que avarias históricas venham junto
                    ->withTimestamps();
    }

    /**
     * Cotas do pedido (v2.6+). Pedidos legados retornam coleção vazia — ver isLegado().
     */
    public function itensPedido()
    {
        return $this->hasMany(PedidoItem::class);
    }

    /**
     * Pedido criado antes da v2.6: não possui cotas, todo item já nasceu com chassi.
     * Nesse caso o sistema inteiro deve se comportar exatamente como antes.
     */
    public function isLegado(): bool
    {
        return !$this->itensPedido()->exists();
    }

    /**
     * Quantos chassis ainda faltam o CD atribuir. Sempre 0 para pedidos legados.
     */
    public function saldoPendente(): int
    {
        return (int) $this->itensPedido()
            ->selectRaw('COALESCE(SUM(GREATEST(quantidade - qtd_atribuida - qtd_cancelada, 0)), 0) as saldo')
            ->value('saldo');
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