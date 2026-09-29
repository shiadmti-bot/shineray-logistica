import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { CheckIcon, ChevronUpDownIcon, MagnifyingGlassIcon } from '@heroicons/react/24/outline';

/**
 * Escolha do modelo de moto: busca por digitação sobre o catálogo completo.
 *
 * POR QUE NÃO UM <select>. O catálogo tem 48+ modelos com o nome exato do
 * Microwork ("XY150-8 - MOTO JEF S", não "JEF 150"). Num select nativo a loja
 * precisa reconhecer o código de homologação numa lista longa; aqui ela digita
 * "jef" e vê as quatro variantes. O filtro casa por pedaço em qualquer posição,
 * porque o nome de rua costuma estar no MEIO do nome oficial.
 *
 * O SALDO É ANOTAÇÃO, NÃO FILTRO. Modelo sem unidade no CD aparece na lista com
 * o rótulo "sem estoque" — e é justamente ele que a loja precisa pedir. Antes
 * desta versão a lista vinha dos chassis em pátio, então pedir reposição de um
 * modelo esgotado era impossível.
 *
 * TEXTO LIVRE CONTINUA VALENDO. Se a loja digitar algo que não está no catálogo,
 * o valor é aceito e marcado como fora do catálogo. A integração pode estar
 * atrasada, e travar o pedido por causa disso pararia a operação — o CD confere
 * na separação de qualquer modo.
 */
export default function SeletorModelo({
    valor = '',
    onChange,
    catalogo = [],
    mostrarSaldo = true,
    mobile = false,
    required = false,
    className = '',
}) {
    const [busca, setBusca] = useState('');
    const [aberto, setAberto] = useState(false);
    const [destacado, setDestacado] = useState(0);

    const containerRef = useRef(null);
    const listaId = useId();

    // Fecha ao clicar fora. Sem isto a lista de um item fica aberta sobre o
    // formulário enquanto a pessoa preenche o resto da linha.
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

    const filtrados = useMemo(() => {
        const termo = busca.trim().toUpperCase();

        if (!termo) return catalogo;

        // Casa por pedaço em qualquer posição: "JEF" precisa achar
        // "XY150-8 - MOTO JEF S".
        return catalogo.filter((m) => m.nome.includes(termo));
    }, [busca, catalogo]);

    const noCatalogo = valor ? catalogo.some((m) => m.nome === valor) : true;

    const selecionar = (nome) => {
        onChange(nome);
        setBusca('');
        setAberto(false);
    };

    const aoDigitar = (e) => {
        const texto = e.target.value.toUpperCase();
        setBusca(texto);
        setDestacado(0);
        setAberto(true);
        // Texto livre vale: o que a pessoa digita já é o valor do campo, e a
        // lista abaixo é sugestão. Isso mantém o caminho de fuga de antes.
        onChange(texto);
    };

    const aoTeclar = (e) => {
        if (e.key === 'ArrowDown') {
            e.preventDefault();
            setAberto(true);
            setDestacado((i) => Math.min(i + 1, filtrados.length - 1));
            return;
        }

        if (e.key === 'ArrowUp') {
            e.preventDefault();
            setDestacado((i) => Math.max(i - 1, 0));
            return;
        }

        if (e.key === 'Enter' && aberto && filtrados[destacado]) {
            e.preventDefault();
            selecionar(filtrados[destacado].nome);
            return;
        }

        if (e.key === 'Escape') {
            setAberto(false);
            setBusca('');
        }
    };

    const classeInput = mobile
        ? 'w-full rounded-lg border-line-strong bg-surface-card py-3 pl-9 pr-9 text-base font-bold uppercase focus:border-brand-500 focus:ring-brand-500'
        : 'w-full rounded border-line-strong bg-surface-card py-1.5 pl-8 pr-8 text-sm font-bold uppercase focus:border-brand-500 focus:ring-brand-500';

    return (
        <div ref={containerRef} className={`relative ${className}`}>
            <MagnifyingGlassIcon
                className={`pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-content-muted ${mobile ? 'h-4 w-4' : 'h-3.5 w-3.5'}`}
            />

            <input
                type="text"
                role="combobox"
                aria-expanded={aberto}
                aria-controls={listaId}
                aria-autocomplete="list"
                autoComplete="off"
                required={required}
                placeholder={mobile ? 'Digite: jef, shi, jet…' : 'BUSCAR MODELO…'}
                value={aberto ? busca : valor}
                onChange={aoDigitar}
                onFocus={() => { setBusca(''); setAberto(true); }}
                onKeyDown={aoTeclar}
                className={classeInput}
            />

            <ChevronUpDownIcon
                className={`pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-content-muted ${mobile ? 'h-5 w-5' : 'h-4 w-4'}`}
            />

            {!aberto && valor && !noCatalogo && (
                <p className="mt-0.5 text-[10px] font-bold text-status-warning-fg">
                    Fora do catálogo — o CD vai conferir na separação.
                </p>
            )}

            {aberto && (
                <ul
                    id={listaId}
                    role="listbox"
                    className="absolute z-30 mt-1 max-h-72 w-full min-w-[17rem] overflow-y-auto rounded-xl border border-line bg-surface-card py-1 shadow-card-hover"
                >
                    {filtrados.length === 0 && (
                        <li className="px-3 py-2 text-xs text-content-muted">
                            Nenhum modelo do catálogo casa com “{busca}”. Você pode
                            enviar assim mesmo — o texto digitado será usado.
                        </li>
                    )}

                    {filtrados.map((modelo, i) => {
                        const selecionado = modelo.nome === valor;
                        const semEstoque = mostrarSaldo && modelo.disponivel_total === 0;

                        return (
                            <li key={modelo.nome} role="option" aria-selected={selecionado}>
                                <button
                                    type="button"
                                    onMouseEnter={() => setDestacado(i)}
                                    onClick={() => selecionar(modelo.nome)}
                                    className={`flex w-full items-center justify-between gap-3 px-3 py-2 text-left transition
                                        ${i === destacado ? 'bg-surface-sunken' : ''}`}
                                >
                                    <span className="flex min-w-0 items-center gap-1.5">
                                        {selecionado && (
                                            <CheckIcon className="h-3.5 w-3.5 shrink-0 text-brand-600" />
                                        )}
                                        <span className="truncate text-xs font-bold text-content-primary">
                                            {modelo.nome}
                                        </span>
                                    </span>

                                    {mostrarSaldo && (
                                        <span
                                            className={`shrink-0 rounded-md px-1.5 py-0.5 text-[10px] font-black uppercase tracking-wide ring-1 ring-inset
                                                ${semEstoque
                                                    ? 'bg-status-neutral-bg text-status-neutral-fg ring-status-neutral-solid/20'
                                                    : 'bg-status-success-bg text-status-success-fg ring-status-success-solid/20'}`}
                                        >
                                            {semEstoque ? 'sem estoque' : `${modelo.disponivel_total} no CD`}
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
