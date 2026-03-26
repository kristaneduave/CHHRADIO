import React from 'react';
import QuizModeCard from './QuizModeCard';
import QuizManageAccess from './QuizManageAccess';

interface QuizLandingViewProps {
  canManage: boolean;
  manageOpen: boolean;
  onToggleManage: () => void;
  onOpenMcq: () => void;
  onOpenAuntMinnie: () => void;
}

const QuizLandingView: React.FC<QuizLandingViewProps> = ({
  canManage,
  manageOpen,
  onToggleManage,
  onOpenMcq,
  onOpenAuntMinnie,
}) => {
  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-[2.15rem] font-black tracking-tight text-white sm:text-[2.55rem]">Quiz Lab</h1>
        </div>
        {canManage ? (
          <div className="shrink-0">
            <QuizManageAccess isOpen={manageOpen} onToggle={onToggleManage} />
          </div>
        ) : null}
      </div>

      <div className="grid grid-cols-1 gap-3 xl:grid-cols-2 xl:gap-4">
        <QuizModeCard
          title="Aunt Minnie"
          detail="Live image rounds"
          accent="warm"
          icon="frame_inspect"
          onClick={onOpenAuntMinnie}
        />
        <QuizModeCard
          title="Multiple Choice Exam"
          detail="Timed exams and review"
          accent="cool"
          icon="fact_check"
          onClick={onOpenMcq}
        />
      </div>

      <div
        aria-hidden="true"
        className="xl:hidden"
        style={{ height: 'var(--mobile-bottom-nav-clearance)' }}
      />
    </div>
  );
};

export default QuizLandingView;
