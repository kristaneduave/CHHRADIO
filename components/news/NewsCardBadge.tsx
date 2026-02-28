import React from 'react';

interface NewsCardBadgeProps {
  label: string;
  className?: string;
}

const NewsCardBadge: React.FC<NewsCardBadgeProps> = ({ label, className = '' }) => {
  return (
    <span className={`inline-flex items-center rounded-md border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${className}`}>
      {label}
    </span>
  );
};

export default NewsCardBadge;
