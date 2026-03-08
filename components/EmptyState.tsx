import React from 'react';

interface EmptyStateProps {
    icon: string;
    title: string;
    description?: string;
    action?: React.ReactNode;
    compact?: boolean;
}

const EmptyState: React.FC<EmptyStateProps> = ({ icon, title, description, action, compact }) => {
    return (
        <div className={`flex flex-col items-center justify-center text-center animate-in fade-in slide-in-from-bottom-4 duration-500 ${compact ? 'py-8' : 'py-16'}`}>
            <div className="relative mb-5 group animate-[levitate_4s_ease-in-out_infinite]">
                <div className="absolute inset-0 bg-primary/20 blur-xl rounded-full opacity-50 group-hover:opacity-100 transition-opacity duration-700 pointer-events-none animate-pulse" />
                <div className="w-16 h-16 rounded-2xl bg-white/[0.03] border border-white/10 flex items-center justify-center shadow-inner relative z-10 backdrop-blur-md">
                    <span className="material-icons text-4xl text-slate-400 group-hover:text-primary-light transition-colors duration-500">
                        {icon}
                    </span>
                </div>
            </div>

            <h3 className={`font-bold text-white tracking-tight mb-2 ${compact ? 'text-base' : 'text-lg'}`}>
                {title}
            </h3>

            {description && (
                <p className={`text-slate-400 max-w-[260px] mx-auto leading-relaxed ${compact ? 'text-xs' : 'text-sm mb-6'}`}>
                    {description}
                </p>
            )}

            {action && (
                <div className={`${compact ? 'mt-4' : ''}`}>
                    {action}
                </div>
            )}
        </div>
    );
};

export default EmptyState;
