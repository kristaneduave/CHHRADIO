import React from 'react';

type ScreenStatusTone = 'info' | 'error' | 'success';

interface ScreenStatusNoticeProps {
  message: string;
  tone?: ScreenStatusTone;
  className?: string;
}

const TONE_STYLES: Record<ScreenStatusTone, string> = {
  info: 'border-cyan-500/20 bg-cyan-500/10 text-cyan-100',
  error: 'border-rose-500/20 bg-rose-500/10 text-rose-200',
  success: 'border-emerald-500/20 bg-emerald-500/10 text-emerald-100',
};

const ScreenStatusNotice: React.FC<ScreenStatusNoticeProps> = ({
  message,
  tone = 'info',
  className = '',
}) => {
  return (
    <div className={`rounded-[1.6rem] border p-4 text-sm ${TONE_STYLES[tone]} ${className}`.trim()}>
      {message}
    </div>
  );
};

export default ScreenStatusNotice;
