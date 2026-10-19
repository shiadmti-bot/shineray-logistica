<?php

namespace App\Services;

use App\Enums\Modulo;
use App\Models\ModuloSistema;
use App\Models\User;
use Illuminate\Database\QueryException;
use Illuminate\Support\Facades\Cache;

/**
 * Quem responde se um módulo opcional está ligado.
 *
 * Ordem de decisão: o que o admin gravou em `modulos_sistema` e, sem
 * registro, o padrão de config/modulos.php.
 *
 * O estado gravado fica em cache (driver do projeto) e é esquecido a cada
 * alteração, então o bloqueio das rotas vale na hora. O menu lê por outro
 * caminho, junto dos contadores (HandleInertiaRequests), e pode levar até
 * 30 s para refletir a mudança.
 *
 * Registrado como `scoped` (um por requisição): middleware, menu e controller
 * perguntam o estado na mesma requisição sem repetir a leitura.
 */
final class Modulos
{
    private const CACHE = 'modulos_sistema';

    private const CACHE_SEGUNDOS = 300;

    /** @var array<string, bool>|null */
    private ?array $estados = null;

    public function ativo(Modulo $modulo): bool
    {
        return $this->estados()[$modulo->value];
    }

    /** @return array<string, bool> chave do módulo => ligado */
    public function estados(): array
    {
        return $this->estados ??= $this->carregar();
    }

    public function definir(Modulo $modulo, bool $ativo, ?User $autor): ModuloSistema
    {
        $registro = ModuloSistema::updateOrCreate(
            ['chave' => $modulo->value],
            ['ativo' => $ativo, 'atualizado_por' => $autor?->id],
        );

        Cache::forget(self::CACHE);
        $this->estados = null;

        return $registro;
    }

    /** @return array<string, bool> */
    private function carregar(): array
    {
        try {
            $gravados = Cache::remember(
                self::CACHE,
                self::CACHE_SEGUNDOS,
                fn () => ModuloSistema::query()->pluck('ativo', 'chave')->map(fn ($ativo) => (bool) $ativo)->all(),
            );
        } catch (QueryException) {
            // Código publicado antes do `migrate` (a Vercel não migra no
            // deploy): sem a tabela, vale o padrão de cada módulo.
            $gravados = [];
        }

        $estados = [];

        foreach (Modulo::cases() as $modulo) {
            $estados[$modulo->value] = array_key_exists($modulo->value, $gravados)
                ? (bool) $gravados[$modulo->value]
                : $modulo->padrao();
        }

        return $estados;
    }
}
