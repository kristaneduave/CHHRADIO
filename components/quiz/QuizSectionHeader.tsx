import React from 'react';

interface QuizSectionHeaderProps {
  title: string;
  description: string;
  onBack?: () => void;
  action?: React.ReactNode;
}

const QuizSectionHeader: React.FC<QuizSectionHeaderProps> = ({ title, description, onBack, action }) => {
  return (
    <div className="sticky top-0 z-20 -mx-4 border-b border-white/5 bg-[#08111a]/88 px-4 pb-4 pt-4 backdrop-blur-xl sm:-mx-6 sm:px-6 xl:mx-0 xl:rounded-3xl xl:border xl:border-white/5 xl:bg-white/[0.03] xl:p-4 xl:backdrop-blur-sm">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          {onBack ? (
            <button
              type="button"
              onClick={onBack}
              className="mb-4 inline-flex min-h-[44px] items-center gap-2 rounded-full border border-white/[0.05] bg-white/[0.02] px-4 text-sm font-semibold text-slate-200 transition hover:bg-white/[0.04] hover:text-white"
            >
              <span className="material-icons text-[18px]">arrow_back</span>
              Back
            </button>
          ) : null}
          <h2 className="text-[1.85rem] font-black tracking-tight text-white sm:text-[2.2rem]">{title}</h2>
          {description ? <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-400">{description}</p> : null}
        </div>
        {action ? <div className="shrink-0">{action}</div> : null}
      </div>
    </div>
  );
};

export default QuizSectionHeader;
