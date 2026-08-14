<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;
use Spatie\Activitylog\LogOptions;
use Spatie\Activitylog\Traits\LogsActivity;

/**
 * Um TIPO de peça no catálogo — não uma unidade física.
 *
 * Contraste com Moto: lá 1 linha = 1 chassi real. Aqui 1 linha = "pastilha de
 * freio dianteira", e o quanto existe de cada uma vive em PecaEstoque, por local.
 */
class Peca extends Model
{
    use HasFactory, SoftDeletes, LogsActivity;

    protected $fillable = [
        'codigo',
        'descricao',
        'unidade',
        'categoria',
        'tipo_item', // especifica | universal | indefinido
        'marca',
        'aplicacao',
        'codigo_barras',
        'codigo_ncm',
        'preco_referencia',
        'custo_aquisicao',
        'origem',
        'sincronizado_em',
        'ultima_entrada',
        'ultima_saida',
        'ativo',
    ];

    protected $casts = [
        // aplicacao é texto livre vindo do Microwork ("JET 125/50"),
        // não uma lista — ver migration 2026_08_14_100600.
        'preco_referencia' => 'decimal:2',
        'custo_aquisicao'  => 'decimal:2',
        'sincronizado_em'  => 'datetime',
        'ultima_entrada'   => 'date',
        'ultima_saida'     => 'date',
        'ativo'            => 'boolean',
    ];

    public const ORIGEM_MICROWORK = 'microwork';
    public const ORIGEM_MANUAL    = 'manual';

    public function estoques()
    {
        return $this->hasMany(PecaEstoque::class);
    }

    /** Modelos em que esta peça serve. */
    public function aplicacoes()
    {
        return $this->hasMany(PecaAplicacao::class);
    }

    /**
     * Saldo espelhado do Microwork, por empresa. Informativo — ver
     * PecaSaldoExterno. Não use para reserva ou baixa.
     */
    public function saldosExternos()
    {
        return $this->hasMany(PecaSaldoExterno::class);
    }

    /**
     * Serve em qualquer moto (acessório, vestuário, consumível).
     * Não é o mesmo que "aplicação desconhecida" — ver tipo_item.
     */
    public function isUniversal(): bool
    {
        return $this->tipo_item === 'universal';
    }

    /** Peça específica cuja aplicação ninguém preencheu ainda. */
    public function precisaConferencia(): bool
    {
        return $this->tipo_item === 'indefinido';
    }

    /** Filtra por família de modelo (JEF, SHI, STORM...). */
    public function scopeParaModelo($query, ?string $familia)
    {
        if (! $familia) {
            return $query;
        }

        return $query->whereHas('aplicacoes', fn ($q) => $q->daFamilia($familia));
    }

    public function movimentos()
    {
        return $this->hasMany(PecaMovimento::class);
    }

    /** Itens de carga que transportam esta peça. */
    public function itensCarga()
    {
        return $this->morphMany(RomaneioItem::class, 'itemable');
    }

    /** Saldo desta peça em um local específico. */
    public function estoqueEm(int $localId): ?PecaEstoque
    {
        return $this->estoques()->where('local_id', $localId)->first();
    }

    /**
     * Cadastro sincronizado do Microwork: o sync externo é dono deste
     * registro e pode sobrescrevê-lo. Cadastro manual, não.
     */
    public function isSincronizada(): bool
    {
        return $this->origem === self::ORIGEM_MICROWORK;
    }

    public function scopeAtivas($query)
    {
        return $query->where('ativo', true);
    }

    /** Busca por código, descrição ou código de barras. */
    public function scopeBusca($query, ?string $termo)
    {
        $termo = trim((string) $termo);
        if ($termo === '') {
            return $query;
        }

        return $query->where(function ($q) use ($termo) {
            $q->where('codigo', 'like', "%{$termo}%")
              ->orWhere('descricao', 'like', "%{$termo}%")
              ->orWhere('codigo_barras', $termo);
        });
    }

    public function getActivitylogOptions(): LogOptions
    {
        return LogOptions::defaults()
            ->logOnly(['codigo', 'descricao', 'preco_referencia', 'ativo'])
            ->logOnlyDirty()
            ->dontSubmitEmptyLogs()
            ->useLogName('peca')
            ->setDescriptionForEvent(fn (string $eventName) => "Peça foi {$eventName}");
    }
}
