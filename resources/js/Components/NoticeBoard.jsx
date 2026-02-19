import { useState } from 'react';
import { useForm, router } from '@inertiajs/react';
import { 
    MegaphoneIcon, 
    ChevronDownIcon, 
    PlusIcon, 
    TrashIcon,
    InformationCircleIcon,
    CheckCircleIcon,
    ExclamationTriangleIcon,
    ExclamationCircleIcon
} from '@heroicons/react/24/outline';

export default function NoticeBoard({ notices = [], auth }) {
    const [isOpen, setIsOpen] = useState(false);
    const [isCreating, setIsCreating] = useState(false);

    // Verifica permissão (Admin ou Gestor)
    const canManage = auth.user.perfil === 'admin' || auth.user.perfil === 'gestor';

    // Form do Inertia
    const { data, setData, post, reset, processing, errors } = useForm({
        title: '',
        content: '',
        type: 'info'
    });

    const handleSubmit = (e) => {
        e.preventDefault();
        post(route('notices.store'), {
            onSuccess: () => {
                setIsCreating(false);
                reset();
            }
        });
    };

    const handleDelete = (id) => {
        if (confirm('Tem certeza que deseja remover este aviso?')) {
            router.delete(route('notices.destroy', id));
        }
    };

    // Se não tiver avisos e não for admin, não mostra nada
    if ((!notices || notices.length === 0) && !canManage) return null;

    // Check for new notices (< 24h)
    const hasNewNotices = notices.some(n => new Date() - new Date(n.created_at) < 86400000);

    return (
        <div className="mb-6 bg-white rounded-2xl shadow-sm border border-indigo-100 overflow-hidden">
            {/* Header / Título */}
            <div className={`bg-gradient-to-r from-indigo-600 to-indigo-800 p-4 flex justify-between items-center transition-all ${!isOpen && hasNewNotices ? 'animate-pulse' : ''}`}>
                <div className="flex items-center gap-4 cursor-pointer" onClick={() => setIsOpen(!isOpen)}>
                    <h3 className="text-white font-bold flex items-center gap-2 relative">
                        <MegaphoneIcon className="w-6 h-6 text-white" />
                        Mural de Avisos
                        {notices.length > 0 && (
                            <span className="bg-indigo-500 text-xs px-2 py-0.5 rounded-full border border-indigo-400">
                                {notices.length}
                            </span>
                        )}
                        {!isOpen && hasNewNotices && (
                            <span className="absolute -top-1 -right-2 flex h-3 w-3">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                                <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500"></span>
                            </span>
                        )}
                    </h3>
                </div>

                <div className="flex items-center gap-2">
                    {canManage && (
                        <button 
                            onClick={() => setIsCreating(!isCreating)}
                            className="bg-white/20 hover:bg-white/30 text-white text-xs px-3 py-1.5 rounded-lg font-bold transition flex items-center gap-1"
                        >
                            {isCreating ? 'Cancelar' : (
                                <>
                                    <PlusIcon className="w-4 h-4" /> Novo Aviso
                                </>
                            )}
                        </button>
                    )}
                    <button onClick={() => setIsOpen(!isOpen)} className="text-indigo-200 hover:text-white transition transform duration-200" style={{ transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)' }}>
                        <ChevronDownIcon className="w-5 h-5" />
                    </button>
                </div>
            </div>

            {/* Formulário de Criação (Apenas Admin/Gestor) */}
            {isCreating && canManage && (
                <div className="p-5 bg-indigo-50 border-b border-indigo-100 animate-fade-in-down">
                    <form onSubmit={handleSubmit} className="space-y-3">
                        <div>
                            <input 
                                type="text" 
                                placeholder="Título do Aviso"
                                className="w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 text-sm"
                                value={data.title}
                                onChange={e => setData('title', e.target.value)}
                                required
                            />
                            {errors.title && <div className="text-red-500 text-xs mt-1">{errors.title}</div>}
                        </div>
                        
                        <div className="flex gap-2">
                            <select 
                                className="rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 text-sm"
                                value={data.type}
                                onChange={e => setData('type', e.target.value)}
                            >
                                <option value="info">Informação</option>
                                <option value="success">Sucesso / Novidade</option>
                                <option value="warning">Alerta</option>
                                <option value="danger">Perigo / Urgente</option>
                            </select>
                            
                            <textarea 
                                placeholder="Conteúdo da mensagem (suporta HTML básico)..."
                                className="w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 text-sm"
                                rows="2"
                                value={data.content}
                                onChange={e => setData('content', e.target.value)}
                                required
                            ></textarea>
                        </div>
                        
                        <div className="flex justify-end">
                            <button 
                                type="submit" 
                                disabled={processing}
                                className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-1.5 rounded-md text-sm font-bold shadow-sm transition"
                            >
                                {processing ? 'Enviando...' : 'Publicar Aviso'}
                            </button>
                        </div>
                    </form>
                </div>
            )}

            {/* Lista de Avisos */}
            {isOpen && (
                <div className="divide-y divide-gray-100">
                    {notices.length === 0 ? (
                        <div className="p-8 text-center text-gray-400 text-sm italic">
                            Nenhum aviso no momento.
                        </div>
                    ) : (
                        notices.map((notice) => (
                            <div key={notice.id} className="p-4 hover:bg-gray-50 transition border-l-4 border-l-transparent hover:border-l-indigo-500 group relative">
                                <div className="flex justify-between items-start">
                                    <div className="flex gap-3 w-full">
                                        {/* Ícone por Tipo */}
                                        <div className="mt-1 flex-shrink-0">
                                            {notice.type === 'info' && <InformationCircleIcon className="w-6 h-6 text-blue-500" />}
                                            {notice.type === 'warning' && <ExclamationTriangleIcon className="w-6 h-6 text-yellow-500" />}
                                            {notice.type === 'success' && <CheckCircleIcon className="w-6 h-6 text-green-500" />}
                                            {notice.type === 'danger' && <ExclamationCircleIcon className="w-6 h-6 text-red-500" />}
                                        </div>
                                        
                                        <div className="flex-grow">
                                            <h4 className="font-bold text-gray-800 text-sm md:text-base flex items-center gap-2">
                                                {notice.title}
                                                {/* Badge de Novo (ex: criado hoje) */}
                                                {new Date() - new Date(notice.created_at) < 86400000 && (
                                                    <span className="bg-red-100 text-red-600 text-[10px] px-1.5 rounded uppercase font-bold">Novo</span>
                                                )}
                                            </h4>
                                            <div 
                                                className="text-gray-600 text-sm mt-1 leading-relaxed prose prose-sm max-w-none"
                                                dangerouslySetInnerHTML={{ __html: notice.content }} 
                                            />
                                            
                                            {/* Rodapé do Card */}
                                            <div className="flex items-center gap-2 mt-2">
                                                <span className="text-[10px] text-gray-400 font-mono">
                                                    {new Date(notice.created_at).toLocaleDateString('pt-BR')}
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                    
                                    {/* Botão de Excluir (Admin/Gestor) */}
                                    {canManage && (
                                        <button 
                                            onClick={() => handleDelete(notice.id)}
                                            className="text-gray-300 hover:text-red-600 p-1 rounded transition opacity-0 group-hover:opacity-100 absolute right-4 top-4 bg-white shadow-sm border border-gray-100"
                                            title="Excluir Aviso"
                                        >
                                            <TrashIcon className="w-4 h-4" />
                                        </button>
                                    )}
                                </div>
                            </div>
                        ))
                    )}
                </div>
            )}
        </div>
    );
}
