import React from 'react';
import { QuizListItem } from '../../types';
import QuizCard from './QuizCard';

interface QuizLibraryProps {
  quizzes: QuizListItem[];
  onStart: (quiz: QuizListItem) => void;
}

const QuizLibrary: React.FC<QuizLibraryProps> = ({ quizzes, onStart }) => {
  if (quizzes.length === 0) {
    return (
      <div className="rounded-[2rem] border border-white/10 bg-white/[0.03] p-8 text-center backdrop-blur-xl">
        <h3 className="text-lg font-bold text-white">No published quizzes yet</h3>
        <p className="mt-2 text-sm leading-6 text-slate-400">Once faculty publish an assessment, residents will see it here with its open window and timing rules.</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-4 xl:grid-cols-2 xl:gap-5">
      {quizzes.map((quiz) => (
        <QuizCard key={quiz.id} quiz={quiz} onStart={onStart} />
      ))}
    </div>
  );
};

export default QuizLibrary;
