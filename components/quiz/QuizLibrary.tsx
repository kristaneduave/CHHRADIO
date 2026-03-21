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
      <div className="glass-card-enhanced rounded-3xl border border-white/10 p-8 text-center">
        <h3 className="text-lg font-bold text-white">No published quizzes yet</h3>
        <p className="text-sm text-slate-400 mt-2">Once faculty publish an assessment, residents will see it here with its open window and timing rules.</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
      {quizzes.map((quiz) => (
        <QuizCard key={quiz.id} quiz={quiz} onStart={onStart} />
      ))}
    </div>
  );
};

export default QuizLibrary;
