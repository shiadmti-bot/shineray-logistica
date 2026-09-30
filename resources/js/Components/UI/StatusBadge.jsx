import { resolveStatus, TONE_CLASSES, TONE_DOT } from './statusMap';

/**
 * Selo de status. Única forma de exibir status no sistema — o mapeamento
 * status -> cor/rótulo vive em statusMap.js.
 *
 * @param {string}  status  chave crua do backend ('em_transito')
 * @param {'sm'|'md'} size
 * @param {boolean} dot     ponto colorido à esquerda
 */
export default function StatusBadge({ status, size = 'md', dot = true, className = '' }) {
    const { label, tone } = resolveStatus(status);

    const sizes = {
        sm: 'px-2 py-0.5 text-[11px] gap-1',
        md: 'px-2.5 py-1 text-xs gap-1.5',
    };

    return (
        <span
            className={`inline-flex items-center rounded-full font-semibold ring-1 ring-inset whitespace-nowrap
                ${TONE_CLASSES[tone]} ${sizes[size]} ${className}`}
        >
            {dot && <span className={`h-1.5 w-1.5 rounded-full ${TONE_DOT[tone]}`} />}
            {label}
        </span>
    );
}
