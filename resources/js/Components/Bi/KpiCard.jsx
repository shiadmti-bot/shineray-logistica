export default function KpiCard({ title, value, icon, color = 'blue', helperText }) {
    const colorClasses = {
        blue: 'bg-blue-50 text-blue-600 border-blue-200',
        green: 'bg-green-50 text-green-600 border-green-200',
        red: 'bg-red-50 text-red-600 border-red-200',
        orange: 'bg-orange-50 text-orange-600 border-orange-200',
        purple: 'bg-purple-50 text-purple-600 border-purple-200',
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
