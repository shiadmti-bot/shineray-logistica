import { Head, Link, router } from '@inertiajs/react';
import { useState } from 'react';
import { MagnifyingGlassIcon, ArrowLeftIcon } from '@heroicons/react/24/outline';

import AppLayout from '@/Layouts/AppLayout';
import { Card, PageHeader, Button, StatusBadge, EmptyState } from '@/Components/UI';

export default function GestorHistory({ auth, logs, filters }) {
    
    // 1. BLINDAGEM DE FILTROS (Evita o erro no input)
    // Se filters vier null/undefined, usamos um objeto vazio
    const safeFilters = filters || {};

    const [filterForm, setFilterForm] = useState({
        // Forçamos string vazia '' se o valor for null/undefined
        search: safeFilters.search || '', 
        data_inicio: safeFilters.data_inicio || '',
        data_fim: safeFilters.data_fim || '',
    });

    const handleFiltrar = (e) => {
        e.preventDefault();
        router.get(route(route().current()), filterForm, {
            preserveState: true,
            preserveScroll: true,
            replace: true,
        });
    };

    const limparFiltros = () => {
        setFilterForm({ search: '', data_inicio: '', data_fim: '' });
        router.get(route(route().current()));
    };

    const renderDescricao = (texto) => {
        if (!texto) return null;
        return texto.split('\n').map((linha, index) => {
            if (linha.includes('✅')) return <p key={index} className="mb-1 rounded bg-status-success-bg p-1 font-bold text-status-success-fg">{linha}</p>;
            if (linha.includes('🚫') || linha.includes('REJEITADOS')) return <p key={index} className="mt-1 rounded border-l-4 border-status-danger-solid bg-status-danger-bg p-1 pl-2 font-medium text-status-danger-fg">{linha}</p>;
            if (linha.includes('Obs:') || linha.includes('Justificativa')) return <p key={index} className="my-2 rounded border border-status-warning-solid/30 bg-status-warning-bg p-3 text-sm italic text-content-secondary">{linha}</p>;
            return <p key={index} className="text-content-secondary text-sm py-0.5">{linha}</p>;
        });
    };

    return (
        <AppLayout user={auth.user}>
            <Head title="Histórico de Aprovações" />

            <PageHeader
                title="Auditoria Comercial"
                description="Registro completo das decisões de aprovação e rejeição."
                breadcrumbs={[{ label: 'Gestão' }, { label: 'Auditoria' }]}
                actions={
                    <Button variant="secondary" icon={ArrowLeftIcon} href={route('gestor.index')}>
                        Voltar ao Painel
                    </Button>
                }
            />

            <div>

                    {/* FILTROS */}
                    <div className="bg-surface-card p-5 rounded-xl shadow-sm border border-line mb-8">
                        <form onSubmit={handleFiltrar} className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
                            <div className="md:col-span-1">
                                <label className="block text-xs font-bold text-content-muted uppercase mb-1">Buscar</label>
                                <input 
                                    type="text" 
                                    placeholder="Nome, Filial ou Pedido..." 
                                    className="w-full rounded-lg border-line-strong focus:ring-brand-500 focus:border-brand-500 text-sm"
                                    value={filterForm.search} // Blindado pelo useState inicial
                                    onChange={e => setFilterForm({...filterForm, search: e.target.value})}
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-content-muted uppercase mb-1">Data Início</label>
                                <input 
                                    type="date" 
                                    className="w-full rounded-lg border-line-strong focus:ring-brand-500 focus:border-brand-500 text-sm"
                                    value={filterForm.data_inicio}
                                    onChange={e => setFilterForm({...filterForm, data_inicio: e.target.value})}
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-content-muted uppercase mb-1">Data Fim</label>
                                <input 
                                    type="date" 
                                    className="w-full rounded-lg border-line-strong focus:ring-brand-500 focus:border-brand-500 text-sm"
                                    value={filterForm.data_fim}
                                    onChange={e => setFilterForm({...filterForm, data_fim: e.target.value})}
                                />
                            </div>
                            <div className="flex gap-2">
                                <button type="submit" className="flex-1 rounded-lg bg-brand-600 py-2.5 font-bold text-white transition hover:bg-brand-700">Filtrar</button>
                                <button type="button" onClick={limparFiltros} className="px-4 py-2.5 border border-line-strong text-content-secondary rounded-lg hover:bg-surface-sunken transition">Limpar</button>
                            </div>
                        </form>
                    </div>

                    {/* LISTA DE LOGS */}
                    <div className="space-y-6">
                        {logs.data.map((log) => (
                            <div key={log.id} className="bg-surface-card rounded-xl shadow-sm border border-line overflow-hidden hover:shadow-md transition-all">
                                <div className="bg-surface-sunken px-6 py-4 border-b border-line flex justify-between items-center">
                                    <div className="flex items-center gap-4">
                                        <div className="text-2xl">{log.descricao.includes('REJEITADOS') ? '✂️' : '🛡️'}</div>
                                        <div>
                                            <h4 className="font-bold text-content-primary">
                                                Pedido #{log.pedido_id} 
                                                <StatusBadge status={log.pedido?.status} size="sm" className="ml-2 align-middle" />
                                            </h4>
                                            <p className="text-sm text-content-muted">
                                                📅 {new Date(log.created_at).toLocaleDateString('pt-BR')} • {log.pedido?.user?.filial || 'Usuario Removido'}
                                            </p>
                                        </div>
                                    </div>
                                </div>
                                <div className="p-6">
                                    <div className="text-sm leading-relaxed space-y-1">{renderDescricao(log.descricao)}</div>
                                    
                                    {/* Link Condicional: Só exibe se log.pedido_id existir */}
                                    {log.pedido_id && log.pedido && (
                                        <div className="mt-4 flex justify-end">
                                            <Link href={route('pedidos.show', log.pedido_id)} className="text-sm font-bold text-brand-600 hover:underline">
                                                Ver Pedido ↗
                                            </Link>
                                        </div>
                                    )}
                                </div>
                            </div>
                        ))}
                        
                        {logs.data.length === 0 && (
                            <Card>
                                <EmptyState
                                    icon={MagnifyingGlassIcon}
                                    title="Nenhum registro encontrado"
                                    description="Nenhuma decisão bate com os filtros aplicados."
                                    action={<Button variant="secondary" onClick={limparFiltros}>Limpar filtros</Button>}
                                />
                            </Card>
                        )}
                    </div>

                    {/* 2. BLINDAGEM DA PAGINAÇÃO (CORREÇÃO CRÍTICA) */}
                    {logs.links && logs.links.length > 3 && (
                        <div className="mt-10 flex justify-center flex-wrap gap-2">
                            {logs.links.map((link, k) => {
                                // Se a URL for null (botão desativado), renderizamos SPAN, não LINK
                                if (!link.url) {
                                    return (
                                        <span
                                            key={k}
                                            className="px-4 py-2 text-sm font-bold rounded-lg border border-line bg-surface-sunken text-content-muted cursor-not-allowed"
                                            dangerouslySetInnerHTML={{ __html: link.label }}
                                        />
                                    );
                                }
                                // Se tiver URL, renderizamos o Link normal
                                return (
                                    <Link
                                        key={k}
                                        href={link.url}
                                        className={`px-4 py-2 text-sm font-bold rounded-lg border transition-all ${
                                            link.active 
                                                ? 'bg-brand-600 text-white border-brand-600' 
                                                : 'bg-surface-card text-content-secondary border-line hover:bg-surface-sunken'
                                        }`}
                                        dangerouslySetInnerHTML={{ __html: link.label }}
                                    />
                                );
                            })}
                        </div>
                    )}

            </div>
        </AppLayout>
    );
}
