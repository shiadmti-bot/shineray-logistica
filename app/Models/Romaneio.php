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

    // --- REGRAS DE FECHAMENTO SEGURO E RASTREIO FÍSICO ---

    /** Pedido nestes status não segura mais a carga ('no_cd' = transbordo). */
    public const PEDIDO_RESOLVIDO = ['concluido', 'cancelado', 'no_cd'];

    /** Moto fisicamente dentro do caminhão, já fora do pátio. */
    public const MOTO_NA_ESTRADA = ['transito_loja', 'em_transito', 'em_transito_cd', 'coletado'];

    /**
     * Fecha a carga se nada mais nela estiver pendente.
     *
     * @return bool true se a carga foi fechada agora
     */
    public function fecharSeTudoEntregue(): bool
    {
        if ($this->status === 'concluido' || ! $this->podeFechar()) {
            return false;
        }

        $this->update(['status' => 'concluido']);

        return true;
    }

    /**
     * A regra de fechamento, sem efeito colateral.
     *
     * Lê o que ESTÁ na carga fisicamente (motos vinculadas a este romaneio_id),
     * nunca pedidos.romaneio_id. Num embarque parcial o pedido aponta só para a
     * ÚLTIMA carga em que teve moto — a carga anterior ficava parecendo vazia
     * e era fechada com moto ainda na estrada.
     */
    public function podeFechar(): bool
    {
        $this->loadMissing('motos.pedidos');

        if ($this->motos->isEmpty()) {
            if (class_exists(\App\Models\RomaneioItem::class)) {
                $temPecas = \App\Models\RomaneioItem::where('romaneio_id', $this->id)
                    ->where('itemable_type', 'App\Models\Peca')
                    ->whereNotIn('status', ['entregue', 'divergencia', 'retornado'])
                    ->exists();
                return !$temPecas;
            }
            return true;
        }

        foreach ($this->motos as $moto) {
            $pedido = $moto->pedidos->first();

            if (! $pedido || ! in_array($pedido->status, self::PEDIDO_RESOLVIDO, true)) {
                return false;
            }
        }

        if (class_exists(\App\Models\RomaneioItem::class)) {
            return ! \App\Models\RomaneioItem::where('romaneio_id', $this->id)
                ->where('itemable_type', 'App\Models\Peca')
                ->whereNotIn('status', ['entregue', 'divergencia', 'retornado'])
                ->exists();
        }

        return true;
    }

    /**
     * Motos que continuam no caminhão desta carga e cujo pedido ainda não foi
     * recebido. Numa carga 'concluido' isto deveria ser sempre vazio; se não
     * for, a carga foi fechada antes da hora.
     */
    public function motosNaEstrada()
    {
        $this->loadMissing('motos.pedidos');

        return $this->motos->filter(function (Moto $moto) {
            $pedido = $moto->pedidos->first();

            return in_array($moto->status, self::MOTO_NA_ESTRADA, true)
                && $pedido
                && ! in_array($pedido->status, self::PEDIDO_RESOLVIDO, true);
        })->values();
    }
}