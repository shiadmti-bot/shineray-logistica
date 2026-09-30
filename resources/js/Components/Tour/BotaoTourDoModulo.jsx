import { useState } from 'react';
import { usePage } from '@inertiajs/react';
import { QuestionMarkCircleIcon } from '@heroicons/react/24/outline';

import MotorDeTour from './MotorDeTour';
import { tourDoModulo } from './passos';

const CHAVE_ARMAZENAMENTO = 'shineray_tour_modulo_';

/**
 * O "?" que abre o passo a passo DESTA tela.
 *
 * Entra no `actions` do PageHeader da página. Não aparece quando o módulo não
 * tem tour para o perfil de quem está olhando — um botão de ajuda que abre um
 * tour vazio ensina a pessoa a ignorar o botão de ajuda.
 *
 * O PONTINHO é para quem nunca rodou o tour daquele módulo. Some depois da
 * primeira conclusão e mora no localStorage por módulo e por usuário: é
 * conveniência de quem está na frente da tela, não dado de operação, e por isso
 * não vai para o banco.
 */
export default function BotaoTourDoModulo({ modulo, className = '' }) {
    const { auth } = usePage().props;
    const perfil = auth?.user?.perfil;
    const userId = auth?.user?.id;

    const tour = tourDoModulo(modulo, perfil);

    const [aberto, setAberto] = useState(false);
    const [visto, setVisto] = useState(() => {
        try {
            return localStorage.getItem(`${CHAVE_ARMAZENAMENTO}${modulo}_${userId}`) === 'true';
        } catch {
            // Janela privada ou armazenamento bloqueado: trata como "já visto"
            // para não insistir com um pontinho que nunca vai desaparecer.
            return true;
        }
    });

    if (!tour) return null;

    const concluir = () => {
        setVisto(true);

        try {
            localStorage.setItem(`${CHAVE_ARMAZENAMENTO}${modulo}_${userId}`, 'true');
        } catch {
            // Sem armazenamento o pontinho volta na próxima visita. Aceitável:
            // a alternativa seria gravar preferência de interface no banco.
        }
    };

    return (
        <>
            <button
                type="button"
                onClick={() => setAberto(true)}
                title={`Passo a passo: ${tour.titulo}`}
                aria-label={`Abrir o passo a passo desta tela: ${tour.titulo}`}
                className={`relative inline-flex items-center gap-1.5 rounded-lg border border-line bg-surface-card px-3 py-2 text-xs font-bold text-content-secondary shadow-xs transition hover:bg-surface-sunken hover:text-content-primary ${className}`}
            >
                <QuestionMarkCircleIcon className="h-4 w-4" />
                <span className="hidden sm:inline">Como usar</span>

                {!visto && (
                    <span
                        aria-hidden="true"
                        className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full bg-brand-600 ring-2 ring-surface-card"
                    />
                )}
            </button>

            {aberto && (
                <MotorDeTour
                    titulo={tour.titulo}
                    passos={tour.passos}
                    onConcluir={concluir}
                    onFechar={() => setAberto(false)}
                />
            )}
        </>
    );
}
