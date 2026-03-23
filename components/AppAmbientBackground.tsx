import React from 'react';

interface AppAmbientBackgroundProps {
  className?: string;
}

const AppAmbientBackground: React.FC<AppAmbientBackgroundProps> = ({ className = '' }) => {
  return (
    <div
      aria-hidden="true"
      data-testid="app-ambient-background"
      className={`pointer-events-none fixed inset-0 overflow-hidden ${className}`.trim()}
    >
      <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(7,12,18,0.16),rgba(7,12,18,0.02)_18%,rgba(7,12,18,0.08)_100%)]" />
      <div
        className="absolute inset-0 opacity-[0.055]"
        style={{
          backgroundImage:
            'linear-gradient(rgba(148,163,184,0.22) 1px, transparent 1px), linear-gradient(90deg, rgba(148,163,184,0.18) 1px, transparent 1px)',
          backgroundSize: '32px 32px',
        }}
      />
      <div className="absolute inset-0 opacity-[0.035] bg-[radial-gradient(circle_at_20%_16%,rgba(56,189,248,0.2),transparent_28%),radial-gradient(circle_at_78%_22%,rgba(59,130,246,0.12),transparent_26%),radial-gradient(circle_at_50%_78%,rgba(125,211,252,0.1),transparent_24%)]" />
    </div>
  );
};

export default AppAmbientBackground;
