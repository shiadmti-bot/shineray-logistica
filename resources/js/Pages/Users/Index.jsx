import AppLayout from '@/Layouts/AppLayout';
import { PageHeader } from '@/Components/UI';
import { Head, Link, router } from '@inertiajs/react';
import { useState } from 'react';
import Swal from 'sweetalert2';

export default function UsersIndex({ auth, users, filters }) {
    const [term, setTerm] = useState(filters.search || '');

    const handleSearch = (e) => {
        e.preventDefault();
        router.get(route('users.index'), { search: term }, { preserveState: true, replace: true });
    };

    const handleDelete = (id) => {
        if (confirm('Tem certeza que deseja remover o acesso deste usuário?')) {
            router.delete(route('users.destroy', id));
        }
    };

    // --- FUNÇÃO DE ALTERAÇÃO DE FLUXO (V2) ---
    const toggleRota = (user) => {
        Swal.fire({
            title: 'Alterar Logística?',
            text: user.is_interior 
                ? `Mudar ${user.filial} para CAPITAL? (Isso habilitará o fluxo direto Loja->Loja sem passar pelo CD).`
                : `Mudar ${user.filial} para INTERIOR? (Isso obrigará todas as cargas a passarem pelo CD).`,
            icon: 'question',
            showCancelButton: true,
            confirmButtonColor: user.is_interior ? '#16a34a' : '#ea580c', // Verde p/ Capital, Laranja p/ Interior
            cancelButtonColor: '#6b7280',
            confirmButtonText: user.is_interior ? 'Sim, virar Capital' : 'Sim, virar Interior'
        }).then((result) => {
            if (result.isConfirmed) {
                router.patch(route('users.toggle-interior', user.id), {}, {
                    preserveScroll: true,
                    preserveState: false, // <--- FUNDAMENTAL: Força o Inertia a pegar os dados frescos do banco
                    onSuccess: () => {
                        const Toast = Swal.mixin({ toast: true, position: 'top-end', showConfirmButton: false, timer: 3000 });
                        Toast.fire({ 
                            icon: 'success', 
                            title: 'Fluxo Atualizado!',
                            text: `Nova regra aplicada para ${user.filial}`
                        });
                    }
                });
            }
        });
    };

    return (
        <AppLayout user={auth.user}>
            <Head title="Usuários" />
            <PageHeader
                title="Gestão de Acessos"
                breadcrumbs={[
                    { label: 'Início', href: route('dashboard') },
                    { label: 'Usuários' },
                ]}
                actions={
                    <div className="flex flex-col md:flex-row items-center gap-4">
                        <form onSubmit={handleSearch} className="relative w-full md:w-64">
                            <input
                                type="text"
                                placeholder="🔍 Buscar nome, email ou loja..."
                                value={term}
                                onChange={(e) => setTerm(e.target.value)}
                                className="w-full border-line-strong rounded-full pl-5 pr-12 shadow-sm focus:border-brand-500 focus:ring-brand-500 text-sm"
                            />
                            <button type="submit" className="absolute right-3 top-1/2 transform -translate-y-1/2 text-content-muted hover:text-brand-600">
                                ➜
                            </button>
                        </form>
                        <Link href={route('users.create')} className="w-full md:w-auto bg-brand-700 text-white px-6 py-2 rounded-full font-bold shadow hover:bg-brand-800 transition text-center text-sm whitespace-nowrap">
                            + Novo Usuário
                        </Link>
                    </div>
                }
            />

            {/* Tabela de Usuários */}
            <div className="bg-surface-card shadow-sm sm:rounded-lg overflow-hidden border-t-4 border-line-strong">
                        <div className="overflow-x-auto">
                            <table className="min-w-full divide-y divide-line">
                                <thead className="bg-surface-sunken">
                                    <tr>
                                        <th className="px-6 py-3 text-left text-xs font-bold text-content-muted uppercase">Status / Nome</th>
                                        <th className="px-6 py-3 text-left text-xs font-bold text-content-muted uppercase">Perfil</th>
                                        <th className="px-6 py-3 text-left text-xs font-bold text-content-muted uppercase">Filial / Local</th>
                                        <th className="px-6 py-3 text-center text-xs font-bold text-content-muted uppercase">Logística & Fluxo (V2)</th>
                                        <th className="px-6 py-3 text-right text-xs font-bold text-content-muted uppercase">Ações</th>
                                    </tr>
                                </thead>
                                <tbody className="bg-surface-card divide-y divide-line">
                                    {users.data.map((user) => (
                                        <tr key={user.id} className="hover:bg-surface-sunken transition">
                                            <td className="px-6 py-4">
                                                <div className="flex items-center gap-4">
                                                    {/* Avatar */}
                                                    <div className="relative">
                                                        <div className={`w-10 h-10 rounded-full flex items-center justify-center text-lg font-bold text-white uppercase shadow-sm ${user.is_online ? 'bg-status-success-solid' : 'bg-content-muted'}`}>
                                                            {user.name.charAt(0)}
                                                        </div>
                                                        {user.is_online && (
                                                            <span className="absolute bottom-0 right-0 w-3 h-3 bg-status-success-solid border-2 border-white rounded-full animate-pulse"></span>
                                                        )}
                                                    </div>
                                                    {/* Info */}
                                                    <div>
                                                        <div className="text-sm font-bold text-content-primary flex items-center gap-2">
                                                            {user.name}
                                                        </div>
                                                        <div className="text-xs text-content-muted">{user.email}</div>
                                                        <div className="text-[10px] text-content-muted mt-1 font-mono">
                                                            {user.last_seen_human ? `🕒 ${user.last_seen_human}` : ''}
                                                        </div>
                                                    </div>
                                                </div>
                                            </td>

                                            <td className="px-6 py-4">
                                                <BadgePerfil perfil={user.perfil} />
                                            </td>

                                            <td className="px-6 py-4 text-sm text-content-secondary">
                                                {user.filial || <span className="text-content-muted italic">Matriz</span>}
                                            </td>

                                            {/* --- COLUNA INTERATIVA V2 --- */}
                                            <td className="px-6 py-4 text-center">
                                                {user.perfil === 'loja' ? (
                                                    <button 
                                                        onClick={() => toggleRota(user)}
                                                        className={`w-full md:w-auto px-3 py-1.5 rounded-full text-xs font-bold border transition-all flex items-center justify-center gap-2 shadow-sm hover:shadow-md hover:scale-105 ${
                                                            user.is_interior 
                                                                ? 'bg-status-warning-bg text-status-warning-fg border-status-warning-solid/30 hover:bg-status-warning-bg' 
                                                                : 'bg-status-success-bg text-status-success-fg border-status-success-solid/30 hover:bg-status-success-bg'
                                                        }`}
                                                        title="Clique para alterar a regra de roteamento"
                                                    >
                                                        {user.is_interior ? (
                                                            <>
                                                                <span>🏭</span> Interior (Via CD)
                                                            </>
                                                        ) : (
                                                            <>
                                                                <span>⚡</span> Capital (Direto)
                                                            </>
                                                        )}
                                                    </button>
                                                ) : (
                                                    <span className="text-content-muted text-xs">-</span>
                                                )}
                                            </td>

                                            <td className="px-6 py-4 text-right">
                                                <div className="flex justify-end gap-2">
                                                    <Link
                                                        href={route('users.edit', user.id)}
                                                        className="text-status-info-fg hover:text-status-info-fg font-bold text-xs uppercase border border-status-info-solid/30 px-3 py-1 rounded hover:bg-status-info-bg transition"
                                                    >
                                                        Editar
                                                    </Link>

                                                    <button
                                                        onClick={() => handleDelete(user.id)}
                                                        className="text-status-danger-fg hover:brightness-90 font-bold text-xs uppercase border border-status-danger-solid/30 px-3 py-1 rounded hover:bg-brand-50 transition"
                                                    >
                                                        Remover
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}

                                    {users.data.length === 0 && (
                                        <tr>
                                            <td colSpan="5" className="px-6 py-10 text-center text-content-muted">
                                                Nenhum usuário encontrado.
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>

                        {/* Paginação */}
                        {users.links.length > 3 && (
                            <div className="px-6 py-4 border-t border-line bg-surface-sunken flex justify-center">
                                {users.links.map((link, key) => (
                                    link.url ? (
                                        <Link
                                            key={key}
                                            href={link.url}
                                            className={`px-3 py-1 mx-1 rounded border text-sm ${link.active ? 'bg-brand-700 text-white border-brand-700' : 'bg-surface-card text-content-secondary border-line-strong hover:bg-surface-sunken'}`}
                                            dangerouslySetInnerHTML={{ __html: link.label }}
                                        />
                                    ) : (
                                        <span key={key} className="px-3 py-1 mx-1 text-sm text-content-muted" dangerouslySetInnerHTML={{ __html: link.label }} />
                                    )
                                ))}
                            </div>
                        )}
                    </div>
        </AppLayout>
    );
}

function BadgePerfil({ perfil }) {
    const config = {
        admin: { label: 'ADMIN / AUDITOR', class: 'bg-black text-white' },
        gestor: { label: 'DIRETORIA', class: 'bg-status-warning-bg text-status-warning-fg border border-status-warning-solid/30' },
        cd: { label: 'OPERADOR CD', class: 'bg-status-info-bg text-status-info-fg border border-status-info-solid/30' },
        loja: { label: 'LOJA / REVENDA', class: 'bg-surface-sunken text-content-primary border border-line' },
    }[perfil] || { label: perfil, class: 'bg-surface-sunken text-content-secondary' };

    return <span className={`px-2 py-1 rounded text-[10px] font-bold uppercase tracking-wide ${config.class}`}>{config.label}</span>;
}