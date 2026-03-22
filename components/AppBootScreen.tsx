import React from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import LoadingLogo from './LoadingLogo';

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
  statusLabel,
  phaseLabel,
  funMessage,
  mode = 'bootstrap',
  isComplete = false,
  messageKey,
  taskSummary,
}) => {
  const shouldReduceMotion = useReducedMotion();
  const normalizedProgress = Math.max(0, Math.min(100, progress));
  const progressWidth = `${normalizedProgress}%`;
  const computedMessageKey = messageKey || funMessage || 'boot-message';

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
                <div className="relative mx-auto flex h-24 w-24 items-center justify-center">
                  <motion.div
                    aria-hidden="true"
                    className="absolute inset-0 rounded-full border border-cyan-300/20"
                    animate={shouldReduceMotion ? { opacity: 0.7 } : { scale: [1, 1.08, 1], opacity: [0.35, 0.65, 0.35] }}
                    transition={{ duration: 2.8, repeat: Infinity, ease: 'easeInOut' }}
                  />
                  <motion.div
                    aria-hidden="true"
                    className="absolute inset-[10px] rounded-full bg-cyan-400/10 blur-xl"
                    animate={shouldReduceMotion ? { opacity: 0.45 } : { scale: [0.94, 1.1, 0.94], opacity: [0.25, 0.55, 0.25] }}
                    transition={{ duration: 3.2, repeat: Infinity, ease: 'easeInOut' }}
                  />
                  <motion.div
                    animate={shouldReduceMotion ? undefined : { y: [0, -4, 0] }}
                    transition={{ duration: 2.4, repeat: Infinity, ease: 'easeInOut' }}
                  >
                    <LoadingLogo sizeClass="h-14 w-14 sm:h-16 sm:w-16" className="drop-shadow-[0_0_28px_rgba(34,211,238,0.28)]" />
                  </motion.div>
                </div>
                <h1 className="mt-3 text-4xl font-black uppercase tracking-[0.16em] text-white sm:text-5xl">
                  RADCORE
                </h1>
                <p className="mt-3 text-[11px] font-bold uppercase tracking-[0.24em] text-cyan-300/85 sm:text-[13px]">
                  CHH Radiology Residency Portal
                </p>
              </div>

              <div className="mt-8 rounded-[1.65rem] border border-white/8 bg-black/25 px-4 py-4 sm:px-5">
                <div className="flex items-center justify-end gap-3">
                  <motion.span
                    className="text-xs font-bold uppercase tracking-[0.16em] text-slate-400"
                    key={`pct-${normalizedProgress}`}
                    initial={shouldReduceMotion ? { opacity: 1 } : { opacity: 0.75, scale: 0.96 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ duration: 0.22 }}
                  >
                    {normalizedProgress}%
                  </motion.span>
                </div>
                <div className="mt-4 h-3 overflow-hidden rounded-full border border-white/8 bg-white/6">
                  <motion.div
                    className="relative h-full rounded-full bg-[linear-gradient(90deg,rgba(34,211,238,0.9),rgba(59,130,246,0.95))]"
                    initial={false}
                    animate={{ width: progressWidth }}
                    transition={{ duration: shouldReduceMotion ? 0.2 : 0.45, ease: 'easeOut' }}
                  >
                    <motion.div
                      aria-hidden="true"
                      className="absolute inset-y-0 w-20 bg-[linear-gradient(90deg,transparent,rgba(255,255,255,0.35),transparent)]"
                      animate={shouldReduceMotion ? { opacity: 0 } : { x: ['-130%', '260%'] }}
                      transition={{ duration: 1.8, repeat: Infinity, ease: 'linear' }}
                    />
                  </motion.div>
                </div>

                <div className="mt-5 min-h-[5.5rem] rounded-[1.5rem] border border-cyan-400/10 bg-app/70 px-4 py-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
                  <AnimatePresence mode="wait">
                    <motion.p
                      key={computedMessageKey}
                      className="text-base font-semibold leading-relaxed text-cyan-50 sm:text-lg"
                      initial={shouldReduceMotion ? { opacity: 1 } : { opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, y: -8 }}
                      transition={{ duration: 0.24 }}
                    >
                      {funMessage}
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
