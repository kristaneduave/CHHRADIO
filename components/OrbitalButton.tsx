import React from 'react';
import { motion } from 'framer-motion';

export interface ActionConfig {
    label: string;
    target: string;
    icon: string;
}

interface OrbitalButtonProps {
    action: ActionConfig;
    index: number;
    totalElements: number;
    radius: number;
    onClick: () => void;
    onHover?: () => void;
    onHoverEnd?: () => void;
    isLogoSyncing?: boolean;
    displayLabel: string;
    styleConfig: {
        colorClass: string;
        bgClass: string;
        borderClass: string;
        shadowClass: string;
    };
}

export const OrbitalButton: React.FC<OrbitalButtonProps> = ({
    action,
    index,
    totalElements,
    radius,
    onClick,
    onHover,
    onHoverEnd,
    isLogoSyncing,
    displayLabel,
    styleConfig
}) => {
    const angle = (index * (360 / totalElements)) - 90; // Start Top (-90deg)

    // Calculate final X and Y based on angle and radius
    const angleInRad = (angle * Math.PI) / 180;
    const x = Math.cos(angleInRad) * radius;
    const y = Math.sin(angleInRad) * radius;

    return (
        <motion.div
            initial={{
                opacity: 0,
                scale: 0.8,
                x: x * 0.8,
                y: y * 0.8,
                filter: 'drop-shadow(0 0 0 transparent)'
            }}
            animate={{
                opacity: 1,
                scale: 1,
                x: [x * 0.8, x * 1.02, x * 0.99, x],
                y: [y * 0.8, y * 1.02, y * 0.99, y],
                filter: [
                    'drop-shadow(0 0 0 transparent)',
                    'drop-shadow(4px 0 0 rgba(239, 68, 68, 0.6)) drop-shadow(-4px 0 0 rgba(34, 211, 238, 0.6))',
                    'drop-shadow(-4px 0 0 rgba(239, 68, 68, 0.6)) drop-shadow(4px 0 0 rgba(34, 211, 238, 0.6))',
                    'drop-shadow(2px 0 0 rgba(239, 68, 68, 0.6)) drop-shadow(-2px 0 0 rgba(34, 211, 238, 0.6))',
                    'drop-shadow(0 0 0 transparent)'
                ]
            }}
            transition={{
                duration: 1.2,
                delay: index * 0.1,
                ease: "easeOut",
                x: { duration: 1.2, times: [0, 0.6, 0.8, 1], ease: "easeOut" },
                y: { duration: 1.2, times: [0, 0.6, 0.8, 1], ease: "easeOut" },
                filter: { duration: 0.8, delay: index * 0.1 + 0.2, times: [0, 0.25, 0.5, 0.75, 1], ease: "linear" }
            }}
            className="absolute inset-0 m-auto w-[72px] h-[72px] z-30"
        >
            <button
                onClick={onClick}
                onMouseEnter={onHover}
                onMouseLeave={onHoverEnd}
                className="w-full h-full rounded-full flex flex-col items-center justify-center group transform transition-transform duration-300 hover:scale-[1.12] active:scale-95 select-none"
            >
                <div className={`w-[60px] h-[60px] rounded-full flex items-center justify-center border-2 ${isLogoSyncing ? 'bg-white/5 border-cyan-500/30 shadow-[0_0_10px_rgba(34,211,238,0.3)]' : `${styleConfig.bgClass} ${styleConfig.borderClass} ${styleConfig.shadowClass}`} backdrop-blur-md group-hover:bg-white/10 transition-all duration-300`}>
                    <span className={`material-icons text-[30px] transition-colors duration-300 ${isLogoSyncing ? 'animate-glitch brightness-150 drop-shadow-[0_0_8px_rgba(255,255,255,0.8)] text-white' : styleConfig.colorClass}`}>
                        {action.icon}
                    </span>
                </div>
                {/* Custom Label Layout */}
                <div className="absolute -bottom-5 w-28 text-center pointer-events-none">
                    <span className={`text-[10px] sm:text-[11px] font-bold tracking-widest uppercase transition-colors duration-500 block leading-tight drop-shadow-md ${isLogoSyncing ? 'animate-glitch text-cyan-200' : 'text-slate-300 group-hover:text-white'}`}>
                        {displayLabel}
                    </span>
                </div>
            </button>
        </motion.div>
    );
};
