import React from 'react';

interface SkeletonProps {
    className?: string;
    variant?: 'rectangular' | 'circular' | 'text';
}

export const Skeleton: React.FC<SkeletonProps> = ({ className = '', variant = 'rectangular' }) => {
    // Use a subtle glass-like shimmer effect
    const baseClasses = 'animate-pulse bg-surface-alt/80 border border-white/5';

    let variantClasses = '';
    switch (variant) {
        case 'circular':
            variantClasses = 'rounded-full';
            break;
        case 'text':
            variantClasses = 'rounded-md h-4';
            break;
        case 'rectangular':
        default:
            variantClasses = 'rounded-2xl';
            break;
    }

    return (
        <div className={`${baseClasses} ${variantClasses} ${className}`} aria-hidden="true" />
    );
};
