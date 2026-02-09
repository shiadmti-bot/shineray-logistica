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
    
    // Controle de Edição ou Criação
    const [editingEventId, setEditingEventId] = useState(null); 
    const [selectedDate, setSelectedDate] = useState('');
    
    const [form, setForm] = useState({
        stops: [''], 
        status: 'planned'
    });

    useEffect(() => { setEvents(initialEvents || []); }, [initialEvents]);

    useEffect(() => {
        if (canEdit && isModalOpen && destinos.length === 0) {
            axios.get(route('calendar.rotas'))
                .then(res => setDestinos(res.data))
                .catch(err => console.error("Erro ao buscar rotas:", err));
        }
    }, [canEdit, isModalOpen]);

    const addStop = () => setForm(prev => ({ ...prev, stops: [...prev.stops, ''] }));

    const removeStop = (index) => {
        if (form.stops.length === 1) return; 
        const newStops = form.stops.filter((_, i) => i !== index);
        setForm(prev => ({ ...prev, stops: newStops }));
    };

    const updateStop = (index, value) => {
        const newStops = [...form.stops];
        newStops[index] = value;
        setForm(prev => ({ ...prev, stops: newStops }));
    };

    // --- ABRIR MODAL PARA CRIAR ---
    const handleDateClick = (arg) => {
        if (!canEdit) return; 
        
        const clickedDate = new Date(arg.dateStr);
        const today = new Date();
        today.setHours(0,0,0,0); // Zera hora para comparar apenas data
        
        if (clickedDate < today) {
            Swal.fire({ icon: 'error', title: 'Data Passada', text: 'Não é possível agendar rotas retroativas.', toast: true, position: 'top-end', timer: 3000, showConfirmButton: false });
            return;
        }

        setEditingEventId(null); // Modo Criação
        setSelectedDate(arg.dateStr);
        setForm({ stops: [''], status: 'planned' });
        setIsModalOpen(true);
    };

    // --- ABRIR MODAL PARA EDITAR/VISUALIZAR ---
    const handleEventClick = (info) => {
        const props = info.event.extendedProps;
        
        // Se não pode editar (Loja vendo calendário), mostra detalhes
        if (!canEdit) {
            if (!props.is_my_route) {
                Swal.fire({ title: 'Rota Externa', text: 'Esta carga não passa pela sua loja.', icon: 'info', confirmButtonColor: '#6b7280' });
                return;
            }
            // Mostra detalhes (Visualização apenas)
            Swal.fire({
                title: `<span class="text-xl font-black text-gray-800 uppercase">${info.event.title}</span>`,
                html: `
                    <div class="text-left bg-gray-50 p-5 rounded-xl border border-gray-200 mt-2 space-y-3">
                        <div class="flex justify-between border-b pb-2">
                            <span class="text-gray-500 text-sm">📅 Data Prevista</span>
                            <span class="font-bold text-gray-800">${new Date(info.event.start).toLocaleDateString('pt-BR')}</span>
                        </div>
                        <div class="flex justify-between items-center">
                            <span class="text-gray-500 text-sm">🚦 Status</span>
                            <span class="font-bold uppercase ${props.status === 'confirmed' ? 'text-green-600' : 'text-orange-500'}">
                                ${props.status === 'confirmed' ? '✅ Confirmado' : '⏳ Em Planejamento'}
                            </span>
                        </div>
                        <div class="bg-white p-3 rounded border border-gray-200 text-xs text-gray-600 font-mono mt-2">
                            <strong>Rota Completa:</strong><br/> ${props.rota_completa}
                        </div>
                    </div>
                `,
                confirmButtonColor: '#1f2937'
            });
            return;
        }

        // Se é CD/Admin -> Abre Modal de Edição Rápida (Mudar Status ou Excluir)
        // Aqui simplificamos: Se clicar, abre o modal já preenchido
        // Como o backend manda "stops" complexo no evento, para editar stops seria preciso tratar melhor os dados.
        // Para simplificar a alteração de STATUS sem excluir:
        
        Swal.fire({
            title: 'Gerenciar Rota',
            html: `O que deseja fazer com a rota <strong>${info.event.title}</strong>?`,
            showDenyButton: true,
            showCancelButton: true,
            confirmButtonText: props.status === 'planned' ? '✅ Confirmar Rota' : '⏪ Voltar p/ Planejamento',
            denyButtonText: '🗑️ Excluir Rota',
            cancelButtonText: 'Cancelar',
            confirmButtonColor: props.status === 'planned' ? '#059669' : '#d97706', // Verde ou Laranja
            denyButtonColor: '#dc2626'
        }).then((result) => {
            if (result.isConfirmed) {
                // Alternar Status (Toggle)
                const newStatus = props.status === 'planned' ? 'confirmed' : 'planned';
                
                router.post(route('calendar.store'), {
                    id: info.event.id, // Envia ID para atualizar
                    date: info.event.startStr,
                    stops: props.stops_ids, // Precisa garantir que o backend mande os IDs das paradas
                    status: newStatus
                }, {
                    onSuccess: () => Swal.fire({ icon: 'success', title: 'Status Atualizado!', toast: true, position: 'top-end', timer: 2000, showConfirmButton: false })
                });

            } else if (result.isDenied) {
                // Excluir
                router.delete(route('calendar.destroy', info.event.id), {
                    onSuccess: () => {
                        info.event.remove();
                        Swal.fire({ icon: 'success', title: 'Rota removida', toast: true, position: 'top-end', timer: 2000, showConfirmButton: false });
                    }
                });
            }
        });
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        if (processing) return;
        if (form.stops.some(s => s === '')) return Swal.fire('Erro', 'Preencha todas as paradas.', 'error');

        setProcessing(true);

        router.post(route('calendar.store'), {
            date: selectedDate,
            ...form
        }, {
            onSuccess: () => {
                setIsModalOpen(false);
                setProcessing(false);
                Swal.fire({ icon: 'success', title: 'Rota Criada!', toast: true, position: 'top-end', timer: 3000, showConfirmButton: false });
            },
            onError: (errors) => {
                setProcessing(false);
                Swal.fire('Erro', Object.values(errors)[0], 'error');
            }
        });
    };

    // --- RENDERIZAÇÃO DO CARD NO CALENDÁRIO ---
    function renderEventContent(eventInfo) {
        const props = eventInfo.event.extendedProps;
        const isConfirmed = props.status === 'confirmed';
        
        // Cores baseadas no status
        let bgClass = isConfirmed 
            ? "bg-green-100 text-green-800 border-green-500 shadow-sm" // Confirmado = Verde
            : "bg-orange-50 text-orange-800 border-orange-300 border-dashed opacity-90"; // Planejado = Laranja/Amarelo

        // Ícone e Label
        let icon = isConfirmed ? "🚛" : "📝";
        let label = isConfirmed ? "Confirmado" : "Planejamento";

        if (!canEdit && !props.is_my_route) {
            // Rota de terceiros (Loja vendo rota alheia)
            bgClass = "bg-gray-50 text-gray-400 border-gray-200 opacity-50 grayscale";
            icon = "🔒";
            label = "Externa";
        }

        return (
            <div className={`w-full p-1 rounded-[4px] text-[10px] md:text-xs leading-tight border-l-4 transition-all hover:brightness-95 cursor-pointer overflow-hidden ${bgClass}`}>
                <div className="flex justify-between items-center mb-0.5">
                    <span className="uppercase tracking-wider text-[8px] opacity-80 font-black">{label}</span>
                </div>
                <div className="truncate flex items-center gap-1 font-bold">
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
                    {minhaLoja && !canEdit && (
                        <span className="text-xs text-gray-500 font-medium bg-gray-100 px-2 py-1 rounded">
                            Visão: {minhaLoja}
                        </span>
                    )}
                </div>
            }
        >
            <Head title="Logística - Rotas" />

            <div className="py-8 bg-gray-100 min-h-screen font-sans">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    
                    {/* LEGENDA */}
                    <div className="mb-6 bg-white p-4 rounded-xl shadow-sm border border-gray-200 flex flex-wrap gap-4 text-xs font-bold uppercase text-gray-600 justify-end">
                        <div className="flex items-center gap-2"><span className="w-3 h-3 bg-green-100 border-l-4 border-green-500 rounded-sm"></span> Rota Confirmada</div>
                        <div className="flex items-center gap-2"><span className="w-3 h-3 bg-orange-50 border-l-4 border-orange-400 border-dashed rounded-sm"></span> Em Planejamento</div>
                        {!canEdit && <div className="flex items-center gap-2 opacity-60"><span className="w-3 h-3 bg-gray-100 border-l-4 border-gray-300 rounded-sm"></span> Outras Rotas</div>}
                    </div>

                    <div className="bg-white p-4 md:p-6 rounded-2xl shadow-xl border-t-4 border-red-800 overflow-hidden">
                        <style>{`
                            .fc-col-header-cell { background: #f9fafb; padding: 10px 0; border-bottom: 2px solid #e5e7eb; }
                            .fc-day-today { background-color: #fff1f2 !important; }
                            .fc-event { border: none !important; background: transparent !important; margin-bottom: 4px !important; }
                            .fc-toolbar-title { font-size: 1.25rem !important; font-weight: 800; text-transform: uppercase; color: #111827; }
                            .fc-button-primary { background-color: #1f2937 !important; border: none !important; border-radius: 0.5rem !important; font-weight: bold; }
                            .fc-button-primary:hover { background-color: #dc2626 !important; }
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
                            buttonText={{ today: 'Hoje', month: 'Mês', week: 'Semana' }}
                        />
                    </div>
                </div>
            </div>

            {/* MODAL DE CRIAÇÃO (Apenas para novas rotas) */}
            {canEdit && isModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900/80 backdrop-blur-sm p-4 transition-opacity animate-fade-in">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden transform transition-all scale-100 my-8">
                        <div className="bg-gray-900 px-6 py-4 flex justify-between items-center text-white">
                            <div>
                                <h3 className="font-bold uppercase tracking-wider">Nova Rota</h3>
                                <p className="text-xs text-gray-400 font-mono mt-0.5">{new Date(selectedDate).toLocaleDateString()}</p>
                            </div>
                            <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-white">✕</button>
                        </div>

                        <form onSubmit={handleSubmit} className="p-6 space-y-5">
                            
                            <div className="space-y-3 max-h-[300px] overflow-y-auto custom-scrollbar p-1">
                                <label className="block text-xs font-bold text-gray-500 uppercase">Sequência de Paradas</label>
                                {form.stops.map((stop, index) => (
                                    <div key={index} className="flex items-center gap-2 animate-fade-in-up">
                                        <div className="bg-gray-100 text-gray-500 w-8 h-10 flex items-center justify-center rounded font-bold text-xs">
                                            {index + 1}º
                                        </div>
                                        <select
                                            className="w-full border-gray-300 rounded-lg shadow-sm focus:border-blue-500 focus:ring-blue-500 text-sm font-medium text-gray-700"
                                            value={stop}
                                            onChange={(e) => updateStop(index, e.target.value)}
                                            required
                                        >
                                            <option value="">Selecione a Loja...</option>
                                            {destinos.map(l => (
                                                <option key={l.id} value={l.id} disabled={form.stops.includes(String(l.id)) && stop != l.id}>
                                                    {l.name}
                                                </option>
                                            ))}
                                        </select>
                                        {form.stops.length > 1 && (
                                            <button type="button" onClick={() => removeStop(index)} className="text-red-400 hover:text-red-600 p-2">
                                                🗑️
                                            </button>
                                        )}
                                    </div>
                                ))}
                            </div>

                            <button type="button" onClick={addStop} className="w-full py-2 border-2 border-dashed border-gray-300 rounded-lg text-gray-500 font-bold text-xs uppercase hover:border-blue-400 hover:text-blue-500 transition">
                                + Adicionar Parada
                            </button>

                            {/* SELETOR DE STATUS VISUAL */}
                            <div className="grid grid-cols-2 gap-3 pt-4 border-t border-gray-100">
                                <button type="button" onClick={() => setForm({...form, status: 'planned'})} className={`p-3 rounded-lg border-2 text-xs font-bold uppercase transition-all flex flex-col items-center gap-1 ${form.status === 'planned' ? 'border-orange-400 bg-orange-50 text-orange-700 shadow-sm' : 'border-gray-100 text-gray-400 grayscale'}`}>
                                    <span className="text-lg">📅</span>
                                    Planejamento
                                </button>
                                <button type="button" onClick={() => setForm({...form, status: 'confirmed'})} className={`p-3 rounded-lg border-2 text-xs font-bold uppercase transition-all flex flex-col items-center gap-1 ${form.status === 'confirmed' ? 'border-green-600 bg-green-50 text-green-700 shadow-sm' : 'border-gray-100 text-gray-400 grayscale'}`}>
                                    <span className="text-lg">✅</span>
                                    Confirmado
                                </button>
                            </div>

                            <div className="flex justify-end gap-3 pt-2">
                                <button type="button" onClick={() => setIsModalOpen(false)} className="px-4 py-2 text-sm font-bold text-gray-500 hover:bg-gray-100 rounded-lg">Cancelar</button>
                                <button 
                                    type="submit" 
                                    disabled={processing}
                                    className={`px-6 py-2 text-sm font-bold bg-gray-900 text-white rounded-lg hover:bg-black shadow-lg transition transform hover:-translate-y-0.5 ${processing ? 'opacity-50 cursor-not-allowed' : ''}`}
                                >
                                    {processing ? 'Salvando...' : 'Salvar Rota'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </AuthenticatedLayout>
    );
}