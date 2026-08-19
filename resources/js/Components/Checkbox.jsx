export default function Checkbox({ className = '', ...props }) {
    return (
        <input
            {...props}
            type="checkbox"
            className={
                'rounded border-line-strong text-status-info-fg shadow-sm focus:ring-brand-500 ' +
                className
            }
        />
    );
}
