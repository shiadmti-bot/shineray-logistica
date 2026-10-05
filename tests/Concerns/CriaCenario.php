<?php

namespace Tests\Concerns;

use App\Models\Moto;
use App\Models\Pedido;
use App\Models\User;

/**
 * Peças de cenário que quase toda suíte de módulo precisa.
 *
 * As suítes mais antigas mantêm um `usuario()` privado cada; as da varredura
 * de segurança da v3.7 compartilham este. Os nomes e e-mails são únicos por
 * chamada porque a faixa rápida roda num banco persistente (DatabaseTransactions),
 * onde pode haver dados de outras execuções.
 */
trait CriaCenario
{
    protected function usuario(string $perfil, array $extra = []): User
    {
        return User::factory()->create([
            'email'  => "{$perfil}_" . uniqid() . random_int(100, 999) . '@teste.shineray.com.br',
            'perfil' => $perfil,
            ...$extra,
        ]);
    }

    protected function moto(string $status, array $extra = []): Moto
    {
        return Moto::create([
            'chassi'            => '9C2' . str_pad((string) random_int(0, 99_999_999_999_999), 14, '0', STR_PAD_LEFT),
            'modelo'            => 'JET 50',
            'cor'               => 'PRETA',
            'status'            => $status,
            'localizacao_atual' => 'Cenário de teste',
            ...$extra,
        ]);
    }

    /** Pedido de moto; `$origem` presente = transferência entre lojas. */
    protected function pedidoMoto(User $destino, string $status, ?User $origem = null, array $extra = []): Pedido
    {
        return Pedido::create([
            'user_id'        => $destino->id,
            'origem_user_id' => $origem?->id,
            'status'         => $status,
            'tipo_carga'     => 'moto',
            ...$extra,
        ]);
    }

    /** Pedido com uma moto já vinculada (pedido legado, sem cotas). */
    protected function pedidoComMoto(User $destino, string $status, string $statusMoto, ?User $origem = null): array
    {
        $pedido = $this->pedidoMoto($destino, $status, $origem);
        $moto = $this->moto($statusMoto, ['loja_atual_id' => $origem?->id]);

        $pedido->motos()->attach($moto->id, ['destino' => $destino->filial ?? 'Destino']);

        return [$pedido, $moto];
    }
}
