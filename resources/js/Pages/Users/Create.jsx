import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { Head, useForm, Link } from '@inertiajs/react';

// Recebemos 'filiais' vindo do Controller
export default function UserCreate({ auth, filiais }) {
    const { data, setData, post, processing, errors } = useForm({
        name: '',
        email: '',
        password: '',
        password_confirmation: '',
        perfil: 'loja', // Padrão
        filial: ''
    });

    const submit = (e) => {
        e.preventDefault();
        post(route('users.store'));
    };

    return (
        <AuthenticatedLayout user={auth.user} header={<h2 className="font-bold text-2xl text-gray-800">Novo Acesso</h2>}>
            <Head title="Criar Usuário" />

            <div className="py-12 bg-gray-100 min-h-screen">
                <div className="max-w-2xl mx-auto sm:px-6 lg:px-8">
                    
                    <form onSubmit={submit} className="bg-white p-8 shadow-lg rounded-xl border-t-4 border-red-600">
                        <h3 className="text-lg font-bold text-gray-700 mb-6">Dados da Conta</h3>

                        <div className="grid grid-cols-1 gap-6">
                            
                            {/* Tipo de Perfil */}
                            <div>
                                <label className="block text-sm font-bold text-gray-700 mb-2">Tipo de Acesso</label>
                                <div className="flex gap-4">
                                    {['loja', 'cd', 'admin'].map((tipo) => (
                                        <label key={tipo} className={`flex-1 border rounded-lg p-3 cursor-pointer text-center uppercase font-bold text-sm transition ${data.perfil === tipo ? 'bg-red-50 border-red-500 text-red-700' : 'border-gray-200 hover:border-gray-400'}`}>
                                            <input 
                                                type="radio" 
                                                name="perfil" 
                                                value={tipo} 
                                                checked={data.perfil === tipo} 
                                                onChange={e => setData('perfil', e.target.value)} 
                                                className="sr-only"
                                            />
                                            {tipo === 'cd' ? 'Operação CD' : tipo}
                                        </label>
                                    ))}
                                </div>
                            </div>

                            {/* Nome */}
                            <div>
                                <label className="block text-sm font-bold text-gray-700">Nome do Responsável / Loja</label>
                                <input type="text" value={data.name} onChange={e => setData('name', e.target.value)} className="w-full border-gray-300 rounded mt-1" placeholder="Ex: João Silva ou Loja Centro" required />
                                {errors.name && <div className="text-red-500 text-xs mt-1">{errors.name}</div>}
                            </div>

                            {/* Email */}
                            <div>
                                <label className="block text-sm font-bold text-gray-700">E-mail de Acesso</label>
                                <input type="email" value={data.email} onChange={e => setData('email', e.target.value)} className="w-full border-gray-300 rounded mt-1" placeholder="usuario@shineray.com" required />
                                {errors.email && <div className="text-red-500 text-xs mt-1">{errors.email}</div>}
                            </div>

                            {/* Filial (MUDANÇA AQUI: Agora é um Select Automático) */}
                            {data.perfil === 'loja' && (
                                <div>
                                    <label className="block text-sm font-bold text-gray-700">Selecione a Loja / Filial</label>
                                    <select
                                        value={data.filial}
                                        onChange={e => setData('filial', e.target.value)}
                                        className="w-full border-gray-300 rounded mt-1 text-gray-700"
                                        required
                                    >
                                        <option value="">-- Selecione na lista --</option>
                                        {filiais && filiais.map((filial) => (
                                            <option key={filial.id} value={filial.nome}>
                                                {filial.uf} - {filial.nome}
                                            </option>
                                        ))}
                                    </select>
                                    <p className="text-xs text-gray-400 mt-1">A lista carrega as lojas cadastradas no banco.</p>
                                </div>
                            )}

                            {/* Senhas */}
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-bold text-gray-700">Senha</label>
                                    <input type="password" value={data.password} onChange={e => setData('password', e.target.value)} className="w-full border-gray-300 rounded mt-1" required />
                                </div>
                                <div>
                                    <label className="block text-sm font-bold text-gray-700">Confirmar Senha</label>
                                    <input type="password" value={data.password_confirmation} onChange={e => setData('password_confirmation', e.target.value)} className="w-full border-gray-300 rounded mt-1" required />
                                </div>
                            </div>
                            {errors.password && <div className="text-red-500 text-xs">{errors.password}</div>}

                        </div>

                        <div className="mt-8 flex justify-end gap-4 border-t pt-6">
                            <Link href={route('users.index')} className="px-6 py-2 border border-gray-300 rounded text-gray-700 hover:bg-gray-50">Cancelar</Link>
                            <button disabled={processing} className="bg-red-700 text-white px-6 py-2 rounded font-bold hover:bg-red-800 shadow">
                                {processing ? 'Salvando...' : 'Criar Conta'}
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </AuthenticatedLayout>
    );
}