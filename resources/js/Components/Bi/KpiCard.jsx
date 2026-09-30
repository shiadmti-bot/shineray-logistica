export default function KpiCard({ title, value, icon, color = 'blue', helperText }) {
    const colorClasses = {
        blue: 'bg-status-info-bg text-status-info-fg border-status-info-solid/30',
        green: 'bg-status-success-bg text-status-success-fg border-status-success-solid/30',
        red: 'bg-status-danger-bg text-status-danger-fg border-status-danger-solid/30',
        orange: 'bg-status-warning-bg text-status-warning-fg border-status-warning-solid/30',
        purple: 'bg-brand-50 text-brand-600 border-brand-600/30',
    };

    const currentTheme = colorClasses[color] || colorClasses.blue;

    return (
        <div className={`p-6 rounded-2xl border ${currentTheme} shadow-sm hover:shadow-md transition-shadow relative overflow-hidden`}>
            <div className="flex justify-between items-start relative z-10">
                <div>
                    <p className="text-sm font-bold uppercase tracking-wide opacity-80 mb-1">{title}</p>
                    <h3 className="text-3xl font-black">{value}</h3>
                    {helperText && <p className="text-xs mt-2 opacity-75 font-medium">{helperText}</p>}
                </div>
                {icon && <div className="p-3 bg-white/50 rounded-lg backdrop-blur-sm shadow-sm">{icon}</div>}
            </div>
            
            {/* Decorativo de Fundo */}
            <div className={`absolute -bottom-6 -right-6 w-24 h-24 rounded-full opacity-10 bg-current pointer-events-none`}></div>
        </div>
    );
}
