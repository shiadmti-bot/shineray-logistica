import AppLayout from '@/Layouts/AppLayout';
import { PageHeader } from '@/Components/UI';
import { Head, useForm, Link } from '@inertiajs/react';
import Swal from 'sweetalert2';

export default function UserEdit({ auth, usuario, filiais, rotas }) {
    
    const { data, setData, put, processing, errors } = useForm({
        name: usuario.name,
        email: usuario.email,
        perfil: usuario.perfil,
        filial: usuario.filial || '',
        default_route_id: usuario.default_route_id || '',
        is_interior: Boolean(usuario.is_interior), // <--- NOVO: Controla Capital vs Interior
        valida_pecas: Boolean(usuario.valida_pecas), // <--- V3.1: Assina a liberação de peças
        password: '',
        password_confirmation: ''
    });

    const submit = (e) => {
        e.preventDefault();
        put(route('users.update', usuario.id), {
            onSuccess: () => Swal.fire({
                title: 'Sucesso', 
                text: 'Dados e regras logísticas atualizados.', 
                icon: 'success',
                timer: 2000,
                showConfirmButton: false
            }),
            onError: () => Swal.fire('Erro', 'Verifique os campos.', 'error'),
        });
    };

    return (
        <AppLayout user={auth.user}>
            <Head title={`Editar ${usuario.name}`} />
            <PageHeader
                title="Editar Acesso"
                breadcrumbs={[
                    { label: 'Início', href: route('dashboard') },
                    { label: 'Usuários', href: route('users.index') },
                    { label: 'Editar' },
                ]}
            />

            <div className="max-w-4xl mx-auto sm:px-6 lg:px-8">
                <form onSubmit={submit} className="bg-surface-card p-8 shadow-lg rounded-xl border-t-4 border-brand-600">
                        <div className="flex justify-between items-center mb-6">
                            <h3 className="text-lg font-bold text-content-secondary">Dados da Conta</h3>
                            <span className="text-xs text-content-muted">Editando ID: #{usuario.id}</span>
                        </div>

                        <div className="grid grid-cols-1 gap-6">
                            
                            {/* --- TIPO DE PERFIL --- */}
                            <div>
                                <label className="block text-sm font-bold text-content-secondary mb-2">Tipo de Acesso</label>
                                <div className="flex gap-2 flex-wrap md:flex-nowrap">
                                    {['loja', 'cd', 'admin', 'gestor'].map((tipo) => (
                                        <label key={tipo} className={`flex-1 border rounded-lg p-3 cursor-pointer text-center uppercase font-bold text-sm transition ${data.perfil === tipo ? 'bg-brand-50 border-brand-500 text-brand-700 shadow-sm' : 'border-line hover:border-line-strong text-content-muted'}`}>
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

                            {/* --- DADOS PESSOAIS --- */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div>
                                    <label className="block text-sm font-bold text-content-secondary">Nome do Responsável / Loja</label>
                                    <input
                                        type="text"
                                        className="mt-1 w-full border-line-strong rounded shadow-sm focus:border-brand-500 focus:ring-brand-500"
                                        value={data.name}
                                        onChange={e => setData('name', e.target.value)}
                                        required
                                    />
                                    {errors.name && <div className="text-status-danger-fg text-xs mt-1">{errors.name}</div>}
                                </div>

                                <div>
                                    <label className="block text-sm font-bold text-content-secondary">E-mail de Acesso</label>
                                    <input
                                        type="email"
                                        className="mt-1 w-full border-line-strong rounded shadow-sm bg-surface-sunken focus:bg-surface-card transition"
                                        value={data.email}
                                        onChange={e => setData('email', e.target.value)}
                                        required
                                    />
                                    {errors.email && <div className="text-status-danger-fg text-xs mt-1">{errors.email}</div>}
                                </div>
                            </div>

                            {/* --- FILIAL (Select) --- */}
                            {data.perfil === 'loja' && (
                                <div className="bg-surface-sunken p-4 rounded-lg border border-line space-y-4">
                                    <div>
                                        <label className="block text-sm font-bold text-content-secondary mb-1">Loja / Filial Vinculada</label>
                                        <select
                                            className="w-full border-line-strong rounded shadow-sm focus:border-brand-500 focus:ring-brand-500"
                                            value={data.filial}
                                            onChange={e => setData('filial', e.target.value)}
                                        >
                                            <option value="">-- Selecione --</option>
                                            {filiais && filiais.map((f) => (
                                                <option key={f.id} value={`${f.cidade}/${f.uf}`}>
                                                    {f.uf} - {f.cidade} - {f.nome}
                                                </option>
                                            ))}
                                            <option value="Matriz">Matriz</option>
                                        </select>
                                    </div>

                                    {/* --- NOVA SEÇÃO: MODELO LOGÍSTICO (Capital vs Interior) --- */}
                                    <div>
                                        <label className="block text-xs font-black text-content-muted uppercase mb-2 tracking-wide">Modelo Logístico</label>
                                        
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                            {/* Opção 1: Capital */}
                                            <div 
                                                onClick={() => setData('is_interior', false)}
                                                className={`cursor-pointer border-2 rounded-lg p-3 flex items-center gap-3 transition-all relative overflow-hidden ${
                                                    !data.is_interior 
                                                        ? 'bg-surface-card border-status-success-solid shadow-md ring-2 ring-status-success-solid/20' 
                                                        : 'bg-surface-card border-line opacity-60 hover:opacity-100 hover:border-status-success-solid/40'
                                                }`}
                                            >
                                                <div className={`w-10 h-10 rounded-full flex items-center justify-center text-xl ${!data.is_interior ? 'bg-status-success-bg text-status-success-fg' : 'bg-surface-sunken text-content-muted'}`}>⚡</div>
                                                <div>
                                                    <div className="font-bold text-sm text-content-primary">Capital / Direto</div>
                                                    <div className="text-xs text-content-muted">Fluxo Loja ➔ Loja</div>
                                                </div>
                                                {!data.is_interior && <div className="absolute top-2 right-2 text-status-success-solid text-xs font-bold">ATIVO</div>}
                                            </div>

                                            {/* Opção 2: Interior */}
                                            <div 
                                                onClick={() => setData('is_interior', true)}
                                                className={`cursor-pointer border-2 rounded-lg p-3 flex items-center gap-3 transition-all relative overflow-hidden ${
                                                    data.is_interior 
                                                        ? 'bg-surface-card border-status-warning-solid shadow-md ring-2 ring-status-warning-solid/20' 
                                                        : 'bg-surface-card border-line opacity-60 hover:opacity-100 hover:border-status-warning-solid/40'
                                                }`}
                                            >
                                                <div className={`w-10 h-10 rounded-full flex items-center justify-center text-xl ${data.is_interior ? 'bg-status-warning-bg text-status-warning-fg' : 'bg-surface-sunken text-content-muted'}`}>🏭</div>
                                                <div>
                                                    <div className="font-bold text-sm text-content-primary">Interior / Hub</div>
                                                    <div className="text-xs text-content-muted">Obrigatório passar pelo CD</div>
                                                </div>
                                                {data.is_interior && <div className="absolute top-2 right-2 text-status-warning-fg text-xs font-bold">ATIVO</div>}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* --- ROTA PADRÃO (Opcional) --- */}
                            {(data.perfil === 'loja' || data.perfil === 'cd') && (
                                <div className="bg-status-info-bg p-5 rounded-lg border border-status-info-solid/30 mt-2 shadow-inner">
                                    <div className="flex items-start gap-3">
                                        <span className="text-2xl">🚚</span>
                                        <div className="flex-1">
                                            <h4 className="font-bold text-status-info-fg text-sm">Rota Logística Preferencial</h4>
                                            <p className="text-xs text-status-info-fg mb-3">
                                                Usada para destacar datas no calendário logístico.
                                            </p>
                                            
                                            <select
                                                className="w-full border-status-info-solid/40 rounded text-sm text-status-info-fg font-bold focus:ring-status-info-solid shadow-sm"
                                                value={data.default_route_id}
                                                onChange={e => setData('default_route_id', e.target.value)}
                                            >
                                                <option value="">-- Sem Rota Definida --</option>
                                                {rotas && rotas.map((rota) => (
                                                    <option key={rota.id} value={rota.id}>
                                                        [{rota.code}] {rota.name ? `- ${rota.name}` : ''}
                                                    </option>
                                                ))}
                                            </select>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* --- VALIDAÇÃO DE PEÇAS (Gate 1) ---
                                Atribuição, não perfil: quem tem esta marca assina a liberação
                                dos pedidos de peça, sem perder nada do acesso que já tem. */}
                            {data.perfil !== 'loja' && (
                                <div className="bg-surface-sunken p-5 rounded-lg border border-line mt-2">
                                    <label className="flex items-start gap-3 cursor-pointer">
                                        <input
                                            type="checkbox"
                                            className="mt-1 rounded border-line-strong text-brand-600 focus:ring-brand-500"
                                            checked={Boolean(data.valida_pecas)}
                                            onChange={e => setData('valida_pecas', e.target.checked)}
                                        />
                                        <div className="flex-1">
                                            <h4 className="font-bold text-content-primary text-sm">
                                                Pode liberar pedidos de peça
                                            </h4>
                                            <p className="text-xs text-content-muted mt-1">
                                                Nenhuma peça é separada antes desta liberação. Marque apenas
                                                quem confere o código e o preço com o Pós-Venda.
                                            </p>
                                        </div>
                                    </label>
                                </div>
                            )}

                            {/* --- ALTERAR SENHA --- */}
                            <div className="border-t pt-6 mt-2">
                                <h4 className="text-sm font-bold text-content-muted uppercase mb-4">Alterar Senha (Opcional)</h4>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div>
                                        <label className="block text-sm font-bold text-content-secondary">Nova Senha</label>
                                        <input
                                            type="password"
                                            className="mt-1 w-full border-line-strong rounded shadow-sm placeholder-content-muted text-sm"
                                            placeholder="Deixe vazio para manter a atual"
                                            value={data.password}
                                            onChange={e => setData('password', e.target.value)}
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-sm font-bold text-content-secondary">Confirmar Nova Senha</label>
                                        <input
                                            type="password"
                                            className="mt-1 w-full border-line-strong rounded shadow-sm placeholder-content-muted text-sm"
                                            placeholder="Repita a nova senha"
                                            value={data.password_confirmation}
                                            onChange={e => setData('password_confirmation', e.target.value)}
                                        />
                                    </div>
                                </div>
                                {errors.password && <div className="text-status-danger-fg text-xs mt-2">{errors.password}</div>}
                            </div>

                        </div>

                        {/* --- RODAPÉ DE AÇÃO --- */}
                        <div className="mt-8 flex justify-end gap-4 border-t pt-6">
                            <Link 
                                href={route('users.index')} 
                                className="px-6 py-2 border border-line-strong rounded text-content-secondary font-bold hover:bg-surface-sunken transition"
                            >
                                Cancelar
                            </Link>
                            <button
                                type="submit"
                                disabled={processing}
                                className="bg-brand-700 text-white px-8 py-2 rounded font-bold hover:bg-brand-800 shadow-md transition transform hover:-translate-y-0.5"
                            >
                                {processing ? 'Salvando...' : 'Salvar Alterações'}
                            </button>
                        </div>

                    </form>
            </div>
        </AppLayout>
    );
}