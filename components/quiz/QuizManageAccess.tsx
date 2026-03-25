import React from 'react';

interface QuizManageAccessProps {
  isOpen: boolean;
  onToggle: () => void;
}

const QuizManageAccess: React.FC<QuizManageAccessProps> = ({ isOpen, onToggle }) => {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-expanded={isOpen}
      className="inline-flex min-h-[44px] items-center gap-2 rounded-full border border-white/10 bg-white/[0.03] px-4 py-2 text-sm font-semibold text-slate-200 transition hover:border-white/20 hover:text-white"
    >
      <span className="material-icons text-[18px]">tune</span>
      {isOpen ? 'Close' : 'Manage'}
    </button>
  );
};

export default QuizManageAccess;
