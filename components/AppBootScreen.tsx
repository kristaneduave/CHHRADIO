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
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(14,165,233,0.18),transparent_38%),radial-gradient(circle_at_bottom_left,rgba(56,189,248,0.12),transparent_34%),linear-gradient(180deg,rgba(2,6,23,0.92),rgba(6,11,22,1))]" />
      <motion.div
        aria-hidden="true"
        className="absolute -left-16 top-12 h-56 w-56 rounded-full bg-cyan-400/20 blur-3xl"
        animate={shouldReduceMotion ? { opacity: 0.35 } : { x: [0, 26, -10, 0], y: [0, -18, 12, 0], opacity: [0.32, 0.5, 0.36, 0.32] }}
        transition={{ duration: 14, repeat: Infinity, ease: 'easeInOut' }}
      />
      <motion.div
        aria-hidden="true"
        className="absolute right-[-3rem] top-[18%] h-72 w-72 rounded-full bg-blue-500/18 blur-3xl"
        animate={shouldReduceMotion ? { opacity: 0.3 } : { x: [0, -30, 8, 0], y: [0, 20, -14, 0], opacity: [0.28, 0.42, 0.3, 0.28] }}
        transition={{ duration: 16, repeat: Infinity, ease: 'easeInOut' }}
      />
      <div
        aria-hidden="true"
        className="absolute inset-0 opacity-[0.08]"
        style={{
          backgroundImage:
            'linear-gradient(rgba(148,163,184,0.22) 1px, transparent 1px), linear-gradient(90deg, rgba(148,163,184,0.18) 1px, transparent 1px)',
          backgroundSize: '32px 32px',
          maskImage: 'linear-gradient(180deg, rgba(0,0,0,0.55), transparent 90%)',
        }}
      />

      <div className="relative flex min-h-screen items-center justify-center px-6 py-10">
        <motion.div
          className="w-full max-w-lg"
          initial={shouldReduceMotion ? { opacity: 1 } : { opacity: 0, y: 24, scale: 0.985 }}
          animate={isComplete && !shouldReduceMotion ? { opacity: 1, y: -6, scale: 1.01 } : { opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: shouldReduceMotion ? 0.16 : 0.42, ease: 'easeOut' }}
        >
          <div className="relative overflow-hidden rounded-[2rem] border border-white/10 bg-white/[0.045] px-6 py-8 shadow-[0_24px_80px_rgba(0,0,0,0.42)] backdrop-blur-xl sm:px-7">
            <div className="absolute inset-0 bg-[linear-gradient(135deg,rgba(56,189,248,0.09),transparent_38%,rgba(59,130,246,0.08))]" />
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

                <div className="mt-5 min-h-[5.5rem] rounded-[1.5rem] border border-cyan-400/10 bg-[linear-gradient(135deg,rgba(34,211,238,0.08),rgba(255,255,255,0.02))] px-4 py-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
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
