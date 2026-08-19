import AppLayout from '@/Layouts/AppLayout';
import { PageHeader } from '@/Components/UI';
import { Head, useForm, router } from '@inertiajs/react';
import { useState } from 'react';
import Swal from 'sweetalert2';

export default function CalendarManager({ auth, rotas, eventos, mesAtual }) {
    const { data, setData, post, reset, processing } = useForm({
        date: '',
        route_id: '',
        status: 'planned' // Padrão: Planejado (Prévia)
    });

    // --- LÓGICA DE CALENDÁRIO ---
    const dataMes = new Date(mesAtual + '-02'); // Ajuste fuso (dia 02 garante cair no mês certo)
    const getDiasNoMes = (date) => {
        const ano = date.getFullYear();
        const mes = date.getMonth();
        const dias = [];
        const primeiroDiaSemana = new Date(ano, mes, 1).getDay();
        const ultimoDia = new Date(ano, mes + 1, 0).getDate();

        // Espaços vazios antes do dia 1
        for (let i = 0; i < primeiroDiaSemana; i++) dias.push(null);
        // Dias reais
        for (let i = 1; i <= ultimoDia; i++) dias.push(new Date(ano, mes, i));
        return dias;
    };

    const diasCalendario = getDiasNoMes(dataMes);

    // --- AÇÕES ---
    const abrirModal = (dataIso) => {
        setData('date', dataIso);
        document.getElementById('modal-add').showModal();
    };

    const salvarViagem = (e) => {
        e.preventDefault();
        post(route('schedules.store'), {
            onSuccess: () => {
                reset();
                document.getElementById('modal-add').close();
                const Toast = Swal.mixin({ toast: true, position: 'top-end', showConfirmButton: false, timer: 3000 });
                Toast.fire({ icon: 'success', title: 'Agendado!' });
            }
        });
    };

    const confirmarViagem = (id) => {
        router.put(route('schedules.confirm', id), {}, {
            onSuccess: () => Swal.fire('Confirmado', 'Viagem agora é definitiva.', 'success')
        });
    };

    const excluirViagem = (id) => {
        if (confirm('Remover esta viagem do calendário?')) {
            router.delete(route('schedules.destroy', id));
        }
    };

    const mudarMes = (e) => {
        router.get(route('schedules.manager'), { mes: e.target.value });
    };

    return (
        <AppLayout user={auth.user}>
            <Head title="Gestão de Rotas CD - Shineray By Sabel" />
            <PageHeader
                title="Gestão Logística CD"
                description="Painel tático de agendamento de viagens e confirmação de rotas do Centro de Distribuição."
                breadcrumbs={[
                    { label: 'Início', href: route('dashboard') },
                    { label: 'Calendário', href: route('calendar.index') },
                    { label: 'Gestão Logística' }
                ]}
                actions={
                    <div className="flex items-center gap-2 bg-surface-card p-1.5 rounded-xl border border-line shadow-xs">
                        <span className="text-xs font-bold text-content-secondary px-2">Mês:</span>
                        <input 
                            type="month" 
                            value={mesAtual} 
                            onChange={mudarMes}
                            className="border-line focus:border-brand-500 focus:ring-brand-500 rounded-lg font-bold text-xs bg-surface-sunken py-1 px-2.5"
                        />
                    </div>
                }
            />
                    
            {/* LEGENDA REFINADA */}
            <div className="mb-6 flex flex-wrap items-center gap-3 justify-end text-xs font-bold text-content-secondary">
                <div className="flex items-center gap-2 bg-surface-card px-3 py-1.5 rounded-full border border-line shadow-xs">
                    <span className="w-2.5 h-2.5 bg-content-muted rounded-full"></span> 
                    <span>Prévia (Planejamento)</span>
                </div>
                <div className="flex items-center gap-2 bg-surface-card px-3 py-1.5 rounded-full border border-line shadow-xs">
                    <span className="w-2.5 h-2.5 bg-status-success-solid rounded-full"></span> 
                    <span>Definitiva (Confirmado)</span>
                </div>
            </div>

            {/* GRID CALENDÁRIO */}
            <div className="bg-surface-card rounded-3xl shadow-card p-4 md:p-6 border border-line overflow-hidden relative">
                <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-brand-600 via-brand-500 to-brand-700"></div>
                <div className="grid grid-cols-7 gap-1 text-center mb-3">
                    {['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'].map(d => (
                        <div key={d} className="text-content-muted font-extrabold uppercase text-[11px] tracking-wider py-1">{d}</div>
                    ))}
                </div>

                <div className="grid grid-cols-7 gap-1.5 md:gap-2.5">
                    {diasCalendario.map((dia, idx) => {
                        if (!dia) return <div key={idx} className="bg-surface-sunken/50 h-32 rounded-2xl border border-transparent"></div>;

                        const diaIso = dia.toISOString().split('T')[0];
                        const eventosDia = eventos.filter(e => e.date === diaIso);
                        const isToday = diaIso === new Date().toISOString().split('T')[0];

                        return (
                            <div key={idx} className={`bg-surface-card border ${isToday ? 'border-brand-500/50 ring-1 ring-brand-500/20' : 'border-line'} h-32 rounded-2xl p-2.5 flex flex-col relative hover:border-brand-500/40 hover:shadow-sm transition-all duration-200 group`}>
                                <div className="flex justify-between items-start">
                                    <span className={`font-black text-xs ${isToday ? 'bg-brand-600 text-white rounded-full w-6 h-6 flex items-center justify-center shadow-xs' : 'text-content-secondary'}`}>
                                        {dia.getDate()}
                                    </span>
                                    <button 
                                        onClick={() => abrirModal(diaIso)}
                                        className="opacity-0 group-hover:opacity-100 w-6 h-6 rounded-full bg-brand-50 text-brand-600 hover:bg-brand-600 hover:text-white flex items-center justify-center font-bold text-sm transition shadow-xs"
                                        title="Adicionar Viagem"
                                    >
                                        +
                                    </button>
                                </div>

                                {/* LISTA DE VIAGENS DO DIA */}
                                <div className="flex-1 overflow-y-auto mt-1.5 space-y-1 custom-scrollbar">
                                    {eventosDia.map(ev => (
                                        <div 
                                            key={ev.id} 
                                            className={`text-[10px] p-1.5 rounded-lg border flex justify-between items-center group/item transition-all ${
                                                ev.status === 'confirmed' 
                                                    ? 'bg-status-success-bg border-status-success-solid/40 text-status-success-fg font-bold shadow-xs' 
                                                    : 'bg-surface-sunken border-line text-content-secondary border-dashed'
                                            }`}
                                        >
                                            <span className="truncate" title={ev.route.name}>
                                                {ev.route.code}
                                            </span>
                                            
                                            {/* AÇÕES NO HOVER DO ITEM */}
                                            <div className="hidden group-hover/item:flex items-center gap-1">
                                                {ev.status === 'planned' && (
                                                    <button 
                                                        onClick={() => confirmarViagem(ev.id)}
                                                        className="text-status-success-fg hover:bg-status-success-bg p-0.5 rounded transition"
                                                        title="Confirmar Viagem"
                                                    >
                                                        ✅
                                                    </button>
                                                )}
                                                <button 
                                                    onClick={() => excluirViagem(ev.id)}
                                                    className="text-status-danger-fg hover:bg-status-danger-bg p-0.5 rounded transition"
                                                    title="Remover"
                                                >
                                                    🗑️
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* MODAL ADICIONAR */}
            <dialog id="modal-add" className="modal rounded-3xl shadow-2xl p-0 backdrop:bg-surface-inverted/60 border border-line">
                <div className="bg-surface-card p-6 w-80 md:w-96 rounded-3xl">
                    <div className="flex items-center justify-between mb-4 border-b border-line pb-3">
                        <div>
                            <span className="text-[10px] font-black uppercase tracking-wider text-brand-600 bg-brand-50 px-2 py-0.5 rounded">Logística CD</span>
                            <h3 className="font-black text-lg text-content-primary mt-0.5">Nova Viagem</h3>
                        </div>
                        <p className="text-xs font-bold text-content-muted">{data.date.split('-').reverse().join('/')}</p>
                    </div>
                    
                    <form onSubmit={salvarViagem} className="space-y-4">
                        <div>
                            <label className="block text-sm font-bold text-content-secondary">Selecione a Rota</label>
                            <select 
                                className="w-full border-line-strong rounded"
                                value={data.route_id}
                                onChange={e => setData('route_id', e.target.value)}
                                required
                            >
                                <option value="">-- Escolha --</option>
                                {rotas.map(r => (
                                    <option key={r.id} value={r.id}>{r.code} - {r.name}</option>
                                ))}
                            </select>
                        </div>

                        <div>
                            <label className="block text-sm font-bold text-content-secondary">Status Inicial</label>
                            <div className="flex gap-2 mt-1">
                                <label className={`flex-1 border p-2 rounded text-center text-xs font-bold cursor-pointer ${data.status === 'planned' ? 'bg-surface-sunken border-line-strong' : 'bg-surface-card'}`}>
                                    <input type="radio" name="st" value="planned" checked={data.status === 'planned'} onChange={() => setData('status', 'planned')} className="hidden"/>
                                    📅 Prévia
                                </label>
                                <label className={`flex-1 border p-2 rounded text-center text-xs font-bold cursor-pointer ${data.status === 'confirmed' ? 'bg-status-success-bg border-status-success-solid text-status-success-fg' : 'bg-surface-card'}`}>
                                    <input type="radio" name="st" value="confirmed" checked={data.status === 'confirmed'} onChange={() => setData('status', 'confirmed')} className="hidden"/>
                                    ✅ Definitiva
                                </label>
                            </div>
                        </div>

                        <div className="flex justify-end gap-2 pt-4">
                            <button type="button" onClick={() => document.getElementById('modal-add').close()} className="px-4 py-2 text-content-muted hover:bg-surface-sunken rounded">Cancelar</button>
                            <button type="submit" disabled={processing} className="px-4 py-2 bg-status-info-solid text-white font-bold rounded hover:bg-status-info-solid">Salvar</button>
                        </div>
                    </form>
                </div>
            </dialog>

        </AppLayout>
    );
}