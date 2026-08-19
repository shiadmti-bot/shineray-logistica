import AppLayout from './AppLayout';

/**
 * PONTE PARA O SHELL v3.
 *
 * Era o layout completo do sistema (~650 linhas). Virou um adaptador sobre
 * AppLayout para que exista UMA moldura só: com dois shells vivos ao mesmo
 * tempo, navegar entre Dashboard e Peças parecia trocar de produto.
 *
 * A única diferença em relação a usar AppLayout direto é `contained={false}`.
 * As 22 telas legadas trazem o próprio fundo, altura e espaçamento no conteúdo
 * (min-h-screen, bg-surface-sunken, py-8) porque o layout antigo não os fornecia —
 * ligar o container do AppLayout duplicaria margem e fundo em todas elas.
 *
 * Nenhuma das telas precisou ser editada.
 *
 * Ao migrar uma tela para o padrão novo: troque o import para AppLayout,
 * remova o fundo/padding próprios e use Card, PageHeader e DataTable.
 * Dá para fazer uma a uma.
 */
export default function Authenticated({ user, header, children }) {
    return (
        <AppLayout user={user} header={header} contained={false}>
            {children}
        </AppLayout>
    );
}
