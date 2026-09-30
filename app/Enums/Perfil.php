<?php

namespace App\Enums;

/**
 * Perfil de acesso do usuário (`users.perfil`).
 *
 * Fonte única dos quatro valores que viviam como texto solto em rotas, Gates,
 * validação e dezenas de comparações. Um perfil digitado errado numa rota
 * (`check_perfil:gestro`) negava acesso em silêncio; resolvido por aqui, ele
 * quebra na hora — ver CheckPerfil.
 *
 * SEM CAST NO MODEL, DE PROPÓSITO
 * `users.perfil` continua string: as comparações `$user->perfil === 'admin'`
 * espalhadas pelo código deixariam de bater com um enum, e a quebra seria
 * silenciosa (acesso negado, não erro). A migração é por módulo; em código
 * novo use `$user->temPerfil(Perfil::Cd, ...)`.
 */
enum Perfil: string
{
    case Admin  = 'admin';
    case Gestor = 'gestor';
    case Cd     = 'cd';
    case Loja   = 'loja';

    /**
     * Quem acompanha pedidos e devoluções de qualquer filial — é o trabalho
     * deles. Loja só enxerga o que participa.
     *
     * @return list<self>
     */
    public static function operacaoCentral(): array
    {
        return [self::Admin, self::Gestor, self::Cd];
    }

    /** @return list<string> */
    public static function valores(): array
    {
        return array_column(self::cases(), 'value');
    }
}
