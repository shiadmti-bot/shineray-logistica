import AppLayout from '@/Layouts/AppLayout';
import { PageHeader } from '@/Components/UI';
import { Head, useForm, Link } from '@inertiajs/react';

// Agora recebemos também 'rotas' vindo do Controller
export default function UserCreate({ auth, filiais, rotas }) {
    const { data, setData, post, processing, errors } = useForm({
        name: '',
        email: '',
        password: '',
        password_confirmation: '',
        perfil: 'loja', // Padrão
        filial: '',
        default_route_id: '' // Campo da v2.0
    });

    const submit = (e) => {
        e.preventDefault();
        post(route('users.store'));
    };

    return (
        <AppLayout user={auth.user}>
            <Head title="Criar Usuário" />
            <PageHeader
                title="Novo Acesso"
                breadcrumbs={[
                    { label: 'Início', href: route('dashboard') },
                    { label: 'Usuários', href: route('users.index') },
                    { label: 'Novo' },
                ]}
            />

            <div className="max-w-2xl mx-auto sm:px-6 lg:px-8">
                <form onSubmit={submit} className="bg-surface-card p-8 shadow-lg rounded-xl border-t-4 border-brand-600">
                        <h3 className="text-lg font-bold text-content-secondary mb-6">Dados da Conta</h3>

                        <div className="grid grid-cols-1 gap-6">
                            
                            {/* Tipo de Perfil */}
                            <div>
                                <label className="block text-sm font-bold text-content-secondary mb-2">Tipo de Acesso</label>
                                <div className="flex gap-4">
                                    {['loja', 'cd', 'admin', 'gestor'].map((tipo) => (
                                        <label key={tipo} className={`flex-1 border rounded-lg p-3 cursor-pointer text-center uppercase font-bold text-sm transition ${data.perfil === tipo ? 'bg-brand-50 border-brand-500 text-brand-700' : 'border-line hover:border-line-strong'}`}>
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
                                <label className="block text-sm font-bold text-content-secondary">Nome do Responsável / Loja</label>
                                <input type="text" value={data.name} onChange={e => setData('name', e.target.value)} className="w-full border-line-strong rounded mt-1" placeholder="Ex: João Silva ou Loja Centro" required />
                                {errors.name && <div className="text-status-danger-fg text-xs mt-1">{errors.name}</div>}
                            </div>

                            {/* Email */}
                            <div>
                                <label className="block text-sm font-bold text-content-secondary">E-mail de Acesso</label>
                                <input type="email" value={data.email} onChange={e => setData('email', e.target.value)} className="w-full border-line-strong rounded mt-1" placeholder="usuario@shineray.com" required />
                                {errors.email && <div className="text-status-danger-fg text-xs mt-1">{errors.email}</div>}
                            </div>

                            {/* Filial */}
                            {data.perfil === 'loja' && (
                                <div>
                                    <label className="block text-sm font-bold text-content-secondary">Selecione a Loja / Filial</label>
                                    <select
                                        value={data.filial}
                                        onChange={e => setData('filial', e.target.value)}
                                        className="w-full border-line-strong rounded mt-1 text-content-secondary"
                                        required
                                    >
                                        <option value="">-- Selecione na lista --</option>
                                        {filiais && filiais.map((filial) => (
                                            <option key={filial.id} value={`${filial.cidade}/${filial.uf}`}>
                                                {filial.uf} - {filial.cidade} - {filial.nome}
                                            </option>
                                        ))}
                                        <option value="Matriz">Matriz</option>
                                    </select>
                                </div>
                            )}

                            {/* --- CONFIGURAÇÃO LOGÍSTICA --- */}
                            {/* Mostramos para Loja e CD, pois ambos participam da logística */}
                            {(data.perfil === 'loja' || data.perfil === 'cd') && (
                                <div className="bg-status-info-bg p-4 rounded-lg border border-status-info-solid/30 mt-2">
                                    <h4 className="font-bold text-status-info-fg text-sm flex items-center gap-2 mb-2">
                                        🚚 Rota Logística
                                    </h4>
                                    <p className="text-xs text-status-info-fg mb-3">
                                        Vincule este usuário a uma rota oficial para habilitar o calendário de entregas automático.
                                    </p>
                                    
                                    <label className="block text-xs font-bold text-status-info-fg uppercase mb-1">Rota Padrão</label>
                                    <select
                                        value={data.default_route_id}
                                        onChange={e => setData('default_route_id', e.target.value)}
                                        className="w-full border-status-info-solid/40 rounded text-sm text-status-info-fg font-semibold focus:ring-status-info-solid"
                                    >
                                        <option value="">-- Sem Rota Definida --</option>
                                        {rotas && rotas.map((rota) => (
                                            <option key={rota.id} value={rota.id}>
                                                {rota.code} {rota.name ? `- ${rota.name}` : ''}
                                            </option>
                                        ))}
                                    </select>
                                    {errors.default_route_id && <div className="text-status-danger-fg text-xs mt-1">{errors.default_route_id}</div>}
                                </div>
                            )}

                            {/* Senhas */}
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-bold text-content-secondary">Senha</label>
                                    <input type="password" value={data.password} onChange={e => setData('password', e.target.value)} className="w-full border-line-strong rounded mt-1" required />
                                </div>
                                <div>
                                    <label className="block text-sm font-bold text-content-secondary">Confirmar Senha</label>
                                    <input type="password" value={data.password_confirmation} onChange={e => setData('password_confirmation', e.target.value)} className="w-full border-line-strong rounded mt-1" required />
                                </div>
                            </div>
                            {errors.password && <div className="text-status-danger-fg text-xs">{errors.password}</div>}

                        </div>

                        <div className="mt-8 flex justify-end gap-4 border-t pt-6">
                            <Link href={route('users.index')} className="px-6 py-2 border border-line-strong rounded text-content-secondary hover:bg-surface-sunken transition">Cancelar</Link>
                            <button disabled={processing} className="bg-brand-700 text-white px-6 py-2 rounded font-bold hover:bg-brand-800 shadow transition transform hover:-translate-y-0.5">
                                {processing ? 'Salvando...' : 'Criar Conta'}
                            </button>
                        </div>
                    </form>
            </div>
        </AppLayout>
    );
}