import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
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
        <AuthenticatedLayout
            user={auth.user}
            header={<h2 className="font-bold text-2xl text-gray-800">✏️ Editar Acesso</h2>}
        >
            <Head title={`Editar ${usuario.name}`} />

            <div className="py-12 bg-gray-100 min-h-screen">
                <div className="max-w-4xl mx-auto sm:px-6 lg:px-8">
                    
                    <form onSubmit={submit} className="bg-white p-8 shadow-lg rounded-xl border-t-4 border-red-600">
                        <div className="flex justify-between items-center mb-6">
                            <h3 className="text-lg font-bold text-gray-700">Dados da Conta</h3>
                            <span className="text-xs text-gray-400">Editando ID: #{usuario.id}</span>
                        </div>

                        <div className="grid grid-cols-1 gap-6">
                            
                            {/* --- TIPO DE PERFIL --- */}
                            <div>
                                <label className="block text-sm font-bold text-gray-700 mb-2">Tipo de Acesso</label>
                                <div className="flex gap-2 flex-wrap md:flex-nowrap">
                                    {['loja', 'cd', 'admin', 'gestor'].map((tipo) => (
                                        <label key={tipo} className={`flex-1 border rounded-lg p-3 cursor-pointer text-center uppercase font-bold text-sm transition ${data.perfil === tipo ? 'bg-red-50 border-red-500 text-red-700 shadow-sm' : 'border-gray-200 hover:border-gray-400 text-gray-500'}`}>
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
                                    <label className="block text-sm font-bold text-gray-700">Nome do Responsável / Loja</label>
                                    <input
                                        type="text"
                                        className="mt-1 w-full border-gray-300 rounded shadow-sm focus:border-red-500 focus:ring-red-500"
                                        value={data.name}
                                        onChange={e => setData('name', e.target.value)}
                                        required
                                    />
                                    {errors.name && <div className="text-red-500 text-xs mt-1">{errors.name}</div>}
                                </div>

                                <div>
                                    <label className="block text-sm font-bold text-gray-700">E-mail de Acesso</label>
                                    <input
                                        type="email"
                                        className="mt-1 w-full border-gray-300 rounded shadow-sm bg-gray-50 focus:bg-white transition"
                                        value={data.email}
                                        onChange={e => setData('email', e.target.value)}
                                        required
                                    />
                                    {errors.email && <div className="text-red-500 text-xs mt-1">{errors.email}</div>}
                                </div>
                            </div>

                            {/* --- FILIAL (Select) --- */}
                            {data.perfil === 'loja' && (
                                <div className="bg-gray-50 p-4 rounded-lg border border-gray-200 space-y-4">
                                    <div>
                                        <label className="block text-sm font-bold text-gray-700 mb-1">Loja / Filial Vinculada</label>
                                        <select
                                            className="w-full border-gray-300 rounded shadow-sm focus:border-red-500 focus:ring-red-500"
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
                                        <label className="block text-xs font-black text-gray-500 uppercase mb-2 tracking-wide">Modelo Logístico (Definição V2)</label>
                                        
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                            {/* Opção 1: Capital */}
                                            <div 
                                                onClick={() => setData('is_interior', false)}
                                                className={`cursor-pointer border-2 rounded-lg p-3 flex items-center gap-3 transition-all relative overflow-hidden ${
                                                    !data.is_interior 
                                                        ? 'bg-white border-green-500 shadow-md ring-2 ring-green-100' 
                                                        : 'bg-white border-gray-200 opacity-60 hover:opacity-100 hover:border-green-300'
                                                }`}
                                            >
                                                <div className={`w-10 h-10 rounded-full flex items-center justify-center text-xl ${!data.is_interior ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-400'}`}>⚡</div>
                                                <div>
                                                    <div className="font-bold text-sm text-gray-800">Capital / Direto</div>
                                                    <div className="text-xs text-gray-500">Fluxo Loja ➔ Loja</div>
                                                </div>
                                                {!data.is_interior && <div className="absolute top-2 right-2 text-green-500 text-xs font-bold">ATIVO</div>}
                                            </div>

                                            {/* Opção 2: Interior */}
                                            <div 
                                                onClick={() => setData('is_interior', true)}
                                                className={`cursor-pointer border-2 rounded-lg p-3 flex items-center gap-3 transition-all relative overflow-hidden ${
                                                    data.is_interior 
                                                        ? 'bg-white border-orange-500 shadow-md ring-2 ring-orange-100' 
                                                        : 'bg-white border-gray-200 opacity-60 hover:opacity-100 hover:border-orange-300'
                                                }`}
                                            >
                                                <div className={`w-10 h-10 rounded-full flex items-center justify-center text-xl ${data.is_interior ? 'bg-orange-100 text-orange-700' : 'bg-gray-100 text-gray-400'}`}>🏭</div>
                                                <div>
                                                    <div className="font-bold text-sm text-gray-800">Interior / Hub</div>
                                                    <div className="text-xs text-gray-500">Obrigatório passar pelo CD</div>
                                                </div>
                                                {data.is_interior && <div className="absolute top-2 right-2 text-orange-500 text-xs font-bold">ATIVO</div>}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* --- ROTA PADRÃO (Opcional) --- */}
                            {(data.perfil === 'loja' || data.perfil === 'cd') && (
                                <div className="bg-blue-50 p-5 rounded-lg border border-blue-200 mt-2 shadow-inner">
                                    <div className="flex items-start gap-3">
                                        <span className="text-2xl">🚚</span>
                                        <div className="flex-1">
                                            <h4 className="font-bold text-blue-900 text-sm">Rota Logística Preferencial</h4>
                                            <p className="text-xs text-blue-600 mb-3">
                                                Usada para destacar datas no calendário logístico.
                                            </p>
                                            
                                            <select
                                                className="w-full border-blue-300 rounded text-sm text-blue-900 font-bold focus:ring-blue-500 shadow-sm"
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

                            {/* --- ALTERAR SENHA --- */}
                            <div className="border-t pt-6 mt-2">
                                <h4 className="text-sm font-bold text-gray-500 uppercase mb-4">Alterar Senha (Opcional)</h4>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div>
                                        <label className="block text-sm font-bold text-gray-700">Nova Senha</label>
                                        <input
                                            type="password"
                                            className="mt-1 w-full border-gray-300 rounded shadow-sm placeholder-gray-400 text-sm"
                                            placeholder="Deixe vazio para manter a atual"
                                            value={data.password}
                                            onChange={e => setData('password', e.target.value)}
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-sm font-bold text-gray-700">Confirmar Nova Senha</label>
                                        <input
                                            type="password"
                                            className="mt-1 w-full border-gray-300 rounded shadow-sm placeholder-gray-400 text-sm"
                                            placeholder="Repita a nova senha"
                                            value={data.password_confirmation}
                                            onChange={e => setData('password_confirmation', e.target.value)}
                                        />
                                    </div>
                                </div>
                                {errors.password && <div className="text-red-500 text-xs mt-2">{errors.password}</div>}
                            </div>

                        </div>

                        {/* --- RODAPÉ DE AÇÃO --- */}
                        <div className="mt-8 flex justify-end gap-4 border-t pt-6">
                            <Link 
                                href={route('users.index')} 
                                className="px-6 py-2 border border-gray-300 rounded text-gray-700 font-bold hover:bg-gray-50 transition"
                            >
                                Cancelar
                            </Link>
                            <button
                                type="submit"
                                disabled={processing}
                                className="bg-red-700 text-white px-8 py-2 rounded font-bold hover:bg-red-800 shadow-md transition transform hover:-translate-y-0.5"
                            >
                                {processing ? 'Salvando...' : 'Salvar Alterações'}
                            </button>
                        </div>

                    </form>
                </div>
            </div>
        </AuthenticatedLayout>
    );
}