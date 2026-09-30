<?php

namespace App\Policies;

use App\Enums\Perfil;
use App\Models\Basqueta;
use App\Models\User;
use Illuminate\Auth\Access\Response;

/**
 * Quem vê, fatura e confere uma basqueta.
 */
class BasquetaPolicy
{
    /** A tela de basquetas e o faturamento: o Estoque Central. */
    public function acompanhar(User $user): Response
    {
        return $user->temPerfil(...Perfil::operacaoCentral())
            ? Response::allow()
            : Response::deny('Apenas o Estoque Central vê as basquetas.');
    }

    /**
     * O romaneio de peças é o único documento da basqueta que a FILIAL precisa
     * ver — é ela quem confere antes do despacho (Passo 7). Por isso a regra
     * aqui é mais larga que a de `acompanhar`.
     */
    public function view(User $user, Basqueta $basqueta): Response
    {
        return $user->temPerfil(...Perfil::operacaoCentral()) || $user->estoque_local_id === $basqueta->estoque_local_id
            ? Response::allow()
            : Response::deny('Esta basqueta não é da sua loja.');
    }

    /**
     * Quem assina o Gate 2 é a LOJA QUE RECEBE — não os validadores do Gate 1.
     *
     * São confirmações diferentes por desenho: a primeira é do lado que envia,
     * sobre o código estar certo; esta é do lado que recebe, sobre a caixa
     * estar completa. Por isso aqui vale o escopo de destino, e não a
     * atribuição `valida_pecas`.
     *
     * O CD entra junto porque em filial pequena o mesmo caminhão que leva traz
     * a conferência por telefone — e alguém precisa poder registrar. Admin
     * entra por herança, como em todo o resto.
     */
    public function conferir(User $user, Basqueta $basqueta): Response
    {
        return $user->temPerfil(Perfil::Cd, Perfil::Admin) || $user->estoque_local_id === $basqueta->estoque_local_id
            ? Response::allow()
            : Response::deny('Só a filial de destino confere este romaneio.');
    }
}
