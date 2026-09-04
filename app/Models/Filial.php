<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Filial extends Model
{
    use HasFactory;

    protected $table = 'filials';

    protected $fillable = [
        'nome',
        'cidade',
        'uf',
        'ativo',
        'codigo_empresa',
    ];

    protected $casts = [
        'ativo' => 'boolean',
    ];

    protected $appends = [
        'chave_filial',
        'rotulo_completo',
    ];

    public function scopeAtivas($query)
    {
        return $query->where('ativo', true);
    }

    public function getChaveFilialAttribute(): string
    {
        return "{$this->cidade}/{$this->uf}";
    }

    public function getRotuloCompletoAttribute(): string
    {
        return "[{$this->uf}] {$this->cidade} - {$this->nome}";
    }

    /**
     * Local de estoque associado (V3 / EstoqueLocal).
     */
    public function estoqueLocal(): ?EstoqueLocal
    {
        return EstoqueLocal::where('tipo', EstoqueLocal::TIPO_LOJA)
            ->where(function ($q) {
                $q->where('nome', 'LIKE', "%{$this->cidade}%")
                  ->orWhere('nome', $this->nome);
            })
            ->first();
    }

    /**
     * Usuários vinculados a esta filial.
     */
    public function usuarios()
    {
        $chave = $this->chave_filial;
        return User::where('filial', $chave)
            ->orWhere('filial', $this->nome)
            ->orWhere('filial', 'LIKE', "%{$this->cidade}%");
    }
}