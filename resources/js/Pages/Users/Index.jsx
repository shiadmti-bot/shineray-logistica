import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
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
        <AuthenticatedLayout user={auth.user} header={<h2 className="font-bold text-2xl text-gray-800">Gestão de Acessos</h2>}>
            <Head title="Usuários" />

            <div className="py-12 bg-gray-100 min-h-screen">
                <div className="max-w-7xl mx-auto sm:px-6 lg:px-8">

                    {/* Barra de Busca e Botão Novo */}
                    <div className="flex flex-col md:flex-row justify-between items-center mb-6 gap-4">
                        <form onSubmit={handleSearch} className="w-full md:w-1/2 relative">
                            <input
                                type="text"
                                placeholder="🔍 Buscar nome, email ou loja..."
                                value={term}
                                onChange={(e) => setTerm(e.target.value)}
                                className="w-full border-gray-300 rounded-full pl-5 pr-12 shadow-sm focus:border-red-500 focus:ring-red-500"
                            />
                            <button type="submit" className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-red-600">
                                ➜
                            </button>
                        </form>
                        <Link href={route('users.create')} className="w-full md:w-auto bg-red-700 text-white px-6 py-2 rounded-full font-bold shadow hover:bg-red-800 transition text-center">
                            + Novo Usuário
                        </Link>
                    </div>

                    {/* Tabela de Usuários */}
                    <div className="bg-white shadow-sm sm:rounded-lg overflow-hidden border-t-4 border-gray-800">
                        <div className="overflow-x-auto">
                            <table className="min-w-full divide-y divide-gray-200">
                                <thead className="bg-gray-50">
                                    <tr>
                                        <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase">Status / Nome</th>
                                        <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase">Perfil</th>
                                        <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase">Filial / Local</th>
                                        <th className="px-6 py-3 text-center text-xs font-bold text-gray-500 uppercase">Logística & Fluxo (V2)</th>
                                        <th className="px-6 py-3 text-right text-xs font-bold text-gray-500 uppercase">Ações</th>
                                    </tr>
                                </thead>
                                <tbody className="bg-white divide-y divide-gray-200">
                                    {users.data.map((user) => (
                                        <tr key={user.id} className="hover:bg-gray-50 transition">
                                            <td className="px-6 py-4">
                                                <div className="flex items-center gap-4">
                                                    {/* Avatar */}
                                                    <div className="relative">
                                                        <div className={`w-10 h-10 rounded-full flex items-center justify-center text-lg font-bold text-white uppercase shadow-sm ${user.is_online ? 'bg-green-600' : 'bg-gray-400'}`}>
                                                            {user.name.charAt(0)}
                                                        </div>
                                                        {user.is_online && (
                                                            <span className="absolute bottom-0 right-0 w-3 h-3 bg-green-400 border-2 border-white rounded-full animate-pulse"></span>
                                                        )}
                                                    </div>
                                                    {/* Info */}
                                                    <div>
                                                        <div className="text-sm font-bold text-gray-900 flex items-center gap-2">
                                                            {user.name}
                                                        </div>
                                                        <div className="text-xs text-gray-500">{user.email}</div>
                                                        <div className="text-[10px] text-gray-400 mt-1 font-mono">
                                                            {user.last_seen_human ? `🕒 ${user.last_seen_human}` : ''}
                                                        </div>
                                                    </div>
                                                </div>
                                            </td>

                                            <td className="px-6 py-4">
                                                <BadgePerfil perfil={user.perfil} />
                                            </td>

                                            <td className="px-6 py-4 text-sm text-gray-700">
                                                {user.filial || <span className="text-gray-400 italic">Matriz</span>}
                                            </td>

                                            {/* --- COLUNA INTERATIVA V2 --- */}
                                            <td className="px-6 py-4 text-center">
                                                {user.perfil === 'loja' ? (
                                                    <button 
                                                        onClick={() => toggleRota(user)}
                                                        className={`w-full md:w-auto px-3 py-1.5 rounded-full text-xs font-bold border transition-all flex items-center justify-center gap-2 shadow-sm hover:shadow-md hover:scale-105 ${
                                                            user.is_interior 
                                                                ? 'bg-orange-50 text-orange-700 border-orange-200 hover:bg-orange-100' 
                                                                : 'bg-green-50 text-green-700 border-green-200 hover:bg-green-100'
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
                                                    <span className="text-gray-300 text-xs">-</span>
                                                )}
                                            </td>

                                            <td className="px-6 py-4 text-right">
                                                <div className="flex justify-end gap-2">
                                                    <Link
                                                        href={route('users.edit', user.id)}
                                                        className="text-indigo-600 hover:text-indigo-900 font-bold text-xs uppercase border border-indigo-200 px-3 py-1 rounded hover:bg-indigo-50 transition"
                                                    >
                                                        Editar
                                                    </Link>

                                                    <button
                                                        onClick={() => handleDelete(user.id)}
                                                        className="text-red-600 hover:text-red-900 font-bold text-xs uppercase border border-red-200 px-3 py-1 rounded hover:bg-red-50 transition"
                                                    >
                                                        Remover
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}

                                    {users.data.length === 0 && (
                                        <tr>
                                            <td colSpan="5" className="px-6 py-10 text-center text-gray-500">
                                                Nenhum usuário encontrado.
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>

                        {/* Paginação */}
                        {users.links.length > 3 && (
                            <div className="px-6 py-4 border-t border-gray-200 bg-gray-50 flex justify-center">
                                {users.links.map((link, key) => (
                                    link.url ? (
                                        <Link
                                            key={key}
                                            href={link.url}
                                            className={`px-3 py-1 mx-1 rounded border text-sm ${link.active ? 'bg-red-700 text-white border-red-700' : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-100'}`}
                                            dangerouslySetInnerHTML={{ __html: link.label }}
                                        />
                                    ) : (
                                        <span key={key} className="px-3 py-1 mx-1 text-sm text-gray-400" dangerouslySetInnerHTML={{ __html: link.label }} />
                                    )
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </AuthenticatedLayout>
    );
}

function BadgePerfil({ perfil }) {
    const config = {
        admin: { label: 'ADMIN / AUDITOR', class: 'bg-black text-white' },
        gestor: { label: 'DIRETORIA', class: 'bg-orange-100 text-orange-800 border border-orange-200' },
        cd: { label: 'OPERADOR CD', class: 'bg-blue-100 text-blue-800 border border-blue-200' },
        loja: { label: 'LOJA / REVENDA', class: 'bg-gray-100 text-gray-800 border border-gray-200' },
    }[perfil] || { label: perfil, class: 'bg-gray-100 text-gray-600' };

    return <span className={`px-2 py-1 rounded text-[10px] font-bold uppercase tracking-wide ${config.class}`}>{config.label}</span>;
}