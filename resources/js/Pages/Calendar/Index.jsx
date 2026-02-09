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

    const addStop = () => {
        setForm(prev => ({ ...prev, stops: [...prev.stops, ''] }));
    };

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

    const handleDateClick = (arg) => {
        if (!canEdit) return; 
        
        const clickedDate = new Date(arg.dateStr);
        const today = new Date();
        today.setHours(0,0,0,0);
        
        if (clickedDate < today) {
            Swal.fire({ icon: 'error', title: 'Data Inválida', text: 'Não é possível agendar no passado.', toast: true, position: 'top-end', timer: 3000, showConfirmButton: false });
            return;
        }

        setSelectedDate(arg.dateStr);
        setForm({ stops: [''], status: 'planned' });
        setIsModalOpen(true);
    };

    const handleEventClick = (info) => {
        const props = info.event.extendedProps;
        
        if (!canEdit) {
            if (!props.is_my_route) {
                Swal.fire({ title: 'Rota Externa', text: 'Esta carga não tem paradas na sua loja.', icon: 'info', confirmButtonColor: '#6b7280' });
                return;
            }

            Swal.fire({
                title: `<span class="text-xl font-black text-gray-800 uppercase">${info.event.title}</span>`,
                html: `
                    <div class="text-left bg-gray-50 p-5 rounded-xl border border-gray-200 mt-2 space-y-3">
                        <div class="flex justify-between border-b pb-2">
                            <span class="text-gray-500 text-sm">📅 Data Prevista</span>
                            <span class="font-bold text-gray-800">${new Date(info.event.start).toLocaleDateString('pt-BR')}</span>
                        </div>
                        <div class="flex justify-between border-b pb-2">
                            <span class="text-gray-500 text-sm">📦 Operação</span>
                            <span class="font-bold uppercase ${props.type === 'destino' ? 'text-green-600' : 'text-orange-600'}">
                                ${props.type === 'destino' ? '🏁 Entrega Final' : `🛑 Parada nº ${props.sequence}`}
                            </span>
                        </div>
                        <div class="flex justify-between items-center">
                            <span class="text-gray-500 text-sm">🚦 Status</span>
                            <span class="font-bold uppercase ${props.status === 'confirmed' ? 'text-green-600' : 'text-blue-500'}">
                                ${props.status === 'confirmed' ? '✅ Confirmado' : '📅 Planejado'}
                            </span>
                        </div>
                        <div class="bg-white p-3 rounded border border-gray-200 text-xs text-gray-600 font-mono mt-2">
                            <strong>Rota Completa:</strong><br/> ${props.rota_completa}
                        </div>
                    </div>
                `,
                confirmButtonColor: '#1f2937',
                confirmButtonText: 'Entendido'
            });
            return;
        }

        Swal.fire({
            title: 'Gerenciar Viagem',
            html: `
                <div class="text-left text-sm mb-4">
                    Você selecionou: <strong>${info.event.title}</strong>
                </div>
                <div class="bg-red-50 p-3 rounded border-l-4 border-red-500 text-red-800 text-xs text-left">
                    ⚠️ <strong>Atenção:</strong> Esta ação excluirá a <strong>VIAGEM INTEIRA</strong> e todas as suas paradas.
                </div>
            `,
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#dc2626',
            confirmButtonText: '🗑️ Excluir Viagem',
            cancelButtonText: 'Cancelar'
        }).then((result) => {
            if (result.isConfirmed) {
                router.delete(route('calendar.destroy', info.event.id), {
                    onSuccess: () => {
                        info.event.remove(); 
                        Swal.fire({ icon: 'success', title: 'Rota removida', toast: true, position: 'top-end', timer: 3000, showConfirmButton: false });
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
                Swal.fire({ icon: 'success', title: 'Rota Salva!', toast: true, position: 'top-end', timer: 3000, showConfirmButton: false });
            },
            onError: (errors) => {
                setProcessing(false);
                Swal.fire('Erro', Object.values(errors)[0], 'error');
            }
        });
    };

    function renderEventContent(eventInfo) {
        const props = eventInfo.event.extendedProps;
        const isConfirmed = props.status === 'confirmed';
        
        let bgClass = "bg-gray-50 text-gray-400 border-gray-200 opacity-60 grayscale";
        let icon = "🚛";
        let label = "Externa";

        if (canEdit || props.is_my_route) {
            if (props.type === 'destino') {
                bgClass = "bg-green-100 text-green-800 border-green-500 shadow-sm font-bold";
                icon = "🏁";
                label = "Destino";
            } else if (props.type === 'escala') {
                bgClass = "bg-orange-100 text-orange-800 border-orange-500 shadow-sm font-bold";
                icon = "🛑";
                label = "Escala";
            }
        }

        const borderStyle = isConfirmed ? 'border-l-4' : 'border-l-4 border-dashed opacity-80';

        return (
            <div className={`w-full p-1 rounded text-[10px] md:text-xs leading-tight border transition-transform hover:scale-105 cursor-pointer ${bgClass} ${borderStyle}`}>
                <div className="flex justify-between items-center mb-0.5">
                    <span className="uppercase tracking-wider text-[8px] opacity-80 font-bold">{label}</span>
                    {!isConfirmed && (
                        <span className="text-[7px] bg-white/50 px-1 rounded uppercase tracking-widest font-bold">PLAN</span>
                    )}
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
                            Loja: {minhaLoja}
                        </span>
                    )}
                </div>
            }
        >
            <Head title="Logística - Rotas" />

            <div className="py-8 bg-gray-100 min-h-screen font-sans">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    
                    <div className="mb-6 bg-white p-4 rounded-xl shadow-sm border border-gray-200 flex flex-wrap gap-4 text-xs font-bold uppercase text-gray-600 justify-end">
                        <div className="flex items-center gap-2"><span className="w-3 h-3 bg-green-100 border-l-4 border-green-500 rounded-sm"></span> Destino Final</div>
                        <div className="flex items-center gap-2"><span className="w-3 h-3 bg-orange-100 border-l-4 border-orange-500 rounded-sm"></span> Escala (Milk Run)</div>
                        {!canEdit && <div className="flex items-center gap-2 opacity-60"><span className="w-3 h-3 bg-gray-100 border-l-4 border-gray-300 rounded-sm"></span> Outras Rotas</div>}
                    </div>

                    <div className="bg-white p-4 md:p-6 rounded-2xl shadow-xl border-t-4 border-red-800 overflow-hidden">
                        <style>{`
                            .fc-col-header-cell { background: #f9fafb; padding: 10px 0; }
                            .fc-day-today { background-color: #fff1f2 !important; }
                            .fc-event { border: none !important; background: transparent !important; }
                            .fc-toolbar-title { font-size: 1.25rem !important; font-weight: 800; text-transform: uppercase; color: #111827; }
                            .fc-button-primary { background-color: #1f2937 !important; border: none !important; border-radius: 0.5rem !important; }
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
                                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
                                            </button>
                                        )}
                                    </div>
                                ))}
                            </div>

                            <button type="button" onClick={addStop} className="w-full py-2 border-2 border-dashed border-gray-300 rounded-lg text-gray-500 font-bold text-xs uppercase hover:border-blue-400 hover:text-blue-500 transition">
                                + Adicionar Parada
                            </button>

                            <div className="grid grid-cols-2 gap-3 pt-4 border-t border-gray-100">
                                <button type="button" onClick={() => setForm({...form, status: 'planned'})} className={`p-3 rounded-lg border-2 text-xs font-bold uppercase transition-all ${form.status === 'planned' ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-gray-100 text-gray-400'}`}>📅 Planejado</button>
                                <button type="button" onClick={() => setForm({...form, status: 'confirmed'})} className={`p-3 rounded-lg border-2 text-xs font-bold uppercase transition-all ${form.status === 'confirmed' ? 'border-green-600 bg-green-50 text-green-700' : 'border-gray-100 text-gray-400'}`}>✅ Confirmado</button>
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