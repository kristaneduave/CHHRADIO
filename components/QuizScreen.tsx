
import React, { useState, useEffect } from 'react';
import { generateMedicalQuiz } from '../services/geminiService';
import { SPECIALTIES } from '../constants';

interface Question {
  question: string;
  options: string[];
  correctAnswer: number;
}

const QuizScreen: React.FC = () => {
  const [questions, setQuestions] = useState<Question[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [score, setScore] = useState(0);
  const [isFinished, setIsFinished] = useState(false);
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [selectedSpecialty, setSelectedSpecialty] = useState('Neuroradiology');

  useEffect(() => {
    loadQuiz(selectedSpecialty);
  }, []);

  const loadQuiz = async (specialty: string) => {
    setIsLoading(true);
    setQuestions([]);
    setIsFinished(false);
    setCurrentIndex(0);
    setScore(0);
    setSelectedOption(null);
    
    const data = await generateMedicalQuiz(specialty);
    if (data) setQuestions(data);
    setIsLoading(false);
  };

  const handleSpecialtyChange = (specialty: string) => {
    setSelectedSpecialty(specialty);
    loadQuiz(specialty);
  };

  const handleNext = () => {
    if (selectedOption === questions[currentIndex].correctAnswer) {
      setScore(score + 1);
    }

    if (currentIndex < questions.length - 1) {
      setCurrentIndex(currentIndex + 1);
      setSelectedOption(null);
    } else {
      setIsFinished(true);
    }
  };

  return (
    <div className="px-6 pt-12 flex flex-col h-full animate-in fade-in duration-500">
      <header className="mb-6">
        <h1 className="text-2xl font-bold text-white mb-1">Medical Quiz</h1>
        <p className="text-slate-400 text-xs">Challenge your clinical expertise</p>
      </header>

      {/* Specialty Filter */}
      <div className="flex gap-2 overflow-x-auto pb-4 no-scrollbar -mx-2 px-2 mb-4">
        {SPECIALTIES.map(spec => (
          <button
            key={spec}
            onClick={() => handleSpecialtyChange(spec)}
            disabled={isLoading}
            className={`whitespace-nowrap px-4 py-2 rounded-full text-[10px] font-bold uppercase tracking-wider transition-all border ${
              selectedSpecialty === spec 
                ? 'bg-primary border-primary text-white shadow-[0_0_15px_rgba(13,162,231,0.3)]' 
                : 'bg-white/5 border-white/10 text-slate-500 hover:text-white'
            } disabled:opacity-50`}
          >
            {spec}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="flex-1 flex flex-col items-center justify-center p-6 space-y-4">
          <div className="relative">
            <div className="w-16 h-16 border-4 border-white/5 border-t-primary rounded-full animate-spin"></div>
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="material-icons text-primary/40 animate-pulse">psychology</span>
            </div>
          </div>
          <div className="text-center">
            <p className="text-white text-sm font-semibold">Generating questions...</p>
            <p className="text-slate-500 text-xs mt-1">Sourcing {selectedSpecialty} case studies</p>
          </div>
        </div>
      ) : isFinished ? (
        <div className="flex-1 flex flex-col items-center justify-center text-center animate-in zoom-in-95 duration-500">
          <div className="relative inline-block mb-8">
            <div className="absolute -inset-4 bg-emerald-500/20 rounded-full blur-xl animate-pulse"></div>
            <div className="relative inline-flex p-6 rounded-full bg-emerald-500/20 text-emerald-500 border border-emerald-500/30">
              <span className="material-icons text-6xl">emoji_events</span>
            </div>
            <div className="absolute -top-2 -right-2 bg-primary text-white text-[10px] font-bold px-2 py-1 rounded-full shadow-lg">
              +{score * 10} XP
            </div>
          </div>
          
          <h2 className="text-2xl font-bold text-white mb-2">Quiz Complete!</h2>
          <p className="text-slate-400 text-sm mb-8 px-8 leading-relaxed">
            Excellent work! You achieved a precision score of <span className="text-emerald-400 font-bold">{Math.round((score/questions.length)*100)}%</span> in <span className="text-primary font-semibold">{selectedSpecialty}</span>.
          </p>

          <div className="w-full space-y-3">
            <button 
              onClick={() => loadQuiz(selectedSpecialty)}
              className="w-full py-4 bg-primary text-white rounded-2xl font-bold hover:bg-primary-dark transition-all shadow-[0_10px_20px_-5px_rgba(13,162,231,0.4)] flex items-center justify-center gap-2"
            >
              <span className="material-icons text-lg">refresh</span>
              Try New Set
            </button>
            <button 
              onClick={() => {}} // Could navigate back or to leaderboard
              className="w-full py-4 glass-card-enhanced text-slate-300 rounded-2xl font-bold hover:text-white transition-all"
            >
              Review Explanations
            </button>
          </div>
        </div>
      ) : (
        <div className="flex-1 flex flex-col animate-in slide-in-from-right-4 duration-500">
          <div className="flex justify-between items-center mb-6 px-1">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-primary animate-pulse"></span>
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                Question {currentIndex + 1} of {questions.length}
              </span>
            </div>
            <div className="h-1.5 w-24 bg-white/5 rounded-full overflow-hidden border border-white/5">
              <div 
                className="h-full bg-primary transition-all duration-500 ease-out shadow-[0_0_10px_rgba(13,162,231,0.5)]" 
                style={{ width: `${((currentIndex + 1) / questions.length) * 100}%` }}
              ></div>
            </div>
          </div>

          <div className="glass-card-enhanced p-6 rounded-2xl mb-8 border border-white/10 shadow-2xl">
            <h2 className="text-lg font-semibold text-white leading-relaxed">
              {questions[currentIndex]?.question}
            </h2>
          </div>

          <div className="space-y-3 flex-1">
            {questions[currentIndex]?.options.map((option, idx) => (
              <button
                key={idx}
                onClick={() => setSelectedOption(idx)}
                className={`w-full p-4 rounded-2xl text-left transition-all border group relative overflow-hidden ${
                  selectedOption === idx 
                    ? 'bg-primary/10 border-primary shadow-[inset_0_0_20px_rgba(13,162,231,0.1)]' 
                    : 'glass-card-enhanced border-white/5 text-slate-400 hover:border-white/20 hover:bg-white/[0.04]'
                }`}
              >
                <div className="flex items-center gap-4 relative z-10">
                  <span className={`w-10 h-10 rounded-xl flex items-center justify-center text-xs font-bold border transition-all ${
                    selectedOption === idx 
                      ? 'bg-primary text-white border-primary shadow-lg scale-110' 
                      : 'bg-white/5 border-white/10 text-slate-500 group-hover:border-primary/40 group-hover:text-primary'
                  }`}>
                    {String.fromCharCode(65 + idx)}
                  </span>
                  <span className={`text-sm font-medium transition-colors ${selectedOption === idx ? 'text-white' : 'group-hover:text-slate-200'}`}>
                    {option}
                  </span>
                </div>
                {selectedOption === idx && (
                  <div className="absolute right-4 top-1/2 -translate-y-1/2 animate-in zoom-in duration-300">
                    <span className="material-icons text-primary/40 text-2xl">check_circle</span>
                  </div>
                )}
              </button>
            ))}
          </div>

          <button
            disabled={selectedOption === null}
            onClick={handleNext}
            className="mt-8 mb-6 py-4 bg-primary hover:bg-primary-dark text-white rounded-2xl font-bold transition-all shadow-[0_10px_20px_-5px_rgba(13,162,231,0.4)] disabled:opacity-50 disabled:grayscale disabled:cursor-not-allowed flex items-center justify-center gap-2 group"
          >
            {currentIndex === questions.length - 1 ? 'Finalize Quiz' : 'Submit & Continue'}
            <span className="material-icons text-lg group-hover:translate-x-1 transition-transform">
              {currentIndex === questions.length - 1 ? 'done_all' : 'arrow_forward'}
            </span>
          </button>
        </div>
      )}
    </div>
  );
};

export default QuizScreen;
