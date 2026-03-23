import React from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';

interface AppBootScreenProps {
  progress: number;
  statusLabel: string;
  phaseLabel?: string;
  funMessage?: string;
  mode?: 'session' | 'bootstrap';
  isComplete?: boolean;
  messageKey?: string;
  taskSummary?: {
    completed: number;
    total: number;
  };
}

const AppBootScreen: React.FC<AppBootScreenProps> = ({
  progress,
  funMessage,
  mode = 'bootstrap',
  isComplete = false,
  messageKey,
}) => {
  const shouldReduceMotion = useReducedMotion();
  const normalizedProgress = Math.max(0, Math.min(100, progress));
  const displayProgressPct = Math.round(normalizedProgress);
  const progressWidth = `${normalizedProgress}%`;
  const glowWidth = `${Math.min(100, normalizedProgress + (isComplete ? 0 : normalizedProgress < 35 ? 6 : 10))}%`;
  const computedMessageKey = messageKey || funMessage || (mode === 'session' ? 'session:boot-message' : 'boot-message');
  const primaryMessage = funMessage || (mode === 'session'
    ? 'Checking session access and preparing a clean launch.'
    : 'Preparing your workspace and checking the launch path.');
  const isEarlyProgress = normalizedProgress < 35;
  const isLateProgress = normalizedProgress >= 85 || isComplete;
  const fillShadow = isComplete
    ? '0 0 22px rgba(89,124,255,0.36)'
    : isLateProgress
      ? '0 0 18px rgba(89,124,255,0.28)'
      : isEarlyProgress
        ? '0 0 10px rgba(34,211,238,0.16)'
        : '0 0 14px rgba(71,187,255,0.22)';

  return (
    <motion.div
      className="relative min-h-screen overflow-hidden bg-app text-text-primary"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, scale: 1.02 }}
      transition={{ duration: shouldReduceMotion ? 0.18 : 0.28, ease: 'easeOut' }}
    >
      <div
        aria-hidden="true"
        className="absolute inset-0 opacity-[0.05]"
        style={{
          backgroundImage:
            'linear-gradient(rgba(148,163,184,0.22) 1px, transparent 1px), linear-gradient(90deg, rgba(148,163,184,0.18) 1px, transparent 1px)',
          backgroundSize: '32px 32px',
        }}
      />

      <div className="relative flex min-h-screen items-center justify-center px-6 py-10">
        <motion.div
          className="w-full max-w-lg"
          initial={shouldReduceMotion ? { opacity: 1 } : { opacity: 0, y: 24, scale: 0.985 }}
          animate={isComplete && !shouldReduceMotion ? { opacity: 1, y: -6, scale: 1.01 } : { opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: shouldReduceMotion ? 0.16 : 0.42, ease: 'easeOut' }}
        >
          <div className="relative overflow-hidden rounded-[2rem] border border-white/10 bg-panel/95 px-6 py-8 shadow-[0_24px_80px_rgba(0,0,0,0.34)] backdrop-blur-xl sm:px-7">
            <div className="relative">
              <div className="text-center">
                <h1 className="text-4xl font-black uppercase tracking-[0.16em] text-white sm:text-5xl">
                  RADCORE
                </h1>
                <p className="mt-3 text-[11px] font-bold uppercase tracking-[0.24em] text-cyan-300/85 sm:text-[13px]">
                  CHH Radiology Residency Portal
                </p>
              </div>

              <div className="mt-8 rounded-[1.65rem] border border-white/8 bg-black/25 px-4 py-4 sm:px-5">
                <div className="relative">
                  <div className={`absolute inset-y-[2px] left-[2px] rounded-full blur-md transition-all duration-500 ${isEarlyProgress ? 'bg-cyan-400/12 opacity-40' : isLateProgress ? 'bg-blue-400/22 opacity-80' : 'bg-sky-400/16 opacity-60'}`} style={{ width: glowWidth }} />
                  <div className={`relative h-5 overflow-hidden rounded-full border ${isComplete ? 'border-cyan-300/30' : 'border-white/8'} bg-[#0a1018] shadow-[inset_0_1px_0_rgba(255,255,255,0.04),inset_0_-1px_0_rgba(2,6,23,0.32)]`}>
                    <div className="absolute inset-[1px] rounded-full bg-[linear-gradient(180deg,rgba(255,255,255,0.035),rgba(255,255,255,0.008))]" />
                    <motion.div
                      className="absolute inset-y-[1px] left-[1px] rounded-full bg-[linear-gradient(90deg,rgba(34,211,238,0.72),rgba(67,178,255,0.9),rgba(89,124,255,0.98))]"
                      style={{ boxShadow: fillShadow }}
                      initial={false}
                      animate={{ width: normalizedProgress > 0 ? `calc(${progressWidth} - 2px)` : '0%' }}
                      transition={{ duration: shouldReduceMotion ? 0.2 : 0.45, ease: 'easeOut' }}
                    >
                      <div className="absolute inset-0 rounded-full bg-[linear-gradient(180deg,rgba(255,255,255,0.2),rgba(255,255,255,0.03)_48%,transparent)]" />
                      <motion.div
                        aria-hidden="true"
                        className="absolute inset-y-0 right-0 w-8 rounded-full bg-[radial-gradient(circle_at_center,rgba(255,255,255,0.48),rgba(255,255,255,0.06)_62%,transparent_74%)]"
                        animate={shouldReduceMotion ? { opacity: isComplete ? 0.65 : 0.4 } : { opacity: isComplete ? [0.52, 0.68, 0.55] : [0.3, 0.5, 0.34], scale: isComplete ? [1, 1.02, 1] : [0.98, 1.02, 1] }}
                        transition={{ duration: isComplete ? 1.2 : 1.9, repeat: Infinity, ease: 'easeInOut' }}
                      />
                      <motion.div
                        aria-hidden="true"
                        className="absolute inset-y-0 w-16 bg-[linear-gradient(90deg,transparent,rgba(255,255,255,0.16),transparent)]"
                        animate={shouldReduceMotion || isComplete ? { opacity: 0 } : { x: ['-135%', '260%'], opacity: [0, 0.9, 0] }}
                        transition={{ duration: isLateProgress ? 2.35 : 1.85, repeat: Infinity, ease: 'linear' }}
                      />
                    </motion.div>
                    <motion.span
                      className={`absolute inset-y-0 right-3 flex items-center text-[0.62rem] font-bold leading-none tracking-[0.12em] ${
                        isComplete ? 'text-cyan-50/95' : 'text-slate-200/92'
                      }`}
                      key={`pct-${displayProgressPct}`}
                      initial={shouldReduceMotion ? { opacity: 1 } : { opacity: 0.75, scale: 0.96 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ duration: 0.22 }}
                    >
                      {displayProgressPct}%
                    </motion.span>
                  </div>
                </div>

                <div className="mt-3 min-w-0">
                  <AnimatePresence mode="wait">
                    <motion.p
                      key={computedMessageKey}
                      className="text-[0.78rem] font-semibold leading-5 text-slate-100 sm:text-[0.84rem]"
                      style={{
                        display: '-webkit-box',
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: 'vertical',
                        overflow: 'hidden',
                      }}
                      initial={shouldReduceMotion ? { opacity: 1 } : { opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, y: -8 }}
                      transition={{ duration: 0.24 }}
                    >
                      {primaryMessage}
                    </motion.p>
                  </AnimatePresence>
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </motion.div>
  );
};

export default AppBootScreen;
