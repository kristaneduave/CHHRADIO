import React from 'react';

interface InlinePillGroupProps<T extends string> {
  options: T[];
  value: T;
  onChange: (value: T) => void;
  getLabel?: (value: T) => string;
  className?: string;
}

const InlinePillGroup = <T extends string>({
  options,
  value,
  onChange,
  getLabel,
  className = '',
}: InlinePillGroupProps<T>) => {
  return (
    <div className={`flex flex-wrap gap-2 ${className}`.trim()}>
      {options.map((option) => {
        const active = option === value;
        return (
          <button
            key={option}
            type="button"
            onClick={() => onChange(option)}
            className={`rounded-full border px-3 py-2 text-xs font-semibold transition ${
              active
                ? 'border-cyan-400/30 bg-cyan-500/12 text-cyan-50'
                : 'border-white/10 bg-white/5 text-slate-300 hover:border-white/20 hover:bg-white/10 hover:text-white'
            }`}
          >
            {getLabel ? getLabel(option) : option}
          </button>
        );
      })}
    </div>
  );
};

export default InlinePillGroup;
