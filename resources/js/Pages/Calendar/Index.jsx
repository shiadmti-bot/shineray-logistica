import AppLayout from '@/Layouts/AppLayout';
import { PageHeader } from '@/Components/UI';
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
                title: `<span class="text-lg font-black text-content-primary uppercase">${info.event.title}</span>`,
                html: `
                    <div class="text-left bg-surface-sunken p-4 rounded-lg border border-line mt-2 text-sm">
                        <div class="mb-2"><strong>📅 Data:</strong> ${new Date(info.event.start).toLocaleDateString('pt-BR')}</div>
                        <div class="mb-2"><strong>🚦 Status:</strong> 
                            <span class="badge ${props.status === 'confirmed' ? 'text-status-success-fg' : 'text-status-warning-fg'} font-bold">
                                ${props.status === 'confirmed' ? 'CONFIRMADO' : 'PLANEJAMENTO'}
                            </span>
                        </div>
                        <div class="mt-3 pt-3 border-t border-line font-mono text-xs text-content-secondary">
                            <strong>Rota:</strong><br/>${props.rota_completa}
                        </div>
                        ${props.is_past ? '<div class="mt-3 text-xs text-status-danger-fg font-bold border-t border-status-danger-solid/20 pt-2">📅 Rota passada (Edição bloqueada)</div>' : ''}
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
            ? "bg-status-success-bg border-l-4 border-status-success-solid text-status-success-fg" 
            : "bg-status-warning-bg border-l-4 border-status-warning-solid text-status-warning-fg border-dashed";

        let icon = isConfirmed ? "🚛" : "📋";
        let label = isConfirmed ? "CONFIRMADO" : "PLANEJAMENTO";

        if (!canEdit && !props.is_my_route) {
            containerClass = "bg-surface-sunken border border-line-strong text-content-muted grayscale opacity-60";
            icon = "🔒";
            label = "EXTERNA";
        } else if (props.is_past) {
            if (isConfirmed) {
                containerClass = "bg-status-success-bg border border-status-success-solid/40 text-status-success-fg opacity-80 cursor-not-allowed";
                icon = "✅";
                label = "Passado (Conf.)";
            } else {
                containerClass = "bg-surface-sunken border border-line text-content-muted opacity-60 cursor-not-allowed";
                icon = "⚠️";
                label = "Passado (Pend.)";
            }
        }

        return (
            <div className={`w-full p-2 rounded-xl shadow-xs text-[11px] md:text-xs leading-tight transition-all duration-200 hover:scale-[1.01] hover:shadow-sm cursor-pointer ${containerClass}`}>
                <div className="flex justify-between items-center mb-1">
                    <span className="font-extrabold text-[9px] uppercase tracking-wider opacity-80">{label}</span>
                </div>
                <div className="font-bold truncate flex items-center gap-1.5">
                    <span className="text-xs">{icon}</span> 
                    <span className="truncate">{eventInfo.event.title}</span>
                </div>
            </div>
        );
    }

    return (
        <AppLayout user={auth.user}>
            <Head title="Calendário de Rotas - Shineray By Sabel" />
            <PageHeader
                title="Calendário de Rotas"
                description="Planejamento tático de saídas, agendamentos e previsão de entrega por filial."
                breadcrumbs={[
                    { label: 'Início', href: route('dashboard') },
                    { label: 'Calendário de Rotas' }
                ]}
                actions={
                    minhaLoja && !canEdit && (
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-brand-50 border border-brand-200 text-brand-700 text-xs font-black uppercase">
                            📍 {minhaLoja}
                        </span>
                    )
                }
            />
                    
            {/* LEGENDA REFINADA */}
            <div className="mb-6 flex flex-wrap items-center gap-3 justify-end text-xs font-bold text-content-secondary">
                <div className="flex items-center gap-2 bg-surface-card px-3 py-1.5 rounded-full border border-line shadow-xs">
                    <span className="w-2.5 h-2.5 bg-status-success-solid rounded-full"></span> 
                    <span>Confirmado</span>
                </div>
                <div className="flex items-center gap-2 bg-surface-card px-3 py-1.5 rounded-full border border-line shadow-xs">
                    <span className="w-2.5 h-2.5 bg-status-warning-solid rounded-full"></span> 
                    <span>Planejado (Prévia)</span>
                </div>
                <div className="flex items-center gap-2 bg-surface-card px-3 py-1.5 rounded-full border border-line shadow-xs">
                    <span className="w-2.5 h-2.5 bg-status-success-bg border border-status-success-solid/40 rounded-full"></span> 
                    <span className="text-content-muted">Passado (Conf.)</span>
                </div>
                <div className="flex items-center gap-2 bg-surface-card px-3 py-1.5 rounded-full border border-line shadow-xs">
                    <span className="w-2.5 h-2.5 bg-surface-sunken border border-line-strong rounded-full"></span> 
                    <span className="text-content-muted">Passado (Pend.)</span>
                </div>
            </div>

            {/* CARD DO FULLCALENDAR COM ESTILO MODERNO */}
            <div className="bg-surface-card p-4 md:p-8 rounded-3xl shadow-card border border-line overflow-hidden relative">
                <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-brand-600 via-brand-500 to-brand-700"></div>
                <style>{`
                    .fc { font-family: inherit; }
                    .fc-col-header-cell { background: #f8fafc; padding: 12px 0 !important; border-color: #e2e8f0 !important; }
                    .fc-col-header-cell-cushion { font-size: 0.75rem !important; font-weight: 800 !important; text-transform: uppercase !important; color: #64748b !important; letter-spacing: 0.05em !important; }
                    .fc-day-today { background-color: rgba(225, 29, 72, 0.04) !important; }
                    .fc-daygrid-day-number { font-size: 0.85rem !important; font-weight: 800 !important; color: #334155 !important; padding: 8px 10px !important; }
                    .fc-daygrid-day { border-color: #f1f5f9 !important; transition: background 0.15s ease; }
                    .fc-daygrid-day:hover { background-color: #f8fafc; }
                    .fc-event { background: transparent !important; border: none !important; margin: 2px 4px !important; }
                    .fc-toolbar { margin-bottom: 1.5rem !important; flex-wrap: wrap; gap: 0.75rem; }
                    .fc-toolbar-title { font-size: 1.25rem !important; font-weight: 900 !important; color: #0f172a !important; letter-spacing: -0.02em !important; }
                    .fc-button { background: #ffffff !important; border: 1px solid #cbd5e1 !important; color: #334155 !important; font-weight: 700 !important; font-size: 0.8rem !important; border-radius: 0.75rem !important; padding: 0.45rem 0.9rem !important; box-shadow: 0 1px 2px rgba(0,0,0,0.05) !important; transition: all 0.2s ease !important; }
                    .fc-button:hover { background: #f8fafc !important; border-color: #94a3b8 !important; color: #0f172a !important; }
                    .fc-button-active { background: #0f172a !important; border-color: #0f172a !important; color: #ffffff !important; box-shadow: 0 2px 4px rgba(0,0,0,0.1) !important; }
                    .fc-button:disabled { opacity: 0.4 !important; }
                    .fc-daygrid-event-dot { display: none !important; }
                `}</style>
                
                <FullCalendar
                    plugins={[dayGridPlugin, interactionPlugin]}
                    initialView={canEdit ? "dayGridMonth" : "dayGridWeek"}
                    headerToolbar={{ 
                        left: 'prev,today,next', 
                        center: 'title', 
                        right: canEdit ? 'dayGridMonth,dayGridWeek' : 'dayGridWeek,dayGridMonth' 
                    }}
                    locale={ptBrLocale}
                    events={events}
                    eventContent={renderEventContent}
                    dateClick={handleDateClick}
                    eventClick={handleEventClick}
                    height="auto"
                />
            </div>

            {/* MODAL DE CRIAÇÃO / EDIÇÃO MODERNO */}
            {canEdit && isModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-surface-inverted/70 backdrop-blur-sm p-4 animate-fade-in">
                    <div className="bg-surface-card rounded-3xl shadow-2xl w-full max-w-md overflow-hidden border border-line">
                        <div className="bg-gradient-to-r from-surface-card to-surface-sunken px-6 py-4 flex justify-between items-center border-b border-line">
                            <div>
                                <span className="text-[10px] font-black uppercase tracking-wider text-brand-600 bg-brand-50 px-2 py-0.5 rounded">
                                    Agendamento
                                </span>
                                <h3 className="font-black text-lg text-content-primary mt-0.5">
                                    {editingId ? 'Editar Rota Logística' : 'Nova Viagem'}
                                </h3>
                                <p className="text-xs text-content-muted">Data: {new Date(selectedDate + 'T00:00:00').toLocaleDateString('pt-BR')}</p>
                            </div>
                            <button 
                                onClick={() => setIsModalOpen(false)} 
                                className="w-8 h-8 rounded-full bg-surface-sunken hover:bg-line text-content-secondary flex items-center justify-center transition"
                            >
                                ✕
                            </button>
                        </div>

                        <form onSubmit={handleSubmit} className="p-6 space-y-5">
                            <div>
                                <label className="block text-xs font-bold text-content-secondary uppercase mb-2">Paradas da Rota (Sequência)</label>
                                <div className="space-y-2.5 max-h-[240px] overflow-y-auto pr-1 custom-scrollbar">
                                    {form.stops.map((stop, index) => (
                                        <div key={index} className="flex gap-2 items-center bg-surface-sunken p-2 rounded-xl border border-line">
                                            <span className="text-xs font-black w-6 text-center text-brand-600 bg-surface-card py-1 rounded-md shadow-xs">{index + 1}º</span>
                                            <select 
                                                className="w-full border-line focus:border-brand-500 focus:ring-brand-500 rounded-lg text-sm bg-surface-card"
                                                value={stop} 
                                                onChange={e => updateStop(index, e.target.value)} 
                                                required
                                            >
                                                <option value="">Selecione o destino...</option>
                                                {destinos.map(l => (
                                                    <option key={l.id} value={l.id} disabled={form.stops.includes(String(l.id)) && stop != l.id}>
                                                        {l.name}
                                                    </option>
                                                ))}
                                            </select>
                                            {form.stops.length > 1 && (
                                                <button type="button" onClick={() => removeStop(index)} className="p-1 text-status-danger-fg hover:bg-status-danger-bg rounded-md transition" title="Remover parada">
                                                    🗑️
                                                </button>
                                            )}
                                        </div>
                                    ))}
                                </div>
                                <button type="button" onClick={addStop} className="mt-2.5 text-xs font-bold text-brand-600 hover:text-brand-700 hover:underline inline-flex items-center gap-1">
                                    + Adicionar Nova Parada
                                </button>
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-content-secondary uppercase mb-2">Status da Viagem</label>
                                <div className="grid grid-cols-2 gap-3">
                                    <button 
                                        type="button" 
                                        onClick={() => setForm({...form, status: 'planned'})} 
                                        className={`py-3 px-3 rounded-xl border-2 text-xs font-bold uppercase transition flex items-center justify-center gap-1.5 ${
                                            form.status === 'planned' 
                                                ? 'border-status-warning-solid bg-status-warning-bg text-status-warning-fg shadow-xs' 
                                                : 'border-line bg-surface-sunken text-content-muted hover:border-line-strong'
                                        }`}
                                    >
                                        📅 Planejado
                                    </button>
                                    <button 
                                        type="button" 
                                        onClick={() => setForm({...form, status: 'confirmed'})} 
                                        className={`py-3 px-3 rounded-xl border-2 text-xs font-bold uppercase transition flex items-center justify-center gap-1.5 ${
                                            form.status === 'confirmed' 
                                                ? 'border-status-success-solid bg-status-success-bg text-status-success-fg shadow-xs' 
                                                : 'border-line bg-surface-sunken text-content-muted hover:border-line-strong'
                                        }`}
                                    >
                                        ✅ Confirmado
                                    </button>
                                </div>
                            </div>

                            <div className="flex gap-3 pt-2">
                                {editingId && (
                                    <button 
                                        type="button" 
                                        onClick={handleDelete} 
                                        className="px-4 py-3 bg-status-danger-bg hover:bg-status-danger-bg text-status-danger-fg rounded-xl font-bold transition flex items-center justify-center" 
                                        title="Excluir Rota"
                                    >
                                        🗑️
                                    </button>
                                )}
                                <button 
                                    type="submit" 
                                    disabled={processing} 
                                    className="flex-1 py-3 bg-brand-600 hover:bg-brand-700 text-white rounded-xl font-bold shadow-md transition disabled:opacity-50 text-sm"
                                >
                                    {processing ? 'Gravando...' : (editingId ? 'Salvar Alterações' : 'Confirmar Agendamento')}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </AppLayout>
    );
}