import React from 'react';

interface LoadingButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  isLoading?: boolean;
  loadingText?: string;
  icon?: string;
}

const LoadingButton: React.FC<LoadingButtonProps> = ({
  isLoading = false,
  loadingText = 'Loading...',
  icon,
  children,
  className = '',
  disabled,
  ...props
}) => {
  return (
    <button
      {...props}
      disabled={Boolean(disabled || isLoading)}
      className={className}
    >
      {isLoading ? (
        <span className="inline-flex items-center gap-2">
          <span className="material-icons animate-spin text-sm">sync</span>
          <span>{loadingText}</span>
        </span>
      ) : (
        <span className="inline-flex items-center gap-2">
          <span>{children}</span>
          {icon ? <span className="material-icons text-sm">{icon}</span> : null}
        </span>
      )}
    </button>
  );
};

export default LoadingButton;

