import React from 'react';

interface QuizModeCardProps {
  title: string;
  detail: string;
  accent: 'warm' | 'cool';
  icon: string;
  onClick: () => void;
  disabled?: boolean;
}

const ACCENT_STYLES = {
  warm: {
    shell: 'border-amber-400/12 bg-white/[0.03] hover:bg-white/[0.04]',
    icon: 'border-amber-400/18 bg-amber-500/[0.08] text-amber-200',
  },
  cool: {
    shell: 'border-cyan-400/12 bg-white/[0.03] hover:bg-white/[0.04]',
    icon: 'border-cyan-400/18 bg-cyan-500/[0.08] text-cyan-100',
  },
} as const;

const QuizModeCard: React.FC<QuizModeCardProps> = ({
  title,
  detail,
  accent,
  icon,
  onClick,
  disabled = false,
}) => {
  const styles = ACCENT_STYLES[accent];

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`group block h-auto min-h-[168px] w-full shrink-0 rounded-3xl border p-5 text-left align-top backdrop-blur-sm transition hover:-translate-y-0.5 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-50 sm:p-6 ${styles.shell}`}
    >
      <div className="flex h-full flex-col justify-between gap-8">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <h3 className="text-[1.6rem] font-black tracking-tight text-white sm:text-[1.85rem]">{title}</h3>
            <p className="mt-3 max-w-[24rem] text-sm leading-6 text-slate-400">{detail}</p>
          </div>
          <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border ${styles.icon}`}>
            <span className="material-icons text-[21px]">{icon}</span>
          </div>
        </div>

        <div className="flex items-center justify-end">
          <span className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-white/[0.05] bg-white/[0.02] text-white transition group-hover:bg-white/[0.04]">
            <span className="material-icons text-[18px]">arrow_forward</span>
          </span>
        </div>
      </div>
    </button>
  );
};

export default QuizModeCard;
