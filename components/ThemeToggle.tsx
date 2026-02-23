import React from 'react';
import { ThemePreference, useThemePreference } from '../utils/theme';

const OPTIONS: { value: ThemePreference; label: string; icon: string }[] = [
  { value: 'system', label: 'System', icon: 'devices' },
  { value: 'light', label: 'Light', icon: 'light_mode' },
  { value: 'dark', label: 'Dark', icon: 'dark_mode' },
];

interface ThemeToggleProps {
  compact?: boolean;
  showSystem?: boolean;
}

const ThemeToggle: React.FC<ThemeToggleProps> = ({ compact = false, showSystem = true }) => {
  const { preference, setPreference } = useThemePreference();
  const toggleOptions = showSystem ? OPTIONS : OPTIONS.filter((option) => option.value !== 'system');

  return (
    <div className={`inline-flex items-center gap-1 rounded-xl border border-border-default/50 bg-surface/60 backdrop-blur-sm p-1 ${compact ? 'text-[10px]' : 'text-xs'}`}>
      {toggleOptions.map((option) => {
        const active = preference === option.value;
        return (
          <button
            key={option.value}
            type="button"
            onClick={() => setPreference(option.value)}
            className={`inline-flex items-center gap-1 rounded-lg px-2 py-1.5 font-medium transition-colors ${
              active
                ? 'bg-white/10 text-text-primary'
                : 'text-text-tertiary hover:bg-white/5 hover:text-text-secondary'
            }`}
            aria-label={`Use ${option.label.toLowerCase()} theme`}
            title={`Use ${option.label.toLowerCase()} theme`}
          >
            <span className="material-icons text-sm">{option.icon}</span>
            {!compact && <span>{option.label}</span>}
          </button>
        );
      })}
    </div>
  );
};

export default ThemeToggle;
