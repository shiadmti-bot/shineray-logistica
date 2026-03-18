import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { Head, router } from '@inertiajs/react';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import interactionPlugin from '@fullcalendar/interaction';
import ptBrLocale from '@fullcalendar/core/locales/pt-br';
import { useState, useEffect } from 'react';
import Swal from 'sweetalert2';
import axios from 'axios';

export default function CalendarIndex({ auth, initialEvents, canEdit, minhaLoja }) {
    const [events, setEvents] = useState(initialEvents || []);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [destinos, setDestinos] = useState([]);
    const [processing, setProcessing] = useState(false);
    
    // Estados do Formulário
    const [selectedDate, setSelectedDate] = useState('');
    const [editingId, setEditingId] = useState(null); // ID do evento sendo editado
    const [form, setForm] = useState({ stops: [''], status: 'planned' });

    useEffect(() => { setEvents(initialEvents || []); }, [initialEvents]);

    useEffect(() => {
        if (canEdit && isModalOpen && destinos.length === 0) {
            axios.get(route('calendar.rotas'))
                .then(res => setDestinos(res.data))
                .catch(err => console.error("Erro rotas:", err));
        }
    }, [canEdit, isModalOpen]);

    const addStop = () => setForm(prev => ({ ...prev, stops: [...prev.stops, ''] }));
    
    const removeStop = (index) => {
        if (form.stops.length === 1) return;
        setForm(prev => ({ ...prev, stops: prev.stops.filter((_, i) => i !== index) }));
    };

    const updateStop = (index, value) => {
        const newStops = [...form.stops];
        newStops[index] = value;
        setForm(prev => ({ ...prev, stops: newStops }));
    };

    // --- CLIQUE NA DATA (CRIAR NOVO) ---
    const handleDateClick = (arg) => {
        if (!canEdit) return;
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const clickedDate = new Date(arg.dateStr + 'T00:00:00');
        
        if (clickedDate < today) {
            Swal.fire({ icon: 'error', title: 'Data Passada', text: 'Não é possível agendar no passado.', timer: 2000, showConfirmButton: false });
            return;
        }

        setSelectedDate(arg.dateStr);
        setEditingId(null); // Modo Criação
        setForm({ stops: [''], status: 'planned' });
        setIsModalOpen(true);
    };

    // --- CLIQUE NO EVENTO (EDITAR OU VISUALIZAR) ---
    const handleEventClick = (info) => {
        const props = info.event.extendedProps;

        // 1. Apenas Visualização (Loja OU Data Passada)
        if (!canEdit || props.is_past) {
            if (!canEdit && !props.is_my_route) {
                Swal.fire({ title: 'Rota Externa', text: 'Esta carga não passa pela sua loja.', icon: 'info' });
                return;
            }
            // Visualização Simples
            Swal.fire({
                title: `<span class="text-lg font-black text-gray-800 uppercase">${info.event.title}</span>`,
                html: `
                    <div class="text-left bg-gray-50 p-4 rounded-lg border border-gray-200 mt-2 text-sm">
                        <div class="mb-2"><strong>📅 Data:</strong> ${new Date(info.event.start).toLocaleDateString('pt-BR')}</div>
                        <div class="mb-2"><strong>🚦 Status:</strong> 
                            <span class="badge ${props.status === 'confirmed' ? 'text-green-600' : 'text-orange-600'} font-bold">
                                ${props.status === 'confirmed' ? 'CONFIRMADO' : 'PLANEJAMENTO'}
                            </span>
                        </div>
                        <div class="mt-3 pt-3 border-t border-gray-200 font-mono text-xs text-gray-600">
                            <strong>Rota:</strong><br/>${props.rota_completa}
                        </div>
                        ${props.is_past ? '<div class="mt-3 text-xs text-red-500 font-bold border-t border-red-100 pt-2">📅 Rota passada (Edição bloqueada)</div>' : ''}
                    </div>
                `,
                confirmButtonColor: '#1f2937'
            });
            return;
        }

        // 2. Edição (CD/Admin)
        // Aqui abrimos o modal com os dados preenchidos para permitir edição completa
        setSelectedDate(info.event.startStr);
        setEditingId(info.event.id);
        
        // Converte os IDs das paradas para strings para o select funcionar
        // props.stops_ids vem do backend com a lista de IDs na ordem
        const stopsIds = props.stops_ids && props.stops_ids.length > 0 
            ? props.stops_ids.map(String) 
            : [''];

        setForm({
            stops: stopsIds,
            status: props.status
        });
        
        setIsModalOpen(true);
    };

    // --- FUNÇÕES DE AÇÃO RÁPIDA (DENTRO DO MODAL OU SWAL) ---
    // Você pode chamar essas funções se quiser adicionar botões de ação direta no modal
    const quickStatusToggle = () => {
        const newStatus = form.status === 'planned' ? 'confirmed' : 'planned';
        setForm(prev => ({ ...prev, status: newStatus }));
        // Se quiser salvar direto sem clicar em "Salvar Rota", chame handleSubmit aqui
    };

    const handleDelete = () => {
        if (!editingId) return;
        
        Swal.fire({
            title: 'Tem certeza?',
            text: "Você excluirá esta rota permanentemente.",
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#d33',
            confirmButtonText: 'Sim, excluir',
            cancelButtonText: 'Cancelar'
        }).then((result) => {
            if (result.isConfirmed) {
                router.delete(route('calendar.destroy', editingId), {
                    onSuccess: () => {
                        setIsModalOpen(false);
                        Swal.fire({ icon: 'success', title: 'Rota excluída', toast: true, position: 'top-end', timer: 2000, showConfirmButton: false });
                    }
                });
            }
        });
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        if (processing) return;
        if (form.stops.some(s => s === '')) return Swal.fire('Atenção', 'Preencha todas as paradas.', 'warning');

        setProcessing(true);
        
        // Se tem editingId, manda o ID para atualizar. Se não, cria.
        const dataToSend = { 
            id: editingId, // Importante: Envia o ID se for edição
            date: selectedDate, 
            ...form 
        };

        router.post(route('calendar.store'), dataToSend, {
            onSuccess: () => {
                setIsModalOpen(false);
                setProcessing(false);
                Swal.fire({ icon: 'success', title: editingId ? 'Rota Atualizada!' : 'Rota Criada!', toast: true, position: 'top-end', timer: 2000, showConfirmButton: false });
            },
            onError: (err) => {
                setProcessing(false);
                Swal.fire('Erro', Object.values(err)[0], 'error');
            }
        });
    };

    // --- RENDERIZAÇÃO DO CARD ---
    function renderEventContent(eventInfo) {
        const props = eventInfo.event.extendedProps;
        const isConfirmed = props.status === 'confirmed';
        
        let containerClass = isConfirmed
            ? "bg-green-100 border-l-4 border-green-500 text-green-900" 
            : "bg-yellow-50 border-l-4 border-yellow-400 text-yellow-900 border-dashed";

        let icon = isConfirmed ? "🚛" : "📋";
        let label = isConfirmed ? "CONFIRMADO" : "PLANEJAMENTO";

        if (!canEdit && !props.is_my_route) {
            containerClass = "bg-gray-100 border-l-4 border-gray-300 text-gray-400 grayscale opacity-60";
            icon = "🔒";
            label = "EXTERNA";
        } else if (props.is_past) {
            if (isConfirmed) {
                // User requirement: Keep original green color instead of gray, just slightly dimmed
                containerClass = "bg-green-100 border-l-4 border-green-500 text-green-800 opacity-85 cursor-not-allowed";
                icon = "✅";
                label = "PASSADO (CONF.)";
            } else {
                containerClass = "bg-gray-50 border-l-4 border-gray-300 text-gray-400 opacity-60 border-dashed text-opacity-80 cursor-not-allowed";
                icon = "⚠️";
                label = "PASSADO (PEND.)";
            }
        }

        return (
            <div className={`w-full p-1.5 rounded-r shadow-sm text-[10px] md:text-xs leading-tight transition hover:brightness-95 cursor-pointer ${containerClass}`}>
                <div className="flex justify-between items-center mb-0.5">
                    <span className="font-black opacity-75 text-[9px] uppercase tracking-wider">{label}</span>
                </div>
                <div className="font-bold truncate flex items-center gap-1">
                    <span>{icon}</span> {eventInfo.event.title}
                </div>
            </div>
        );
    }

    return (
        <AuthenticatedLayout 
            user={auth.user} 
            header={
                <div className="flex items-center gap-2">
                    <h2 className="font-black text-2xl text-gray-800 tracking-tight uppercase">
                        Calendário de <span className="text-red-700">Rotas</span>
                    </h2>
                    {minhaLoja && !canEdit && <span className="text-xs bg-gray-200 text-gray-600 px-2 py-1 rounded font-bold">{minhaLoja}</span>}
                </div>
            }
        >
            <Head title="Logística - Rotas" />

            <div className="py-8 bg-gray-100 min-h-screen font-sans">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    
                    <div className="mb-6 flex flex-wrap gap-4 justify-end text-xs font-bold uppercase text-gray-500">
                        <div className="flex items-center gap-2"><span className="w-3 h-3 bg-green-500 rounded"></span> Confirmado</div>
                        <div className="flex items-center gap-2"><span className="w-3 h-3 bg-yellow-400 rounded border border-yellow-500 border-dashed"></span> Planejamento</div>
                        <div className="flex items-center gap-2"><span className="w-3 h-3 bg-green-300 opacity-80 rounded"></span> Passado (Conf.)</div>
                        <div className="flex items-center gap-2"><span className="w-3 h-3 bg-gray-200 rounded border border-gray-300 border-dashed"></span> Passado (Pend.)</div>
                    </div>

                    <div className="bg-white p-2 md:p-6 rounded-2xl shadow-xl border-t-4 border-red-800 overflow-hidden">
                        <style>{`
                            .fc-col-header-cell { background: #f9fafb; padding: 10px 0; }
                            .fc-day-today { background-color: #fff1f2 !important; }
                            .fc-event { cursor: pointer; }
                            .fc-toolbar-title { font-size: 1.1rem !important; font-weight: 800; text-transform: uppercase; }
                            .fc-button { background: #1f2937 !important; border: none !important; font-weight: bold !important; }
                            .fc-button:hover { background: #000 !important; }
                        `}</style>
                        
                        <FullCalendar
                            plugins={[dayGridPlugin, interactionPlugin]}
                            initialView={canEdit ? "dayGridMonth" : "dayGridWeek"}
                            headerToolbar={{ left: 'prev,today,next', center: 'title', right: canEdit ? 'dayGridMonth,dayGridWeek' : 'dayGridWeek,dayGridMonth' }}
                            locale={ptBrLocale}
                            events={events}
                            eventContent={renderEventContent}
                            dateClick={handleDateClick}
                            eventClick={handleEventClick}
                            height="auto"
                        />
                    </div>
                </div>
            </div>

            {/* MODAL DE CRIAÇÃO / EDIÇÃO */}
            {canEdit && isModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900/80 backdrop-blur-sm p-4 animate-fade-in">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
                        <div className="bg-gray-900 px-6 py-4 flex justify-between items-center text-white">
                            <div>
                                <h3 className="font-bold uppercase tracking-wider">{editingId ? 'Editar Rota' : 'Nova Rota'}</h3>
                                <p className="text-xs text-gray-400">{new Date(selectedDate).toLocaleDateString()}</p>
                            </div>
                            <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-white text-xl">×</button>
                        </div>

                        <form onSubmit={handleSubmit} className="p-6 space-y-4">
                            <div>
                                <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Paradas (Sequência)</label>
                                <div className="space-y-2 max-h-[250px] overflow-y-auto pr-1 custom-scrollbar">
                                    {form.stops.map((stop, index) => (
                                        <div key={index} className="flex gap-2 items-center">
                                            <span className="text-xs font-bold w-6 text-gray-400">{index + 1}º</span>
                                            <select 
                                                className="w-full border-gray-300 rounded-lg text-sm"
                                                value={stop} 
                                                onChange={e => updateStop(index, e.target.value)} 
                                                required
                                            >
                                                <option value="">Selecione...</option>
                                                {destinos.map(l => (
                                                    <option key={l.id} value={l.id} disabled={form.stops.includes(String(l.id)) && stop != l.id}>
                                                        {l.name}
                                                    </option>
                                                ))}
                                            </select>
                                            {form.stops.length > 1 && (
                                                <button type="button" onClick={() => removeStop(index)} className="text-red-400">🗑️</button>
                                            )}
                                        </div>
                                    ))}
                                </div>
                                <button type="button" onClick={addStop} className="mt-2 text-xs font-bold text-blue-600 hover:underline">+ Adicionar Parada</button>
                            </div>

                            <div className="grid grid-cols-2 gap-3 pt-2">
                                <button type="button" onClick={() => setForm({...form, status: 'planned'})} className={`py-3 rounded-lg border-2 text-xs font-bold uppercase ${form.status === 'planned' ? 'border-yellow-400 bg-yellow-50 text-yellow-800' : 'border-gray-100 text-gray-400'}`}>📅 Planejado</button>
                                <button type="button" onClick={() => setForm({...form, status: 'confirmed'})} className={`py-3 rounded-lg border-2 text-xs font-bold uppercase ${form.status === 'confirmed' ? 'border-green-500 bg-green-50 text-green-800' : 'border-gray-100 text-gray-400'}`}>✅ Confirmado</button>
                            </div>

                            <div className="flex gap-3">
                                {editingId && (
                                    <button type="button" onClick={handleDelete} className="px-4 py-3 bg-red-100 text-red-600 rounded-lg font-bold hover:bg-red-200 transition">
                                        🗑️
                                    </button>
                                )}
                                <button type="submit" disabled={processing} className="flex-1 py-3 bg-gray-900 text-white rounded-lg font-bold shadow hover:bg-black transition disabled:opacity-50">
                                    {processing ? 'Salvando...' : (editingId ? 'Atualizar Rota' : 'Salvar Rota')}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </AuthenticatedLayout>
    );
}