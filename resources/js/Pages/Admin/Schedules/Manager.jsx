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
            <Head title="Gerenciar Cargas" />
            <PageHeader
                title="Gestão Logística CD"
                breadcrumbs={[
                    { label: 'Início', href: route('dashboard') },
                    { label: 'Calendário' },
                    { label: 'Gestão' }
                ]}
                actions={
                    <input 
                        type="month" 
                        value={mesAtual} 
                        onChange={mudarMes}
                        className="border-line-strong rounded font-bold"
                    />
                }
            />
                    
                    {/* LEGENDA */}
                    <div className="flex gap-4 mb-4 text-sm justify-end">
                        <div className="flex items-center gap-2">
                            <div className="w-3 h-3 bg-content-muted rounded"></div>
                            <span>Prévia (Planejamento)</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <div className="w-3 h-3 bg-status-success-solid rounded"></div>
                            <span className="font-bold">Definitiva (Confirmado)</span>
                        </div>
                    </div>

                    {/* GRID CALENDÁRIO */}
                    <div className="bg-surface-card rounded-xl shadow-lg p-4">
                        <div className="grid grid-cols-7 gap-1 text-center mb-2">
                            {['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'].map(d => (
                                <div key={d} className="text-content-muted font-bold uppercase text-xs">{d}</div>
                            ))}
                        </div>

                        <div className="grid grid-cols-7 gap-1 md:gap-2">
                            {diasCalendario.map((dia, idx) => {
                                if (!dia) return <div key={idx} className="bg-surface-sunken h-32 rounded"></div>;

                                const diaIso = dia.toISOString().split('T')[0];
                                const eventosDia = eventos.filter(e => e.date === diaIso);

                                return (
                                    <div key={idx} className="bg-surface-card border border-line h-32 rounded p-2 flex flex-col relative hover:border-status-info-solid/40 transition group">
                                        <div className="flex justify-between items-start">
                                            <span className={`font-bold text-sm ${diaIso === new Date().toISOString().split('T')[0] ? 'bg-status-info-solid text-white rounded-full w-6 h-6 flex items-center justify-center' : 'text-content-secondary'}`}>
                                                {dia.getDate()}
                                            </span>
                                            <button 
                                                onClick={() => abrirModal(diaIso)}
                                                className="opacity-0 group-hover:opacity-100 text-status-info-fg font-bold text-xl leading-none hover:scale-110 transition"
                                                title="Adicionar Viagem"
                                            >
                                                +
                                            </button>
                                        </div>

                                        {/* LISTA DE VIAGENS DO DIA */}
                                        <div className="flex-1 overflow-y-auto mt-1 space-y-1 custom-scrollbar">
                                            {eventosDia.map(ev => (
                                                <div 
                                                    key={ev.id} 
                                                    className={`text-[10px] md:text-xs p-1 rounded border-l-4 flex justify-between items-center group/item 
                                                        ${ev.status === 'confirmed' 
                                                            ? 'bg-status-success-bg border-status-success-solid text-status-success-fg' 
                                                            : 'bg-surface-sunken border-line-strong text-content-secondary border-dashed'}`}
                                                >
                                                    <span className="font-bold truncate" title={ev.route.name}>
                                                        {ev.route.code}
                                                    </span>
                                                    
                                                    {/* AÇÕES NO HOVER DO ITEM */}
                                                    <div className="hidden group-hover/item:flex gap-1">
                                                        {ev.status === 'planned' && (
                                                            <button 
                                                                onClick={() => confirmarViagem(ev.id)}
                                                                className="text-status-success-fg hover:bg-status-success-bg p-0.5 rounded"
                                                                title="Confirmar Viagem"
                                                            >
                                                                ✅
                                                            </button>
                                                        )}
                                                        <button 
                                                            onClick={() => excluirViagem(ev.id)}
                                                            className="text-status-danger-fg hover:bg-status-danger-bg p-0.5 rounded"
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
            <dialog id="modal-add" className="modal rounded-xl shadow-2xl p-0 backdrop:bg-surface-inverted/50">
                <div className="bg-surface-card p-6 w-80 md:w-96 rounded-xl">
                    <h3 className="font-bold text-lg mb-4">Nova Viagem</h3>
                    <p className="text-sm text-content-muted mb-4">Data: <b>{data.date.split('-').reverse().join('/')}</b></p>
                    
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