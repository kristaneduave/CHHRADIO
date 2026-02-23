import React from 'react';
import LoadingLogo from './LoadingLogo';

interface LoadingStateProps {
  title?: string;
  subtitle?: string;
  compact?: boolean;
}

const LoadingState: React.FC<LoadingStateProps> = ({
  title = 'Loading...',
  subtitle,
  compact = false,
}) => {
  return (
    <div className={`flex flex-col items-center justify-center text-center text-slate-400 ${compact ? 'py-8' : 'py-16'}`}>
      <div className="relative mb-3">
        <LoadingLogo sizeClass={compact ? 'h-10 w-10' : 'h-12 w-12'} />
      </div>
      <p className={`${compact ? 'text-xs' : 'text-sm'} font-medium text-slate-300`}>{title}</p>
      {subtitle ? <p className="mt-1 text-xs text-slate-500">{subtitle}</p> : null}
    </div>
  );
};

export default LoadingState;
