import React from 'react';

interface TopRightCreateActionProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  label: string;
  icon: string;
  compact?: boolean;
}

const TopRightCreateAction: React.FC<TopRightCreateActionProps> = ({
  label,
  icon,
  compact = false,
  className = '',
  type = 'button',
  ...props
}) => {
  const sizeClass = compact ? 'px-3.5 py-2.5 text-[13px]' : 'px-4 py-3 text-sm';
  const iconClass = compact ? 'text-[17px]' : 'text-[18px]';

  return (
    <button
      type={type}
      className={`inline-flex items-center justify-center gap-2 rounded-2xl border border-cyan-300/20 bg-cyan-400/10 font-semibold text-cyan-50 shadow-[0_18px_50px_rgba(0,0,0,0.32)] backdrop-blur-md transition hover:bg-cyan-400/18 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/50 disabled:cursor-not-allowed disabled:opacity-50 ${sizeClass} ${className}`}
      {...props}
    >
      <span className={`material-icons ${iconClass}`} aria-hidden="true">{icon}</span>
      <span>{label}</span>
    </button>
  );
};

export default TopRightCreateAction;
