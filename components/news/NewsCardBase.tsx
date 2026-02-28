import React from 'react';

interface NewsCardBaseProps {
  children: React.ReactNode;
  isElevated?: boolean;
  className?: string;
  onClick?: () => void;
}

const NewsCardBase: React.FC<NewsCardBaseProps> = ({ children, isElevated = false, className = '', onClick }) => {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`group relative w-full overflow-visible rounded-2xl px-4 py-4 text-left transition-all duration-300 ${isElevated ? 'z-40' : 'z-0'} ${className}`}
    >
      {children}
    </button>
  );
};

export default NewsCardBase;
