import React from 'react';
import { ScreenLayoutMode } from '../layout/screenLayoutConfig';

interface PageShellProps {
  children: React.ReactNode;
  layoutMode?: ScreenLayoutMode;
  className?: string;
  contentClassName?: string;
  noBottomPadding?: boolean;
}

const WIDTH_CLASS_MAP: Record<ScreenLayoutMode, string> = {
  narrow: 'max-w-2xl',
  content: 'max-w-5xl',
  split: 'max-w-6xl',
  wide: 'max-w-7xl',
};

const PageShell: React.FC<PageShellProps> = ({
  children,
  layoutMode = 'content',
  className = '',
  contentClassName = '',
  noBottomPadding = false,
}) => {
  const widthClassName = WIDTH_CLASS_MAP[layoutMode];

  return (
    <div className={`relative min-h-full bg-transparent text-text-primary ${noBottomPadding ? '' : 'mobile-nav-clearance xl:pb-10'} ${className}`.trim()}>
      <div className={`mx-auto w-full ${widthClassName} px-4 pt-6 sm:px-6 xl:px-8 ${contentClassName}`.trim()}>
        {children}
      </div>
    </div>
  );
};

export default PageShell;
