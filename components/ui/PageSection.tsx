import React from 'react';

interface PageSectionProps {
  children: React.ReactNode;
  className?: string;
}

const PageSection: React.FC<PageSectionProps> = ({ children, className = '' }) => {
  return (
    <section className={`rounded-[1.75rem] border border-white/10 bg-white/[0.03] p-4 shadow-[0_20px_60px_rgba(0,0,0,0.18)] backdrop-blur-xl sm:p-5 ${className}`.trim()}>
      {children}
    </section>
  );
};

export default PageSection;
