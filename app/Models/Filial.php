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
     * Usuários ativos vinculados a esta filial.
     */
    public function usuarios()
    {
        $chave = $this->chave_filial;
        $cidade = $this->cidade;
        $nome = $this->nome;
        $local = $this->estoqueLocal();
        $localId = $local?->id;

        return User::where(function ($q) use ($chave, $cidade, $nome, $localId) {
            $q->where('filial', $chave)
              ->orWhere('filial', $nome)
              ->orWhere('filial', 'LIKE', "%{$cidade}%");

            if ($localId) {
                $q->orWhere('estoque_local_id', $localId);
            }
        });
    }

    /**
     * Arquiva (soft-delete) todos os usuários vinculados à filial quando ela for desativada.
     */
    public function arquivarUsuarios(): int
    {
        $usuarios = $this->usuarios()->get();
        $count = 0;

        foreach ($usuarios as $usuario) {
            // Protege o usuário logado para evitar desconectar o próprio administrador
            if (auth()->check() && $usuario->id === auth()->id()) {
                continue;
            }
            // Não arquiva admin geral que não tenha filial vinculada
            if ($usuario->perfil === 'admin' && empty($usuario->filial)) {
                continue;
            }

            $usuario->delete();
            $count++;
        }

        return $count;
    }

    /**
     * Restaura os usuários arquivados da filial quando ela for reativada.
     */
    public function restaurarUsuarios(): int
    {
        $chave = $this->chave_filial;
        $cidade = $this->cidade;
        $nome = $this->nome;
        $local = $this->estoqueLocal();
        $localId = $local?->id;

        $usuariosLixeira = User::onlyTrashed()->where(function ($q) use ($chave, $cidade, $nome, $localId) {
            $q->where('filial', $chave)
              ->orWhere('filial', $nome)
              ->orWhere('filial', 'LIKE', "%{$cidade}%");

            if ($localId) {
                $q->orWhere('estoque_local_id', $localId);
            }
        })->get();

        $count = 0;
        foreach ($usuariosLixeira as $usuario) {
            $usuario->restore();
            $count++;
        }

        return $count;
    }
}