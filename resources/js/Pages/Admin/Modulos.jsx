import { useState } from 'react';
import { Head, router } from '@inertiajs/react';
import Swal from 'sweetalert2';
import { InformationCircleIcon, PowerIcon } from '@heroicons/react/24/outline';
import { Alert, Button, Card, PageHeader } from '@/Components/UI';

/**
 * Gestão > Módulos — ligar e desligar módulos opcionais. Rota: modulos.index, só admin.
 *
 * Desligar congela o fluxo do módulo: o menu esconde as entradas e o servidor
 * barra as rotas (ExigirModulo). O que já existe continua consultável onde
 * aparece em outras telas, como a lista de pedidos.
 */
export default function Modulos({ modulos }) {
    const [enviando, setEnviando] = useState(null);

    const alternar = (modulo) => {
        const ligar = !modulo.ativo;

        Swal.fire({
            title: ligar ? `Ligar “${modulo.rotulo}”?` : `Desligar “${modulo.rotulo}”?`,
            text: ligar
                ? 'As telas do módulo voltam ao menu de quem tem acesso.'
                : modulo.em_andamento > 0
                    ? `Há ${modulo.em_andamento} registro(s) em andamento. Eles ficam parados até o módulo ser ligado de novo.`
                    : 'As telas do módulo saem do menu e deixam de abrir para todos os usuários.',
            icon: ligar ? 'question' : 'warning',
            showCancelButton: true,
            confirmButtonText: ligar ? 'Sim, ligar' : 'Sim, desligar',
            cancelButtonText: 'Cancelar',
            confirmButtonColor: ligar ? '#059669' : '#dc2626',
        }).then((resposta) => {
            if (!resposta.isConfirmed) return;

            setEnviando(modulo.chave);
            router.patch(
                route('modulos.atualizar', modulo.chave),
                { ativo: ligar },
                { preserveScroll: true, onFinish: () => setEnviando(null) }
            );
        });
    };

    return (
        <>
            <Head title="Módulos" />
            <PageHeader
                title="Módulos do sistema"
                description="Ligue ou desligue os módulos que estão sendo liberados aos poucos."
                breadcrumbs={[{ label: 'Gestão' }, { label: 'Módulos' }]}
            />

            <div className="space-y-4">
                <Alert tone="info" icon={InformationCircleIcon} title="Como funciona">
                    Um módulo desligado sai do menu e as telas dele deixam de abrir, para todos os perfis. Nada é
                    apagado: ao ligar de novo, tudo volta como estava. O menu dos demais usuários pode levar até 30
                    segundos para mudar.
                </Alert>

                {modulos.map((modulo) => (
                    <Card key={modulo.chave}>
                        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                            <div className="min-w-0 space-y-2">
                                <div className="flex flex-wrap items-center gap-2">
                                    <h2 className="text-base font-bold text-content-primary">{modulo.rotulo}</h2>
                                    <span
                                        className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-bold ring-1 ring-inset ${
                                            modulo.ativo
                                                ? 'bg-status-success-bg text-status-success-fg ring-status-success-solid/30'
                                                : 'bg-status-neutral-bg text-status-neutral-fg ring-status-neutral-solid/30'
                                        }`}
                                    >
                                        <span
                                            className={`h-1.5 w-1.5 rounded-full ${
                                                modulo.ativo ? 'bg-status-success-solid' : 'bg-status-neutral-solid'
                                            }`}
                                        />
                                        {modulo.ativo ? 'Ligado' : 'Desligado'}
                                    </span>
                                </div>

                                <p className="text-sm text-content-secondary">{modulo.descricao}</p>

                                <p className="text-xs text-content-muted">
                                    {modulo.alterado_por
                                        ? `Alterado por ${modulo.alterado_por} em ${new Date(modulo.alterado_em).toLocaleString('pt-BR')}.`
                                        : `Estado padrão (${modulo.padrao ? 'ligado' : 'desligado'}) — ninguém alterou ainda.`}
                                    {modulo.em_andamento > 0 && ` ${modulo.em_andamento} registro(s) em andamento.`}
                                </p>
                            </div>

                            <Button
                                variant={modulo.ativo ? 'secondary' : 'success'}
                                icon={PowerIcon}
                                loading={enviando === modulo.chave}
                                onClick={() => alternar(modulo)}
                                className="shrink-0"
                            >
                                {modulo.ativo ? 'Desligar' : 'Ligar'}
                            </Button>
                        </div>
                    </Card>
                ))}
            </div>
        </>
    );
}
