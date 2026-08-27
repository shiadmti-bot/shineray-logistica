<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

/**
 * Cota de um pedido: "5x NEW JEF VERMELHA para a Loja Ananindeua".
 *
 * Existe apenas para pedidos criados a partir da v2.6. Pedidos legados não
 * possuem linhas aqui e são tratados como 100% atribuídos.
 */
class PedidoItem extends Model
{
    use HasFactory;

    protected $table = 'pedido_itens';

    protected $fillable = [
        'pedido_id',
        'tipo',     // v3: moto | peca
        'peca_id',  // v3: preenchido apenas quando tipo = 'peca'
        'descricao_solicitada', // v3.1: texto da filial quando não há código
        'modelo',
        'cor',
        'motivo',
        'local',
        'quantidade',
        'preco_unitario',       // v3.1: valor informado neste atendimento
        'qtd_atribuida',
        'qtd_cancelada',
        'motivo_cancelamento',
        'cancelado_por',
        'cancelado_em',
        'exige_chassi',
        'identificado_por',     // v3.1: quem achou o SKU (Passo 2)
        'identificado_em',
        'confirmado_por',       // v3.1: quem liberou (Gate 1, Passo 3)
        'confirmado_em',
        'recusa_motivo',
        'basqueta_id',          // v3.1: caixote da filial em que foi depositada
    ];

    protected $casts = [
        'quantidade'      => 'integer',
        'preco_unitario'  => 'decimal:2',
        'qtd_atribuida'   => 'integer',
        'qtd_cancelada'   => 'integer',
        'exige_chassi'    => 'boolean',
        'cancelado_em'    => 'datetime',
        'identificado_em' => 'datetime',
        'confirmado_em'   => 'datetime',
    ];

    protected $appends = ['qtd_pendente'];

    public function pedido()
    {
        return $this->belongsTo(Pedido::class);
    }

    /** Peça solicitada. NULL quando a cota é de moto. */
    public function peca()
    {
        return $this->belongsTo(Peca::class);
    }

    public function isPeca(): bool
    {
        return $this->tipo === 'peca';
    }

    public function isMoto(): bool
    {
        return $this->tipo !== 'peca';
    }

    /**
     * Rótulo do que foi pedido, independente do tipo.
     * Evita espalhar `if (tipo === peca)` por controllers e views.
     */
    public function getDescricaoAttribute(): string
    {
        if ($this->isPeca()) {
            if ($this->peca) {
                return "{$this->peca->codigo} — {$this->peca->descricao}";
            }

            // Ainda sem código: mostra o que a filial escreveu, que é a única
            // informação que existe até o Call Center identificar o SKU.
            return $this->descricao_solicitada
                ? "Sem código — {$this->descricao_solicitada}"
                : 'Peça não identificada';
        }

        return trim("{$this->modelo} {$this->cor}");
    }

    /** O Call Center já escolheu o SKU desta cota (Passo 2 do manual). */
    public function isIdentificada(): bool
    {
        return $this->peca_id !== null;
    }

    /** Liberada pelo Pós-Venda: só então pode ser separada (Gate 1). */
    public function isLiberada(): bool
    {
        return $this->confirmado_em !== null;
    }

    /**
     * Recusada no Gate 1 e devolvida ao Call Center.
     *
     * Recusa limpa confirmado_em e grava o motivo — as duas coisas juntas
     * distinguem "nunca foi analisada" de "foi analisada e voltou".
     */
    public function foiRecusada(): bool
    {
        return $this->recusa_motivo !== null && ! $this->isLiberada();
    }

    /** Cotas de peça que o Call Center ainda precisa identificar. */
    public function scopeAguardandoIdentificacao($query)
    {
        return $query->where('tipo', 'peca')->whereNull('peca_id');
    }

    /** Cotas identificadas que esperam a assinatura do Pós-Venda. */
    public function scopeAguardandoLiberacao($query)
    {
        return $query->where('tipo', 'peca')
                     ->whereNotNull('peca_id')
                     ->whereNull('confirmado_em');
    }

    /**
     * Motos (chassis) já vinculadas a esta cota.
     */
    public function motos()
    {
        return $this->belongsToMany(Moto::class, 'pedido_moto', 'pedido_item_id', 'moto_id')
                    ->withPivot(['destino', 'motivo'])
                    ->withTimestamps();
    }

    public function canceladoPor()
    {
        return $this->belongsTo(User::class, 'cancelado_por');
    }

    /** Quem consultou o e-Part e escolheu o SKU. */
    public function identificadoPor()
    {
        return $this->belongsTo(User::class, 'identificado_por');
    }

    /** Quem assinou a liberação (Gate 1). */
    public function confirmadoPor()
    {
        return $this->belongsTo(User::class, 'confirmado_por');
    }

    /** Caixote da filial em que estas unidades foram depositadas. */
    public function basqueta()
    {
        return $this->belongsTo(Basqueta::class);
    }

    /**
     * Quantos chassis o CD ainda precisa bipar para esta cota.
     */
    public function getQtdPendenteAttribute(): int
    {
        return max(0, $this->quantidade - $this->qtd_atribuida - $this->qtd_cancelada);
    }

    public function scopePendentes($query)
    {
        return $query->whereRaw('quantidade > (qtd_atribuida + qtd_cancelada)');
    }
}
