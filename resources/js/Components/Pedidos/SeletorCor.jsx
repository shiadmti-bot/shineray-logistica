import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { CheckIcon, ChevronUpDownIcon } from '@heroicons/react/24/outline';

const CORES_PADRAO = [
    'PRETA',
    'VERMELHA',
    'BRANCA',
    'AZUL',
    'CINZA',
    'PRATA',
    'AMARELA',
    'VERDE',
    'DOURADA',
    'LARANJA',
    'BEGE',
    'FOSCA',
];

/**
 * Seletor inteligente de cor de motos:
 * - Permite selecionar qualquer cor do catálogo ou da paleta padrão.
 * - Permite digitar LIVREMENTE qualquer cor personalizada ou sob encomenda.
 * - Exibe em tempo real o saldo disponível no CD para a cor escolhida.
 */
export default function SeletorCor({
    valor = '',
    onChange,
    modelo = '',
    cores = [],
    disponivel = null,
    mostrarSaldo = true,
    mobile = false,
    required = false,
    disabled = false,
    className = '',
}) {
    const [busca, setBusca] = useState('');
    const [aberto, setAberto] = useState(false);
    const [destacado, setDestacado] = useState(0);

    const containerRef = useRef(null);
    const listaId = useId();

    useEffect(() => {
        const aoClicarFora = (e) => {
            if (containerRef.current && !containerRef.current.contains(e.target)) {
                setAberto(false);
                setBusca('');
            }
        };

        document.addEventListener('mousedown', aoClicarFora);
        return () => document.removeEventListener('mousedown', aoClicarFora);
    }, []);

    // Unifica cores do modelo com a paleta padrão sem duplicidades
    const listaOpcoes = useMemo(() => {
        const coresDoModeloMap = new Map();
        cores.forEach((c) => {
            if (c?.cor) coresDoModeloMap.set(c.cor.toUpperCase(), c.disponivel ?? 0);
        });

        const unificadas = [];

        // 1. Cores oficiais do modelo
        cores.forEach((c) => {
            if (c?.cor) {
                unificadas.push({
                    cor: c.cor.toUpperCase(),
                    disponivel: c.disponivel ?? 0,
                    doModelo: true,
                });
            }
        });

        // 2. Cores da paleta padrão que não estão no modelo
        CORES_PADRAO.forEach((nomeCor) => {
            if (!coresDoModeloMap.has(nomeCor)) {
                unificadas.push({
                    cor: nomeCor,
                    disponivel: null,
                    doModelo: false,
                });
            }
        });

        const termo = busca.trim().toUpperCase();
        if (!termo) return unificadas;

        return unificadas.filter((item) => item.cor.includes(termo));
    }, [cores, busca]);

    const selecionar = (nomeCor) => {
        onChange(nomeCor);
        setBusca('');
        setAberto(false);
    };

    const aoDigitar = (e) => {
        const texto = e.target.value.toUpperCase();
        setBusca(texto);
        setDestacado(0);
        setAberto(true);
        onChange(texto);
    };

    const aoTeclar = (e) => {
        if (e.key === 'ArrowDown') {
            e.preventDefault();
            setAberto(true);
            setDestacado((i) => Math.min(i + 1, listaOpcoes.length - 1));
            return;
        }

        if (e.key === 'ArrowUp') {
            e.preventDefault();
            setDestacado((i) => Math.max(i - 1, 0));
            return;
        }

        if (e.key === 'Enter' && aberto && listaOpcoes[destacado]) {
            e.preventDefault();
            selecionar(listaOpcoes[destacado].cor);
            return;
        }

        if (e.key === 'Escape') {
            setAberto(false);
            setBusca('');
        }
    };

    const baseInput = mobile
        ? 'w-full border-line-strong rounded-lg uppercase text-base py-3 pl-3 pr-8 focus:ring-brand-500 focus:border-brand-500 bg-surface-card'
        : 'w-full border-line-strong rounded uppercase text-sm py-1.5 pl-2.5 pr-7 focus:ring-brand-500 focus:border-brand-500 bg-surface-card';

    return (
        <div ref={containerRef} className={`relative ${className}`}>
            <div className="relative">
                <input
                    type="text"
                    role="combobox"
                    aria-expanded={aberto}
                    aria-controls={listaId}
                    aria-autocomplete="list"
                    autoComplete="off"
                    required={required}
                    disabled={disabled}
                    placeholder={disabled ? 'Escolha o modelo' : 'COR (ou escolha)'}
                    value={aberto ? busca : valor}
                    onChange={aoDigitar}
                    onFocus={() => {
                        if (!disabled) {
                            setBusca('');
                            setAberto(true);
                        }
                    }}
                    onKeyDown={aoTeclar}
                    className={`${baseInput} font-bold disabled:bg-surface-sunken disabled:text-content-muted`}
                />

                <ChevronUpDownIcon
                    className={`pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-content-muted ${mobile ? 'h-5 w-5' : 'h-4 w-4'}`}
                />
            </div>

            {/* Feedback instantâneo de disponibilidade no estoque */}
            {!aberto && valor && !disabled && (
                <div className="mt-1 flex items-center gap-1.5 text-[10px] font-bold">
                    {disponivel !== null && disponivel > 0 ? (
                        <span className="text-status-success-fg flex items-center gap-1">
                            <span className="h-1.5 w-1.5 rounded-full bg-status-success-solid animate-pulse" />
                            {disponivel} un. no CD
                        </span>
                    ) : disponivel !== null && disponivel === 0 ? (
                        <span className="text-status-warning-fg flex items-center gap-1">
                            <span className="h-1.5 w-1.5 rounded-full bg-status-warning-solid" />
                            0 no CD (sob encomenda)
                        </span>
                    ) : (
                        <span className="text-content-muted flex items-center gap-1">
                            <span className="h-1.5 w-1.5 rounded-full bg-line-strong" />
                            Sob encomenda
                        </span>
                    )}
                </div>
            )}

            {aberto && (
                <ul
                    id={listaId}
                    role="listbox"
                    className="absolute z-40 mt-1 max-h-64 w-full min-w-[15rem] overflow-y-auto rounded-xl border border-line bg-surface-card py-1 shadow-card-hover"
                >
                    {listaOpcoes.length === 0 && (
                        <li className="px-3 py-2 text-xs text-content-muted">
                            Nenhuma sugestão para “{busca}”. O valor digitado será enviado como pedido sob encomenda.
                        </li>
                    )}

                    {listaOpcoes.map((opcao, i) => {
                        const selecionada = opcao.cor === valor;
                        const temEstoque = opcao.disponivel !== null && opcao.disponivel > 0;
                        const zerado = opcao.disponivel !== null && opcao.disponivel === 0;

                        return (
                            <li key={opcao.cor} role="option" aria-selected={selecionada}>
                                <button
                                    type="button"
                                    onMouseEnter={() => setDestacado(i)}
                                    onClick={() => selecionar(opcao.cor)}
                                    className={`flex w-full items-center justify-between gap-2 px-3 py-2 text-left transition text-xs
                                        ${i === destacado ? 'bg-surface-sunken' : ''}`}
                                >
                                    <span className="flex min-w-0 items-center gap-1.5">
                                        {selecionada && (
                                            <CheckIcon className="h-3.5 w-3.5 shrink-0 text-brand-600 font-bold" />
                                        )}
                                        <span className={`font-bold ${selecionada ? 'text-brand-700' : 'text-content-primary'}`}>
                                            {opcao.cor}
                                        </span>
                                        {!opcao.doModelo && (
                                            <span className="text-[9px] text-content-muted uppercase">
                                                (paleta)
                                            </span>
                                        )}
                                    </span>

                                    {mostrarSaldo && (
                                        <span
                                            className={`shrink-0 rounded-md px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wide ring-1 ring-inset
                                                ${temEstoque
                                                    ? 'bg-status-success-bg text-status-success-fg ring-status-success-solid/20'
                                                    : zerado
                                                        ? 'bg-status-warning-bg text-status-warning-fg ring-status-warning-solid/20'
                                                        : 'bg-surface-sunken text-content-muted ring-line'}`}
                                        >
                                            {temEstoque
                                                ? `${opcao.disponivel} no CD`
                                                : zerado
                                                    ? '0 no CD'
                                                    : 'sob encomenda'}
                                        </span>
                                    )}
                                </button>
                            </li>
                        );
                    })}
                </ul>
            )}
        </div>
    );
}
