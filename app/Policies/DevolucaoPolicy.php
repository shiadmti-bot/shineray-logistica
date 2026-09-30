<?php

namespace App\Policies;

use App\Enums\Perfil;
use App\Models\Devolucao;
use App\Models\User;
use App\Services\Devolucao\ChecklistMoto;
use Illuminate\Auth\Access\Response;

/**
 * Quem enxerga e quem escreve numa devolução.
 *
 * Só o QUEM mora aqui. O QUANDO — a etapa ainda aberta, a devolução ainda em
 * rascunho — é estado do documento e continua no controller, respondendo 422
 * com a explicação, não 403.
 */
class DevolucaoPolicy
{
    public function view(User $user, Devolucao $devolucao): Response
    {
        return $user->temPerfil(...Perfil::operacaoCentral()) || $devolucao->user_id === $user->id
            ? Response::allow()
            : Response::deny('Esta devolução não é da sua loja.');
    }

    /** Alterar dados, enviar e cancelar: a loja que abriu (admin por herança). */
    public function editar(User $user, Devolucao $devolucao): Response
    {
        return $user->temPerfil(Perfil::Admin) || $devolucao->user_id === $user->id
            ? Response::allow()
            : Response::deny('Só a loja que abriu a devolução pode alterá-la.');
    }

    /**
     * Quem pode escrever em cada ponta.
     *
     * A separação é o ponto do desenho: o valor do documento vem de as duas
     * conferências serem feitas por lados opostos da entrega. Deixar o CD
     * preencher o checklist de origem, ou a loja o de destino, transformaria o
     * dossiê numa formalidade.
     */
    public function conferirEtapa(User $user, Devolucao $devolucao, string $etapa): Response
    {
        if ($etapa === ChecklistMoto::ETAPA_DESTINO) {
            return $user->temPerfil(Perfil::Cd, Perfil::Admin)
                ? Response::allow()
                : Response::deny('A conferência de destino é do CD, que é quem recebe a moto.');
        }

        return $this->editar($user, $devolucao);
    }
}
